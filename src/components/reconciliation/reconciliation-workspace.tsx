"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Banknote,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Building2,
  User,
  Calendar,
  Eye,
  X,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Receipt,
  Printer,
  ChevronRight,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  ArrowUpRight,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface CashSessionRow {
  id: string;
  referenceNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  cashierId: string;
  cashierName: string;
  cashierCode: string;
  status: "OPEN" | "CLOSED";
  openingCash: string;
  openedAt: string | Date;
  closedAt: string | Date | null;
  closedBy: string | null;
  notes: string | null;
  expectedCash: string;
  declaredCash: string | null;
  cashVariance: string | null;
  expectedTransfer: string;
  declaredTransfer: string | null;
  transferVariance: string | null;
  cashSales: string;
  transferSales: string;
  otherSales: string;
  cashRefunds: string;
  transferRefunds: string;
  totalSalesCount: number;
  totalRevenue: string;
}

export interface CashReconciliationKPIs {
  totalSessions: number;
  openSessions: number;
  closedSessions: number;
  sessionsWithDiscrepancy: number;
  totalCashVariance: number;
  totalTransferVariance: number;
}

interface ReconciliationWorkspaceProps {
  initialSessions: CashSessionRow[];
  initialKPIs: CashReconciliationKPIs;
  branches: { id: string; name: string; code: string }[];
  currentBranchId: string;
  isOwner: boolean;
  activeWindow?: string;
}

