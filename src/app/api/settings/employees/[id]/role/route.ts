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

    if (!employee || !employee.user) {
      return NextResponse.json({ error: "Employee account not found." }, { status: 404 });
    }

    const currentRole = employee.user.roles[0]?.role;
    if (currentRole?.name === "OWNER") {
      return NextResponse.json(
        { error: "The Business Owner role cannot be demoted or altered." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { newRole, reason } = body;

    const validRoles = ["MANAGER", "CASHIER", "STOCKKEEPER", "SALESPERSON"];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: "Target role must be MANAGER, CASHIER, STOCKKEEPER, or SALESPERSON." },
        { status: 400 }
      );
    }

    const targetRoleRecord = await db.role.findUnique({
      where: { name: newRole },
    });

    if (!targetRoleRecord) {
      return NextResponse.json({ error: `Role '${newRole}' not found.` }, { status: 400 });
    }

    if (currentRole?.id === targetRoleRecord.id) {
      return NextResponse.json(
        { error: `Employee is already assigned to the ${newRole} role.` },
        { status: 400 }
      );
    }

    await db.$transaction(async (tx) => {
      // 1. Remove previous role assignments
      await tx.userRole.deleteMany({
        where: { userId: employee.userId! },
      });

      // 2. Assign new role
      await tx.userRole.create({
        data: {
          userId: employee.userId!,
          roleId: targetRoleRecord.id,
        },
      });

      // 3. Log Audit Trail
      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_ROLE_CHANGED",
          userId: user.id,
          branchId: user.activeBranchId,
          entityType: "EMPLOYEE",
          entityId: employee.id,
          description: `Employee ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) role changed from ${currentRole?.name || "NONE"} to ${newRole}. Reason: ${reason || "Executive reassignment"}.`,
          oldValue: { role: currentRole?.name || "NONE" },
          newValue: { role: newRole, reason: reason || "Executive reassignment" },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${employee.firstName} ${employee.lastName} role changed to ${newRole}.`,
      roleName: newRole,
    });
  } catch (error: any) {
    console.error("Change role error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to change employee role." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
