"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Search,
  Filter,
  ShoppingBag,
  Package,
  ArrowLeftRight,
  Clock,
  User,
  Building2,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  CalendarDays,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export interface AuditRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  branchName: string;
  branchCode: string;
  userName: string;
  userRole: string;
  oldValue: any | null;
  newValue: any | null;
  reason: string | null;
  createdAt: string;
}

export interface ActivityMetrics {
  totalCount: number;
  salesCount: number;
  inventoryCount: number;
  securityCount: number;
}

interface ActivityWorkspaceProps {
  initialLogs: AuditRecord[];
  activeWindow?: string;
  fromParam?: string;
  toParam?: string;
  selectedBranchId?: string;
  metrics?: ActivityMetrics;
  branches?: { id: string; name: string; code: string }[];
  isOwner?: boolean;
}

export function ActivityWorkspace({
  initialLogs,
  activeWindow = "24h",
  fromParam = "",
  toParam = "",
  selectedBranchId,
  metrics = {
    totalCount: initialLogs.length,
    salesCount: 0,
    inventoryCount: 0,
    securityCount: 0,
  },
  branches = [],
  isOwner = false,
}: ActivityWorkspaceProps) {
  const router = useRouter();
  const logs = initialLogs;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Custom range state
  const [customFrom, setCustomFrom] = useState(fromParam);
  const [customTo, setCustomTo] = useState(toParam);
  const [showCustomInputs, setShowCustomInputs] = useState(activeWindow === "custom");

  React.useEffect(() => {
    setCustomFrom(fromParam);
    setCustomTo(toParam);
    setShowCustomInputs(activeWindow === "custom");
  }, [fromParam, toParam, activeWindow]);

  const handleWindowChange = (newWindow: string) => {
    if (newWindow === "custom") {
      setShowCustomInputs(true);
      return;
    }
    setShowCustomInputs(false);
    const params = new URLSearchParams();
    params.set("window", newWindow);
    if (selectedBranchId) {
      params.set("branchId", selectedBranchId);
    }
    router.push(`/activity?${params.toString()}`);
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom) return;
    const params = new URLSearchParams();
    params.set("window", "custom");
    params.set("from", customFrom);
    if (customTo) params.set("to", customTo);
    if (selectedBranchId) {
      params.set("branchId", selectedBranchId);
    }
    router.push(`/activity?${params.toString()}`);
  };

  const handleBranchChange = (newBranchId: string) => {
    const params = new URLSearchParams();
    params.set("window", activeWindow);
    if (activeWindow === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    if (newBranchId) {
      params.set("branchId", newBranchId);
    }
    router.push(`/activity?${params.toString()}`);
  };

  const filteredLogs = logs.filter((log) => {
    if (selectedEntity !== "ALL" && log.entityType !== selectedEntity) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const actionMatch = log.action.toLowerCase().includes(q);
      const descMatch = log.description.toLowerCase().includes(q);
      const userMatch = log.userName.toLowerCase().includes(q);
      const branchMatch =
        log.branchName.toLowerCase().includes(q) || log.branchCode.toLowerCase().includes(q);
      if (!actionMatch && !descMatch && !userMatch && !branchMatch) {
        return false;
      }
    }
    return true;
  });

  const getActionBadge = (action: string, entityType: string) => {
    if (action.includes("SALE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
          <ShoppingBag className="w-3 h-3 text-emerald-400" />
          {action}
        </span>
      );
    }
    if (action.includes("DAMAGE") || action.includes("EXPIRY")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          {action}
        </span>
      );
    }
    if (action.includes("TRANSFER")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
          <ArrowLeftRight className="w-3 h-3 text-amber-400" />
          {action}
        </span>
      );
    }
    if (action.includes("ATTENDANCE") || action.includes("CLOCK")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-300 border border-orange-500/30">
          <Clock className="w-3 h-3 text-orange-400" />
          {action}
        </span>
      );
    }
    if (action.includes("USER") || action.includes("EMPLOYEE") || action.includes("ROLE")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/30">
          <User className="w-3 h-3 text-violet-400" />
          {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
        <Package className="w-3 h-3 text-cyan-400" />
        {action}
      </span>
    );
  };

  const windowTitle =
    activeWindow === "24h"
      ? "Last 24 Hours"
      : activeWindow === "7d"
      ? "Last 7 Days"
      : activeWindow === "30d"
      ? "Last 30 Days"
      : activeWindow === "custom"
      ? `Custom (${fromParam || "Start"} to ${toParam || "Now"})`
      : "All Historical Time";

  return (
    <div className="space-y-4">
      {/* Header & Window Duration Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-card bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Activity & Audit Trail
            </h1>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
              Immutable Forensic Ledger
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Tamper-evident operational trail tracking sales, inventory, cash, and configuration events.
          </p>
        </div>

        {/* Duration Window Presets */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-elevated/40 border border-border rounded-lg self-start lg:self-center flex-wrap">
          <button
            type="button"
            onClick={() => handleWindowChange("24h")}
            className={`py-1 px-2.5 rounded-md text-xs font-semibold transition-all ${
              activeWindow === "24h"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Last 24 Hours
          </button>
          <button
            type="button"
            onClick={() => handleWindowChange("7d")}
            className={`py-1 px-2.5 rounded-md text-xs font-semibold transition-all ${
              activeWindow === "7d"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => handleWindowChange("30d")}
            className={`py-1 px-2.5 rounded-md text-xs font-semibold transition-all ${
              activeWindow === "30d"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => handleWindowChange("custom")}
            className={`py-1 px-2.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${
              activeWindow === "custom"
                ? "bg-cyan-500 text-slate-950 shadow-sm font-bold"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <CalendarDays className="w-3 h-3" />
            <span>Custom Range</span>
          </button>
          <button
            type="button"
            onClick={() => handleWindowChange("all")}
            className={`py-1 px-2.5 rounded-md text-xs font-semibold transition-all ${
              activeWindow === "all"
                ? "bg-slate-200 text-slate-950 shadow-sm font-bold"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Inline Custom Date Range Selector (Reveals when Custom Range is active) */}
      {showCustomInputs && (
        <Card className="p-3.5 bg-surface border-cyan-500/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-surface to-surface">
          <form onSubmit={handleApplyCustomRange} className="flex flex-col sm:flex-row items-end gap-3 text-xs">
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-[11px] font-bold uppercase text-cyan-300 mb-1">
                From Date (Start of Range)
              </label>
              <input
                type="date"
                required
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface-elevated border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>
            <div className="w-full sm:w-auto flex-1">
              <label className="block text-[11px] font-bold uppercase text-cyan-300 mb-1">
                To Date (End of Range)
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface-elevated border border-border rounded-md text-xs text-text-primary focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="submit"
                size="sm"
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs px-4"
              >
                Apply Date Range
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleWindowChange("24h")}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                Reset to 24h
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Executive Window Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-surface border-border">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-text-muted">Total Events in Window</div>
            <ShieldAlert className="w-4 h-4 text-text-muted" />
          </div>
          <div className="text-xl font-bold text-text-primary mt-1">{metrics.totalCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5 font-medium">{windowTitle}</div>
        </Card>

        <Card className="p-3.5 bg-surface border-emerald-500/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-surface to-surface">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-emerald-400">Sales & Cash Actions</div>
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-300 mt-1">{metrics.salesCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Orders, payments, refunds</div>
        </Card>

        <Card className="p-3.5 bg-surface border-cyan-500/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-surface to-surface">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-cyan-400">Stock & Movements</div>
            <Package className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-300 mt-1">{metrics.inventoryCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Receipts, damages, transfers</div>
        </Card>

        <Card className="p-3.5 bg-surface border-violet-500/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-surface to-surface">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-violet-400">Admin & Security</div>
            <User className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-xl font-bold text-violet-300 mt-1">{metrics.securityCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Roles, units, branch configs</div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3.5 bg-surface border-border space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action, employee, details..."
              className="w-full pl-9 pr-3 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Branch Filter for Owner */}
          {isOwner && branches.length > 0 && (
            <div className="flex items-center gap-2 self-start md:self-auto">
              <label className="text-[11px] font-medium text-text-secondary whitespace-nowrap">
                Branch Location:
              </label>
              <select
                value={selectedBranchId || "ALL"}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="px-2.5 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Branch Locations</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Entity Category Toggle Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 pt-1 border-t border-border/50">
          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider mr-1">
            Category:
          </span>
          {["ALL", "SALE", "INVENTORY", "STOCK_TRANSFER", "ATTENDANCE", "CUSTOMER", "UNIT_OF_MEASUREMENT", "PRODUCT"].map(
            (entity) => (
              <button
                key={entity}
                onClick={() => setSelectedEntity(entity)}
                className={`px-2.5 py-1 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedEntity === entity
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "bg-surface-elevated border border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {entity === "ALL"
                  ? "All Activity"
                  : entity === "UNIT_OF_MEASUREMENT"
                  ? "Packaging Units"
                  : entity === "STOCK_TRANSFER"
                  ? "Transfers"
                  : entity.replace(/_/g, " ")}
              </button>
            )
          )}
        </div>
      </Card>

      {/* Activity Timeline List */}
      <Card className="bg-surface border-border overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-border flex items-center justify-between bg-surface-elevated/40">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-text-muted" />
            <h2 className="text-xs font-bold uppercase text-text-primary tracking-wider">
              Audit Events in Ledger ({filteredLogs.length})
            </h2>
          </div>
          <span className="text-[11px] font-mono text-text-muted">
            Window: {windowTitle}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-text-muted space-y-3">
            <ShieldAlert className="w-10 h-10 mx-auto opacity-30 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                No audit events recorded in {windowTitle}
              </p>
              <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                No transactions or operational changes were found within this time window. You can expand the duration filter to inspect earlier historical activity.
              </p>
            </div>
            {activeWindow !== "all" && (
              <div className="pt-2 flex items-center justify-center gap-2">
                {activeWindow === "24h" && (
                  <Button
                    size="sm"
                    onClick={() => handleWindowChange("7d")}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                  >
                    Switch to Last 7 Days
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleWindowChange("all")}
                  className="text-xs"
                >
                  View All Historical Time
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasJson = log.oldValue || log.newValue;

              return (
                <div
                  key={log.id}
                  className="p-3.5 hover:bg-surface-elevated/40 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getActionBadge(log.action, log.entityType)}</div>
                      <div>
                        <p className="text-xs text-text-primary font-semibold">{log.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted mt-1">
                          <span className="flex items-center gap-1 text-text-secondary">
                            <User className="w-3 h-3 text-text-muted" />
                            {log.userName} ({log.userRole})
                          </span>
                          <span className="flex items-center gap-1 text-text-secondary">
                            <Building2 className="w-3 h-3 text-text-muted" />
                            {log.branchName} ({log.branchCode})
                          </span>
                          <span className="font-mono text-text-muted text-[10px]">
                            ID: {log.entityId}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                      <span className="text-[11px] text-text-muted whitespace-nowrap font-mono">
                        {formatDateTime(log.createdAt)}
                      </span>
                      {hasJson && (
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-elevated"
                          title={isExpanded ? "Collapse state details" : "Expand state details"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && hasJson && (
                    <div className="mt-3 p-3 bg-surface-elevated rounded-subtle border border-border text-xs font-mono">
                      {log.oldValue && (
                        <div className="mb-2">
                          <span className="text-rose-400 font-semibold">Previous State:</span>
                          <pre className="text-text-secondary mt-1 overflow-x-auto text-[11px] bg-surface-950 p-2 rounded">
                            {JSON.stringify(log.oldValue, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newValue && (
                        <div>
                          <span className="text-emerald-400 font-semibold">New State:</span>
                          <pre className="text-text-secondary mt-1 overflow-x-auto text-[11px] bg-surface-950 p-2 rounded">
                            {JSON.stringify(log.newValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
