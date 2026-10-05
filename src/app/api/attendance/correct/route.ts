import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import {
  getNormalizedWorkDate,
  parseWorkDate,
  evaluateShiftStatus,
  BRANCH_TIMEZONE,
} from "@/lib/attendance";
import { z } from "zod";

const requestCorrectionSchema = z.object({
  attendanceId: z.string().optional(),
  workDate: z.string().optional(),
  correctedClockIn: z.string().optional(),
  reason: z.string().min(3, "Reason must be at least 3 characters"),
});

const approveCorrectionSchema = z.object({
  correctionId: z.string().min(1),
  action: z.enum(["APPROVED", "REJECTED"]),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const body = await request.json();

    // 1. Approval flow (Managers / Owners)
    if ("correctionId" in body) {
      try {
        await requirePermission(user.id, "attendance.correct.approve");
      } catch {
        return NextResponse.json(
          { error: "Only managers or owners can review attendance corrections." },
          { status: 403 }
        );
      }

      const { correctionId, action } = approveCorrectionSchema.parse(body);

      const correction = await db.attendanceCorrection.findUnique({
        where: { id: correctionId },
        include: {
          attendance: {
            include: { employee: true },
          },
        },
      });

      if (!correction) {
        return NextResponse.json({ error: "Correction record not found." }, { status: 404 });
      }

      if (correction.status !== "PENDING") {
        return NextResponse.json(
          { error: `Correction is already ${correction.status.toLowerCase()}.` },
          { status: 400 }
        );
      }

      const updatedCorrection = await db.$transaction(async (tx) => {
        const res = await tx.attendanceCorrection.update({
          where: { id: correctionId },
          data: {
            status: action,
            approvedBy: user.employeeId,
          },
        });

        if (action === "APPROVED") {
          // If employee had no initial clockIn or was INCOMPLETE, evaluate status based on approved time
          const evaluatedStatus = correction.correctedClockIn
            ? evaluateShiftStatus(correction.correctedClockIn)
            : "PRESENT";

          await tx.attendance.update({
            where: { id: correction.attendanceId },
            data: {
              status: evaluatedStatus,
              source: "CORRECTION_APPROVED",
            },
          });
        }

        // Immutable Audit Log preserving original evidence
        await tx.auditLog.create({
          data: {
            action: `ATTENDANCE_CORRECTION_${action}`,
            userId: user.id,
            branchId: user.activeBranchId,
            entityType: "ATTENDANCE_CORRECTION",
            entityId: correctionId,
            description: `Attendance adjustment for ${correction.attendance.employee.firstName} ${correction.attendance.employee.lastName} was ${action.toLowerCase()} by ${user.employeeName}. Reason: "${correction.reason}"`,
            oldValue: {
              originalClockIn: correction.originalClockIn?.toISOString() || null,
              attendanceStatus: correction.attendance.status,
            },
            newValue: {
              action,
              approvedBy: user.employeeName,
              correctedClockIn: correction.correctedClockIn?.toISOString() || null,
            },
          },
        });

        return res;
      });

      return NextResponse.json({ success: true, correction: updatedCorrection });
    } else {
      // 2. Request flow (Staff or Managers requesting adjustment)
      try {
        await requirePermission(user.id, "attendance.correct");
      } catch {
        return NextResponse.json(
          { error: "You do not have permission to request attendance adjustments." },
          { status: 403 }
        );
      }

      const parsed = requestCorrectionSchema.parse(body);
      const now = new Date();
      const targetWorkDate = parsed.workDate
        ? parseWorkDate(parsed.workDate)
        : getNormalizedWorkDate(now);

      const correction = await db.$transaction(async (tx) => {
        let attendanceRecord = null;

        if (parsed.attendanceId) {
          attendanceRecord = await tx.attendance.findUnique({
            where: { id: parsed.attendanceId },
          });
        } else {
          // Find or create attendance for the workDate
          attendanceRecord = await tx.attendance.findUnique({
            where: {
              employeeId_workDate: {
                employeeId: user.employeeId,
                workDate: targetWorkDate,
              },
            },
          });

          if (!attendanceRecord) {
            // Staff forgot to clock in; create placeholder attendance record
            attendanceRecord = await tx.attendance.create({
              data: {
                employeeId: user.employeeId,
                branchId: user.activeBranchId,
                workDate: targetWorkDate,
                clockIn: parsed.correctedClockIn ? new Date(parsed.correctedClockIn) : now,
                status: "INCOMPLETE",
                source: "MANUAL_REQUEST",
              },
            });
          }
        }

        if (!attendanceRecord) {
          throw new Error("Unable to locate or initialize attendance record.");
        }

        const newCorrection = await tx.attendanceCorrection.create({
          data: {
            attendanceId: attendanceRecord.id,
            originalClockIn: attendanceRecord.clockIn,
            correctedClockIn: parsed.correctedClockIn ? new Date(parsed.correctedClockIn) : null,
            reason: parsed.reason,
            requestedBy: user.employeeId,
            status: "PENDING",
          },
        });

        await tx.auditLog.create({
          data: {
            action: "ATTENDANCE_CORRECTION_REQUESTED",
            userId: user.id,
            branchId: user.activeBranchId,
            entityType: "ATTENDANCE_CORRECTION",
            entityId: newCorrection.id,
            description: `Staff ${user.employeeName} requested attendance adjustment: "${parsed.reason}"`,
          },
        });

        return newCorrection;
      });

      return NextResponse.json({ success: true, correction }, { status: 201 });
    }
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid adjustment request data.", issues: error.issues },
        { status: 400 }
      );
    }
    console.error("Attendance correction exception:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process attendance correction." },
      { status: 500 }
    );
  }
}
