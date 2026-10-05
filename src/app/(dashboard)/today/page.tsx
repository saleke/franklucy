import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  Users,
  Package,
  ArrowRight,
  Clock,
  ArrowLeftRight,
  CheckCircle2,
  DollarSign,
  Calendar,
  Building2,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNaira, formatDateTime, formatTimeOnly } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface TodayPageProps {
  searchParams?: {
    branchId?: string;
  };
}

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Branch scoping: defaults strictly to user active branch for all roles including owner
  const selectedBranchId =
    searchParams?.branchId !== undefined
      ? searchParams.branchId
      : user.activeBranchId;
  const isConsolidated = user.isOwner && selectedBranchId === "ALL";

  // Fetch branches for owner switcher
  const allBranches = user.isOwner
    ? await db.branch.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      })
    : [];

  const scopedBranch = !isConsolidated
    ? await db.branch.findUnique({
        where: { id: selectedBranchId },
      })
    : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 1. Fetch Today's Sales Count & Financial Totals
  const salesWhere: any = {
    createdAt: { gte: todayStart, lte: todayEnd },
    status: "COMPLETED",
  };
  if (!isConsolidated) {
    salesWhere.branchId = selectedBranchId;
  }
  if (user.role === "CASHIER" || user.role === "SALESPERSON") {
    salesWhere.cashierId = user.employeeId;
  }

  const N_RECENT_SALES = 8;

  const [totalSalesCount, salesTotals, todayRecentSales] = await Promise.all([
    db.sale.count({ where: salesWhere }),
    db.sale.findMany({
      where: salesWhere,
      select: {
        total: true,
        payments: {
          select: { amount: true, method: true },
        },
      },
    }),
    db.sale.findMany({
      where: salesWhere,
      include: {
        items: { include: { product: true } },
        payments: true,
        customer: true,
        cashier: true,
      },
      orderBy: { createdAt: "desc" },
      take: N_RECENT_SALES,
    }),
  ]);

  const totalSalesRevenue = salesTotals.reduce(
    (acc, s) => acc + Number(s.total.toString()),
    0
  );

  const totalCashCollected = salesTotals.reduce((acc, s) => {
    const cash = s.payments
      .filter((p) => p.method === "CASH")
      .reduce((pAcc, p) => pAcc + Number(p.amount.toString()), 0);
    return acc + cash;
  }, 0);

  const totalTransferCollected = salesTotals.reduce((acc, s) => {
    const transfer = s.payments
      .filter((p) => p.method === "BANK_TRANSFER")
      .reduce((pAcc, p) => pAcc + Number(p.amount.toString()), 0);
    return acc + transfer;
  }, 0);

  // 2. Fetch Low Stock / Inventory Alerts
  const branchProductsWhere: any = {
    status: "ACTIVE",
  };
  if (!isConsolidated) {
    branchProductsWhere.branchId = selectedBranchId;
  }

  const branchProducts = await db.branchProduct.findMany({
    where: branchProductsWhere,
    include: { product: true, branch: true },
    orderBy: { currentStock: "asc" },
  });

  const lowStockItems = branchProducts.filter(
    (bp) => bp.currentStock <= bp.reorderLevel
  );

  // 3. Fetch Recent Activity / Audit Events
  const auditWhere: any = {};
  if (!isConsolidated) {
    auditWhere.branchId = selectedBranchId;
  }

  const recentAudits = await db.auditLog.findMany({
    where: auditWhere,
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { user: true, branch: true },
  });

  // 4. Fetch Attendance for Today
  const todayAttendance = await db.attendance.findUnique({
    where: {
      employeeId_workDate: {
        employeeId: user.employeeId,
        workDate: todayStart,
      },
    },
  });

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header Greeting & Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Frank<span className="text-brand">Lucy</span> Commercial Network
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Good day, {user.employeeName.split(" ")[0]}
            </h1>
            <p className="text-xs text-text-secondary mt-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span>
                {new Intl.DateTimeFormat("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date())}
              </span>
              <span>·</span>
              <span className="font-semibold text-brand">
                {isConsolidated
                  ? "All Branches (Consolidated)"
                  : `${scopedBranch?.name || user.activeBranchName} (${scopedBranch?.code || user.activeBranchCode})`}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {["OWNER", "MANAGER", "CASHIER", "SALESPERSON"].includes(user.role) && (
              <Link
                href="/sales/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-subtle bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-sm transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>+ New Sale</span>
              </Link>
            )}
          </div>
        </div>

        {/* Owner Branch Location Switcher Pills (Defaults strictly to Active Branch) */}
        {user.isOwner && allBranches.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-text-muted flex items-center gap-1 mr-1 shrink-0 font-medium">
              <Building2 className="w-3.5 h-3.5 text-brand" />
              Branch Scope:
            </span>
            {allBranches.map((b) => (
              <Link
                key={b.id}
                href={`/today?branchId=${b.id}`}
                className={`px-2.5 py-1 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedBranchId === b.id
                    ? "bg-brand text-white shadow-xs font-bold"
                    : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {b.name} ({b.code})
              </Link>
            ))}
            <Link
              href="/today?branchId=ALL"
              className={`px-2.5 py-1 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedBranchId === "ALL"
                  ? "bg-brand text-white shadow-xs font-bold"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              All Branches (Consolidated)
            </Link>
          </div>
        )}

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-surface to-surface border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-20 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-[10px]">
                Today&apos;s Revenue
              </span>
              <div className="w-8 h-8 rounded-card bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 relative">
              <div className="text-2xl font-black text-text-primary tracking-tight">
                {formatNaira(totalSalesRevenue)}
              </div>
              <p className="text-[11px] text-emerald-400 font-medium mt-1">
                {totalSalesCount} completed transactions
              </p>
            </div>
          </Card>

          <Card className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-surface to-surface border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-20 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-[10px]">
                Cash in Till
              </span>
              <div className="w-8 h-8 rounded-card bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 relative">
              <div className="text-2xl font-black text-text-primary tracking-tight">
                {formatNaira(totalCashCollected)}
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                {formatNaira(totalTransferCollected)} via bank transfer
              </p>
            </div>
          </Card>

          <Card className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-surface to-surface border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-20 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-[10px]">
                Inventory Status
              </span>
              <div
                className={`w-8 h-8 rounded-card flex items-center justify-center ${
                  lowStockItems.length > 0
                    ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                    : "bg-surface-elevated text-text-muted border border-border"
                }`}
              >
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 relative">
              <div className="text-2xl font-black text-text-primary tracking-tight">
                {lowStockItems.length > 0 ? (
                  <span className="text-amber-400">
                    {lowStockItems.length} Low Stock
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold text-xl">All Healthy</span>
                )}
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                {branchProducts.length} tracked product SKUs
              </p>
            </div>
          </Card>

          <Card className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-surface to-surface border border-violet-500/20 hover:border-violet-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-20 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider text-[10px]">
                {user.isOwner ? "Shift Governance" : "My Attendance"}
              </span>
              <div className="w-8 h-8 rounded-card bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-sm font-bold text-text-primary flex items-center gap-2">
                {user.isOwner ? (
                  <>
                    <span className="text-violet-300 font-bold">
                      Executive Exempt
                    </span>
                    <Badge variant="info">
                      EXEMPT
                    </Badge>
                  </>
                ) : todayAttendance ? (
                  <>
                    <span className="text-emerald-400 font-semibold">
                      Clocked In ({formatTimeOnly(todayAttendance.clockIn)})
                    </span>
                    <Badge variant="success">
                      {todayAttendance.status}
                    </Badge>
                  </>
                ) : (
                  <span className="text-amber-400 text-xs font-semibold">
                    Not Clocked In Yet
                  </span>
                )}
              </div>
              <Link
                href="/attendance"
                className="text-[11px] text-brand hover:underline mt-1.5 inline-block font-medium"
              >
                {user.isOwner ? "Audit Staff Attendance →" : "View Attendance Hub →"}
              </Link>
            </div>
          </Card>
        </div>

        {/* Needs Attention Panel (Alerts) */}
        {lowStockItems.length > 0 && (
          <div className="rounded-card border border-status-warning/30 bg-status-warning-subtle/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-status-warning shrink-0" />
                <div>
                  <h3 className="text-xs font-semibold text-text-primary">
                    Inventory Attention Required ({lowStockItems.length} products
                    below reorder threshold)
                  </h3>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    Replenishment or transfer needed to prevent stockouts.
                  </p>
                </div>
              </div>
              <Link
                href="/inventory"
                className="text-xs font-medium text-status-warning hover:underline"
              >
                Manage Stock →
              </Link>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {lowStockItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 rounded-subtle bg-surface border border-border flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-text-primary truncate">
                    {item.product.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-status-warning">
                      {item.currentStock} {item.product.inventoryUnit}s
                    </span>
                    <span className="text-[10px] text-text-muted">
                      / min {item.reorderLevel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two-Column Grid: Recent Sales + Operational Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Sales Column (2 spans) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                  Today&apos;s Recent Sales
                </h2>
                {totalSalesCount > 0 && (
                  <span className="text-[11px] text-text-muted bg-surface-elevated/80 px-2 py-0.5 rounded border border-border">
                    Latest {todayRecentSales.length} of {totalSalesCount}
                  </span>
                )}
              </div>
              <Link
                href="/sales"
                className="text-xs font-medium text-brand hover:underline flex items-center gap-1"
              >
                View all sales ({totalSalesCount})
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {todayRecentSales.length === 0 ? (
              <Card className="text-center py-10">
                <ShoppingBag className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-text-secondary">
                  No sales recorded today yet.
                </p>
                {["OWNER", "MANAGER", "CASHIER", "SALESPERSON"].includes(user.role) && (
                  <Link
                    href="/sales/new"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand font-medium hover:underline"
                  >
                    + Create the first sale today
                  </Link>
                )}
              </Card>
            ) : (
              <div className="space-y-2">
                {todayRecentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3.5 rounded-card bg-surface border border-border flex items-center justify-between gap-4 hover:border-surface-elevated transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-text-primary">
                          {sale.invoiceNumber}
                        </span>
                        <Badge
                          variant={
                            sale.status === "COMPLETED" ? "success" : "danger"
                          }
                        >
                          {sale.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-secondary truncate mt-1">
                        {sale.items
                          .map(
                            (i) =>
                              `${i.quantity}× ${i.product.name.split(" ")[0]}`
                          )
                          .join(", ")}
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {formatDateTime(sale.createdAt)} · By{" "}
                        {sale.cashier.firstName} ·{" "}
                        {sale.customer?.name || "Walk-in Customer"}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-text-primary">
                        {formatNaira(sale.total)}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {sale.payments.map((p) => p.method).join(", ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational Activity Stream (1 span) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                Audit & Activity Trail
              </h2>
              <Link
                href="/activity"
                className="text-xs font-medium text-brand hover:underline"
              >
                Full Trail →
              </Link>
            </div>

            <Card className="p-0 overflow-hidden divide-y divide-border">
              {recentAudits.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">
                  No activity events recorded yet.
                </div>
              ) : (
                recentAudits.map((a) => (
                  <div key={a.id} className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text-primary">
                        {a.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {formatTimeOnly(a.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary">
                      {a.description}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {a.user?.email || "System"} · {a.branch?.code || "GLOBAL"}
                    </p>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
