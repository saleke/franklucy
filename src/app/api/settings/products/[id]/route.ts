import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "products.manage");
    }

    const product = await db.product.findUnique({
      where: { id: params.id },
      include: { branchProducts: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      category,
      inventoryUnit,
      bulkUnit,
      pieceUnit,
      piecesPerBulk,
      status,
      branchPrices,
      branchPiecePrices,
    } = body;

    const updated = await db.$transaction(async (tx) => {
      // 1. Update product base fields
      const assignedBulkUnit = bulkUnit || inventoryUnit || (inventoryUnit !== undefined ? inventoryUnit : product.inventoryUnit);
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          name: name ? name.trim() : product.name,
          category: category !== undefined ? (category ? category.trim() : null) : product.category,
          inventoryUnit: assignedBulkUnit,
          bulkUnit: assignedBulkUnit,
          pieceUnit: pieceUnit ? pieceUnit.trim() : product.pieceUnit,
          piecesPerBulk: piecesPerBulk ? (Number(piecesPerBulk) > 0 ? Number(piecesPerBulk) : 1) : product.piecesPerBulk,
          status: status ? status : product.status,
        },
      });

      // 2. Update branch prices if provided
      if (branchPrices && typeof branchPrices === "object") {
        for (const [branchId, newPriceStr] of Object.entries(branchPrices)) {
          const newPrice = new Decimal(String(newPriceStr).trim() || "0");
          const existingBp = product.branchProducts.find((bp) => bp.branchId === branchId);

          if (existingBp) {
            const oldPrice = new Decimal(existingBp.sellingPrice.toString());
            if (!newPrice.equals(oldPrice)) {
              await tx.branchProduct.update({
                where: { id: existingBp.id },
                data: { sellingPrice: newPrice },
              });

              // Record in ProductPriceHistory
              await tx.productPriceHistory.create({
                data: {
                  branchProductId: existingBp.id,
                  oldPrice,
                  newPrice,
                  changedBy: user.employeeId || user.id,
                  reason: "Owner/Manager price adjustment in Settings",
                },
              });
            }
          }
        }
      }

      // Update branch piece prices if provided
      if (branchPiecePrices && typeof branchPiecePrices === "object") {
        for (const [branchId, newPiecePriceStr] of Object.entries(branchPiecePrices)) {
          const existingBp = product.branchProducts.find((bp) => bp.branchId === branchId);
          if (existingBp) {
            const piecePriceVal = String(newPiecePriceStr).trim();
            const newPiecePrice = piecePriceVal ? new Decimal(piecePriceVal) : null;
            await tx.branchProduct.update({
              where: { id: existingBp.id },
              data: { piecePrice: newPiecePrice },
            });
          }
        }
      }

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          action: "PRODUCT_UPDATED",
          userId: user.id,
          entityType: "PRODUCT",
          entityId: product.id,
          description: `Product ${product.sku} updated: Name="${updatedProduct.name}", Unit="${updatedProduct.inventoryUnit}", Status="${updatedProduct.status}".`,
          oldValue: {
            name: product.name,
            category: product.category,
            inventoryUnit: product.inventoryUnit,
            status: product.status,
          },
          newValue: {
            name: updatedProduct.name,
            category: updatedProduct.category,
            inventoryUnit: updatedProduct.inventoryUnit,
            status: updatedProduct.status,
          },
        },
      });

      return updatedProduct;
    });

    return NextResponse.json({ product: updated });
  } catch (error: any) {
    console.error("Update product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update product." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "products.manage");
    }

    const product = await db.product.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            saleItems: true,
            inventoryMovements: true,
            transferItems: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    // Enterprise Audit Safe Guard: Never hard-delete products with transaction history
    const totalTransactions =
      product._count.saleItems +
      product._count.inventoryMovements +
      product._count.transferItems;

    if (totalTransactions > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete product '${product.name}' (${product.sku}) because it has ${totalTransactions} recorded transactions (sales, stock movements, or transfers). Deactivate the product instead to safely archive it without breaking historical accounting records.`,
          code: "HISTORICAL_RECORDS_EXIST",
        },
        { status: 400 }
      );
    }

    // Safely delete unused product
    await db.$transaction(async (tx) => {
      await tx.branchProduct.deleteMany({
        where: { productId: product.id },
      });
      await tx.product.delete({
        where: { id: product.id },
      });

      await tx.auditLog.create({
        data: {
          action: "PRODUCT_DELETED",
          userId: user.id,
          entityType: "PRODUCT",
          entityId: product.id,
          description: `Unused product ${product.name} (${product.sku}) deleted permanently.`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Product ${product.name} deleted successfully.`,
    });
  } catch (error: any) {
    console.error("Delete product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete product." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
