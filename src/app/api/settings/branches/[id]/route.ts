import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "branches.manage");
    }

    const branch = await db.branch.findUnique({
      where: { id: params.id },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    const body = await request.json();
    const { name, address, phone, status, openingTime, closingTime, gracePeriodMinutes } = body;

    const updated = await db.$transaction(async (tx) => {
      const updatedBranch = await tx.branch.update({
        where: { id: branch.id },
        data: {
          name: name ? name.trim() : branch.name,
          address: address !== undefined ? address?.trim() || null : branch.address,
          phone: phone !== undefined ? phone?.trim() || null : branch.phone,
          status: status ? status : branch.status,
          openingTime: openingTime !== undefined ? openingTime?.trim() || "08:00" : branch.openingTime,
          closingTime: closingTime !== undefined ? closingTime?.trim() || "17:00" : branch.closingTime,
          gracePeriodMinutes: gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) || 15 : branch.gracePeriodMinutes,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "BRANCH_UPDATED",
          userId: user.id,
          branchId: branch.id,
          entityType: "BRANCH",
          entityId: branch.id,
          description: `Branch ${branch.code} updated: Name="${updatedBranch.name}", Schedule="${updatedBranch.openingTime}-${updatedBranch.closingTime} (+${updatedBranch.gracePeriodMinutes}m)".`,
          oldValue: {
            name: branch.name,
            address: branch.address,
            phone: branch.phone,
            status: branch.status,
            openingTime: branch.openingTime,
            closingTime: branch.closingTime,
            gracePeriodMinutes: branch.gracePeriodMinutes,
          },
          newValue: {
            name: updatedBranch.name,
            address: updatedBranch.address,
            phone: updatedBranch.phone,
            status: updatedBranch.status,
            openingTime: updatedBranch.openingTime,
            closingTime: updatedBranch.closingTime,
            gracePeriodMinutes: updatedBranch.gracePeriodMinutes,
          },
        },
      });

      return updatedBranch;
    });

    return NextResponse.json({ branch: updated });
  } catch (error: any) {
    console.error("Update branch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update branch." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
