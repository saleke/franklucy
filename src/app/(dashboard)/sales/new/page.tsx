import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { POSWorkspace } from "@/components/sales/pos-workspace";
import { getActiveCashSession } from "@/modules/reconciliation/cash-session.service";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Verify permission
  if (!["OWNER", "MANAGER", "CASHIER", "SALESPERSON"].includes(user.role)) {
    redirect("/today");
  }

  // Load branch products for current active branch
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

  const posProducts = branchProducts.map((bp) => ({
    id: bp.id,
    productId: bp.productId,
    name: bp.product.name,
    sku: bp.product.sku,
    category: bp.product.category,
    inventoryUnit: bp.product.inventoryUnit,
    bulkUnit: bp.product.bulkUnit || bp.product.inventoryUnit || "CRATE",
    pieceUnit: bp.product.pieceUnit || "PIECE",
    piecesPerBulk: bp.product.piecesPerBulk || 1,
    sellingPrice: Number(bp.sellingPrice.toString()),
    piecePrice: bp.piecePrice ? Number(bp.piecePrice.toString()) : null,
    currentStock: bp.currentStock,
    reorderLevel: bp.reorderLevel,
  }));

  // Load regular customer accounts with real-time balance
  const customers = await db.customer.findMany({
    where: { status: "ACTIVE" },
    include: {
      sales: {
        where: { status: "COMPLETED" },
        select: {
          total: true,
          payments: {
            where: { status: "COMPLETED" },
            select: { amount: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const posCustomers = customers.map((c) => {
    let totalPurchases = 0;
    let totalPaid = 0;
    for (const s of c.sales) {
      totalPurchases += Number(s.total.toString());
      for (const p of s.payments) {
        totalPaid += Number(p.amount.toString());
      }
    }
    const debt = Math.max(0, totalPurchases - totalPaid);

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      creditLimit: Number(c.creditLimit.toString()),
      outstandingBalance: debt,
    };
  });

  const activeSession = await getActiveCashSession(
    user.employeeId,
    user.activeBranchId
  );

  return (
    <AppShell user={user}>
      <POSWorkspace
        branchId={user.activeBranchId}
        branchName={user.activeBranchName}
        branchCode={user.activeBranchCode}
        cashierName={user.employeeName}
        userRole={user.role}
        initialProducts={posProducts}
        customers={posCustomers}
        initialCashSession={activeSession}
      />
    </AppShell>
  );
}
