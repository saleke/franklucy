import React from "react";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { CustomersWorkspace, CustomerData } from "@/components/customers/customers-workspace";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const rawCustomers = await db.customer.findMany({
    include: {
      sales: {
        include: {
          payments: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const initialCustomers: CustomerData[] = rawCustomers.map((c) => {
    let totalPurchases = new Decimal(0);
    let totalPaid = new Decimal(0);

    for (const sale of c.sales) {
      totalPurchases = totalPurchases.add(new Decimal(sale.total.toString()));
      for (const p of sale.payments) {
        if (p.status === "COMPLETED") {
          totalPaid = totalPaid.add(new Decimal(p.amount.toString()));
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

  return (
    <AppShell user={user}>
      <CustomersWorkspace initialCustomers={initialCustomers} />
    </AppShell>
  );
}
