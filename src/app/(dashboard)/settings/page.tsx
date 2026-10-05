import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import {
  BranchItem,
  ProductItem,
  UnitItem,
  EmployeeItem,
} from "@/components/settings/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Only business owner can access overall business settings
  if (user.role !== "OWNER") {
    redirect("/today");
  }

  // 1. Fetch all branches with counts
  const rawBranches = await db.branch.findMany({
    include: {
      _count: {
        select: {
          employeeAssignments: { where: { endDate: null } },
          products: true,
          sales: true,
          cashSessions: { where: { status: "OPEN" } },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  const branches: BranchItem[] = rawBranches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    address: b.address,
    phone: b.phone,
    status: b.status,
    openingTime: b.openingTime || "08:00",
    closingTime: b.closingTime || "17:00",
    gracePeriodMinutes: b.gracePeriodMinutes ?? 15,
    activeEmployeesCount: b._count.employeeAssignments,
    productsCount: b._count.products,
    totalSalesCount: b._count.sales,
    activeCashDrawersCount: b._count.cashSessions,
    createdAt: b.createdAt.toISOString(),
  }));

  // 2. Fetch all products with branch allocations and counts
  const rawProducts = await db.product.findMany({
    include: {
      branchProducts: {
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
        },
      },
      _count: {
        select: {
          saleItems: true,
          inventoryMovements: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const products: ProductItem[] = rawProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    inventoryUnit: p.inventoryUnit,
    bulkUnit: p.bulkUnit || p.inventoryUnit || "CRATE",
    pieceUnit: p.pieceUnit || "PIECE",
    piecesPerBulk: p.piecesPerBulk || 1,
    status: p.status,
    saleItemsCount: p._count.saleItems,
    inventoryMovementsCount: p._count.inventoryMovements,
    branchProducts: p.branchProducts.map((bp) => ({
      id: bp.id,
      branchId: bp.branchId,
      branchName: bp.branch.name,
      branchCode: bp.branch.code,
      sellingPrice: bp.sellingPrice.toString(),
      piecePrice: bp.piecePrice ? bp.piecePrice.toString() : null,
      currentStock: bp.currentStock,
      reorderLevel: bp.reorderLevel,
    })),
    createdAt: p.createdAt.toISOString(),
  }));

  // 3. Fetch all units of measurement with product counts
  const rawUnits = await db.unitOfMeasurement.findMany({
    orderBy: { name: "asc" },
  });

  const bulkCountMap = new Map<string, number>();
  const pieceCountMap = new Map<string, number>();
  const totalCountMap = new Map<string, Set<string>>();

  for (const p of rawProducts) {
    const bulkCode = p.bulkUnit || p.inventoryUnit;
    const pieceCode = p.pieceUnit;

    if (bulkCode) {
      bulkCountMap.set(bulkCode, (bulkCountMap.get(bulkCode) || 0) + 1);
      if (!totalCountMap.has(bulkCode)) totalCountMap.set(bulkCode, new Set());
      totalCountMap.get(bulkCode)!.add(p.id);
    }
    if (pieceCode) {
      pieceCountMap.set(pieceCode, (pieceCountMap.get(pieceCode) || 0) + 1);
      if (!totalCountMap.has(pieceCode)) totalCountMap.set(pieceCode, new Set());
      totalCountMap.get(pieceCode)!.add(p.id);
    }
  }

  const units: UnitItem[] = rawUnits.map((u) => ({
    id: u.id,
    code: u.code,
    name: u.name,
    description: u.description,
    scaleType: (u.scaleType as any) || "UNIVERSAL",
    defaultPieceUnit: u.defaultPieceUnit || null,
    defaultRatio: u.defaultRatio || null,
    isDefault: u.isDefault,
    productsCount: totalCountMap.get(u.code)?.size || 0,
    bulkProductsCount: bulkCountMap.get(u.code) || 0,
    pieceProductsCount: pieceCountMap.get(u.code) || 0,
    createdAt: u.createdAt.toISOString(),
  }));

  // 4. Fetch all employees across the enterprise
  const rawEmployees = await db.employee.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          status: true,
          roles: {
            include: {
              role: { select: { id: true, name: true, description: true } },
            },
          },
        },
      },
      branchAssignments: {
        where: { endDate: null },
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { startDate: "desc" },
        take: 1,
      },
      _count: {
        select: {
          sales: true,
          attendances: true,
        },
      },
    },
    orderBy: { employeeNumber: "asc" },
  });

  const employees: EmployeeItem[] = rawEmployees.map((emp) => {
    const activeAssignment = emp.branchAssignments[0];
    const role = emp.user?.roles[0]?.role;
    return {
      id: emp.id,
      userId: emp.userId,
      employeeNumber: emp.employeeNumber,
      firstName: emp.firstName,
      lastName: emp.lastName,
      fullName: `${emp.firstName} ${emp.lastName}`,
      phone: emp.phone,
      status: emp.status,
      userStatus: emp.user?.status || "ACTIVE",
      email: emp.user?.email || null,
      roleId: role?.id || null,
      roleName: role?.name || "STAFF",
      branchId: activeAssignment?.branch.id || null,
      branchName: activeAssignment?.branch.name || "Unassigned",
      branchCode: activeAssignment?.branch.code || "-",
      salesCount: emp._count.sales,
      attendancesCount: emp._count.attendances,
      isOwner: role?.name === "OWNER",
      createdAt: emp.createdAt.toISOString(),
    };
  });

  return (
    <AppShell user={user}>
      <SettingsWorkspace
        initialBranches={branches}
        initialProducts={products}
        initialUnits={units}
        initialEmployees={employees}
        isOwner={user.isOwner}
      />
    </AppShell>
  );
}
