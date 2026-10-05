import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBranchInvoiceConfig } from "@/lib/business-config";
import {
  PrintableInvoiceView,
  InvoiceData,
} from "@/components/sales/printable-invoice-view";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

export default async function SaleInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const sale = await db.sale.findUnique({
    where: { id: params.id },
    include: {
      branch: true,
      cashier: true,
      customer: {
        include: {
          sales: {
            where: { status: "COMPLETED" },
            include: {
              payments: { where: { status: "COMPLETED" } },
            },
          },
        },
      },
      items: {
        include: { product: true },
      },
      payments: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!sale) {
    notFound();
  }

  // Branch access check for non-owners
  if (!user.isOwner && sale.branchId !== user.activeBranchId) {
    redirect("/sales");
  }

  // Calculate customer's overall outstanding balance
  let customerTotalOutstanding = 0;
  if (sale.customer) {
    let purchases = new Decimal(0);
    let paid = new Decimal(0);
    for (const s of sale.customer.sales) {
      purchases = purchases.add(new Decimal(s.total.toString()));
      for (const p of s.payments) {
        paid = paid.add(new Decimal(p.amount.toString()));
      }
    }
    customerTotalOutstanding = Math.max(0, purchases.sub(paid).toNumber());
  }

  const invoiceConfig = getBranchInvoiceConfig(sale.branch);

  const invoiceData: InvoiceData = {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    createdAt: sale.createdAt.toISOString(),
    status: sale.status,
    subtotal: Number(sale.subtotal.toString()),
    discount: Number(sale.discount.toString()),
    total: Number(sale.total.toString()),
    notes: sale.notes,
    branch: {
      id: sale.branch.id,
      name: sale.branch.name,
      code: sale.branch.code,
      address: sale.branch.address,
      phone: sale.branch.phone,
    },
    customer: sale.customer
      ? {
          id: sale.customer.id,
          name: sale.customer.name,
          phone: sale.customer.phone,
          address: sale.customer.address,
          creditLimit: Number(sale.customer.creditLimit.toString()),
          totalOutstanding: customerTotalOutstanding,
        }
      : null,
    cashier: {
      id: sale.cashier.id,
      name: `${sale.cashier.firstName} ${sale.cashier.lastName}`,
    },
    items: sale.items.map((i) => ({
      id: i.id,
      productName: i.product.name,
      sku: i.product.sku,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice.toString()),
      lineTotal: Number(i.lineTotal.toString()),
      unit: i.unitName || i.product.inventoryUnit,
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount.toString()),
      method: p.method,
      status: p.status,
      reference: p.reference,
      createdAt: p.createdAt.toISOString(),
    })),
    config: invoiceConfig,
  };

  return <PrintableInvoiceView invoice={invoiceData} />;
}
