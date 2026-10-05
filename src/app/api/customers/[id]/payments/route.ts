import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import Decimal from "decimal.js";

const recordDebtPaymentSchema = z.object({
  amount: z.union([z.number(), z.string()]).refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0;
  }, "Repayment amount must be a positive number"),
  method: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!["OWNER", "MANAGER", "CASHIER", "SALESPERSON"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permission to record debt payments." },
        { status: 403 }
      );
    }

    const customerId = params.id;
    const body = await request.json();
    const parsed = recordDebtPaymentSchema.parse(body);
    const repaymentAmount = new Decimal(parsed.amount.toString());

    return await db.$transaction(async (tx) => {
      // 1. Fetch customer with all completed sales & completed payments
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        include: {
          sales: {
            where: { status: "COMPLETED" },
            include: {
              payments: {
                where: { status: "COMPLETED" },
              },
            },
            orderBy: { createdAt: "asc" }, // FIFO order
          },
        },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "Customer account not found." },
          { status: 404 }
        );
      }

      // 2. Identify unpaid sales and calculate total outstanding balance
      let totalOutstanding = new Decimal(0);
      const openSales: {
        saleId: string;
        invoiceNumber: string;
        unpaid: Decimal;
      }[] = [];

      for (const sale of customer.sales) {
        const saleTotal = new Decimal(sale.total.toString());
        let paid = new Decimal(0);
        for (const p of sale.payments) {
          paid = paid.add(new Decimal(p.amount.toString()));
        }

        const unpaid = saleTotal.sub(paid);
        if (unpaid.greaterThan(0)) {
          totalOutstanding = totalOutstanding.add(unpaid);
          openSales.push({
            saleId: sale.id,
            invoiceNumber: sale.invoiceNumber,
            unpaid,
          });
        }
      }

      if (totalOutstanding.isZero()) {
        return NextResponse.json(
          { error: "This customer currently has no outstanding debt." },
          { status: 400 }
        );
      }

      if (repaymentAmount.greaterThan(totalOutstanding)) {
        return NextResponse.json(
          {
            error: `Payment amount (₦${repaymentAmount.toNumber().toLocaleString()}) exceeds the total outstanding balance (₦${totalOutstanding.toNumber().toLocaleString()}).`,
          },
          { status: 400 }
        );
      }

      // 3. Resolve active cash session if payment method is CASH
      let activeCashSessionId: string | null = null;
      if (parsed.method === "CASH") {
        const activeCashSession = await tx.cashSession.findFirst({
          where: {
            cashierId: user.employeeId,
            branchId: user.activeBranchId,
            status: "OPEN",
          },
        });

        if (!activeCashSession && user.role !== "OWNER") {
          return NextResponse.json(
            {
              error:
                "An active cash drawer session is required to accept cash repayments. Please open a cash session first.",
              code: "CASH_SESSION_REQUIRED",
            },
            { status: 400 }
          );
        }

        activeCashSessionId = activeCashSession?.id || null;
      }

      // 4. Allocate payment in FIFO order across open sales
      let remainingToAllocate = repaymentAmount;
      const settlementAllocations: {
        saleId: string;
        invoiceNumber: string;
        allocated: string;
      }[] = [];

      for (const saleItem of openSales) {
        if (remainingToAllocate.isZero()) break;

        const alloc = Decimal.min(remainingToAllocate, saleItem.unpaid);

        await tx.payment.create({
          data: {
            saleId: saleItem.saleId,
            amount: alloc,
            method: parsed.method,
            status: "COMPLETED",
            reference:
              parsed.reference ||
              `Debt settlement for ${saleItem.invoiceNumber}${
                parsed.notes ? ` - ${parsed.notes}` : ""
              }`,
            receivedBy: user.employeeId,
            cashSessionId: activeCashSessionId,
          },
        });

        settlementAllocations.push({
          saleId: saleItem.saleId,
          invoiceNumber: saleItem.invoiceNumber,
          allocated: alloc.toString(),
        });

        remainingToAllocate = remainingToAllocate.sub(alloc);
      }

      const newOutstanding = totalOutstanding.sub(repaymentAmount);

      // 5. Immutable Audit Log
      await tx.auditLog.create({
        data: {
          action: "CUSTOMER_DEBT_REPAID",
          userId: user.id,
          branchId: user.activeBranchId,
          entityType: "CUSTOMER",
          entityId: customer.id,
          description: `Debt payment of ₦${repaymentAmount.toNumber().toLocaleString()} recorded for ${customer.name} via ${parsed.method}. New debt: ₦${newOutstanding.toNumber().toLocaleString()}.`,
          newValue: {
            amount: repaymentAmount.toString(),
            method: parsed.method,
            newOutstanding: newOutstanding.toString(),
            allocations: settlementAllocations,
          },
        },
      });

      return NextResponse.json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          previousOutstanding: totalOutstanding.toNumber(),
          amountPaid: repaymentAmount.toNumber(),
          newOutstanding: newOutstanding.toNumber(),
        },
        allocations: settlementAllocations,
      });
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid payment payload.", issues: error.issues },
        { status: 400 }
      );
    }
    console.error("Debt repayment exception:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record debt repayment." },
      { status: 500 }
    );
  }
}
