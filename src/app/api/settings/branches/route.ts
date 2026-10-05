import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "branches.manage");
    }

    const branches = await db.branch.findMany({
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

    return NextResponse.json({
      branches: branches.map((b) => ({
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
        createdAt: b.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("List branches error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch branches." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "branches.manage");
    }

    const body = await request.json();
    const { name, code, address, phone, openingTime, closingTime, gracePeriodMinutes } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Branch name and branch code are required." },
        { status: 400 }
      );
    }

    const cleanCode = code.toUpperCase().trim();
    const cleanName = name.trim();

    // Check code uniqueness
    const existing = await db.branch.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Branch code '${cleanCode}' is already taken by ${existing.name}.` },
        { status: 400 }
      );
    }

    // Atomic branch creation, sequence initialization, catalog linking, and audit log
    const newBranch = await db.$transaction(async (tx) => {
      // 1. Create branch
      const branch = await tx.branch.create({
        data: {
          name: cleanName,
          code: cleanCode,
          address: address?.trim() || null,
          phone: phone?.trim() || null,
          openingTime: openingTime?.trim() || "08:00",
          closingTime: closingTime?.trim() || "17:00",
          gracePeriodMinutes: Number(gracePeriodMinutes) || 15,
          status: "ACTIVE",
        },
      });

      // 2. Initialize human-readable identifier sequences
      await tx.branchInvoiceSequence.create({
        data: { branchId: branch.id, nextNumber: 1 },
      });
      await tx.branchTransferSequence.create({
        data: { branchId: branch.id, nextNumber: 1 },
      });
      await tx.branchCashSessionSequence.create({
        data: { branchId: branch.id, nextNumber: 1 },
      });

      // 3. Link all active catalog products to this new branch with zero stock
      const allProducts = await tx.product.findMany({
        where: { status: "ACTIVE" },
      });

      if (allProducts.length > 0) {
        await tx.branchProduct.createMany({
          data: allProducts.map((p) => ({
            branchId: branch.id,
            productId: p.id,
            sellingPrice: 0,
            currentStock: 0,
            reorderLevel: 10,
          })),
        });
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          action: "BRANCH_CREATED",
          userId: user.id,
          branchId: branch.id,
          entityType: "BRANCH",
          entityId: branch.id,
          description: `New branch ${branch.name} (${branch.code}) established with initialized sequences and ${allProducts.length} linked catalog products.`,
          newValue: {
            name: branch.name,
            code: branch.code,
            address: branch.address,
            phone: branch.phone,
          },
        },
      });

      return branch;
    });

    return NextResponse.json({ branch: newBranch }, { status: 201 });
  } catch (error: any) {
    console.error("Create branch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create branch." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
