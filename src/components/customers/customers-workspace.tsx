"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  FileText,
  X,
  TrendingUp,
  Receipt,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNaira, formatDateTime } from "@/lib/format";

export interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  creditLimit: number;
  status: string;
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  invoicesCount: number;
  createdAt: string;
}

interface CustomersWorkspaceProps {
  initialCustomers: CustomerData[];
}

export function CustomersWorkspace({ initialCustomers }: CustomersWorkspaceProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerData[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBalance, setFilterBalance] = useState<"ALL" | "WITH_DEBT" | "CLEAN">("ALL");

  // Add Customer Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected Customer for Details
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);

  // Debt Repayment Modal State
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [repaymentCustomer, setRepaymentCustomer] = useState<CustomerData | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [repaymentMethod, setRepaymentMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [repaymentNotes, setRepaymentNotes] = useState("");
  const [isSubmittingRepayment, setIsSubmittingRepayment] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | null>(null);
  const [repaymentSuccessMsg, setRepaymentSuccessMsg] = useState<string | null>(null);

  const openRepaymentModal = (customer: CustomerData, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRepaymentCustomer(customer);
    setRepaymentAmount(customer.outstandingBalance.toString());
    setRepaymentMethod("CASH");
    setRepaymentNotes("");
    setRepaymentError(null);
    setIsRepaymentModalOpen(true);
  };

  const handleRecordDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repaymentCustomer) return;

    const amt = Number(repaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setRepaymentError("Please enter a valid repayment amount.");
      return;
    }

    if (amt > repaymentCustomer.outstandingBalance) {
      setRepaymentError(
        `Repayment amount cannot exceed total outstanding debt (${formatNaira(
          repaymentCustomer.outstandingBalance
        )}).`
      );
      return;
    }

    setIsSubmittingRepayment(true);
    setRepaymentError(null);

    try {
      const res = await fetch(`/api/customers/${repaymentCustomer.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          method: repaymentMethod,
          notes: repaymentNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record debt repayment.");
      }

      // Update local state
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === repaymentCustomer.id
            ? {
                ...c,
                totalPaid: c.totalPaid + amt,
                outstandingBalance: Math.max(0, c.outstandingBalance - amt),
              }
            : c
        )
      );

      if (selectedCustomer?.id === repaymentCustomer.id) {
        setSelectedCustomer((prev) =>
          prev
            ? {
                ...prev,
                totalPaid: prev.totalPaid + amt,
                outstandingBalance: Math.max(0, prev.outstandingBalance - amt),
              }
            : null
        );
      }

      setIsRepaymentModalOpen(false);
      setRepaymentSuccessMsg(
        `Debt payment of ${formatNaira(amt)} recorded successfully for ${
          repaymentCustomer.name
        }.`
      );
      setTimeout(() => setRepaymentSuccessMsg(null), 4500);
      router.refresh();
    } catch (err: any) {
      setRepaymentError(err.message || "Failed to record debt payment.");
    } finally {
      setIsSubmittingRepayment(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (filterBalance === "WITH_DEBT" && c.outstandingBalance <= 0) return false;
    if (filterBalance === "CLEAN" && c.outstandingBalance > 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = c.phone?.toLowerCase().includes(q);
      const addrMatch = c.address?.toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !addrMatch) return false;
    }
    return true;
  });

  const totalCustomers = customers.length;
  const customersWithDebt = customers.filter((c) => c.outstandingBalance > 0).length;
  const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
  const totalPurchasesVolume = customers.reduce((sum, c) => sum + c.totalPurchases, 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Customer name is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          creditLimit: Number(creditLimit) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create customer.");
      }

      setIsModalOpen(false);
      setName("");
      setPhone("");
      setAddress("");
      setCreditLimit(0);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save customer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-brand-400" />
              Customer Accounts & Credit Ledger
            </h1>
            <Badge variant="outline" className="border-brand-500/30 text-brand-400">
              Receivables
            </Badge>
          </div>
          <p className="text-sm text-surface-400 mt-1">
            Enterprise customer directory, wholesale credit limits, and verified transaction ledgers.
          </p>
        </div>

        <Button
          onClick={() => {
            setErrorMessage(null);
            setIsModalOpen(true);
          }}
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium flex items-center gap-2 shadow-lg shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </Button>
      </div>

      {/* Success Notification Banner */}
      {repaymentSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{repaymentSuccessMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface-900/60 border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-surface-400 tracking-wider">
              Total Customers
            </span>
            <Users className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totalCustomers}</p>
          <p className="text-xs text-surface-500 mt-1">Active registered accounts</p>
        </Card>

        <Card className="p-4 bg-surface-900/60 border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-danger-400 tracking-wider">
              Total Receivables Owed
            </span>
            <AlertCircle className="w-4 h-4 text-danger-400" />
          </div>
          <p className="text-2xl font-bold text-danger-400 mt-2 font-mono">
            {formatNaira(totalOutstanding)}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            Across {customersWithDebt} debtor account{customersWithDebt === 1 ? "" : "s"}
          </p>
        </Card>

        <Card className="p-4 bg-surface-900/60 border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-success-400 tracking-wider">
              Debt-Free Accounts
            </span>
            <CheckCircle2 className="w-4 h-4 text-success-400" />
          </div>
          <p className="text-2xl font-bold text-success-400 mt-2">
            {totalCustomers - customersWithDebt}
          </p>
          <p className="text-xs text-surface-500 mt-1">Accounts with zero balance</p>
        </Card>

        <Card className="p-4 bg-surface-900/60 border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-brand-400 tracking-wider">
              Lifetime Sales Volume
            </span>
            <TrendingUp className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-mono">
            {formatNaira(totalPurchasesVolume)}
          </p>
          <p className="text-xs text-surface-500 mt-1">Total revenue generated</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-surface-900/60 border-surface-800">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer name, phone, address..."
              className="w-full pl-9 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setFilterBalance("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterBalance === "ALL"
                  ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                  : "bg-surface-800 text-surface-400 hover:text-white"
              }`}
            >
              All Accounts ({customers.length})
            </button>
            <button
              onClick={() => setFilterBalance("WITH_DEBT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterBalance === "WITH_DEBT"
                  ? "bg-danger-500/20 text-danger-400 border border-danger-500/30"
                  : "bg-surface-800 text-surface-400 hover:text-white"
              }`}
            >
              Outstanding Debt ({customersWithDebt})
            </button>
            <button
              onClick={() => setFilterBalance("CLEAN")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterBalance === "CLEAN"
                  ? "bg-success-500/20 text-success-400 border border-success-500/30"
                  : "bg-surface-800 text-surface-400 hover:text-white"
              }`}
            >
              Settled Accounts ({customers.length - customersWithDebt})
            </button>
          </div>
        </div>
      </Card>

      {/* Customers Table */}
      <Card className="bg-surface-900/60 border-surface-800 overflow-hidden">
        <div className="p-4 border-b border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-surface-400" />
            <h2 className="text-sm font-semibold uppercase text-surface-300 tracking-wider">
              Customer Accounts Directory ({filteredCustomers.length})
            </h2>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-surface-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-surface-300">No customers found</p>
            <p className="text-xs text-surface-500 mt-1">
              Add a customer account to track wholesale credit and purchase histories.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-950/60 text-surface-400 border-b border-surface-800 text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Customer Info</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">Credit Limit</th>
                  <th className="px-4 py-3">Total Purchases</th>
                  <th className="px-4 py-3">Settled / Paid</th>
                  <th className="px-4 py-3">Outstanding Debt</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {filteredCustomers.map((c) => {
                  const hasDebt = c.outstandingBalance > 0;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-surface-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedCustomer(c)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{c.name}</div>
                        {c.address && (
                          <div className="text-xs text-surface-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-surface-500" />
                            <span>{c.address}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-300">
                        {c.phone ? (
                          <div className="flex items-center gap-1 text-xs font-mono">
                            <Phone className="w-3 h-3 text-surface-500" />
                            <span>{c.phone}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-surface-600">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-surface-300">
                        {c.creditLimit > 0 ? (
                          formatNaira(c.creditLimit)
                        ) : (
                          <span className="text-surface-600">No Limit Set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-white">
                        {formatNaira(c.totalPurchases)}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-success-400">
                        {formatNaira(c.totalPaid)}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {hasDebt ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-danger-500/10 text-danger-400 border border-danger-500/20">
                            {formatNaira(c.outstandingBalance)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-surface-400 bg-surface-800">
                            Settled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasDebt && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => openRepaymentModal(c, e)}
                              className="h-7 px-2 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-medium gap-1"
                            >
                              <CreditCard className="w-3 h-3" />
                              Settle
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCustomer(c);
                            }}
                            className="text-xs text-brand-400 hover:text-brand-300"
                          >
                            {c.invoicesCount} {c.invoicesCount === 1 ? "Sale" : "Sales"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="bg-surface-900 border-surface-700 w-full max-w-md overflow-hidden shadow-2xl">
            <form onSubmit={handleCreateCustomer}>
              <div className="p-4 border-b border-surface-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-400" />
                  <h3 className="text-base font-bold text-white">Register Customer</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-surface-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-xs">
                    {errorMessage}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                    Customer / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alaba Wholesale Mart"
                    className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 08031234567"
                    className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                    Business / Store Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Shop 4B, Alaba Int Market, Lagos"
                    className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                    Credit Limit (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <span className="text-[11px] text-surface-500 mt-1 block">
                    Maximum allowed outstanding debt for credit sales.
                  </span>
                </div>
              </div>

              <div className="p-4 border-t border-surface-800 bg-surface-950 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="bg-brand-500 hover:bg-brand-600 text-white min-w-28"
                >
                  {isSubmitting ? "Saving..." : "Save Customer"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Customer Quick View Drawer/Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="bg-surface-900 border-surface-700 w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-surface-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-400" />
                <h3 className="text-base font-bold text-white">{selectedCustomer.name}</h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-surface-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-sm">
              <div className="bg-surface-950 p-3 rounded-lg border border-surface-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-surface-400">Phone:</span>
                  <span className="text-white font-mono">{selectedCustomer.phone || "Not provided"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Address:</span>
                  <span className="text-white text-right">{selectedCustomer.address || "Not provided"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Credit Limit:</span>
                  <span className="text-white font-mono">{formatNaira(selectedCustomer.creditLimit)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-950 border border-surface-800 rounded-lg">
                  <div className="text-[11px] text-surface-400 uppercase font-semibold">Total Purchases</div>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    {formatNaira(selectedCustomer.totalPurchases)}
                  </div>
                </div>

                <div className="p-3 bg-surface-950 border border-surface-800 rounded-lg">
                  <div className="text-[11px] text-surface-400 uppercase font-semibold">Outstanding Debt</div>
                  <div
                    className={`text-base font-bold font-mono mt-1 ${
                      selectedCustomer.outstandingBalance > 0 ? "text-danger-400" : "text-success-400"
                    }`}
                  >
                    {formatNaira(selectedCustomer.outstandingBalance)}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-surface-800/40 rounded-lg border border-surface-700/60 text-xs flex items-center justify-between">
                <span className="text-surface-300">Associated Invoices Recorded:</span>
                <span className="font-bold text-white font-mono">{selectedCustomer.invoicesCount}</span>
              </div>
            </div>

            <div className="p-4 border-t border-surface-800 bg-surface-950 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
              >
                Close
              </Button>

              {selectedCustomer.outstandingBalance > 0 && (
                <Button
                  size="sm"
                  onClick={() => openRepaymentModal(selectedCustomer)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <CreditCard className="w-4 h-4" />
                  Record Debt Payment
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Debt Repayment Settlement Modal */}
      {isRepaymentModalOpen && repaymentCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <Card className="bg-surface-900 border-surface-800 max-w-md w-full p-5 shadow-2xl animate-scaleUp">
            <form onSubmit={handleRecordDebtPayment} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Record Debt Payment
                    </h3>
                    <p className="text-[11px] text-surface-400">
                      Customer: {repaymentCustomer.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRepaymentModalOpen(false)}
                  className="text-surface-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {repaymentError && (
                <div className="p-2.5 bg-danger-500/10 border border-danger-500/30 rounded-lg text-danger-400 text-xs">
                  {repaymentError}
                </div>
              )}

              {/* Outstanding Debt Info Box */}
              <div className="p-3 rounded-lg bg-surface-950 border border-surface-800 flex justify-between items-center text-xs">
                <span className="text-surface-400">Total Outstanding Balance:</span>
                <span className="text-base font-bold font-mono text-danger-400">
                  {formatNaira(repaymentCustomer.outstandingBalance)}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-surface-300 mb-1">
                    Payment Amount to Settle (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={repaymentCustomer.outstandingBalance}
                    value={repaymentAmount}
                    onChange={(e) => setRepaymentAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full h-9 px-3 rounded-lg border border-surface-700 bg-surface-950 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="flex justify-between items-center text-[10px] text-surface-500 mt-1">
                    <span>Quick Select:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setRepaymentAmount(
                            Math.round(repaymentCustomer.outstandingBalance / 2).toString()
                          )
                        }
                        className="px-1.5 py-0.5 rounded bg-surface-800 hover:bg-surface-700 text-surface-300"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRepaymentAmount(repaymentCustomer.outstandingBalance.toString())
                        }
                        className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold"
                      >
                        Full (100%)
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-surface-300 mb-1">
                    Payment Tender Method *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRepaymentMethod("CASH")}
                      className={`py-2 px-3 rounded-lg font-medium border text-xs flex items-center justify-center gap-1.5 transition-colors ${
                        repaymentMethod === "CASH"
                          ? "bg-emerald-500 text-white border-emerald-500 font-bold shadow-sm"
                          : "bg-surface-950 border-surface-800 text-surface-400 hover:text-white"
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Cash Till
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepaymentMethod("BANK_TRANSFER")}
                      className={`py-2 px-3 rounded-lg font-medium border text-xs flex items-center justify-center gap-1.5 transition-colors ${
                        repaymentMethod === "BANK_TRANSFER"
                          ? "bg-emerald-500 text-white border-emerald-500 font-bold shadow-sm"
                          : "bg-surface-950 border-surface-800 text-surface-400 hover:text-white"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Bank Transfer
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-surface-300 mb-1">
                    Transaction Reference / Receipt Notes
                  </label>
                  <input
                    type="text"
                    value={repaymentNotes}
                    onChange={(e) => setRepaymentNotes(e.target.value)}
                    placeholder="e.g. Cleared via GTBank transfer or in-store cash deposit"
                    className="w-full h-8 px-2.5 rounded-lg border border-surface-700 bg-surface-950 text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-surface-500 mt-1">
                    Allocated automatically via FIFO across customer&apos;s oldest open invoices.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-surface-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRepaymentModalOpen(false)}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSubmittingRepayment}
                  className="flex-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                >
                  Confirm Repayment
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
