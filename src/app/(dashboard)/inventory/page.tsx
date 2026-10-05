import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { InventoryWorkspace, InventoryItem } from "@/components/inventory/inventory-workspace";

export const dynamic = "force-dynamic";

interface InventoryPageProps {
  searchParams?: {
    branchId?: string;
  };
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Branch scoping: strictly defaults to user active branch for all roles including owner
  const selectedBranchId =
    user.isOwner && searchParams?.branchId
      ? searchParams.branchId
      : user.activeBranchId;

  // Active branch details
  const activeBranch = await db.branch.findUnique({
    where: { id: selectedBranchId },
  });

  const allBranches = user.isOwner
    ? await db.branch.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Fetch branch products for the active branch
  const branchProducts = await db.branchProduct.findMany({
    where: {
      branchId: selectedBranchId,
      status: "ACTIVE",
    },
    include: {
      product: true,
      branch: true,
    },
    orderBy: {
      product: { name: "asc" },
    },
  });

  // Fetch latest movements for this branch
  const recentMovements = await db.inventoryMovement.findMany({
    where: {
      branchId: selectedBranchId,
    },
    include: {
      employee: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  // Group movements by productId
  const movementsByProduct = new Map<string, typeof recentMovements>();
  for (const mov of recentMovements) {
    const list = movementsByProduct.get(mov.productId) || [];
    list.push(mov);
    movementsByProduct.set(mov.productId, list);
  }

  const items: InventoryItem[] = branchProducts.map((bp) => {
    const pMovements = movementsByProduct.get(bp.productId) || [];
    return {
      id: bp.id,
      productId: bp.productId,
      name: bp.product.name,
      sku: bp.product.sku,
      category: bp.product.category,
      inventoryUnit: bp.product.inventoryUnit,
      bulkUnit: bp.product.bulkUnit || bp.product.inventoryUnit || "CRATE",
      pieceUnit: bp.product.pieceUnit || "PIECE",
      piecesPerBulk: bp.product.piecesPerBulk || 1,
      sellingPrice: Number(bp.sellingPrice),
      piecePrice: bp.piecePrice ? Number(bp.piecePrice) : null,
      currentStock: bp.currentStock,
      reorderLevel: bp.reorderLevel,
      movements: pMovements.slice(0, 10).map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        createdAt: m.createdAt.toISOString(),
        employeeName: `${m.employee.firstName} ${m.employee.lastName}`,
      })),
    };
  });

  return (
    <AppShell user={user}>
      <InventoryWorkspace
        branchName={activeBranch?.name || user.activeBranchName}
        branchCode={activeBranch?.code || user.activeBranchCode}
        userRole={user.role}
        items={items}
        isOwner={user.isOwner}
        branches={allBranches}
        selectedBranchId={selectedBranchId}
      />
    </AppShell>
  );
}