export const ReconciliationWorkspace: React.FC<ReconciliationWorkspaceProps> = ({
  initialSessions,
  initialKPIs,
  branches,
  currentBranchId,
  isOwner,
  activeWindow = "24h",
}) => {
  const [sessions, setSessions] = useState<CashSessionRow[]>(initialSessions);
  const [kpis, setKpis] = useState<CashReconciliationKPIs>(initialKPIs);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentBranchId);
  const [selectedWindow, setSelectedWindow] = useState<string>(activeWindow || "24h");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED" | "DISCREPANCY">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Drill-down modal state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<"PAYMENTS" | "PAYOUTS">("PAYMENTS");

  // Re-fetch data from API when branch, window, or date changes
  const refreshData = async (branchId: string, windowVal?: string, dateVal?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      if (dateVal) {
        params.set("date", dateVal);
      } else if (windowVal) {
        params.set("window", windowVal);
      }
      const res = await fetch(`/api/reconciliation?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setKpis(data.kpis || initialKPIs);
      }
    } catch (err) {
      console.error("Error refreshing reconciliation sessions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranchId(branchId);
    refreshData(branchId, selectedDate ? undefined : selectedWindow, selectedDate);
  };

  const handleWindowSelect = (windowVal: string) => {
    setSelectedWindow(windowVal);
    setSelectedDate("");
    refreshData(selectedBranchId, windowVal, "");
  };

  const handleDateChange = (dateVal: string) => {
    setSelectedDate(dateVal);
    refreshData(selectedBranchId, undefined, dateVal);
  };

  const handleClearFilters = () => {
    setSelectedBranchId(isOwner ? "ALL" : currentBranchId);
    setSelectedWindow("24h");
    setSelectedDate("");
    setStatusFilter("ALL");
    setSearchQuery("");
    refreshData(isOwner ? "ALL" : currentBranchId, "24h", "");
  };

  // Filter sessions locally
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Branch filter (honors "ALL" for multi-branch view)
      if (selectedBranchId && selectedBranchId !== "ALL" && s.branchId !== selectedBranchId) {
        return false;
      }
      // Status filter
      if (statusFilter === "OPEN" && s.status !== "OPEN") return false;
      if (statusFilter === "CLOSED" && s.status !== "CLOSED") return false;
      if (statusFilter === "DISCREPANCY") {
        if (s.status !== "CLOSED") return false;
        const cashVar = parseFloat(s.cashVariance || "0");
        const transVar = parseFloat(s.transferVariance || "0");
        if (cashVar === 0 && transVar === 0) return false;
      }
      // Search query (reference number, cashier name, cashier code)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRef = s.referenceNumber.toLowerCase().includes(q);
        const matchesCashier = s.cashierName.toLowerCase().includes(q);
        const matchesCode = s.cashierCode.toLowerCase().includes(q);
        if (!matchesRef && !matchesCashier && !matchesCode) return false;
      }
      return true;
    });
  }, [sessions, selectedBranchId, statusFilter, searchQuery]);

  const openSessionDetails = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsLoadingDetail(true);
    setDetailError(null);
    setModalTab("PAYMENTS");
    try {
      const res = await fetch(`/api/cash-session/${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load session details");
      setSessionDetail(data.session);
    } catch (err: any) {
      setDetailError(err.message || "Failed to retrieve session breakdown");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeSessionDetails = () => {
    setActiveSessionId(null);
    setSessionDetail(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-subtle bg-brand-subtle flex items-center justify-center text-brand">
              <Banknote className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Cash Drawer & End-of-Day Reconciliation
            </h1>
          </div>
          <p className="text-xs text-text-secondary">
            Authoritative cash drawer audit, shift balancing, and payment variance tracking across cashier sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Window Filter Pills (Delicate 24h Default) */}
          <div className="flex items-center gap-1 p-1 bg-surface-elevated rounded-subtle border border-border">
            {[
              { id: "24h", label: "Last 24 Hours" },
              { id: "7d", label: "7 Days" },
              { id: "30d", label: "30 Days" },
              { id: "all", label: "All Time" },
            ].map((w) => (
              <button
                key={w.id}
                onClick={() => handleWindowSelect(w.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-subtle transition-colors ${
                  !selectedDate && selectedWindow === w.id
                    ? "bg-brand text-white shadow-xs"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Date Picker Filter */}
          <div className="flex items-center gap-1.5 bg-surface-elevated border border-border rounded-subtle px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-xs text-text-primary focus:outline-none"
            />
            {selectedDate && (
              <button
                onClick={() => handleWindowSelect("24h")}
                className="text-[11px] text-text-muted hover:text-text-primary underline ml-1"
              >
                Clear
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshData(selectedBranchId, selectedDate ? undefined : selectedWindow, selectedDate)}
            disabled={isLoading}
            className="h-8 px-2.5 text-xs text-text-secondary"
            title="Refresh reconciliation data"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-brand" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Branch Filter Pills */}
      {isOwner && branches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
          <span className="text-[11px] font-semibold text-text-muted flex items-center gap-1 mr-1">
            <Building2 className="w-3.5 h-3.5" />
            Branch Scope:
          </span>
          <button
            onClick={() => handleBranchSelect("ALL")}
            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
              selectedBranchId === "ALL"
                ? "bg-brand text-white border-brand shadow-xs"
                : "bg-surface-elevated text-text-muted border-border hover:text-text-primary hover:border-brand/40"
            }`}
          >
            All Branches
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => handleBranchSelect(b.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                selectedBranchId === b.id
                  ? "bg-brand text-white border-brand shadow-xs"
                  : "bg-surface-elevated text-text-muted border-border hover:text-text-primary hover:border-brand/40"
              }`}
            >
              {b.name} ({b.code})
            </button>
          ))}
        </div>
      )}

      {/* Operational KPI Attention Header */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-surface border-border">
          <div className="text-[11px] font-medium text-text-muted">Total Sessions</div>
          <div className="text-lg font-bold text-text-primary mt-1">{kpis.totalSessions}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Recorded shifts</div>
        </Card>

        <Card className="p-3 bg-surface border-border">
          <div className="text-[11px] font-medium text-text-muted">Active Drawers</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-lg font-bold text-emerald-400">{kpis.openSessions}</span>
          </div>
          <div className="text-[10px] text-text-muted mt-0.5">Currently selling</div>
        </Card>

        <Card className="p-3 bg-surface border-border">
          <div className="text-[11px] font-medium text-text-muted">Closed Sessions</div>
          <div className="text-lg font-bold text-text-secondary mt-1">{kpis.closedSessions}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Reconciled shifts</div>
        </Card>

        <Card className={`p-3 bg-surface border-border ${kpis.sessionsWithDiscrepancy > 0 ? "border-status-warning/40 bg-status-warning-subtle/10" : ""}`}>
          <div className="text-[11px] font-medium text-text-muted flex items-center justify-between">
            <span>Discrepancies</span>
            {kpis.sessionsWithDiscrepancy > 0 && (
              <AlertTriangle className="w-3.5 h-3.5 text-status-warning" />
            )}
          </div>
          <div className={`text-lg font-bold mt-1 ${kpis.sessionsWithDiscrepancy > 0 ? "text-status-warning" : "text-text-primary"}`}>
            {kpis.sessionsWithDiscrepancy}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5">Unbalanced counts</div>
        </Card>

        <Card className={`p-3 bg-surface border-border ${kpis.totalCashVariance < 0 ? "border-status-danger/40 bg-status-danger-subtle/10" : ""}`}>
          <div className="text-[11px] font-medium text-text-muted">Cash Variance</div>
          <div className={`text-base font-bold font-mono mt-1 ${kpis.totalCashVariance < 0 ? "text-status-danger" : kpis.totalCashVariance > 0 ? "text-cyan-400" : "text-emerald-400"}`}>
            {formatNaira(kpis.totalCashVariance)}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5">
            {kpis.totalCashVariance === 0 ? "Balanced" : kpis.totalCashVariance < 0 ? "Net Cash Shortage" : "Net Cash Overage"}
          </div>
        </Card>

        <Card className="p-3 bg-surface border-border">
          <div className="text-[11px] font-medium text-text-muted">Transfer Variance</div>
          <div className={`text-base font-bold font-mono mt-1 ${kpis.totalTransferVariance !== 0 ? "text-status-warning" : "text-emerald-400"}`}>
            {formatNaira(kpis.totalTransferVariance)}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5">Digital payments</div>
        </Card>
      </div>

      {/* Controls & Filters Bar */}
      <Card className="p-3.5 bg-surface border-border">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-elevated rounded-subtle border border-border w-full md:w-auto">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1 text-xs font-semibold rounded-subtle transition-colors ${
                statusFilter === "ALL"
                  ? "bg-brand text-white shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              All ({sessions.length})
            </button>
            <button
              onClick={() => setStatusFilter("OPEN")}
              className={`px-3 py-1 text-xs font-semibold rounded-subtle transition-colors ${
                statusFilter === "OPEN"
                  ? "bg-brand text-white shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Open Drawers ({kpis.openSessions})
            </button>
            <button
              onClick={() => setStatusFilter("CLOSED")}
              className={`px-3 py-1 text-xs font-semibold rounded-subtle transition-colors ${
                statusFilter === "CLOSED"
                  ? "bg-brand text-white shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Closed Shifts ({kpis.closedSessions})
            </button>
            <button
              onClick={() => setStatusFilter("DISCREPANCY")}
              className={`px-3 py-1 text-xs font-semibold rounded-subtle transition-colors ${
                statusFilter === "DISCREPANCY"
                  ? "bg-status-warning text-surface-950 shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Discrepancies ({kpis.sessionsWithDiscrepancy})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, cashier name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Reconciliation Table */}
      <Card className="bg-surface border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/40 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Session Reference</th>
                <th className="py-3 px-3">Cashier</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Opened</th>
                <th className="py-3 px-3 text-right">Opening Float</th>
                <th className="py-3 px-3 text-right">Expected Cash</th>
                <th className="py-3 px-3 text-right">Declared Cash</th>
                <th className="py-3 px-3 text-center">Cash Variance</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-text-muted">
                    <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading reconciliation records...</span>
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 px-4">
                    <div className="max-w-md mx-auto text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto text-text-muted">
                        <Receipt className="w-6 h-6 opacity-60" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">No Cash Drawer Sessions Found</h4>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                          Cash drawer sessions track cashier physical floats, sales, drawer payouts, and shift balancing counts. Sessions are opened by cashiers at the Point of Sale when starting a shift.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <Link href="/sales/new">
                          <Button size="sm" className="h-8 px-3 text-xs gap-1.5">
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Open POS Terminal</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        {(selectedBranchId !== (isOwner ? "ALL" : currentBranchId) || selectedWindow !== "all" || selectedDate || searchQuery || statusFilter !== "ALL") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearFilters}
                            className="h-8 px-3 text-xs"
                          >
                            Reset Filters
                          </Button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const cashVarianceNum = session.cashVariance ? parseFloat(session.cashVariance) : 0;
                  const isShortage = cashVarianceNum < 0;
                  const isOverage = cashVarianceNum > 0;
                  const isBalanced = cashVarianceNum === 0 && session.status === "CLOSED";

                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-surface-elevated/30 transition-colors cursor-pointer group"
                      onClick={() => openSessionDetails(session.id)}
                    >
                      {/* Session Reference */}
                      <td className="py-3 px-4 font-mono font-semibold text-text-primary">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${session.status === "OPEN" ? "bg-emerald-400 animate-pulse" : "bg-text-muted"}`} />
                          <span className="text-brand group-hover:underline">
                            {session.referenceNumber}
                          </span>
                        </div>
                      </td>

                      {/* Cashier */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-text-primary">{session.cashierName}</div>
                        <div className="text-[10px] text-text-muted font-mono">{session.cashierCode}</div>
                      </td>

                      {/* Branch */}
                      <td className="py-3 px-3 text-text-secondary">
                        <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[11px]">
                          {session.branchName}
                        </span>
                      </td>

                      {/* Opened At */}
                      <td className="py-3 px-3 text-text-secondary whitespace-nowrap">
                        <div className="font-medium">{new Date(session.openedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}</div>
                        <div className="text-[10px] text-text-muted">
                          {new Date(session.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {/* Opening Float */}
                      <td className="py-3 px-3 text-right font-mono text-text-secondary">
                        {formatNaira(session.openingCash)}
                      </td>

                      {/* Expected Cash */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-text-primary">
                        {formatNaira(session.expectedCash)}
                      </td>

                      {/* Declared Cash */}
                      <td className="py-3 px-3 text-right font-mono text-text-primary">
                        {session.declaredCash !== null ? (
                          <span className="font-semibold">{formatNaira(session.declaredCash)}</span>
                        ) : (
                          <span className="text-text-muted italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Cash Variance */}
                      <td className="py-3 px-3 text-center">
                        {session.status === "OPEN" ? (
                          <span className="text-[10px] text-text-muted italic">In Progress</span>
                        ) : isBalanced ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Balanced
                          </span>
                        ) : isShortage ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-danger-subtle text-status-danger border border-status-danger/30 font-mono text-[11px] font-bold">
                            <TrendingDown className="w-3 h-3" />
                            {formatNaira(cashVarianceNum)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono text-[11px] font-bold">
                            <TrendingUp className="w-3 h-3" />
                            +{formatNaira(cashVarianceNum)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {session.status === "OPEN" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Open
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-elevated text-text-muted border border-border text-[10px] font-medium uppercase tracking-wider">
                            Closed
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSessionDetails(session.id);
                          }}
                          className="h-7 px-2.5 text-xs text-brand hover:text-brand-hover hover:bg-brand-subtle/20"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          <span>Audit</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drill-Down Audit Modal */}
      {activeSessionId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <Card className="bg-surface border-border max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-subtle bg-brand-subtle flex items-center justify-center text-brand">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <span>Session Audit Breakdown</span>
                    {sessionDetail && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-brand font-semibold">
                        {sessionDetail.referenceNumber}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Full payment attribution ledger, authorized drawer payouts, declared counts, and variance analysis.
                  </p>
                </div>
              </div>

              <button
                onClick={closeSessionDetails}
                className="text-text-muted hover:text-text-primary p-1 rounded-subtle hover:bg-surface-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {isLoadingDetail ? (
                <div className="py-16 text-center text-text-muted">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading session breakdown...
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-subtle bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs">
                  {detailError}
                </div>
              ) : sessionDetail ? (
                <>
                  {/* Top Metadata Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-surface-elevated/40 rounded-subtle border border-border text-xs">
                    <div>
                      <div className="text-[10px] text-text-muted font-medium">Cashier</div>
                      <div className="font-semibold text-text-primary mt-0.5">{sessionDetail.cashierName}</div>
                      <div className="text-[10px] font-mono text-text-muted">{sessionDetail.cashierCode}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-text-muted font-medium">Branch</div>
                      <div className="font-semibold text-text-primary mt-0.5">{sessionDetail.branchName}</div>
                      <div className="text-[10px] font-mono text-text-muted">{sessionDetail.branchCode}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-text-muted font-medium">Session Duration</div>
                      <div className="font-medium text-text-primary mt-0.5">
                        {new Date(sessionDetail.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        {sessionDetail.closedAt ? ` -> ${new Date(sessionDetail.closedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : " (Active Shift)"}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {new Date(sessionDetail.openedAt).toLocaleDateString("en-GB")}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-text-muted font-medium">Status</div>
                      <div className="mt-0.5">
                        {sessionDetail.status === "OPEN" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Open Drawer
                          </span>
                        ) : (
                          <span className="text-text-muted font-medium text-[11px]">Closed & Reconciled</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dual Reconciliation Cards: Physical Cash vs Bank Transfers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Physical Cash Reconciliation Card */}
                    <div className="p-4 bg-surface-elevated/20 border border-border rounded-subtle space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-text-primary">
                          <DollarSign className="w-3.5 h-3.5 text-brand" />
                          <span>Physical Cash Reconciliation</span>
                        </div>
                        {sessionDetail.status === "CLOSED" && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            parseFloat(sessionDetail.cashVariance || "0") === 0
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : parseFloat(sessionDetail.cashVariance || "0") < 0
                              ? "bg-status-danger-subtle text-status-danger border border-status-danger/30"
                              : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                          }`}>
                            {parseFloat(sessionDetail.cashVariance || "0") === 0
                              ? "Balanced"
                              : parseFloat(sessionDetail.cashVariance || "0") < 0
                              ? `Shortage: ${formatNaira(sessionDetail.cashVariance)}`
                              : `Overage: +${formatNaira(sessionDetail.cashVariance)}`}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-text-secondary">
                          <span>Opening Float (+):</span>
                          <span className="font-mono">{formatNaira(sessionDetail.openingCash)}</span>
                        </div>
                        <div className="flex justify-between text-text-secondary">
                          <span>Cash Sales (+):</span>
                          <span className="font-mono text-emerald-400">+{formatNaira(sessionDetail.cashSales)}</span>
                        </div>
                        {parseFloat(sessionDetail.cashRefunds || "0") > 0 && (
                          <div className="flex justify-between text-text-secondary">
                            <span>Cash Refunds (-):</span>
                            <span className="font-mono text-status-danger">-{formatNaira(sessionDetail.cashRefunds)}</span>
                          </div>
                        )}
                        {parseFloat(sessionDetail.cashPayouts || "0") > 0 && (
                          <div className="flex justify-between text-text-secondary">
                            <span>Drawer Payouts (-):</span>
                            <span className="font-mono text-status-warning">-{formatNaira(sessionDetail.cashPayouts)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-border flex justify-between font-bold text-text-primary">
                          <span>Expected Physical Cash:</span>
                          <span className="font-mono text-brand">{formatNaira(sessionDetail.expectedCash)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-text-primary">
                          <span>Declared Drawer Cash:</span>
                          <span className="font-mono">
                            {sessionDetail.declaredCash !== null
                              ? formatNaira(sessionDetail.declaredCash)
                              : "Pending count"}
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-border flex justify-between font-bold text-xs">
                          <span>Net Cash Variance:</span>
                          <span className={`font-mono ${
                            parseFloat(sessionDetail.cashVariance || "0") < 0
                              ? "text-status-danger"
                              : parseFloat(sessionDetail.cashVariance || "0") > 0
                              ? "text-cyan-400"
                              : "text-emerald-400"
                          }`}>
                            {sessionDetail.cashVariance !== null
                              ? formatNaira(sessionDetail.cashVariance)
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bank Transfer Reconciliation Card */}
                    <div className="p-4 bg-surface-elevated/20 border border-border rounded-subtle space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-text-primary">
                          <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Bank Transfer Reconciliation</span>
                        </div>
                        {sessionDetail.status === "CLOSED" && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            parseFloat(sessionDetail.transferVariance || "0") === 0
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-status-warning-subtle text-status-warning border border-status-warning/30"
                          }`}>
                            {parseFloat(sessionDetail.transferVariance || "0") === 0
                              ? "Balanced"
                              : `Variance: ${formatNaira(sessionDetail.transferVariance)}`}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-text-secondary">
                          <span>Transfer Sales (+):</span>
                          <span className="font-mono text-cyan-400">{formatNaira(sessionDetail.transferSales)}</span>
                        </div>
                        <div className="flex justify-between text-text-secondary">
                          <span>Other Methods:</span>
                          <span className="font-mono">{formatNaira(sessionDetail.otherSales)}</span>
                        </div>
                        <div className="pt-2 border-t border-border flex justify-between font-bold text-text-primary">
                          <span>Expected Transfers:</span>
                          <span className="font-mono text-cyan-400">{formatNaira(sessionDetail.expectedTransfer)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-text-primary">
                          <span>Declared Transfers:</span>
                          <span className="font-mono">
                            {sessionDetail.declaredTransfer !== null
                              ? formatNaira(sessionDetail.declaredTransfer)
                              : "Pending count"}
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-border flex justify-between font-bold text-xs">
                          <span>Net Transfer Variance:</span>
                          <span className={`font-mono ${
                            parseFloat(sessionDetail.transferVariance || "0") !== 0
                              ? "text-status-warning"
                              : "text-emerald-400"
                          }`}>
                            {sessionDetail.transferVariance !== null
                              ? formatNaira(sessionDetail.transferVariance)
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cashier Notes */}
                  {sessionDetail.notes && (
                    <div className="p-3 bg-surface-elevated/40 border border-border rounded-subtle text-xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                        Cashier Closing Notes
                      </div>
                      <p className="text-text-secondary italic">{sessionDetail.notes}</p>
                    </div>
                  )}

                  {/* Tabbed Activity Ledger */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setModalTab("PAYMENTS")}
                          className={`px-3 py-1 text-xs font-semibold rounded-subtle transition-colors ${
                            modalTab === "PAYMENTS"
                              ? "bg-brand text-white shadow-xs"
                              : "text-text-muted hover:text-text-primary bg-surface-elevated/40"
                          }`}
                        >
                          Transactions ({sessionDetail.payments?.length || 0})
                        </button>
                        <button
                          onClick={() => setModalTab("PAYOUTS")}
                          className={`px-3 py-1 text-xs font-semibold rounded-subtle transition-colors ${
                            modalTab === "PAYOUTS"
                              ? "bg-brand text-white shadow-xs"
                              : "text-text-muted hover:text-text-primary bg-surface-elevated/40"
                          }`}
                        >
                          Drawer Payouts ({sessionDetail.payouts?.length || 0})
                        </button>
                      </div>

                      <span className="text-[11px] font-mono text-text-muted">
                        Total Volume: {formatNaira(sessionDetail.totalRevenue)}
                      </span>
                    </div>

                    {modalTab === "PAYMENTS" ? (
                      <div className="max-h-60 overflow-y-auto border border-border rounded-subtle">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-surface-elevated text-[10px] font-bold text-text-muted uppercase border-b border-border">
                            <tr>
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3">Invoice #</th>
                              <th className="py-2 px-3">Customer</th>
                              <th className="py-2 px-3">Method</th>
                              <th className="py-2 px-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {sessionDetail.payments && sessionDetail.payments.length > 0 ? (
                              sessionDetail.payments.map((p: any) => (
                                <tr key={p.id} className="hover:bg-surface-elevated/30">
                                  <td className="py-2 px-3 text-text-muted font-mono whitespace-nowrap">
                                    {new Date(p.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-medium text-text-primary">
                                    {p.sale?.invoiceNumber || "-"}
                                  </td>
                                  <td className="py-2 px-3 text-text-secondary">
                                    {p.sale?.customerName || "Walk-in Customer"}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      p.method === "CASH"
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                        : p.method === "BANK_TRANSFER"
                                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                                        : "bg-surface-elevated text-text-muted border border-border"
                                    }`}>
                                      {p.method.replace("_", " ")}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-semibold text-text-primary">
                                    {formatNaira(p.amount)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-text-muted">
                                  No customer payments recorded in this session yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto border border-border rounded-subtle">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-surface-elevated text-[10px] font-bold text-text-muted uppercase border-b border-border">
                            <tr>
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3">Reason / Details</th>
                              <th className="py-2 px-3">Authorized By</th>
                              <th className="py-2 px-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {sessionDetail.payouts && sessionDetail.payouts.length > 0 ? (
                              sessionDetail.payouts.map((po: any) => (
                                <tr key={po.id} className="hover:bg-surface-elevated/30">
                                  <td className="py-2 px-3 text-text-muted font-mono whitespace-nowrap">
                                    {new Date(po.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-status-warning-subtle text-status-warning border border-status-warning/30">
                                      {po.category.replace("_", " ")}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-text-secondary">
                                    <div className="font-medium text-text-primary">{po.reason}</div>
                                    {po.recipient && (
                                      <div className="text-[10px] text-text-muted">Recipient: {po.recipient}</div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-text-muted font-mono text-[11px]">
                                    {po.authorizedBy}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-semibold text-status-warning">
                                    -{formatNaira(po.amount)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-text-muted">
                                  No drawer payouts or expense disbursements recorded for this session.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-surface-elevated/20">
              <span className="text-[11px] text-text-muted">
                Audit event logged server-side with immutable transaction tracing.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={closeSessionDetails}
                className="text-xs"
              >
                Close Audit View
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
