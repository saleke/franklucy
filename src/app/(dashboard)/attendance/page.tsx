import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import {
  AttendanceWorkspace,
  AttendanceRosterItem,
  PendingCorrectionItem,
  PersonalAttendanceRecord,
} from "@/components/attendance/attendance-workspace";
import {
  getNormalizedWorkDate,
  calculateShiftDuration,
  evaluateShiftStatus,
  BRANCH_TIMEZONE,
  SHIFT_POLICY,
} from "@/lib/attendance";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const todayWorkDate = getNormalizedWorkDate(now);

  // Active branch details
  const activeBranch = await db.branch.findUnique({
    where: { id: user.activeBranchId },
  });

  const isManagerOrOwner = user.role === "OWNER" || user.role === "MANAGER";

  // 1. Fetch all active employees assigned to this branch
  const branchAssignments = await db.employeeBranchAssignment.findMany({
    where: {
      branchId: user.activeBranchId,
      endDate: null,
      employee: { status: "ACTIVE" },
    },
    include: {
      employee: {
        include: {
          user: {
            include: {
              roles: {
                include: { role: true },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { employee: { lastName: "asc" } },
      { employee: { firstName: "asc" } },
    ],
  });

  // 2. Fetch today's attendance records for the branch
  const rawTodayAttendance = await db.attendance.findMany({
    where: {
      branchId: user.activeBranchId,
      workDate: todayWorkDate,
    },
    include: {
      employee: {
        include: {
          user: {
            include: {
              roles: {
                include: { role: true },
              },
            },
          },
        },
      },
    },
    orderBy: { clockIn: "asc" },
  });

  // Map attendance by employeeId for fast lookup
  const attendanceByEmployee = new Map<string, (typeof rawTodayAttendance)[0]>();
  for (const record of rawTodayAttendance) {
    attendanceByEmployee.set(record.employeeId, record);
  }

  // 3. Current user's attendance today
  const myRecordRaw = attendanceByEmployee.get(user.employeeId) || null;
  let myTodayAttendance: PersonalAttendanceRecord | null = null;

  if (myRecordRaw) {
    myTodayAttendance = {
      id: myRecordRaw.id,
      clockIn: myRecordRaw.clockIn.toISOString(),
      clockOut: myRecordRaw.clockOut ? myRecordRaw.clockOut.toISOString() : null,
      status: myRecordRaw.status as any,
      source: myRecordRaw.source,
      durationMinutes: calculateShiftDuration(
        myRecordRaw.clockIn,
        myRecordRaw.clockOut
      ),
    };
  }

  // 4. Construct complete branch roster (Left-joining scheduled staff with attendance)
  const rosterItems: AttendanceRosterItem[] = branchAssignments.map((assignment) => {
    const emp = assignment.employee;
    const existing = attendanceByEmployee.get(emp.id);
    const roleName = emp.user?.roles[0]?.role.name || "STAFF";

    if (existing) {
      return {
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeNumber: emp.employeeNumber,
        employeeRole: roleName,
        attendanceId: existing.id,
        clockIn: existing.clockIn.toISOString(),
        clockOut: existing.clockOut ? existing.clockOut.toISOString() : null,
        status: existing.status as any,
        source: existing.source,
        durationMinutes: calculateShiftDuration(existing.clockIn, existing.clockOut),
        isClockedIn: true,
      };
    }

    // Has NOT clocked in
    // Owner is exempt from mandatory shift clocking and is not penalized as ABSENT
    const isOwnerRole = roleName === "OWNER" || emp.id === user.employeeId && user.isOwner;

    return {
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      employeeNumber: emp.employeeNumber,
      employeeRole: roleName,
      attendanceId: null,
      clockIn: null,
      clockOut: null,
      status: (isOwnerRole ? "EXEMPT" : "ABSENT") as any,
      source: null,
      durationMinutes: null,
      isClockedIn: false,
    };
  });

  // 5. Query corrections
  let rawCorrections = [];
  if (isManagerOrOwner) {
    // Managers and owners see pending corrections for the branch
    rawCorrections = await db.attendanceCorrection.findMany({
      where: {
        status: "PENDING",
        attendance: {
          branchId: user.activeBranchId,
        },
      },
      include: {
        attendance: {
          include: {
            employee: {
              include: {
                user: {
                  include: { roles: { include: { role: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    // Regular staff see their own recent correction requests
    rawCorrections = await db.attendanceCorrection.findMany({
      where: {
        requestedBy: user.employeeId,
      },
      include: {
        attendance: {
          include: {
            employee: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  }

  const corrections: PendingCorrectionItem[] = rawCorrections.map((c) => ({
    id: c.id,
    attendanceId: c.attendanceId,
    employeeId: c.attendance.employeeId,
    employeeName: `${c.attendance.employee.firstName} ${c.attendance.employee.lastName}`,
    reason: c.reason,
    originalClockIn: c.originalClockIn ? c.originalClockIn.toISOString() : null,
    correctedClockIn: c.correctedClockIn ? c.correctedClockIn.toISOString() : null,
    status: c.status as any,
    createdAt: c.createdAt.toISOString(),
  }));

  // 6. Summary metrics (Operational staff only; owner is executive and excluded from shift attendance quota)
  const operationalRoster = rosterItems.filter((r) => r.employeeRole !== "OWNER");
  const totalScheduled = operationalRoster.length;
  const clockedInCount = operationalRoster.filter((r) => r.isClockedIn).length;
  const activeNowCount = operationalRoster.filter(
    (r) => r.isClockedIn && r.clockOut === null
  ).length;
  const onTimeCount = operationalRoster.filter(
    (r) => r.isClockedIn && r.status === "PRESENT"
  ).length;
  const lateCount = operationalRoster.filter(
    (r) => r.isClockedIn && r.status === "LATE"
  ).length;
  const absentCount = Math.max(0, totalScheduled - clockedInCount);

  const openingTime = activeBranch?.openingTime || "08:00";
  const closingTime = activeBranch?.closingTime || "17:00";
  const graceMinutes = activeBranch?.gracePeriodMinutes ?? 15;

  return (
    <AppShell user={user}>
      <AttendanceWorkspace
        branchId={activeBranch?.id || user.activeBranchId}
        currentEmployeeId={user.employeeId}
        currentEmployeeName={user.employeeName}
        userRole={user.role}
        isOwner={user.role === "OWNER" || user.isOwner}
        branchName={activeBranch?.name || user.activeBranchName}
        branchCode={activeBranch?.code || user.activeBranchCode}
        rosterItems={isManagerOrOwner ? rosterItems : []}
        corrections={corrections}
        myTodayAttendance={myTodayAttendance}
        isManagerOrOwner={isManagerOrOwner}
        metrics={{
          totalScheduled,
          clockedInCount,
          activeNowCount,
          onTimeCount,
          lateCount,
          absentCount,
          pendingCorrectionsCount: isManagerOrOwner
            ? corrections.filter((c) => c.status === "PENDING").length
            : 0,
        }}
        shiftConfig={{
          branchId: activeBranch?.id || user.activeBranchId,
          openingTime,
          closingTime,
          gracePeriodMinutes: graceMinutes,
          startTime: openingTime,
          gracePeriod: `${graceMinutes} mins`,
          endTime: closingTime,
          timezone: BRANCH_TIMEZONE,
        }}
      />
    </AppShell>
  );
}
