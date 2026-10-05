import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Receipt,
  ArrowUpRight,
  FileText,
  TrendingUp,
  Building2,
  User,
  CheckCircle2,
  Printer,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNaira, formatDateTime } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface SalesRegisterPageProps {
  searchParams?: {
    q?: string;
    status?: string;
    window?: string;
    branchId?: string;
    page?: string;
  };
}

export default async function SalesRegisterPage({ searchParams }: SalesRegisterPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const query = searchParams?.q?.trim();
  const statusFilter = searchParams?.status;

  // Window defaults strictly to 24 hours for delicate financial ledgers
  const rawWindow = searchParams?.window || "24h";
  const validWindows = ["24h", "today", "7d", "30d", "all"];
  const activeWindow = validWindows.includes(rawWindow) ? rawWindow : "24h";

  // Branch filtering defaults strictly to active branch
  const selectedBranchId =
    searchParams?.branchId !== undefined
      ? searchParams.branchId
      : user.activeBranchId;

  const currentPage = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const pageSize = 20;

  // Compute duration window dates
  const now = new Date();
  let startDate: Date | undefined;

  if (activeWindow === "24h") {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (activeWindow === "today") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (activeWindow === "7d") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (activeWindow === "30d") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (activeWindow === "all") {
    // No date boundary
  }

  const where: any = {};

  // Branch scoping (defaults strictly to user active branch)
  if (!user.isOwner) {
    where.branchId = user.activeBranchId;
  } else if (selectedBranchId === "ALL") {
    // Consolidated across all branches
  } else {
    where.branchId = selectedBranchId || user.activeBranchId;
  }

  if (user.role === "CASHIER" || user.role === "SALESPERSON") {
    where.cashierId = user.employeeId;
  }

  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  if (startDate) {
    where.createdAt = { gte: startDate };
  }

  if (query) {
    where.OR = [
      { invoiceNumber: { contains: query, mode: "insensitive" } },
      { customer: { name: { contains: query, mode: "insensitive" } } },
      { cashier: { firstName: { contains: query, mode: "insensitive" } } },
    ];
  }

  const [totalCount, sales, windowTotals, branches] = await Promise.all([
    db.sale.count({ where }),
    db.sale.findMany({
      where,
      include: {
        items: { include: { product: true } },
        payments: true,
        customer: true,
        cashier: true,
        branch: true,
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (currentPage - 1) * pageSize,
    }),
    db.sale.findMany({
      where,
      select: {
        total: true,
      },
    }),
    user.isOwner
      ? db.branch.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const totalVolume = windowTotals.reduce(
    (acc, s) => acc + Number(s.total.toString()),
    0
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // URL builder helper
  const createFilterUrl = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      q: query || undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      window: activeWindow !== "24h" ? activeWindow : undefined,
      branchId: selectedBranchId !== user.activeBranchId ? selectedBranchId : undefined,
      page: "1",
      ...overrides,
    };

    for (const [key, val] of Object.entries(merged)) {
      if (val && val !== "ALL") {
        params.set(key, val);
      } else if (val === "ALL" && key === "branchId") {
        params.set("branchId", "ALL");
      }
    }
    const qs = params.toString();
    return `/sales${qs ? `?${qs}` : ""}`;
  };

  // Resolve scope display
  const activeBranchRecord = branches.find((b) => b.id === selectedBranchId);
  const activeScopeLabel = user.isOwner
    ? selectedBranchId === "ALL"
      ? "All Branches (Consolidated)"
      : `${activeBranchRecord?.name || user.activeBranchName} (${activeBranchRecord?.code || user.activeBranchCode})`
    : `${user.activeBranchName} (${user.activeBranchCode})`;

  return (
    <AppShell user={user}>
      <div className="space-y-5">
        {/* Header & New Sale Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
              <div className="w-8 h-8 rounded-card bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span>Sales & Invoices Register</span>
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Authoritative transaction records, immutable invoices & payment allocations
            </p>
          </div>

          <div className="flex items-center gap-2">
            {["OWNER", "MANAGER", "CASHIER", "SALESPERSON"].includes(user.role) && (
              <Link
                href="/sales/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-subtle bg-brand hover:bg-brand-hover text-white text-xs font-bold shadow-md transition-colors h-9"
              >
                <Plus className="w-4 h-4" />
                <span>New Sale POS</span>
              </Link>
            )}
          </div>
        </div>

        {/* Summary Metric Ribbon with Organic Ambient Glow */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="relative overflow-hidden p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-surface to-surface border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-16 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Window Sales Volume
                </span>
                <div className="w-7 h-7 rounded-subtle bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-black text-text-primary tracking-tight font-mono">
                {formatNaira(totalVolume)}
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5 font-medium">
                {totalCount} total transactions in window
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-surface to-surface border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-16 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Invoices Recorded
                </span>
                <div className="w-7 h-7 rounded-subtle bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-black text-text-primary tracking-tight font-mono">
                {totalCount}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                Page {currentPage} of {totalPages}
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-surface to-surface border border-violet-500/20 hover:border-violet-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-16 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                  Active Scope
                </span>
                <div className="w-7 h-7 rounded-subtle bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-text-primary mt-1 truncate">
                {activeScopeLabel}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5 font-mono">
                Role: {user.role}
              </div>
            </div>
          </Card>
        </div>

        {/* Filters Toolbar */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            {/* Search Input */}
            <form className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="q"
                defaultValue={query || ""}
                placeholder="Search by invoice #, customer, cashier..."
                className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand"
              />
              {activeWindow !== "24h" && <input type="hidden" name="window" value={activeWindow} />}
              {selectedBranchId && selectedBranchId !== user.activeBranchId && (
                <input type="hidden" name="branchId" value={selectedBranchId} />
              )}
              {statusFilter && statusFilter !== "ALL" && (
                <input type="hidden" name="status" value={statusFilter} />
              )}
            </form>

            {/* Duration Window Switcher (Defaults to 24 Hours) */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-0.5">
              <span className="text-[11px] text-text-muted flex items-center gap-1 mr-1 shrink-0">
                <Clock className="w-3 h-3 text-amber-400" />
                Window:
              </span>
              {[
                { id: "24h", label: "Last 24 Hours" },
                { id: "today", label: "Today" },
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
                { id: "all", label: "All Time" },
              ].map((w) => (
                <Link
                  key={w.id}
                  href={createFilterUrl({ window: w.id, page: "1" })}
                  className={`px-2.5 py-1 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeWindow === w.id
                      ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                      : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {w.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Owner Branch Location Switcher Pills (Defaults to Active Branch) */}
          {user.isOwner && branches.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
              <span className="text-[11px] text-text-muted flex items-center gap-1 mr-1 shrink-0">
                <Building2 className="w-3 h-3 text-violet-400" />
                Branch:
              </span>
              {branches.map((b) => (
                <Link
                  key={b.id}
                  href={createFilterUrl({ branchId: b.id, page: "1" })}
                  className={`px-2.5 py-1 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedBranchId === b.id
                      ? "bg-violet-600 text-white shadow-xs"
                      : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {b.name} ({b.code})
                </Link>
              ))}
              <Link
                href={createFilterUrl({ branchId: "ALL", page: "1" })}
                className={`px-2.5 py-1 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedBranchId === "ALL"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                All Branches
              </Link>
            </div>
          )}

          {/* Status Filter Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
            <span className="text-[11px] text-text-muted flex items-center gap-1 mr-1 shrink-0">
              <Filter className="w-3 h-3 text-brand" />
              Status:
            </span>
            <Link
              href={createFilterUrl({ status: "ALL", page: "1" })}
              className={`px-3 py-1 rounded-subtle text-xs font-semibold transition-colors whitespace-nowrap ${
                !statusFilter || statusFilter === "ALL"
                  ? "bg-brand text-white shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              All Invoices
            </Link>
            <Link
              href={createFilterUrl({ status: "COMPLETED", page: "1" })}
              className={`px-3 py-1 rounded-subtle text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === "COMPLETED"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              Completed
            </Link>
            <Link
              href={createFilterUrl({ status: "CANCELLED", page: "1" })}
              className={`px-3 py-1 rounded-subtle text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === "CANCELLED"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              Cancelled
            </Link>
          </div>
        </div>

        {/* Table of Invoices */}
        <Card className="p-0 overflow-hidden border-border bg-surface shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-surface-elevated/40 border-b border-border text-text-secondary uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4 w-[16%]">Invoice #</th>
                  <th className="py-3 px-4 w-[13%]">Date & Time</th>
                  <th className="py-3 px-4 w-[15%]">Customer</th>
                  <th className="py-3 px-4 w-[9%]">Branch</th>
                  <th className="py-3 px-4 w-[20%]">Items Summary</th>
                  <th className="py-3 px-4 w-[12%] text-right">Total Amount</th>
                  <th className="py-3 px-4 w-[11%] text-center">Settlement Status</th>
                  <th className="py-3 px-4 w-[9%] text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sales.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-text-muted text-xs"
                    >
                      <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No sales records found in current view.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="hover:bg-surface-elevated/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span className="font-mono font-bold text-text-primary">
                            {sale.invoiceNumber}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-text-secondary whitespace-nowrap font-mono text-[11px]">
                        {formatDateTime(sale.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-medium text-text-primary">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-[9px] font-bold text-text-secondary shrink-0">
                            {(sale.customer?.name || "W")[0]}
                          </div>
                          <span className="truncate max-w-[140px] inline-block">{sale.customer?.name || "Walk-in Customer"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text-secondary">
                          {sale.branch.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">
                        <div className="max-w-[200px] truncate" title={sale.items.map((i) => `${i.quantity}x ${i.product.name}`).join(", ")}>
                          {sale.items
                            .map((i) => `${i.quantity}× ${i.product.name}`)
                            .join(", ")}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-text-primary font-mono text-xs">
                        {formatNaira(sale.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {sale.status === "COMPLETED" ? (
                          (() => {
                            const totalPaid = sale.payments
                              .filter((p) => p.status === "COMPLETED")
                              .reduce(
                                (acc, p) => acc + Number(p.amount.toString()),
                                0
                              );
                            const unpaid = Math.max(
                              0,
                              Number(sale.total.toString()) - totalPaid
                            );

                            if (unpaid <= 0.01) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Settled
                                </span>
                              );
                            } else if (totalPaid <= 0.01) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                                  Store Credit ({formatNaira(unpaid)})
                                </span>
                              );
                            } else {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                  Deposit ({formatNaira(unpaid)} Due)
                                </span>
                              );
                            }
                          })()
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                            {sale.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right pr-5">
                        <Link
                          href={`/sales/${sale.id}/invoice`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-surface-elevated/70 hover:bg-brand hover:text-white text-[11px] font-bold transition-all shadow-xs"
                        >
                          <Printer className="w-3 h-3 text-text-muted" />
                          <span>Invoice</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-border bg-surface-elevated/20 text-xs">
              <span className="text-text-muted">
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, totalCount)} of {totalCount} records
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={createFilterUrl({ page: String(Math.max(1, currentPage - 1)) })}
                  className={`px-2.5 py-1 rounded border border-border bg-surface text-text-primary flex items-center gap-1 text-xs ${
                    currentPage === 1 ? "opacity-40 pointer-events-none" : "hover:bg-surface-elevated"
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </Link>
                <span className="px-2 font-mono text-text-primary font-semibold">
                  Page {currentPage} of {totalPages}
                </span>
                <Link
                  href={createFilterUrl({ page: String(Math.min(totalPages, currentPage + 1)) })}
                  className={`px-2.5 py-1 rounded border border-border bg-surface text-text-primary flex items-center gap-1 text-xs ${
                    currentPage === totalPages ? "opacity-40 pointer-events-none" : "hover:bg-surface-elevated"
                  }`}
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
