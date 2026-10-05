import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "products.manage");
    }

    const products = await db.product.findMany({
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

    return NextResponse.json({
      products: products.map((p) => ({
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
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("List products error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch product catalog." },
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
      await requirePermission(user.id, "products.manage");
    }

    const body = await request.json();
    const {
      sku,
      name,
      category,
      inventoryUnit,
      bulkUnit,
      pieceUnit,
      piecesPerBulk,
      defaultPrice,
      defaultPiecePrice,
      defaultReorderLevel,
    } = body;

    if (!sku || !name) {
      return NextResponse.json(
        { error: "SKU and Product Name are required." },
        { status: 400 }
      );
    }

    const cleanSku = sku.toUpperCase().trim();
    const cleanName = name.trim();
    const assignedBulkUnit = bulkUnit || inventoryUnit || "CRATE";
    const assignedPieceUnit = pieceUnit || "PIECE";
    const assignedPiecesPerBulk = Number(piecesPerBulk) > 0 ? Number(piecesPerBulk) : 1;

    // Check SKU uniqueness
    const existing = await db.product.findUnique({
      where: { sku: cleanSku },
    });

    if (existing) {
      return NextResponse.json(
        { error: `SKU '${cleanSku}' already belongs to product '${existing.name}'.` },
        { status: 400 }
      );
    }

    const sellingPriceDec = new Decimal(defaultPrice ? String(defaultPrice).trim() : "0");
    const piecePriceDec = defaultPiecePrice ? new Decimal(String(defaultPiecePrice).trim()) : null;
    const reorderLevelNum = defaultReorderLevel ? parseInt(String(defaultReorderLevel), 10) : 10;

    // Atomically create product and branch inventory records
    const product = await db.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          sku: cleanSku,
          name: cleanName,
          category: category ? category.trim() : null,
          inventoryUnit: assignedBulkUnit,
          bulkUnit: assignedBulkUnit,
          pieceUnit: assignedPieceUnit,
          piecesPerBulk: assignedPiecesPerBulk,
          status: "ACTIVE",
        },
      });

      // Link to all active branches
      const activeBranches = await tx.branch.findMany({
        where: { status: "ACTIVE" },
      });

      if (activeBranches.length > 0) {
        await tx.branchProduct.createMany({
          data: activeBranches.map((b) => ({
            branchId: b.id,
            productId: createdProduct.id,
            sellingPrice: sellingPriceDec,
            piecePrice: piecePriceDec,
            currentStock: 0,
            reorderLevel: reorderLevelNum,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          action: "PRODUCT_CREATED",
          userId: user.id,
          entityType: "PRODUCT",
          entityId: createdProduct.id,
          description: `Product ${createdProduct.name} (${createdProduct.sku}) added to catalog with unit ${createdProduct.inventoryUnit} and deployed to ${activeBranches.length} branches.`,
          newValue: {
            sku: createdProduct.sku,
            name: createdProduct.name,
            category: createdProduct.category,
            inventoryUnit: createdProduct.inventoryUnit,
            defaultPrice: sellingPriceDec.toString(),
          },
        },
      });

      return createdProduct;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    console.error("Create product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create product." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
