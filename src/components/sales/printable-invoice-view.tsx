"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Printer,
  ArrowLeft,
  Copy,
  Check,
  Building2,
  Phone,
  Mail,
  Calendar,
  User,
  CreditCard,
  FileText,
  BadgeCheck,
  AlertTriangle,
  Receipt,
  Share2,
} from "lucide-react";
import { formatNaira, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { BrandLogoIcon } from "@/components/ui/brand-logo";
import { ResolvedBranchInvoiceConfig } from "@/lib/business-config";

export interface InvoiceItemData {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unit: string;
}

export interface InvoicePaymentData {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  createdAt: string;
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  branch: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    creditLimit: number;
    totalOutstanding: number;
  } | null;
  cashier: {
    id: string;
    name: string;
    code?: string;
  };
  items: InvoiceItemData[];
  payments: InvoicePaymentData[];
  config: ResolvedBranchInvoiceConfig;
}

interface PrintableInvoiceViewProps {
  invoice: InvoiceData;
  onClose?: () => void;
  isModal?: boolean;
}

export const PrintableInvoiceView: React.FC<PrintableInvoiceViewProps> = ({
  invoice,
  onClose,
  isModal = false,
}) => {
  const [printFormat, setPrintFormat] = useState<"A4" | "THERMAL">("A4");
  const [copied, setCopied] = useState(false);

  // Calculations
  const totalPaid = invoice.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0);

  const outstandingThisInvoice = Math.max(0, invoice.total - totalPaid);
  const isFullyPaid = outstandingThisInvoice <= 0.01;
  const isCreditSale = totalPaid <= 0.01;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-6 print:p-0 print:bg-white print:text-black">
      {/* Print-specific CSS stylesheet for pixel-perfect printing */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${printFormat === "THERMAL" ? "80mm auto" : "A4 portrait"};
            margin: ${printFormat === "THERMAL" ? "4mm" : "10mm"};
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Floating Top Control Bar (Screen only) */}
      <div className="no-print max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 bg-surface-elevated/70 backdrop-blur-md p-3.5 rounded-xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          {isModal && onClose ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs gap-1.5 border-white/15"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Close Preview
            </Button>
          ) : (
            <Link
              href="/sales"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-surface text-text-secondary hover:text-white text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sales
            </Link>
          )}

          <div className="h-4 w-px bg-white/15 mx-1" />

          {/* Format Switcher */}
          <div className="flex items-center bg-surface p-0.5 rounded-lg border border-white/10 text-xs">
            <button
              onClick={() => setPrintFormat("A4")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                printFormat === "A4"
                  ? "bg-brand text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              A4 Commercial
            </button>
            <button
              onClick={() => setPrintFormat("THERMAL")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                printFormat === "THERMAL"
                  ? "bg-brand text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              80mm Thermal POS
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs gap-1.5 border-white/15"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Link
                </>
              )}
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            className="text-xs gap-2 font-bold shadow-md bg-gradient-to-r from-sky-500 to-teal-500 text-white"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORMAT 1: A4 COMMERCIAL INVOICE TEMPLATE                                  */}
      {/* ========================================================================= */}
      {printFormat === "A4" && (
        <div className="print-sheet max-w-4xl mx-auto bg-white text-slate-900 rounded-2xl shadow-2xl p-8 sm:p-12 border border-slate-200 font-sans print:shadow-none print:rounded-none">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-8 border-b-2 border-slate-900">
            {/* Business Brand & Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center p-2 shadow-md">
                  <BrandLogoIcon className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase leading-none">
                    {invoice.config.businessName}
                  </h1>
                  <p className="text-xs font-semibold text-sky-700 tracking-wide mt-0.5">
                    {invoice.config.tagline}
                  </p>
                </div>
              </div>

              <div className="pt-2 text-xs text-slate-600 space-y-0.5 leading-relaxed">
                <p className="font-semibold text-slate-800">
                  Branch: {invoice.config.branchName} ({invoice.config.branchCode})
                </p>
                <p>{invoice.config.branchAddress}</p>
                <p>
                  Tel: <span className="font-mono">{invoice.config.branchPhone}</span> | Email: {invoice.config.supportEmail}
                </p>
                <p className="font-mono text-[11px] text-slate-500">
                  Reg / CAC: {invoice.config.registrationNumber} | TIN: {invoice.config.taxId}
                </p>
              </div>
            </div>

            {/* Invoice Meta Box */}
            <div className="sm:text-right space-y-2">
              <div className="inline-block px-3 py-1 rounded-md bg-slate-100 font-mono text-xs font-bold uppercase tracking-wider text-slate-800 border border-slate-300">
                Official Commercial Invoice
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-slate-950">
                {invoice.invoiceNumber}
              </div>
              <div className="text-xs text-slate-600 space-y-0.5">
                <p>
                  Date Issued:{" "}
                  <span className="font-medium text-slate-900 font-mono">
                    {formatDateTime(invoice.createdAt)}
                  </span>
                </p>
                <p>
                  Cashier:{" "}
                  <span className="font-medium text-slate-900 font-mono">
                    {invoice.cashier.name}
                  </span>
                </p>
                <div className="pt-1.5">
                  {isFullyPaid ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      Paid in Full
                    </span>
                  ) : isCreditSale ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      100% Store Credit
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-300">
                      <CreditCard className="w-3.5 h-3.5" />
                      Partially Settled (Deposit Paid)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Billed To / Client Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Billed To (Customer Details)
              </span>
              <div className="mt-1">
                <div className="text-sm font-bold text-slate-900">
                  {invoice.customer ? invoice.customer.name : "Walk-in Customer (Counter Sale)"}
                </div>
                {invoice.customer?.phone && (
                  <p className="text-slate-600 font-mono mt-0.5">
                    Phone: {invoice.customer.phone}
                  </p>
                )}
                {invoice.customer?.address && (
                  <p className="text-slate-600 mt-0.5">{invoice.customer.address}</p>
                )}
                {invoice.customer && invoice.customer.creditLimit > 0 && (
                  <p className="text-slate-500 font-mono mt-1 text-[11px]">
                    Authorized Credit Limit: {formatNaira(invoice.customer.creditLimit)}
                  </p>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Fulfillment Location
              </span>
              <div className="mt-1 text-slate-700 space-y-0.5">
                <p className="font-bold text-slate-900">{invoice.branch.name}</p>
                <p>{invoice.branch.address || invoice.config.branchAddress}</p>
                <p className="font-mono text-slate-500">Station Terminal: POS-{invoice.branch.code}</p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto my-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items.map((item, idx) => (
                  <tr key={item.id} className="text-slate-800">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <div>{item.productName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{item.sku}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                      {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatNaira(item.unitPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950">
                      {formatNaira(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation & Settlement Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t-2 border-slate-900">
            {/* Left Column: Bank Remittance Details for Outstanding Balances */}
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-sky-600" />
                  Bank Remittance Instructions
                </div>
                <div className="space-y-1 text-slate-700">
                  <p className="font-semibold text-slate-900">
                    Bank: {invoice.config.bankDetails.bankName}
                  </p>
                  <p className="font-mono font-bold text-sm text-sky-800">
                    Account #: {invoice.config.bankDetails.accountNumber}
                  </p>
                  <p className="text-[11px]">
                    Account Name: {invoice.config.bankDetails.accountName}
                  </p>
                  <p className="text-[10px] text-slate-500 italic mt-1">
                    *{invoice.config.bankDetails.instructions} (Narration: {invoice.invoiceNumber})
                  </p>
                </div>
              </div>

              {invoice.notes && (
                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900">
                  <span className="font-bold">Transaction Narration: </span>
                  {invoice.notes}
                </div>
              )}
            </div>

            {/* Right Column: Authoritative Financial Totals */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Subtotal ({invoice.items.reduce((s, i) => s + i.quantity, 0)} units):</span>
                <span className="font-mono">{formatNaira(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Authorized Commercial Discount:</span>
                <span className="font-mono">₦0.00</span>
              </div>

              <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold text-slate-950">
                <span>TOTAL PURCHASE AMOUNT:</span>
                <span className="font-mono text-base">{formatNaira(invoice.total)}</span>
              </div>

              {/* Settlement Breakdown */}
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 space-y-1.5">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>Amount Paid (Tendered Today):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatNaira(totalPaid)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-900">
                    THIS INVOICE BALANCE DUE:
                  </span>
                  <span
                    className={`font-mono font-black text-sm ${
                      outstandingThisInvoice > 0 ? "text-rose-600" : "text-emerald-700"
                    }`}
                  >
                    {formatNaira(outstandingThisInvoice)}
                  </span>
                </div>

                {invoice.customer && (
                  <div className="pt-2 border-t border-slate-300 text-[11px] space-y-0.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Customer Total Account Debt:</span>
                      <span className="font-mono font-bold text-rose-600">
                        {formatNaira(invoice.customer.totalOutstanding)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Legal Declarations & Signatures */}
          <div className="mt-10 pt-6 border-t border-slate-200 text-slate-500 text-[11px] leading-relaxed">
            <p className="text-center font-medium">
              {invoice.config.invoiceTerms}
            </p>

            <div className="grid grid-cols-2 gap-12 mt-12 pt-6 text-xs text-slate-700">
              <div className="text-center">
                <div className="border-b border-slate-400 h-8 mb-2" />
                <p className="font-bold text-slate-900">Authorized Cashier Signature</p>
                <p className="text-[10px] text-slate-500">{invoice.cashier.name}</p>
              </div>

              <div className="text-center">
                <div className="border-b border-slate-400 h-8 mb-2" />
                <p className="font-bold text-slate-900">Customer Acceptance Signature</p>
                <p className="text-[10px] text-slate-500">
                  {invoice.customer ? invoice.customer.name : "Customer (Received in Good Condition)"}
                </p>
              </div>
            </div>

            <div className="text-center mt-6 text-[10px] text-slate-400 font-mono">
              Generated by FrankLucy ERP • {invoice.invoiceNumber} • Page 1 of 1
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORMAT 2: 80MM POS THERMAL SLIP TEMPLATE                                  */}
      {/* ========================================================================= */}
      {printFormat === "THERMAL" && (
        <div className="print-sheet max-w-[340px] mx-auto bg-white text-black p-4 rounded-xl shadow-2xl font-mono text-[11px] leading-tight border border-slate-200 print:shadow-none print:rounded-none">
          {/* Thermal Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-black">
            <div className="w-8 h-8 rounded-lg bg-black text-white mx-auto flex items-center justify-center p-1.5 mb-1">
              <BrandLogoIcon className="w-full h-full" />
            </div>
            <h2 className="font-black text-xs uppercase tracking-tight">
              {invoice.config.tradingName}
            </h2>
            <p className="text-[10px] font-semibold">{invoice.config.tagline}</p>
            <p className="text-[9px] text-slate-700">
              {invoice.config.branchName} • {invoice.config.branchPhone}
            </p>
            <p className="text-[9px] text-slate-500">
              RC: {invoice.config.registrationNumber}
            </p>
          </div>

          {/* Thermal Invoice Details */}
          <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
            <div className="flex justify-between font-bold">
              <span>INV: {invoice.invoiceNumber}</span>
              <span>{invoice.branch.code}</span>
            </div>
            <div className="flex justify-between">
              <span>Date: {formatDateTime(invoice.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier: {invoice.cashier.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer: {invoice.customer?.name || "Walk-in"}</span>
            </div>
          </div>

          {/* Thermal Items List */}
          <div className="py-2 border-b border-dashed border-black space-y-1.5">
            <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-black">
              <span>ITEM</span>
              <span>QTY × PRICE</span>
              <span>TOTAL</span>
            </div>
            {invoice.items.map((item) => (
              <div key={item.id} className="space-y-0.5">
                <div className="font-bold text-[10px] truncate">{item.productName}</div>
                <div className="flex justify-between text-[10px] text-slate-700">
                  <span>{item.quantity} {item.unit} @ {formatNaira(item.unitPrice)}</span>
                  <span className="font-bold text-black">{formatNaira(item.lineTotal)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Thermal Totals & Outstanding Settlement */}
          <div className="py-2 border-b border-dashed border-black space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatNaira(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between font-black text-xs pt-1 border-t border-black">
              <span>TOTAL DUE:</span>
              <span>{formatNaira(invoice.total)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Tendered / Paid:</span>
              <span>{formatNaira(totalPaid)}</span>
            </div>
            <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
              <span>BALANCE OUTSTANDING:</span>
              <span className={outstandingThisInvoice > 0 ? "font-black" : ""}>
                {formatNaira(outstandingThisInvoice)}
              </span>
            </div>

            {invoice.customer && invoice.customer.totalOutstanding > 0 && (
              <div className="pt-1.5 text-[9px] border-t border-dotted border-black flex justify-between">
                <span>Total Account Debt:</span>
                <span className="font-bold">
                  {formatNaira(invoice.customer.totalOutstanding)}
                </span>
              </div>
            )}
          </div>

          {/* Thermal Footer */}
          <div className="text-center pt-3 space-y-1 text-[9px]">
            <p className="font-bold">THANK YOU FOR YOUR PATRONAGE!</p>
            <p className="text-[8px] text-slate-600">
              Goods received in good condition. Balances payable as agreed.
            </p>
            <div className="pt-2 font-mono text-[8px] text-slate-400">
              *** FrankLucy POS System ***
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
