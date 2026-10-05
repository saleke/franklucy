import { z } from "zod";
import Decimal from "decimal.js";
import { db } from "@/lib/db";
import { requirePermission, requireBranchAccess } from "@/lib/permissions";

export const completeSaleSchema = z.object({
  customerId: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        quantity: z.number().int().positive("Quantity must be a positive integer"),
        unitType: z.enum(["BULK", "PIECE"]).optional().default("BULK"),
      })
    )
    .min(1, "Sale must contain at least one item"),
  payment: z.object({
    method: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
    amount: z.string().min(1, "Payment amount is required"),
    reference: z.string().optional(),
    settlementType: z.enum(["FULL", "PARTIAL", "CREDIT"]).optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export type CompleteSaleInput = z.infer<typeof completeSaleSchema>;

export interface SaleContext {
  userId: string;
  employeeId: string;
  branchId: string;
  idempotencyKey: string;
}

export interface CompleteSaleResult {
  saleId: string;
  invoiceNumber: string;
  subtotal: string;
  discount: string;
  total: string;
  amountPaid: string;
  unpaidBalance: string;
  paymentStatus: "COMPLETED" | "PARTIAL" | "CREDIT";
  changeDue?: string;
}

export class SaleBusinessError extends Error {
  code: string;
  details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = "SaleBusinessError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Authoritative completeSale workflow executing inside an ACID transaction.
 * Guarantees zero-trust price resolution, serialized stock checks, invoice sequence atomicity,
 * and immutable audit logging.
 */
export async function completeSale(
  input: CompleteSaleInput,
  context: SaleContext
): Promise<CompleteSaleResult> {
  // 1. Authorization checks
  await requirePermission(context.userId, "sales.create");
  await requireBranchAccess(context.userId, context.branchId);

  // 2. Validate input schema
  const parsed = completeSaleSchema.parse(input);

  // 3. Normalization: aggregate unique product IDs
  const uniqueProductIds = Array.from(new Set(parsed.items.map((i) => i.productId)));

  // 4. Atomic Transaction
  return await db.$transaction(async (tx) => {
    // 4.1 Idempotency deduplication check
    const existingIdempotency = await tx.idempotencyKey.findUnique({
      where: { key: context.idempotencyKey },
    });

    if (existingIdempotency?.responseJson) {
      return existingIdempotency.responseJson as unknown as CompleteSaleResult;
    }

    // 4.1.5 Authoritative cash session resolution
    const activeCashSession = await tx.cashSession.findFirst({
      where: {
        cashierId: context.employeeId,
        branchId: context.branchId,
        status: "OPEN",
      },
    });

    const paymentAmount = new Decimal(parsed.payment.amount || "0");
    if (paymentAmount.lessThan(0)) {
      throw new SaleBusinessError("Payment amount cannot be negative.", "INVALID_PAYMENT_AMOUNT");
    }

    // Cash drawer session is strictly required if physical cash (> 0) is being tendered
    if (!activeCashSession && parsed.payment.method === "CASH" && paymentAmount.greaterThan(0)) {
      const userWithRoles = await tx.user.findUnique({
        where: { id: context.userId },
        include: { roles: { include: { role: true } } },
      });
      const isOwner = userWithRoles?.roles.some((r) => r.role.name === "OWNER");
      if (!isOwner) {
        throw new SaleBusinessError(
          "An active cash session is required to accept cash sales. Please open a cash session before proceeding.",
          "CASH_SESSION_REQUIRED"
        );
      }
    }

    // 4.2 Fetch branch product configurations
    const branchProducts = await tx.branchProduct.findMany({
      where: {
        branchId: context.branchId,
        productId: { in: uniqueProductIds },
        status: "ACTIVE",
      },
      include: {
        product: true,
      },
    });

    if (branchProducts.length !== uniqueProductIds.length) {
      const foundIds = new Set(branchProducts.map((bp) => bp.productId));
      const missingIds = uniqueProductIds.filter((id) => !foundIds.has(id));
      throw new SaleBusinessError(
        `One or more products are unavailable at this branch: ${missingIds.join(", ")}`,
        "PRODUCT_NOT_AVAILABLE",
        { missingIds }
      );
    }

    const bpMap = new Map(branchProducts.map((bp) => [bp.productId, bp]));

    // 4.3 Check stock availability in base pieces
    const piecesRequiredMap = new Map<string, number>();
    for (const item of parsed.items) {
      const bp = bpMap.get(item.productId)!;
      const piecesMultiplier = item.unitType === "PIECE" ? 1 : (bp.product.piecesPerBulk || 1);
      const pieces = item.quantity * piecesMultiplier;
      piecesRequiredMap.set(item.productId, (piecesRequiredMap.get(item.productId) ?? 0) + pieces);
    }

    for (const bp of branchProducts) {
      const totalPiecesNeeded = piecesRequiredMap.get(bp.productId) ?? 0;
      if (bp.currentStock < totalPiecesNeeded) {
        const piecesPerBulk = bp.product.piecesPerBulk || 1;
        const fullBulk = Math.floor(bp.currentStock / piecesPerBulk);
        const loosePieces = bp.currentStock % piecesPerBulk;
        const bulkUnit = bp.product.bulkUnit || bp.product.inventoryUnit || "CRATE";
        const pieceUnit = bp.product.pieceUnit || "PIECE";
        const availDesc = piecesPerBulk > 1
          ? `${fullBulk} ${bulkUnit}s + ${loosePieces} ${pieceUnit}s (${bp.currentStock} total ${pieceUnit}s)`
          : `${bp.currentStock} ${bulkUnit}s`;

        throw new SaleBusinessError(
          `Insufficient stock for ${bp.product.name}. Available: ${availDesc}, Requested: ${totalPiecesNeeded} ${pieceUnit}s.`,
          "INSUFFICIENT_STOCK",
          {
            productId: bp.productId,
            productName: bp.product.name,
            available: bp.currentStock,
            requestedPieces: totalPiecesNeeded,
          }
        );
      }
    }

    // 4.4 Compute authoritative financial calculations using Decimal
    let subtotal = new Decimal(0);
    const lineItemsData: {
      productId: string;
      quantity: number;
      unitPrice: Decimal;
      discount: Decimal;
      lineTotal: Decimal;
      unitType: "BULK" | "PIECE";
      unitName: string;
      piecesSold: number;
    }[] = [];

    for (const item of parsed.items) {
      const bp = bpMap.get(item.productId)!;
      const isPiece = item.unitType === "PIECE";
      const piecesPerBulk = bp.product.piecesPerBulk || 1;
      const piecesMultiplier = isPiece ? 1 : piecesPerBulk;
      const piecesSold = item.quantity * piecesMultiplier;

      let unitPrice: Decimal;
      let unitName: string;

      if (isPiece) {
        if (bp.piecePrice) {
          unitPrice = new Decimal(bp.piecePrice.toString());
        } else {
          // Fallback: bulk price / piecesPerBulk rounded up to nearest 50
          const bulkPrice = new Decimal(bp.sellingPrice.toString());
          unitPrice = bulkPrice.div(piecesPerBulk).ceil();
        }
        unitName = bp.product.pieceUnit || "PIECE";
      } else {
        unitPrice = new Decimal(bp.sellingPrice.toString());
        unitName = bp.product.bulkUnit || bp.product.inventoryUnit || "CRATE";
      }

      const discount = new Decimal(0); // Standard sale discount policy
      const lineTotal = unitPrice.mul(item.quantity).sub(discount);

      subtotal = subtotal.add(lineTotal);

      lineItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        discount,
        lineTotal,
        unitType: item.unitType || "BULK",
        unitName,
        piecesSold,
      });
    }

    const discountTotal = new Decimal(0);
    const grandTotal = subtotal.sub(discountTotal);

    // 4.5 Validate payment & determine settlement
    let actualPaidToday = new Decimal(0);
    let unpaidBalance = new Decimal(0);
    let changeDue: Decimal | undefined;
    let paymentStatus: "COMPLETED" | "PARTIAL" | "CREDIT" = "COMPLETED";

    if (paymentAmount.greaterThanOrEqualTo(grandTotal)) {
      // Full settlement (or overpayment in cash where change is given)
      actualPaidToday = grandTotal;
      if (parsed.payment.method === "CASH") {
        changeDue = paymentAmount.sub(grandTotal);
      }
      paymentStatus = "COMPLETED";
    } else {
      // Payment amount is strictly less than grandTotal (Partial deposit or 100% Store Credit)
      if (!parsed.customerId) {
        throw new SaleBusinessError(
          "A registered customer account is required for credit sales and partial payments.",
          "CUSTOMER_REQUIRED_FOR_CREDIT_SALE"
        );
      }

      const customer = await tx.customer.findUnique({
        where: { id: parsed.customerId },
        include: {
          sales: {
            where: { status: "COMPLETED" },
            include: {
              payments: { where: { status: "COMPLETED" } },
            },
          },
        },
      });

      if (!customer || customer.status !== "ACTIVE") {
        throw new SaleBusinessError(
          "Selected customer account was not found or is currently inactive.",
          "CUSTOMER_NOT_FOUND"
        );
      }

      actualPaidToday = paymentAmount;
      unpaidBalance = grandTotal.sub(paymentAmount);
      paymentStatus = actualPaidToday.isZero() ? "CREDIT" : "PARTIAL";

      // Calculate existing debt for credit limit verification
      let existingPurchases = new Decimal(0);
      let existingPaid = new Decimal(0);
      for (const s of customer.sales) {
        existingPurchases = existingPurchases.add(new Decimal(s.total.toString()));
        for (const p of s.payments) {
          existingPaid = existingPaid.add(new Decimal(p.amount.toString()));
        }
      }
      const currentDebt = existingPurchases.sub(existingPaid);
      const projectedDebt = currentDebt.add(unpaidBalance);
      const creditLimit = new Decimal(customer.creditLimit.toString());

      if (creditLimit.greaterThan(0) && projectedDebt.greaterThan(creditLimit)) {
        // Exceeds credit limit: check if user is manager or owner or has permission to override
        const userRoles = await tx.userRole.findMany({
          where: { userId: context.userId },
          include: { role: true },
        });
        const canOverride = userRoles.some(
          (ur) => ur.role.name === "OWNER" || ur.role.name === "MANAGER"
        );
        if (!canOverride) {
          throw new SaleBusinessError(
            `Sale exceeds customer credit limit. Limit: ₦${creditLimit.toNumber().toLocaleString()}, Current Debt: ₦${currentDebt.toNumber().toLocaleString()}, Projected: ₦${projectedDebt.toNumber().toLocaleString()}. Manager authorization required.`,
            "CREDIT_LIMIT_EXCEEDED",
            {
              creditLimit: creditLimit.toString(),
              currentDebt: currentDebt.toString(),
              projectedDebt: projectedDebt.toString(),
            }
          );
        }
      }
    }

    // 4.6 Concurrency-safe invoice sequence generation
    const branch = await tx.branch.findUniqueOrThrow({
      where: { id: context.branchId },
      select: { code: true },
    });

    const sequence = await tx.branchInvoiceSequence.upsert({
      where: { branchId: context.branchId },
      update: { nextNumber: { increment: 1 } },
      create: { branchId: context.branchId, nextNumber: 1002 },
    });

    const seqNumberPadded = String(sequence.nextNumber).padStart(6, "0");
    const invoiceNumber = `INV-${branch.code}-${seqNumberPadded}`;

    // 4.7 Create Sale Header
    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        branchId: context.branchId,
        customerId: parsed.customerId || null,
        cashierId: context.employeeId,
        status: "COMPLETED",
        subtotal,
        discount: discountTotal,
        total: grandTotal,
        completedAt: new Date(),
        notes: parsed.payment.notes || (unpaidBalance.greaterThan(0) ? `Unpaid balance: ₦${unpaidBalance.toString()}` : null),
        items: {
          create: lineItemsData.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: item.lineTotal,
            unitType: item.unitType,
            unitName: item.unitName,
            piecesSold: item.piecesSold,
          })),
        },
        payments: actualPaidToday.greaterThan(0)
          ? {
              create: {
                amount: actualPaidToday, // authoritative financial settlement entering cash till
                cashReceived: parsed.payment.method === "CASH" ? paymentAmount : actualPaidToday,
                changeGiven: changeDue || new Decimal(0),
                method: parsed.payment.method,
                status: "COMPLETED",
                reference: parsed.payment.reference || (unpaidBalance.greaterThan(0) ? `Partial deposit (₦${unpaidBalance.toString()} balance)` : null),
                receivedBy: context.employeeId,
                cashSessionId: activeCashSession ? activeCashSession.id : null,
              },
            }
          : undefined,
      },
    });

    // 4.8 Create Inventory Movements & Update Cached Stock (in base pieces)
    for (const productId of uniqueProductIds) {
      const bp = bpMap.get(productId)!;
      const piecesToDeduct = piecesRequiredMap.get(productId)!;
      const itemsForProd = lineItemsData.filter((i) => i.productId === productId);
      const breakdown = itemsForProd.map((i) => `${i.quantity} ${i.unitName}`).join(" + ");

      await tx.inventoryMovement.create({
        data: {
          branchId: context.branchId,
          productId,
          type: "SALE",
          quantity: piecesToDeduct,
          referenceType: "SALE",
          referenceId: sale.id,
          saleId: sale.id,
          reason: `Sale ${invoiceNumber} (${breakdown})`,
          createdBy: context.employeeId,
        },
      });

      // Concurrency-guarded atomic decrement: guarantees stock never drops below zero
      const updateResult = await tx.branchProduct.updateMany({
        where: {
          branchId: context.branchId,
          productId,
          currentStock: { gte: piecesToDeduct },
        },
        data: {
          currentStock: { decrement: piecesToDeduct },
        },
      });

      if (updateResult.count === 0) {
        throw new SaleBusinessError(
          `Stock was just depleted by another terminal. Insufficient stock remaining for ${bp.product.name}.`,
          "INSUFFICIENT_STOCK",
          { productId }
        );
      }
    }

    // 4.9 Create Immutable Audit Record
    await tx.auditLog.create({
      data: {
        action: "SALE_CREATED",
        userId: context.userId,
        branchId: context.branchId,
        entityType: "SALE",
        entityId: sale.id,
        description: `Sale ${invoiceNumber} completed for ${grandTotal} NGN (${lineItemsData.length} items)`,
        newValue: {
          invoiceNumber,
          total: grandTotal.toString(),
          itemsCount: lineItemsData.length,
          paymentMethod: parsed.payment.method,
        },
      },
    });

    const result: CompleteSaleResult = {
      saleId: sale.id,
      invoiceNumber,
      subtotal: subtotal.toString(),
      discount: discountTotal.toString(),
      total: grandTotal.toString(),
      amountPaid: actualPaidToday.toString(),
      unpaidBalance: unpaidBalance.toString(),
      paymentStatus,
      changeDue: changeDue ? changeDue.toString() : undefined,
    };

    // 4.10 Store Idempotency key
    await tx.idempotencyKey.upsert({
      where: { key: context.idempotencyKey },
      update: { responseJson: result as any },
      create: {
        key: context.idempotencyKey,
        operation: "COMPLETE_SALE",
        userId: context.userId,
        responseJson: result as any,
      },
    });

    return result;
  });
}
