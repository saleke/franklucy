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
      await requirePermission(user.id, "employees.manage");
    }

    const employee = await db.employee.findUnique({
      where: { id: params.id },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    const isTargetOwner = employee.user?.roles.some((r) => r.role.name === "OWNER");
    if (isTargetOwner) {
      return NextResponse.json(
        { error: "The Business Owner account cannot be deactivated." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (status !== "ACTIVE" && status !== "INACTIVE") {
      return NextResponse.json(
        { error: "Status must be ACTIVE or INACTIVE." },
        { status: 400 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: { status },
      });

      if (employee.userId) {
        await tx.user.update({
          where: { id: employee.userId },
          data: { status },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_STATUS_CHANGED",
          userId: user.id,
          branchId: user.activeBranchId,
          entityType: "EMPLOYEE",
          entityId: employee.id,
          description: `Employee ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) status set to ${status}.`,
          oldValue: { status: employee.status },
          newValue: { status },
        },
      });
    });

    return NextResponse.json({
      success: true,
      status,
      message: `Employee ${employee.firstName} ${employee.lastName} is now ${status}.`,
    });
  } catch (error: any) {
    console.error("Change status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update employee status." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
