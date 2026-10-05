import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireBranchAccess } from "@/lib/permissions";

export const receiveStockSchema = z.object({
  supplierName: z.string().optional(),
  reference: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive("Received quantity must be positive"),
        unitType: z.enum(["BULK", "PIECE"]).optional().default("BULK"),
      })
    )
    .min(1, "Must receive at least one product"),
});

export const recordDamageSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive("Damaged quantity must be positive"),
  unitType: z.enum(["BULK", "PIECE"]).optional().default("BULK"),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});

export const recordExpirySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive("Expired quantity must be positive"),
  unitType: z.enum(["BULK", "PIECE"]).optional().default("BULK"),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

export interface InventoryContext {
  userId: string;
  employeeId: string;
  branchId: string;
}

/**
 * Authoritative Goods Receipt (Stock Receiving)
 */
export async function receiveStock(
  input: z.infer<typeof receiveStockSchema>,
  context: InventoryContext
) {
  await requirePermission(context.userId, "inventory.receive");
  await requireBranchAccess(context.userId, context.branchId);

  const parsed = receiveStockSchema.parse(input);

  return await db.$transaction(async (tx) => {
    for (const item of parsed.items) {
      const bp = await tx.branchProduct.findUniqueOrThrow({
        where: {
          branchId_productId: {
            branchId: context.branchId,
            productId: item.productId,
          },
        },
        include: { product: true },
      });

      const isPiece = item.unitType === "PIECE";
      const piecesMultiplier = isPiece ? 1 : (bp.product.piecesPerBulk || 1);
      const piecesToAdd = item.quantity * piecesMultiplier;
      const unitName = isPiece ? (bp.product.pieceUnit || "PIECE") : (bp.product.bulkUnit || "CRATE");

      // 1. Create Purchase Inventory Movement
      await tx.inventoryMovement.create({
        data: {
          branchId: context.branchId,
          productId: item.productId,
          type: "PURCHASE",
          quantity: piecesToAdd,
          referenceType: "GOODS_RECEIPT",
          referenceId: parsed.reference || null,
          reason: parsed.supplierName
            ? `Supplier delivery from ${parsed.supplierName} (${item.quantity} ${unitName})`
            : `Stock delivery received (${item.quantity} ${unitName})`,
          createdBy: context.employeeId,
        },
      });

      // 2. Increment cached currentStock in base pieces
      await tx.branchProduct.update({
        where: {
          branchId_productId: {
            branchId: context.branchId,
            productId: item.productId,
          },
        },
        data: {
          currentStock: { increment: piecesToAdd },
        },
      });
    }

    // 3. Audit Log
    await tx.auditLog.create({
      data: {
        action: "STOCK_RECEIVED",
        userId: context.userId,
        branchId: context.branchId,
        entityType: "INVENTORY",
        entityId: context.branchId,
        description: `Received goods delivery (${parsed.items.length} items) from ${
          parsed.supplierName || "Supplier"
        }`,
      },
    });

    return { success: true };
  });
}

/**
 * Authoritative Damaged Stock Logging
 */
export async function recordDamagedStock(
  input: z.infer<typeof recordDamageSchema>,
  context: InventoryContext
) {
  await requirePermission(context.userId, "inventory.damage");
  await requireBranchAccess(context.userId, context.branchId);

  const parsed = recordDamageSchema.parse(input);

  return await db.$transaction(async (tx) => {
    const bp = await tx.branchProduct.findUniqueOrThrow({
      where: {
        branchId_productId: {
          branchId: context.branchId,
          productId: parsed.productId,
        },
      },
      include: { product: true },
    });

    const isPiece = parsed.unitType === "PIECE";
    const piecesMultiplier = isPiece ? 1 : (bp.product.piecesPerBulk || 1);
    const piecesToDeduct = parsed.quantity * piecesMultiplier;
    const unitName = isPiece ? (bp.product.pieceUnit || "PIECE") : (bp.product.bulkUnit || "CRATE");

    if (bp.currentStock < piecesToDeduct) {
      throw new Error(
        `Cannot record damage greater than available stock (${bp.currentStock} pieces).`
      );
    }

    // 1. Create DAMAGED Movement
    await tx.inventoryMovement.create({
      data: {
        branchId: context.branchId,
        productId: parsed.productId,
        type: "DAMAGED",
        quantity: -piecesToDeduct,
        referenceType: "DAMAGE_LOG",
        reason: `${parsed.reason} (${parsed.quantity} ${unitName})` + (parsed.notes ? ` - ${parsed.notes}` : ""),
        createdBy: context.employeeId,
      },
    });

    // 2. Concurrency-guarded atomic decrement
    const updateResult = await tx.branchProduct.updateMany({
      where: {
        id: bp.id,
        currentStock: { gte: piecesToDeduct },
      },
      data: {
        currentStock: { decrement: piecesToDeduct },
      },
    });

    if (updateResult.count === 0) {
      throw new Error("Stock was just depleted by another terminal. Insufficient stock remaining.");
    }

    // 3. Audit Log
    await tx.auditLog.create({
      data: {
        action: "DAMAGED_RECORDED",
        userId: context.userId,
        branchId: context.branchId,
        entityType: "PRODUCT",
        entityId: parsed.productId,
        description: `Recorded ${parsed.quantity} damaged ${unitName}s of ${bp.product.name}: ${parsed.reason}`,
      },
    });

    return { success: true };
  });
}
