import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import Decimal from "decimal.js";

const createCustomerSchema = z.object({
  name: z.string().min(2, "Customer name must be at least 2 characters"),
  phone: z.string().optional(),
  address: z.string().optional(),
  creditLimit: z.number().min(0, "Credit limit cannot be negative").default(0),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createCustomerSchema.parse(body);

    const customer = await db.customer.create({
      data: {
        name: parsed.name.trim(),
        phone: parsed.phone?.trim() || null,
        address: parsed.address?.trim() || null,
        creditLimit: new Decimal(parsed.creditLimit),
        status: "ACTIVE",
      },
    });

    await db.auditLog.create({
      data: {
        action: "CUSTOMER_CREATED",
        userId: user.id,
        branchId: user.activeBranchId,
        entityType: "CUSTOMER",
        entityId: customer.id,
        description: `Customer account registered: ${customer.name} (Credit limit: ₦${parsed.creditLimit.toLocaleString()})`,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid customer details.", issues: error.issues },
        { status: 400 }
      );
    }
    console.error("Customer creation exception:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create customer account." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    const where: any = {};
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
      ];
    }

    const customers = await db.customer.findMany({
      where,
      include: {
        sales: {
          include: {
            payments: true,
          },
        },
      },
      orderBy: { name: "asc" },
      take: 100,
    });

    const formatted = customers.map((c) => {
      let totalPurchases = new Decimal(0);
      let totalPaid = new Decimal(0);

      for (const sale of c.sales) {
        totalPurchases = totalPurchases.add(new Decimal(sale.total.toString()));
        for (const payment of sale.payments) {
          if (payment.status === "COMPLETED") {
            totalPaid = totalPaid.add(new Decimal(payment.amount.toString()));
          }
        }
      }

      const balance = totalPurchases.sub(totalPaid);

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        creditLimit: Number(c.creditLimit),
        status: c.status,
        totalPurchases: Number(totalPurchases),
        totalPaid: Number(totalPaid),
        outstandingBalance: Math.max(0, Number(balance)),
        invoicesCount: c.sales.length,
        createdAt: c.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ customers: formatted });
  } catch (error: any) {
    console.error("Customer retrieval exception:", error);
    return NextResponse.json(
      { error: "Failed to retrieve customers." },
      { status: 500 }
    );
  }
}
