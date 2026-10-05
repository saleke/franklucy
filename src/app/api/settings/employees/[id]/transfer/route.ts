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
        branchAssignments: {
          where: { endDate: null },
          include: { branch: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    const body = await request.json();
    const { branchId, reason } = body;

    if (!branchId) {
      return NextResponse.json({ error: "Target branch ID is required." }, { status: 400 });
    }

    const targetBranch = await db.branch.findUnique({
      where: { id: branchId },
    });

    if (!targetBranch) {
      return NextResponse.json({ error: "Target branch does not exist." }, { status: 404 });
    }

    const currentAssignment = employee.branchAssignments[0];
    if (currentAssignment && currentAssignment.branchId === targetBranch.id) {
      return NextResponse.json(
        { error: `Employee is already assigned to ${targetBranch.name}.` },
        { status: 400 }
      );
    }

    const now = new Date();

    await db.$transaction(async (tx) => {
      // 1. Close current branch assignment if open
      if (currentAssignment) {
        await tx.employeeBranchAssignment.update({
          where: { id: currentAssignment.id },
          data: { endDate: now },
        });
      }

      // 2. Open new branch assignment
      await tx.employeeBranchAssignment.create({
        data: {
          employeeId: employee.id,
          branchId: targetBranch.id,
          startDate: now,
          assignedBy: user.id,
          reason: reason?.trim() || "Owner branch transfer",
        },
      });

      // 3. Log Audit Trail
      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_TRANSFERRED",
          userId: user.id,
          branchId: targetBranch.id,
          entityType: "EMPLOYEE",
          entityId: employee.id,
          description: `Employee ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) transferred from ${currentAssignment?.branch.name || "None"} to ${targetBranch.name}. Reason: ${reason || "Staff redeployment"}.`,
          oldValue: {
            branchId: currentAssignment?.branchId || null,
            branchName: currentAssignment?.branch.name || null,
          },
          newValue: {
            branchId: targetBranch.id,
            branchName: targetBranch.name,
            reason: reason || "Staff redeployment",
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${employee.firstName} ${employee.lastName} transferred to ${targetBranch.name} successfully.`,
      branchName: targetBranch.name,
      branchCode: targetBranch.code,
    });
  } catch (error: any) {
    console.error("Transfer employee error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transfer employee." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
