import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import {
  TransfersWorkspace,
  TransferRecord,
  AvailableProduct,
  TargetBranch,
} from "@/components/transfers/transfers-workspace";

export const dynamic = "force-dynamic";

interface TransfersPageProps {
  searchParams?: {
    branchId?: string;
    window?: string;
  };
}

export default async function TransfersPage({ searchParams }: TransfersPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Branch scoping: defaults strictly to active branch for all roles including owner
  const selectedBranchId =
    searchParams?.branchId !== undefined
      ? searchParams.branchId
      : user.activeBranchId;
  const isConsolidated = user.isOwner && selectedBranchId === "ALL";

  // Window duration filter: defaults strictly to 24 hours for delicate inventory movements
  const rawWindow = searchParams?.window || "24h";
  const validWindows = ["24h", "7d", "30d", "all"];
  const activeWindow = validWindows.includes(rawWindow) ? rawWindow : "24h";

  // Active branch details
  const activeBranch = await db.branch.findUnique({
    where: { id: user.activeBranchId },
  });

  // All active branches for transfer destination selection & owner switcher
  const allBranches = await db.branch.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  // Products available in current branch
  const branchProducts = await db.branchProduct.findMany({
    where: {
      branchId: user.activeBranchId,
      status: "ACTIVE",
    },
    include: {
      product: true,
    },
    orderBy: {
      product: { name: "asc" },
    },
  });

  const availableProducts: AvailableProduct[] = branchProducts.map((bp) => ({
    id: bp.productId,
    name: bp.product.name,
    sku: bp.product.sku,
    currentStock: bp.currentStock,
    inventoryUnit: bp.product.inventoryUnit,
    bulkUnit: bp.product.bulkUnit || bp.product.inventoryUnit || "CRATE",
    pieceUnit: bp.product.pieceUnit || "PIECE",
    piecesPerBulk: bp.product.piecesPerBulk || 1,
  }));

  // Build query filter
  const whereClause: any = {};
  if (!isConsolidated) {
    whereClause.OR = [
      { sourceBranchId: selectedBranchId },
      { destinationBranchId: selectedBranchId },
    ];
  }

  const now = new Date();
  if (activeWindow === "24h") {
    whereClause.createdAt = { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
  } else if (activeWindow === "7d") {
    whereClause.createdAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  } else if (activeWindow === "30d") {
    whereClause.createdAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }

  // Fetch transfers scoped to active branch and 24h default
  const rawTransfers = await db.stockTransfer.findMany({
    where: whereClause,
    include: {
      sourceBranch: true,
      destinationBranch: true,
      employee: true,
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const initialTransfers: TransferRecord[] = rawTransfers.map((t) => ({
    id: t.id,
    referenceNumber: t.referenceNumber,
    sourceBranchId: t.sourceBranchId,
    sourceBranchName: t.sourceBranch.name,
    sourceBranchCode: t.sourceBranch.code,
    destinationBranchId: t.destinationBranchId,
    destinationBranchName: t.destinationBranch.name,
    destinationBranchCode: t.destinationBranch.code,
    employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
    reason: t.reason,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    items: t.items.map((i) => ({
      productId: i.productId,
      productName: i.product.name,
      productSku: i.product.sku,
      quantity: i.quantity,
      unit: i.unitName || i.product.inventoryUnit,
      unitType: i.unitType || "BULK",
      piecesTransferred: i.piecesTransferred || i.quantity,
    })),
  }));

  const targetBranches: TargetBranch[] = allBranches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
  }));

  return (
    <AppShell user={user}>
      <TransfersWorkspace
        currentBranchId={user.activeBranchId}
        currentBranchName={activeBranch?.name || "Active Branch"}
        currentBranchCode={activeBranch?.code || "MAIN"}
        availableProducts={availableProducts}
        branches={targetBranches}
        initialTransfers={initialTransfers}
        isOwner={user.isOwner}
        activeWindow={activeWindow}
        selectedBranchId={selectedBranchId}
      />
    </AppShell>
  );
}
