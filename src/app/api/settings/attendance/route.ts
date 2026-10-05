import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { BRANCH_TIMEZONE } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "branches.manage");
    }

    const branches = await db.branch.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        openingTime: true,
        closingTime: true,
        gracePeriodMinutes: true,
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({
      timezone: BRANCH_TIMEZONE,
      defaultPolicy: {
        standardStart: "08:00",
        standardEnd: "17:00",
        gracePeriodMinutes: 15,
      },
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        status: b.status,
        openingTime: b.openingTime || "08:00",
        closingTime: b.closingTime || "17:00",
        gracePeriodMinutes: b.gracePeriodMinutes ?? 15,
      })),
    });
  } catch (error: any) {
    console.error("Get attendance settings error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch attendance settings." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "branches.manage");
    }

    const body = await request.json();
    const { applyToAll, branchId, openingTime, closingTime, gracePeriodMinutes } = body;

    const cleanOpening = openingTime?.trim() || "08:00";
    const cleanClosing = closingTime?.trim() || "17:00";
    const cleanGrace = Number(gracePeriodMinutes) >= 0 ? Number(gracePeriodMinutes) : 15;

    if (applyToAll) {
      // Batch update all branches
      await db.$transaction(async (tx) => {
        await tx.branch.updateMany({
          data: {
            openingTime: cleanOpening,
            closingTime: cleanClosing,
            gracePeriodMinutes: cleanGrace,
          },
        });

        await tx.auditLog.create({
          data: {
            action: "SHIFT_SCHEDULE_BATCH_UPDATED",
            userId: user.id,
            branchId: user.activeBranchId,
            entityType: "BUSINESS_POLICY",
            entityId: "ALL_BRANCHES",
            description: `Owner applied company-wide shift schedule: ${cleanOpening} - ${cleanClosing} (+${cleanGrace}m grace) to all branches.`,
            newValue: {
              openingTime: cleanOpening,
              closingTime: cleanClosing,
              gracePeriodMinutes: cleanGrace,
            },
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: `Company-wide shift schedule (${cleanOpening} - ${cleanClosing}, ${cleanGrace}m grace) applied to all branches.`,
      });
    }

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required." }, { status: 400 });
    }

    const branch = await db.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    const updated = await db.$transaction(async (tx) => {
      const b = await tx.branch.update({
        where: { id: branch.id },
        data: {
          openingTime: cleanOpening,
          closingTime: cleanClosing,
          gracePeriodMinutes: cleanGrace,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "BRANCH_SHIFT_UPDATED",
          userId: user.id,
          branchId: branch.id,
          entityType: "BRANCH",
          entityId: branch.id,
          description: `Shift hours for branch ${branch.code} updated to ${cleanOpening} - ${cleanClosing} (+${cleanGrace}m grace).`,
          oldValue: {
            openingTime: branch.openingTime,
            closingTime: branch.closingTime,
            gracePeriodMinutes: branch.gracePeriodMinutes,
          },
          newValue: {
            openingTime: b.openingTime,
            closingTime: b.closingTime,
            gracePeriodMinutes: b.gracePeriodMinutes,
          },
        },
      });

      return b;
    });

    return NextResponse.json({
      success: true,
      branch: updated,
      message: `Shift schedule for ${updated.name} updated successfully.`,
    });
  } catch (error: any) {
    console.error("Update attendance settings error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update attendance schedule." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
