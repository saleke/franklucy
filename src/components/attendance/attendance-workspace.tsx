"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  User,
  Shield,
  ShieldCheck,
  Settings,
  FileEdit,
  X,
  Building2,
  Search,
  Filter,
  Users,
  Timer,
  Check,
  Ban,
  ClockAlert,
  ArrowUpRight,
  Info,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface PersonalAttendanceRecord {
  id: string;
  clockIn: string;
  clockOut: string | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "EARLY_LEAVE" | "INCOMPLETE";
  source: string | null;
  durationMinutes: number | null;
}

export interface AttendanceRosterItem {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  employeeRole: string;
  attendanceId: string | null;
  clockIn: string | null;
  clockOut: string | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "EARLY_LEAVE" | "INCOMPLETE" | "EXEMPT";
  source: string | null;
  durationMinutes: number | null;
  isClockedIn: boolean;
}

export interface PendingCorrectionItem {
  id: string;
  attendanceId: string;
  employeeId: string;
  employeeName: string;
  reason: string;
  originalClockIn: string | null;
  correctedClockIn: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface AttendanceMetrics {
  totalScheduled: number;
  clockedInCount: number;
  activeNowCount: number;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  pendingCorrectionsCount: number;
}

export interface ShiftConfig {
  branchId?: string;
  openingTime?: string;
  closingTime?: string;
  gracePeriodMinutes?: number;
  startTime: string;
  gracePeriod: string;
  endTime: string;
  timezone: string;
}

interface AttendanceWorkspaceProps {
  branchId?: string;
  currentEmployeeId: string;
  currentEmployeeName: string;
  userRole: string;
  isOwner?: boolean;
  branchName: string;
  branchCode: string;
  rosterItems: AttendanceRosterItem[];
  corrections: PendingCorrectionItem[];
  myTodayAttendance: PersonalAttendanceRecord | null;
  isManagerOrOwner: boolean;
  metrics: AttendanceMetrics;
  shiftConfig: ShiftConfig;
}

export function AttendanceWorkspace({
  branchId,
  currentEmployeeId,
  currentEmployeeName,
  userRole,
  isOwner,
  branchName,
  branchCode,
  rosterItems,
  corrections,
  myTodayAttendance,
  isManagerOrOwner,
  metrics,
  shiftConfig,
}: AttendanceWorkspaceProps) {
  const router = useRouter();
  const isOwnerUser = isOwner || userRole === "OWNER";

  // Shift schedule editing state
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftOpeningTime, setShiftOpeningTime] = useState(shiftConfig.openingTime || "08:00");
  const [shiftClosingTime, setShiftClosingTime] = useState(shiftConfig.closingTime || "17:00");
  const [shiftGracePeriod, setShiftGracePeriod] = useState(shiftConfig.gracePeriodMinutes ?? 15);
  const [isSavingShift, setIsSavingShift] = useState(false);

  // Clock & Timer State
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [currentDateStr, setCurrentDateStr] = useState<string>("");
  const [elapsedDuration, setElapsedDuration] = useState<string>("");

