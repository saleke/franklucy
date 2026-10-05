import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import {
  getNormalizedWorkDate,
  evaluateShiftStatus,
  calculateShiftDuration,
  BRANCH_TIMEZONE,
} from "@/lib/attendance";
import { z } from "zod";

const clockActionSchema = z.object({
  action: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    // Server-side permission enforcement
    try {
      await requirePermission(user.id, "attendance.clock");
    } catch {
      return NextResponse.json(
        { error: "You do not have permission to clock attendance." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = clockActionSchema.parse(body);

    const now = new Date();
    // Authoritative Nigerian business workDate (UTC midnight)
    const workDate = getNormalizedWorkDate(now);

    // Check existing attendance for this employee today
    const existing = await db.attendance.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: user.employeeId,
          workDate,
        },
      },
    });

    if (action === "CLOCK_IN") {
      if (existing) {
        const existingFormatted = new Intl.DateTimeFormat("en-US", {
          timeZone: BRANCH_TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(existing.clockIn);

        return NextResponse.json(
          {
            error: `Already clocked in today at ${existingFormatted}.`,
            clockIn: existing.clockIn,
            status: existing.status,
          },
          { status: 400 }
        );
      }

      const branch = await db.branch.findUnique({
        where: { id: user.activeBranchId },
        select: { openingTime: true, gracePeriodMinutes: true },
      });

      // Authoritative shift status calculation in Nigerian timezone using branch policy
      const attendanceStatus = evaluateShiftStatus(now, branch || undefined);

      const record = await db.attendance.create({
        data: {
          employeeId: user.employeeId,
          branchId: user.activeBranchId,
          workDate,
          clockIn: now,
          status: attendanceStatus,
          source: "WEB",
        },
      });

      const formattedNow = new Intl.DateTimeFormat("en-US", {
        timeZone: BRANCH_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now);

      await db.auditLog.create({
        data: {
          action: "ATTENDANCE_CLOCK_IN",
          userId: user.id,
          branchId: user.activeBranchId,
          entityType: "ATTENDANCE",
          entityId: record.id,
          description: `Staff ${user.employeeName} clocked in at ${formattedNow} (${attendanceStatus})`,
        },
      });

      return NextResponse.json({
        success: true,
        action: "CLOCK_IN",
        record: {
          id: record.id,
          clockIn: record.clockIn,
          status: record.status,
        },
      });
    }

    if (action === "CLOCK_OUT") {
      if (!existing) {
        return NextResponse.json(
          { error: "No clock-in record found for today. You must clock in first." },
          { status: 400 }
        );
      }

      if (existing.clockOut) {
        const existingOutFormatted = new Intl.DateTimeFormat("en-US", {
          timeZone: BRANCH_TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(existing.clockOut);

        return NextResponse.json(
          {
            error: `Already clocked out today at ${existingOutFormatted}.`,
          },
          { status: 400 }
        );
      }

      const updated = await db.attendance.update({
        where: { id: existing.id },
        data: {
          clockOut: now,
        },
      });

      const durationMinutes = calculateShiftDuration(existing.clockIn, now);
      const formattedNow = new Intl.DateTimeFormat("en-US", {
        timeZone: BRANCH_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now);

      const durationText =
        durationMinutes !== null
          ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
          : "";

      await db.auditLog.create({
        data: {
          action: "ATTENDANCE_CLOCK_OUT",
          userId: user.id,
          branchId: user.activeBranchId,
          entityType: "ATTENDANCE",
          entityId: updated.id,
          description: `Staff ${user.employeeName} clocked out at ${formattedNow}${
            durationText ? ` (Shift duration: ${durationText})` : ""
          }`,
        },
      });

      return NextResponse.json({
        success: true,
        action: "CLOCK_OUT",
        record: {
          id: updated.id,
          clockIn: updated.clockIn,
          clockOut: updated.clockOut,
          status: updated.status,
          durationMinutes,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid clock action payload." }, { status: 400 });
    }
    console.error("Attendance clock exception:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process attendance clock action." },
      { status: 500 }
    );
  }
}
