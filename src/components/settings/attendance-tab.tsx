"use client";

import React, { useState } from "react";
import {
  Clock,
  Building2,
  Save,
  ShieldCheck,
  Timer,
  Edit2,
  X,
  Sliders,
  Sun,
  Moon,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BranchItem } from "./types";

interface AttendanceTabProps {
  branches: BranchItem[];
  setBranches: React.Dispatch<React.SetStateAction<BranchItem[]>>;
  showToast: (type: "success" | "error", text: string) => void;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  branches,
  setBranches,
  showToast,
}) => {
  // Global company default policy state
  const [globalOpeningTime, setGlobalOpeningTime] = useState("08:00");
  const [globalClosingTime, setGlobalClosingTime] = useState("17:00");
  const [globalGracePeriod, setGlobalGracePeriod] = useState(15);
  const [isApplyingGlobal, setIsApplyingGlobal] = useState(false);

  // Edit single branch modal state
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [branchOpening, setBranchOpening] = useState("08:00");
  const [branchClosing, setBranchClosing] = useState("17:00");
  const [branchGrace, setBranchGrace] = useState(15);
  const [branchFormError, setBranchFormError] = useState<string | null>(null);
  const [isSavingBranch, setIsSavingBranch] = useState(false);

  // Calculate cutoff string given start time and grace minutes
  const calculateCutoff = (startStr: string, graceMins: number) => {
    const [startH, startM] = (startStr || "08:00").split(":").map(Number);
    const totalMins = (startH || 0) * 60 + (startM || 0) + (graceMins ?? 15);
    const cutoffH = Math.floor(totalMins / 60) % 24;
    const cutoffM = totalMins % 60;
    return `${String(cutoffH).padStart(2, "0")}:${String(cutoffM).padStart(2, "0")}`;
  };

  // Handle applying default shift to all branches
  const handleApplyToAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsApplyingGlobal(true);

    try {
      const res = await fetch("/api/settings/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applyToAll: true,
          openingTime: globalOpeningTime,
          closingTime: globalClosingTime,
          gracePeriodMinutes: globalGracePeriod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply shift schedule.");

      setBranches((prev) =>
        prev.map((b) => ({
          ...b,
          openingTime: globalOpeningTime,
          closingTime: globalClosingTime,
          gracePeriodMinutes: globalGracePeriod,
        }))
      );

      showToast(
        "success",
        `Master shift schedule (${globalOpeningTime} - ${globalClosingTime}, +${globalGracePeriod}m grace) synced across all ${branches.length} branches.`
      );
    } catch (err: any) {
      showToast("error", err.message || "Failed to update company attendance settings.");
    } finally {
      setIsApplyingGlobal(false);
    }
  };

  const handleOpenEditBranch = (b: BranchItem) => {
    setEditingBranch(b);
    setBranchOpening(b.openingTime || "08:00");
    setBranchClosing(b.closingTime || "17:00");
    setBranchGrace(b.gracePeriodMinutes ?? 15);
    setBranchFormError(null);
  };

  const handleSaveSingleBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    setBranchFormError(null);
    setIsSavingBranch(true);

    try {
      const res = await fetch("/api/settings/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: editingBranch.id,
          openingTime: branchOpening,
          closingTime: branchClosing,
          gracePeriodMinutes: branchGrace,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update branch schedule.");

      setBranches((prev) =>
        prev.map((b) =>
          b.id === editingBranch.id
            ? {
                ...b,
                openingTime: branchOpening,
                closingTime: branchClosing,
                gracePeriodMinutes: branchGrace,
              }
            : b
        )
      );

      setEditingBranch(null);
      showToast("success", `Shift hours for '${editingBranch.name}' updated.`);
    } catch (err: any) {
      setBranchFormError(err.message || "Failed to update branch shift schedule.");
    } finally {
      setIsSavingBranch(false);
    }
  };

  const globalCutoff = calculateCutoff(globalOpeningTime, globalGracePeriod);

  return (
    <div className="space-y-6">
      {/* Executive Summary & Exemption Assurance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-surface to-surface border border-orange-500/20 md:col-span-2 space-y-2 shadow-xs rounded-card">
          <div className="absolute -top-12 left-1/3 -translate-x-1/2 w-48 h-20 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 relative">
            <Clock className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Server-Authoritative Shift & Lateness Governance
            </h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed relative">
            All employee timestamps are evaluated strictly against the server clock in West Africa Time (
            <span className="font-semibold text-text-primary">Africa/Lagos, UTC+1</span>). When staff clock in, their arrival time is checked against the branch opening time plus the configured grace window. Arrivals after the cutoff are automatically flagged as <span className="font-semibold text-amber-400">LATE</span>.
          </p>
        </Card>

        <Card className="relative overflow-hidden p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-surface to-surface border border-emerald-500/20 space-y-2 shadow-xs rounded-card">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-36 h-20 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 text-emerald-400 relative">
            <ShieldCheck className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Executive Exemption
            </h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed relative">
            The Business Owner is permanently exempt from shift clock-ins and lateness enforcement. You can observe any branch without generating employee attendance logs.
          </p>
        </Card>
      </div>

      {/* Global Master Shift Policy Governor */}
      <Card className="relative overflow-hidden p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/[0.08] via-surface to-surface border border-orange-500/20 shadow-sm space-y-5 rounded-card">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-28 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <form onSubmit={handleApplyToAll} className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-subtle bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-base font-bold text-text-primary">
                  Enterprise Master Shift Policy
                </h3>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Configure standard daily operating hours and broadcast them to all physical branches with one click.
              </p>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={isApplyingGlobal}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold gap-1.5 shadow-sm shrink-0 h-9 px-4"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isApplyingGlobal ? "Broadcasting..." : "Sync Policy to All Branches"}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-text-secondary">
                Morning Opening (WAT) *
              </label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={globalOpeningTime}
                  onChange={(e) => setGlobalOpeningTime(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle font-mono text-xs text-text-primary focus:outline-none focus:border-orange-400 font-semibold"
                />
              </div>
              <span className="text-[10px] text-text-muted block">
                Standard start of the morning shift
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-text-secondary">
                Evening Closing (WAT) *
              </label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={globalClosingTime}
                  onChange={(e) => setGlobalClosingTime(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle font-mono text-xs text-text-primary focus:outline-none focus:border-orange-400 font-semibold"
                />
              </div>
              <span className="text-[10px] text-text-muted block">
                Standard end of business shift
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-text-secondary">
                Lateness Grace Buffer (Minutes) *
              </label>
              <input
                type="number"
                min="0"
                max="120"
                required
                value={globalGracePeriod}
                onChange={(e) => setGlobalGracePeriod(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle font-mono text-xs text-text-primary focus:outline-none focus:border-orange-400 font-semibold"
              />
              <span className="text-[10px] text-text-muted block">
                Arrivals past <span className="font-mono text-amber-400 font-semibold">{globalCutoff} WAT</span> are marked LATE
              </span>
            </div>
          </div>

          {/* Master Policy Visual Shift Flow Preview */}
          <div className="p-4 bg-surface-elevated/40 border border-border rounded-card space-y-3">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-bold text-text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                Visual Daily Shift Timeline:
              </span>
              <span className="font-mono text-[11px] text-text-muted">Total Shift Window: 9.0 hrs</span>
            </div>

            <div className="relative flex items-center justify-between py-1 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold">
                <Sun className="w-4 h-4 text-emerald-400" />
                <span>{globalOpeningTime} (Start)</span>
              </div>

              <div className="flex items-center gap-1.5 text-amber-400 font-mono font-bold">
                <Timer className="w-4 h-4 text-amber-400" />
                <span>{globalCutoff} (+{globalGracePeriod}m Grace)</span>
              </div>

              <div className="flex items-center gap-1.5 text-blue-400 font-mono font-bold">
                <Moon className="w-4 h-4 text-blue-400" />
                <span>{globalClosingTime} (Closing)</span>
              </div>
            </div>

            {/* Visual gradient bar */}
            <div className="w-full h-2.5 rounded-full bg-surface-elevated overflow-hidden flex shadow-inner">
              <div className="h-full bg-emerald-500 w-1/4" title="On-time arrival window" />
              <div className="h-full bg-amber-500 w-1/12" title="Grace period buffer" />
              <div className="h-full bg-blue-500/40 flex-1" title="Core operating shift" />
            </div>

            <div className="flex items-center justify-between text-[11px] text-text-muted pt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                On-Time Clock-in Window
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Grace Buffer
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500/60 inline-block" />
                Standard Shift Hours
              </span>
            </div>
          </div>
        </form>
      </Card>

      {/* Branch-Specific Shift Command Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-text-primary">
              Location Operating Schedules ({branches.length} Branches)
            </h3>
            <p className="text-xs text-text-secondary">
              Locations can either follow the company master schedule or maintain customized operating hours.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => {
            const cutoffStr = calculateCutoff(b.openingTime || "08:00", b.gracePeriodMinutes ?? 15);
            const isCustom =
              b.openingTime !== globalOpeningTime ||
              b.closingTime !== globalClosingTime ||
              b.gracePeriodMinutes !== globalGracePeriod;

            return (
              <Card
                key={b.id}
                className="relative overflow-hidden p-5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/[0.09] via-surface to-surface border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 flex flex-col justify-between shadow-xs space-y-4 rounded-card"
              >
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-3.5 relative">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-card bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-mono font-bold text-sm shrink-0">
                        {b.code}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-text-primary">{b.name}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
                          <Users className="w-3 h-3 text-text-muted" />
                          <span>{b.activeEmployeesCount} staff governed</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {b.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-surface-elevated text-text-muted">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Shift Hours Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-subtle bg-surface-elevated/40 border border-border">
                      <span className="text-[10px] font-bold text-text-muted uppercase block">
                        Shift Window
                      </span>
                      <div className="font-mono font-bold text-text-primary mt-1">
                        {b.openingTime || "08:00"} - {b.closingTime || "17:00"}
                      </div>
                      <span className="text-[10px] text-text-muted">WAT (UTC+1)</span>
                    </div>

                    <div className="p-2.5 rounded-subtle bg-surface-elevated/40 border border-border">
                      <span className="text-[10px] font-bold text-text-muted uppercase block">
                        Lateness Cutoff
                      </span>
                      <div className="font-mono font-bold text-amber-400 mt-1">
                        {cutoffStr} WAT
                      </div>
                      <span className="text-[10px] text-text-muted">
                        +{b.gracePeriodMinutes ?? 15}m grace
                      </span>
                    </div>
                  </div>

                  {/* Status Note */}
                  <div className="text-[11px] text-text-secondary flex items-center gap-1.5 pt-1">
                    {isCustom ? (
                      <span className="text-orange-400 font-medium">● Location-specific custom schedule</span>
                    ) : (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        In sync with enterprise master policy
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-3 border-t border-border flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditBranch(b)}
                    className="w-full text-xs font-semibold gap-1.5 h-8 border-border hover:bg-surface-elevated text-text-primary"
                  >
                    <Edit2 className="w-3 h-3 text-orange-400" />
                    <span>Customize Shift Hours</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: EDIT BRANCH SHIFT HOURS */}
      {/* ========================================================================= */}
      {editingBranch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-surface/95 backdrop-blur-2xl border border-white/10 max-w-md w-full shadow-2xl rounded-card flex flex-col max-h-[88vh] overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="p-5 pb-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    Configure Shift: {editingBranch.name} ({editingBranch.code})
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Operating schedule & lateness grace policy
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBranch(null)}
                className="w-7 h-7 rounded-md hover:bg-surface-elevated text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form id="branch-shift-form" onSubmit={handleSaveSingleBranch} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {branchFormError && (
                <div className="p-3 rounded-lg bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs font-medium">
                  {branchFormError}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                      Shift Opening Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={branchOpening}
                      onChange={(e) => setBranchOpening(e.target.value)}
                      className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg font-mono text-xs text-text-primary focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 font-semibold transition-all"
                    />
                    <span className="text-[10px] text-text-muted mt-1 block">Expected start of shift</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                      Shift Closing Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={branchClosing}
                      onChange={(e) => setBranchClosing(e.target.value)}
                      className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg font-mono text-xs text-text-primary focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 font-semibold transition-all"
                    />
                    <span className="text-[10px] text-text-muted mt-1 block">Expected end of shift</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Lateness Grace Buffer (Minutes) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    value={branchGrace}
                    onChange={(e) => setBranchGrace(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg font-mono text-xs text-text-primary focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 font-semibold transition-all"
                  />
                  <div className="p-3 rounded-lg bg-surface-elevated/60 border border-white/5 mt-2.5 text-[11px] text-text-secondary leading-relaxed">
                    Staff clocking in past{" "}
                    <strong className="text-amber-400 font-mono">
                      {calculateCutoff(branchOpening, branchGrace)} WAT
                    </strong>{" "}
                    will be automatically flagged as <span className="font-semibold text-amber-400">LATE</span> on attendance logs.
                  </div>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-surface/50 backdrop-blur-sm flex justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingBranch(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="branch-shift-form"
                size="sm"
                disabled={isSavingBranch}
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 shadow-sm"
              >
                {isSavingBranch ? "Saving..." : "Save Shift Schedule"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