  // Action states
  const [isClocking, setIsClocking] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Correction Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionType, setCorrectionType] = useState<"MISSED_CLOCKIN" | "TIME_CORRECTION">("TIME_CORRECTION");
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [requestedTime, setRequestedTime] = useState<string>("");
  const [correctionReason, setCorrectionReason] = useState<string>("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  // Review states
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Real-time Clock in Nigeria timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        new Intl.DateTimeFormat("en-US", {
          timeZone: shiftConfig.timezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)
      );

      setCurrentDateStr(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: shiftConfig.timezone,
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(now)
      );

      // Live shift elapsed timer
      if (myTodayAttendance && !myTodayAttendance.clockOut) {
        const start = new Date(myTodayAttendance.clockIn).getTime();
        const diffMs = Math.max(0, now.getTime() - start);
        const totalMinutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const secs = Math.floor((diffMs % 60000) / 1000);
        setElapsedDuration(`${hours}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [myTodayAttendance, shiftConfig.timezone]);

  // Handle Owner Shift Schedule Updates
  const handleSaveShiftSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingShift(true);
    setErrorMessage(null);
    try {
      const targetBranchId = branchId || shiftConfig.branchId;
      if (!targetBranchId) {
        throw new Error("Target branch ID is missing.");
      }
      const res = await fetch(`/api/settings/branches/${targetBranchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingTime: shiftOpeningTime,
          closingTime: shiftClosingTime,
          gracePeriodMinutes: Number(shiftGracePeriod),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save branch shift schedule.");
      }
      setActionSuccessMsg(`Shift schedule updated for ${branchName}: ${shiftOpeningTime} - ${shiftClosingTime} (+${shiftGracePeriod}m grace).`);
      setShiftModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update shift schedule.");
    } finally {
      setIsSavingShift(false);
    }
  };

  // Handle Clock In / Clock Out
  const handleClockAction = async (action: "CLOCK_IN" | "CLOCK_OUT") => {
    setIsClocking(true);
    setErrorMessage(null);
    setActionSuccessMsg(null);

    try {
      const res = await fetch("/api/attendance/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Clock action failed.");
      }

      setActionSuccessMsg(
        action === "CLOCK_IN"
          ? "✓ Successfully clocked in! Your shift is now officially recorded."
          : "✓ Successfully clocked out. Have a great evening!"
      );

      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process clock action.");
    } finally {
      setIsClocking(false);
    }
  };

  // Handle Manager Review of Correction
  const handleCorrectionReview = async (correctionId: string, action: "APPROVED" | "REJECTED") => {
    setReviewingId(correctionId);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/attendance/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctionId, action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Review submission failed.");
      }

      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to review attendance adjustment.");
    } finally {
      setReviewingId(null);
    }
  };

  // Handle Request Adjustment Form
  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      setErrorMessage("Adjustment reason is required.");
      return;
    }

    setIsSubmittingCorrection(true);
    setErrorMessage(null);

    try {
      let correctedDateTimeIso: string | undefined = undefined;
      if (requestedTime) {
        const [h, m] = requestedTime.split(":");
        const [year, month, day] = targetDate.split("-").map(Number);
        // Build ISO string in UTC representing local time
        const combined = new Date(Date.UTC(year, month - 1, day, Number(h), Number(m), 0));
        correctedDateTimeIso = combined.toISOString();
      }

      const res = await fetch("/api/attendance/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: myTodayAttendance?.id || undefined,
          workDate: targetDate,
          correctedClockIn: correctedDateTimeIso,
          reason: correctionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit adjustment request.");
      }

      setCorrectionModalOpen(false);
      setCorrectionReason("");
      setRequestedTime("");
      setActionSuccessMsg("Adjustment request submitted successfully. Awaiting manager approval.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit adjustment.");
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  // Filtered Roster for Manager View
  const filteredRoster = useMemo(() => {
    return rosterItems.filter((item) => {
      const matchesSearch =
        item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.employeeNumber.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "ALL") return true;
      if (statusFilter === "ACTIVE") return item.isClockedIn && item.clockOut === null;
      if (statusFilter === "ON_TIME") return item.status === "PRESENT";
      if (statusFilter === "LATE") return item.status === "LATE";
      if (statusFilter === "ABSENT") return !item.isClockedIn;
      return true;
    });
  }, [rosterItems, searchQuery, statusFilter]);

  const isClockedIn = Boolean(myTodayAttendance && !myTodayAttendance.clockOut);
  const isClockedOut = Boolean(myTodayAttendance && myTodayAttendance.clockOut);

  return (
    <div className="space-y-6">
      {/* 1. Header Command Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-subtle bg-brand-subtle flex items-center justify-center text-brand">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-text-primary">
                  Attendance & Shift Hub
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-elevated text-text-secondary border border-border">
                  <Building2 className="w-3 h-3 text-brand" />
                  {branchName} ({branchCode})
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Server-authoritative timestamps, immutable audit trails, and shift tracking
              </p>
            </div>
          </div>
        </div>

        {/* Live Operational Time Display */}
        <div className="flex items-center gap-3.5 bg-surface border border-border px-4 py-2.5 rounded-card shadow-sm">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
          </div>
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-text-primary tracking-wide leading-tight">
              {currentTimeStr || "--:--:--"}
            </div>
            <div className="text-[11px] text-text-muted font-medium flex items-center gap-1 justify-end">
              <span>{currentDateStr || "Loading..."}</span>
              <span>·</span>
              <span className="text-brand font-mono text-[10px]">WAT (UTC+1)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="p-3.5 rounded-card bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-status-danger hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionSuccessMsg && (
        <div className="p-3.5 rounded-card bg-status-success-subtle border border-status-success/30 text-status-success text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-status-success hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Personal Shift Control Card / Owner Executive Exemption Card */}
      <Card className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-surface to-surface p-5 rounded-card shadow-md border border-orange-500/20">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-24 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

        {isOwnerUser ? (
          <div className="space-y-4 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-orange-400" />
                    Executive Shift Governance
                  </span>
                  <span className="text-[11px] text-text-muted">·</span>
                  <span className="text-[11px] text-text-muted font-medium">
                    Branch: {branchName} ({branchCode})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-text-primary">
                    {currentEmployeeName}
                  </h2>
                  <Badge variant="info" className="bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-400" />
                    OWNER EXEMPT · NO CLOCKING REQUIRED
                  </Badge>
                </div>

                <p className="text-xs text-text-secondary max-w-2xl leading-relaxed pt-0.5">
                  As Business Owner, you oversee company operations with complete schedule flexibility. You are never penalized for arrival times and your account has full administrative authority to configure shift hours and audit punctuality.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShiftModalOpen(true)}
                  className="bg-orange-500/10 text-orange-300 border border-orange-500/30 hover:bg-orange-500/20 text-xs font-bold px-4 py-2.5 h-auto flex items-center gap-2 shadow-xs"
                >
                  <Settings className="w-4 h-4 text-orange-400" />
                  <span>Configure Shift Hours</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-1">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Your Personal Shift Status
                  </span>
                  <span className="text-[11px] text-text-muted">·</span>
                  <span className="text-[11px] text-text-muted font-medium">
                    Standard Shift: {shiftConfig.startTime} - {shiftConfig.endTime}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-text-primary">
                    {currentEmployeeName}
                  </h2>
                  <Badge
                    variant={
                      isClockedIn ? "success" : isClockedOut ? "default" : "warning"
                    }
                  >
                    {isClockedIn ? (
                      <span className="flex items-center gap-1.5 text-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        ON ACTIVE SHIFT
                      </span>
                    ) : isClockedOut ? (
                      <span className="flex items-center gap-1.5 text-blue-300">
                        <Check className="w-3 h-3 text-blue-400" />
                        SHIFT COMPLETED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-300">
                        <ClockAlert className="w-3 h-3 text-amber-400" />
                        NOT CLOCKED IN
                      </span>
                    )}
                  </Badge>
                </div>

                {/* Time stamps & dynamic counter */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary pt-1">
                  {myTodayAttendance ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-muted">Clocked in:</span>
                        <span className="text-text-primary font-mono font-medium">
                          {new Intl.DateTimeFormat("en-US", {
                            timeZone: shiftConfig.timezone,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          }).format(new Date(myTodayAttendance.clockIn))}
                        </span>
                        {myTodayAttendance.status === "LATE" && (
                          <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                            Late Arrival (+15m)
                          </span>
                        )}
                      </div>

                      {myTodayAttendance.clockOut && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-muted">Clocked out:</span>
                          <span className="text-text-primary font-mono font-medium">
                            {new Intl.DateTimeFormat("en-US", {
                              timeZone: shiftConfig.timezone,
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            }).format(new Date(myTodayAttendance.clockOut))}
                          </span>
                        </div>
                      )}

                      {isClockedIn && elapsedDuration && (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                          <Timer className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[11px]">Active Duration:</span>
                          <span className="font-mono font-bold text-emerald-300">
                            {elapsedDuration}
                          </span>
                        </div>
                      )}

                      {isClockedOut && myTodayAttendance.durationMinutes !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-muted">Total Duration:</span>
                          <span className="text-text-primary font-mono font-semibold">
                            {Math.floor(myTodayAttendance.durationMinutes / 60)}h{" "}
                            {myTodayAttendance.durationMinutes % 60}m
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        No attendance clocked today. Grace period cut-off is {shiftConfig.gracePeriod}.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button Strip */}
              <div className="flex items-center gap-3">
                {!myTodayAttendance && (
                  <Button
                    onClick={() => handleClockAction("CLOCK_IN")}
                    disabled={isClocking}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 h-auto text-sm shadow-md flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{isClocking ? "Clocking In..." : "Clock In Now"}</span>
                  </Button>
                )}

                {isClockedIn && (
                  <Button
                    onClick={() => handleClockAction("CLOCK_OUT")}
                    disabled={isClocking}
                    variant="danger"
                    className="font-bold px-6 py-2.5 h-auto text-sm shadow-md flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{isClocking ? "Clocking Out..." : "Clock Out"}</span>
                  </Button>
                )}

                {isClockedOut && (
                  <div className="px-3.5 py-1.5 bg-surface-elevated rounded-subtle text-xs text-text-secondary font-medium">
                    Shift Concluded
                  </div>
                )}

                {/* Request Adjustment Trigger */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCorrectionType(myTodayAttendance ? "TIME_CORRECTION" : "MISSED_CLOCKIN");
                    setCorrectionModalOpen(true);
                  }}
                  className="text-xs text-text-secondary hover:text-text-primary hover:bg-surface-elevated border-border"
                >
                  <FileEdit className="w-3.5 h-3.5 mr-1.5 text-orange-400" />
                  <span>Request Adjustment</span>
                </Button>
              </div>
            </div>

            {/* Visual Shift Timeline for Staff */}
            <div className="p-3 rounded-card bg-surface-elevated/40 border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-mono text-[11px] text-text-secondary">
                <Sun className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span>Shift Hours: <strong>{shiftConfig.startTime}</strong> - <strong>{shiftConfig.endTime}</strong> WAT</span>
              </div>
              <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                +{shiftConfig.gracePeriod} grace window
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* 3. Branch Operations Overview (For Managers and Owners) with Organic Ambient Lighting */}
      {isManagerOrOwner && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="relative overflow-hidden p-3.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-surface to-surface border border-violet-500/20 hover:border-violet-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-14 bg-violet-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-text-muted mb-1 relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                Scheduled
              </span>
              <Users className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="text-2xl font-black font-mono text-text-primary relative">
              {metrics.totalScheduled}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5 relative">
              Assigned to {branchCode}
            </div>
          </Card>

          <Card className="relative overflow-hidden p-3.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-surface to-surface border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-14 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-text-muted mb-1 relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Active On Shift
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 relative">
              {metrics.activeNowCount}
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5 font-medium relative">
              Working right now
            </div>
          </Card>

          <Card className="relative overflow-hidden p-3.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/10 via-surface to-surface border border-teal-500/20 hover:border-teal-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-14 bg-teal-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-text-muted mb-1 relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                On Time Arrivals
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="text-2xl font-black font-mono text-text-primary relative">
              {metrics.onTimeCount}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5 relative">
              Before grace cutoff
            </div>
          </Card>

          <Card className="relative overflow-hidden p-3.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-surface to-surface border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 shadow-xs rounded-card">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-14 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-text-muted mb-1 relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Late Arrivals
              </span>
              <ClockAlert className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className={`text-2xl font-black font-mono relative ${metrics.lateCount > 0 ? "text-amber-400" : "text-text-primary"}`}>
              {metrics.lateCount}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5 relative">
              Exceeded grace cutoff
            </div>
          </Card>

          <Card className="relative overflow-hidden p-3.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-500/10 via-surface to-surface border border-rose-500/20 hover:border-rose-500/40 transition-all duration-300 shadow-xs rounded-card col-span-2 sm:col-span-1">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-14 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-text-muted mb-1 relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                Not Clocked In
              </span>
              <Ban className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className={`text-2xl font-black font-mono relative ${metrics.absentCount > 0 ? "text-rose-400" : "text-text-primary"}`}>
              {metrics.absentCount}
            </div>
            <div className="text-[10px] text-text-muted mt-0.5 relative">
              Missing shift check-in
            </div>
          </Card>
        </div>
      )}

      {/* 4. Pending Shift Corrections (Approval Queue for Managers/Owners) */}
      {isManagerOrOwner && corrections.filter((c) => c.status === "PENDING").length > 0 && (
        <Card className="p-4 bg-surface border-status-warning/40 rounded-card shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-warning" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Pending Shift Adjustment Requests ({corrections.filter((c) => c.status === "PENDING").length})
              </h3>
            </div>
            <span className="text-[11px] text-text-muted">
              Approval required for immutable audit logs
            </span>
          </div>

          <div className="space-y-2.5">
            {corrections
              .filter((c) => c.status === "PENDING")
              .map((corr) => (
                <div
                  key={corr.id}
                  className="p-3 bg-surface-elevated/50 border border-border rounded-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{corr.employeeName}</span>
                      <span className="text-[10px] text-text-muted">·</span>
                      <span className="text-[11px] text-text-secondary">
                        Reason: <span className="text-text-primary font-medium">"{corr.reason}"</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted font-mono">
                      {corr.originalClockIn && (
                        <span>
                          System recorded:{" "}
                          <span className="text-text-secondary">
                            {new Intl.DateTimeFormat("en-US", {
                              timeZone: shiftConfig.timezone,
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(corr.originalClockIn))}
                          </span>
                        </span>
                      )}
                      {corr.correctedClockIn && (
                        <span>
                          Requested time:{" "}
                          <span className="text-brand font-semibold">
                            {new Intl.DateTimeFormat("en-US", {
                              timeZone: shiftConfig.timezone,
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(corr.correctedClockIn))}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={reviewingId === corr.id}
                      onClick={() => handleCorrectionReview(corr.id, "APPROVED")}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 px-3 gap-1 shadow-sm"
                    >
                      <Check className="w-3 h-3" />
                      <span>{reviewingId === corr.id ? "Approving..." : "Approve"}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewingId === corr.id}
                      onClick={() => handleCorrectionReview(corr.id, "REJECTED")}
                      className="border-border text-status-danger hover:bg-status-danger-subtle text-xs h-7 px-3 gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Reject</span>
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* 5. Branch Roster View (Managers/Owners) */}
      {isManagerOrOwner ? (
        <Card className="bg-surface border-border rounded-card overflow-hidden shadow-sm">
          {/* Table Header & Controls */}
          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-semibold text-text-primary tracking-tight">
                Daily Branch Shift Roster
              </h2>
              <span className="text-xs text-text-muted">
                ({filteredRoster.length} of {rosterItems.length} staff)
              </span>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-surface-elevated/60 border border-border rounded-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand w-44"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-surface-elevated/60 border border-border rounded-subtle p-0.5 text-xs">
                {[
                  { label: "All", value: "ALL" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "On Time", value: "ON_TIME" },
                  { label: "Late", value: "LATE" },
                  { label: "Absent", value: "ABSENT" },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-2 py-0.5 rounded-[6px] transition-colors font-medium ${
                      statusFilter === f.value
                        ? "bg-brand text-white shadow-xs"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Roster Table */}
          {filteredRoster.length === 0 ? (
            <div className="p-10 text-center text-xs text-text-muted">
              <Users className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
              <p>No staff records matching your filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-elevated/40 text-text-secondary border-b border-border font-medium uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Staff Member</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Scheduled Shift</th>
                    <th className="px-4 py-2.5">Clock In</th>
                    <th className="px-4 py-2.5">Clock Out</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">Shift Status</th>
                    <th className="px-4 py-2.5">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRoster.map((rec) => {
                    return (
                      <tr
                        key={rec.employeeId}
                        className="hover:bg-surface-elevated/40 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-text-primary">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold shadow-xs shrink-0 ${
                                rec.employeeRole === "OWNER"
                                  ? "bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 border-amber-400/40"
                                  : rec.employeeRole === "MANAGER"
                                  ? "bg-gradient-to-br from-violet-500 to-purple-700 text-white border-violet-400/40"
                                  : rec.employeeRole === "CASHIER"
                                  ? "bg-gradient-to-br from-blue-500 to-cyan-700 text-white border-blue-400/40"
                                  : rec.employeeRole === "SALESPERSON"
                                  ? "bg-gradient-to-br from-emerald-500 to-teal-700 text-white border-emerald-400/40"
                                  : "bg-gradient-to-br from-cyan-500 to-sky-700 text-slate-950 border-cyan-400/40"
                              }`}
                            >
                              {rec.employeeName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-text-primary">{rec.employeeName}</div>
                              <div className="text-[10px] text-text-muted font-mono">
                                {rec.employeeNumber}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                              rec.employeeRole === "OWNER"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : rec.employeeRole === "MANAGER"
                                ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                                : rec.employeeRole === "CASHIER"
                                ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                                : rec.employeeRole === "SALESPERSON"
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                            }`}
                          >
                            {rec.employeeRole}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-text-muted text-[11px]">
                          {shiftConfig.startTime} - {shiftConfig.endTime}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px]">
                          {rec.clockIn ? (
                            <span className="text-text-primary font-medium">
                              {new Intl.DateTimeFormat("en-US", {
                                timeZone: shiftConfig.timezone,
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              }).format(new Date(rec.clockIn))}
                            </span>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px]">
                          {rec.clockOut ? (
                            <span className="text-text-secondary">
                              {new Intl.DateTimeFormat("en-US", {
                                timeZone: shiftConfig.timezone,
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              }).format(new Date(rec.clockOut))}
                            </span>
                          ) : rec.isClockedIn ? (
                            <span className="text-emerald-400 font-sans font-semibold text-[10px] flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active On Shift
                            </span>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-text-secondary">
                          {rec.durationMinutes !== null ? (
                            `${Math.floor(rec.durationMinutes / 60)}h ${rec.durationMinutes % 60}m`
                          ) : rec.isClockedIn ? (
                            <span className="text-emerald-400/80 font-sans text-[10px] font-medium">In Progress</span>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {rec.status === "EXEMPT" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              <ShieldCheck className="w-3 h-3 text-amber-400" />
                              EXECUTIVE EXEMPT
                            </span>
                          ) : rec.status === "PRESENT" && rec.isClockedIn ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                              <Check className="w-3 h-3 text-emerald-400" />
                              ON TIME
                            </span>
                          ) : rec.status === "LATE" && rec.isClockedIn ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              LATE ARRIVAL
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                              <Ban className="w-3 h-3 text-rose-400" />
                              NOT CLOCKED IN
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-text-muted font-mono">
                          {rec.source || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        /* Regular Staff Shift History */
        <Card className="bg-surface border-border rounded-card p-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand" />
              <span>Your Recent Attendance & Adjustments</span>
            </h3>
            <span className="text-xs text-text-muted">
              Role: <strong className="text-text-primary">{userRole}</strong>
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {corrections.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">
                No past adjustment requests found. Your records are up to date.
              </p>
            ) : (
              corrections.map((corr) => (
                <div
                  key={corr.id}
                  className="p-3 bg-surface-elevated/40 border border-border rounded-subtle flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-text-primary">
                      Requested adjustment: "{corr.reason}"
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      Submitted: {new Date(corr.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge
                    variant={
                      corr.status === "APPROVED"
                        ? "success"
                        : corr.status === "REJECTED"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {corr.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* 6. Shift Adjustment Request Modal */}
      {correctionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface/95 backdrop-blur-2xl border border-white/10 w-full max-w-md max-h-[88vh] rounded-card shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
            {/* Header */}
            <div className="p-5 pb-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                  <FileEdit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    Request Attendance Adjustment
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Submit audit-verified shift correction
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionModalOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-surface-elevated text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form id="correction-form" onSubmit={handleRequestCorrection} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Notice */}
              <div className="p-3 rounded-lg bg-brand/10 border border-brand/20 text-text-secondary text-[11px] leading-relaxed">
                <span className="font-semibold text-brand">Audit Notice:</span> All shift adjustments require manager or owner verification and are preserved permanently in the branch audit log.
              </div>

              {/* Target Date */}
              <div>
                <label className="block font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-1.5">
                  Shift Date *
                </label>
                <input
                  type="date"
                  required
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 font-mono transition-all"
                />
              </div>

              {/* Requested Clock-in Time */}
              <div>
                <label className="block font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-1.5">
                  Actual Arrival / Clock-In Time
                </label>
                <input
                  type="time"
                  value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 font-mono transition-all"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Leave blank if submitting a shift note or justification only.
                </p>
              </div>

              {/* Reason */}
              <div>
                <label className="block font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-1.5">
                  Reason for Adjustment *
                </label>
                <textarea
                  required
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Morning network downtime at retail counter, or official offsite task"
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none transition-all leading-relaxed"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-surface/50 backdrop-blur-sm flex justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCorrectionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="correction-form"
                size="sm"
                disabled={isSubmittingCorrection || !correctionReason.trim()}
                className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold px-4 shadow-sm"
              >
                {isSubmittingCorrection ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Owner Branch Shift Hours Modal */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md max-h-[88vh] bg-surface/95 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-card overflow-hidden flex flex-col animate-scaleUp">
            {/* Header */}
            <div className="p-5 pb-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    Configure Branch Shift Schedule
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {branchName} ({branchCode}) · Operating cutoff policy
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShiftModalOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-surface-elevated text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form id="shift-schedule-form" onSubmit={handleSaveShiftSchedule} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-1.5">
                    Shift Opening Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftOpeningTime}
                    onChange={(e) => setShiftOpeningTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 font-mono transition-all"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    Standard start hour
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-1.5">
                    Shift Closing Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftClosingTime}
                    onChange={(e) => setShiftClosingTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 font-mono transition-all"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    Standard closing hour
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[11px] uppercase tracking-wider text-text-secondary mb-1.5">
                  Lateness Grace Period (Minutes) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={shiftGracePeriod}
                  onChange={(e) => setShiftGracePeriod(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 font-mono transition-all"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Arrivals beyond this grace window will automatically be flagged as <span className="text-status-warning font-semibold">LATE</span> in the ledger.
                </p>
              </div>

              <div className="p-3 bg-brand/5 border border-brand/20 rounded-lg text-[11px] text-text-secondary flex items-start gap-2 leading-relaxed">
                <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-text-primary">Policy Summary: </span>
                  Staff clocking in between {shiftOpeningTime} and {shiftGracePeriod} minutes after will be marked <span className="text-emerald-400 font-semibold">ON TIME</span>. Later arrivals are flagged.
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-surface/50 backdrop-blur-sm flex justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShiftModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="shift-schedule-form"
                size="sm"
                disabled={isSavingShift}
                className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold px-4 shadow-sm"
              >
                {isSavingShift ? "Saving Schedule..." : "Save Shift Schedule"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
