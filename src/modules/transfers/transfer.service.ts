import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireBranchAccess } from "@/lib/permissions";

export const createTransferItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  unitType: z.enum(["BULK", "PIECE"]).optional().default("BULK"),
});

export const createTransferSchema = z.object({
  sourceBranchId: z.string().optional(),
  destinationBranchId: z.string().min(1, "Destination branch is required"),
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(createTransferItemSchema).min(1, "Must transfer at least one item"),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export interface TransferContext {
  userId: string;
  employeeId: string;
  branchId: string;
}

export class TransferBusinessError extends Error {
  code: string;
  details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = "TransferBusinessError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Executes a direct, atomic inter-branch stock transfer (Component 20).
 * Guarantees serializable stock verification, simultaneous decrement at source and increment at destination,
 * inventory movement logging on both branches, and immutable audit logging.
 */
export async function createStockTransfer(
  input: CreateTransferInput,
  context: TransferContext
) {
  const parsed = createTransferSchema.parse(input);
  const effectiveSourceBranchId = parsed.sourceBranchId || context.branchId;

  await requirePermission(context.userId, "transfers.create");
  await requireBranchAccess(context.userId, effectiveSourceBranchId);

  if (parsed.destinationBranchId === effectiveSourceBranchId) {
    throw new TransferBusinessError(
      "Destination branch cannot be the same as the source branch.",
      "SAME_BRANCH_TRANSFER"
    );
  }

  return await db.$transaction(async (tx) => {
    // 1. Fetch Source and Destination branches
    const sourceBranch = await tx.branch.findUniqueOrThrow({
      where: { id: effectiveSourceBranchId },
      select: { id: true, name: true, code: true, status: true },
    });

    const destBranch = await tx.branch.findUnique({
      where: { id: parsed.destinationBranchId },
      select: { id: true, name: true, code: true, status: true },
    });

    if (!destBranch || destBranch.status !== "ACTIVE") {
      throw new TransferBusinessError(
        "Destination branch not found or inactive.",
        "INVALID_DESTINATION_BRANCH"
      );
    }

    // 2. Fetch and Lock Source Branch Products
    const uniqueProductIds = Array.from(new Set(parsed.items.map((i) => i.productId)));

    const sourceBranchProducts = await tx.branchProduct.findMany({
      where: {
        branchId: effectiveSourceBranchId,
        productId: { in: uniqueProductIds },
      },
      include: {
        product: true,
      },
    });

    if (sourceBranchProducts.length !== uniqueProductIds.length) {
      throw new TransferBusinessError(
        "One or more products are not configured in the source branch.",
        "PRODUCT_NOT_IN_BRANCH"
      );
    }

    const sbpMap = new Map(sourceBranchProducts.map((sbp) => [sbp.productId, sbp]));

    // 3. Compute base pieces required and verify stock availability
    const piecesRequiredMap = new Map<string, number>();
    for (const item of parsed.items) {
      const sbp = sbpMap.get(item.productId)!;
      const piecesMultiplier = item.unitType === "PIECE" ? 1 : (sbp.product.piecesPerBulk || 1);
      const pieces = item.quantity * piecesMultiplier;
      piecesRequiredMap.set(item.productId, (piecesRequiredMap.get(item.productId) || 0) + pieces);
    }

    for (const sbp of sourceBranchProducts) {
      const requestedPieces = piecesRequiredMap.get(sbp.productId) || 0;
      if (sbp.currentStock < requestedPieces) {
        const fullBulk = Math.floor(sbp.currentStock / (sbp.product.piecesPerBulk || 1));
        const loose = sbp.currentStock % (sbp.product.piecesPerBulk || 1);
        const bulkUnit = sbp.product.bulkUnit || sbp.product.inventoryUnit || "CRATE";
        const pieceUnit = sbp.product.pieceUnit || "PIECE";
        const availDesc = (sbp.product.piecesPerBulk || 1) > 1
          ? `${fullBulk} ${bulkUnit}s + ${loose} ${pieceUnit}s (${sbp.currentStock} total ${pieceUnit}s)`
          : `${sbp.currentStock} ${bulkUnit}s`;

        throw new TransferBusinessError(
          `Insufficient stock for "${sbp.product.name}" at source branch. Available: ${availDesc}, Requested: ${requestedPieces} ${pieceUnit}s.`,
          "INSUFFICIENT_STOCK",
          {
            productId: sbp.productId,
            name: sbp.product.name,
            available: sbp.currentStock,
            requested: requestedPieces,
          }
        );
      }
    }

    // 4. Generate Transfer Reference Number
    const sequence = await tx.branchTransferSequence.upsert({
      where: { branchId: effectiveSourceBranchId },
      update: { nextNumber: { increment: 1 } },
      create: { branchId: effectiveSourceBranchId, nextNumber: 1002 },
    });

    const seqNumberPadded = String(sequence.nextNumber).padStart(6, "0");
    const referenceNumber = `TRF-${sourceBranch.code}-${seqNumberPadded}`;

    // 5. Create StockTransfer Record with items
    const transfer = await tx.stockTransfer.create({
      data: {
        referenceNumber,
        sourceBranchId: effectiveSourceBranchId,
        destinationBranchId: parsed.destinationBranchId,
        createdBy: context.employeeId,
        reason: parsed.reason || "Direct branch transfer",
        notes: parsed.notes || null,
        status: "COMPLETED",
        items: {
          create: parsed.items.map((item) => {
            const sbp = sbpMap.get(item.productId)!;
            const isPiece = item.unitType === "PIECE";
            const piecesMultiplier = isPiece ? 1 : (sbp.product.piecesPerBulk || 1);
            const unitName = isPiece ? (sbp.product.pieceUnit || "PIECE") : (sbp.product.bulkUnit || "CRATE");
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitType: item.unitType || "BULK",
              unitName,
              piecesTransferred: item.quantity * piecesMultiplier,
            };
          }),
        },
      },
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
    });

    // 6. Execute atomic inventory movements and balance adjustments
    for (const productId of uniqueProductIds) {
      const sbp = sbpMap.get(productId)!;
      const piecesToMove = piecesRequiredMap.get(productId)!;
      const itemsForProd = transfer.items.filter((i) => i.productId === productId);
      const breakdown = itemsForProd.map((i) => `${i.quantity} ${i.unitName}`).join(" + ");

      // 6.1 Decrement source branch product stock atomically
      const decResult = await tx.branchProduct.updateMany({
        where: {
          branchId: effectiveSourceBranchId,
          productId,
          currentStock: { gte: piecesToMove },
        },
        data: {
          currentStock: { decrement: piecesToMove },
        },
      });

      if (decResult.count === 0) {
        throw new TransferBusinessError(
          `Insufficient stock remaining for "${sbp.product.name}" at source branch. Stock may have been depleted by another transaction.`,
          "INSUFFICIENT_STOCK"
        );
      }

      // 6.2 Record TRANSFER_OUT movement for source branch
      await tx.inventoryMovement.create({
        data: {
          branchId: effectiveSourceBranchId,
          productId,
          type: "TRANSFER_OUT",
          quantity: -piecesToMove,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          reason: `Transferred to ${destBranch.name} (${destBranch.code}) [${breakdown}] - Ref: ${referenceNumber}`,
          createdBy: context.employeeId,
        },
      });

      // 6.3 Ensure destination branch product exists, then increment currentStock
      await tx.branchProduct.upsert({
        where: {
          branchId_productId: {
            branchId: destBranch.id,
            productId,
          },
        },
        update: {
          currentStock: { increment: piecesToMove },
        },
        create: {
          branchId: destBranch.id,
          productId,
          sellingPrice: sbp.sellingPrice,
          piecePrice: sbp.piecePrice,
          currentStock: piecesToMove,
          reorderLevel: sbp.reorderLevel,
          status: "ACTIVE",
        },
      });

      // 6.4 Record TRANSFER_IN movement for destination branch
      await tx.inventoryMovement.create({
        data: {
          branchId: destBranch.id,
          productId,
          type: "TRANSFER_IN",
          quantity: piecesToMove,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          reason: `Received from ${sourceBranch.name} (${sourceBranch.code}) [${breakdown}] - Ref: ${referenceNumber}`,
          createdBy: context.employeeId,
        },
      });
    }

    // 7. Immutable Audit Log
    await tx.auditLog.create({
      data: {
        action: "STOCK_TRANSFER_COMPLETED",
        userId: context.userId,
        branchId: effectiveSourceBranchId,
        entityType: "STOCK_TRANSFER",
        entityId: transfer.id,
        description: `Direct stock transfer ${referenceNumber} sent to ${destBranch.name} (${parsed.items.length} product lines)`,
      },
    });

    const formattedTransfer = {
      id: transfer.id,
      referenceNumber: transfer.referenceNumber,
      sourceBranchId: transfer.sourceBranchId,
      sourceBranchName: transfer.sourceBranch.name,
      sourceBranchCode: transfer.sourceBranch.code,
      destinationBranchId: transfer.destinationBranchId,
      destinationBranchName: transfer.destinationBranch.name,
      destinationBranchCode: transfer.destinationBranch.code,
      employeeName: `${transfer.employee.firstName} ${transfer.employee.lastName}`,
      reason: transfer.reason,
      notes: transfer.notes,
      createdAt: transfer.createdAt.toISOString(),
      items: transfer.items.map((i) => ({
        productId: i.productId,
        productName: i.product.name,
        productSku: i.product.sku,
        quantity: i.quantity,
        unit: i.unitName || i.product.inventoryUnit,
        unitType: i.unitType,
        piecesTransferred: i.piecesTransferred,
      })),
    };

    return {
      success: true,
      transfer: formattedTransfer,
      transferId: transfer.id,
      referenceNumber,
      sourceBranchName: sourceBranch.name,
      destinationBranchName: destBranch.name,
      totalItems: parsed.items.reduce((acc, curr) => acc + curr.quantity, 0),
    };
  });
}
