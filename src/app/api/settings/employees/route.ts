import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "employees.view");
    }

    const employees = await db.employee.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            roles: {
              include: {
                role: { select: { id: true, name: true, description: true } },
              },
            },
          },
        },
        branchAssignments: {
          where: { endDate: null },
          include: {
            branch: {
              select: { id: true, name: true, code: true },
            },
          },
          orderBy: { startDate: "desc" },
          take: 1,
        },
        _count: {
          select: {
            sales: true,
            attendances: true,
          },
        },
      },
      orderBy: { employeeNumber: "asc" },
    });

    return NextResponse.json({
      employees: employees.map((emp) => {
        const activeAssignment = emp.branchAssignments[0];
        const role = emp.user?.roles[0]?.role;
        return {
          id: emp.id,
          userId: emp.userId,
          employeeNumber: emp.employeeNumber,
          firstName: emp.firstName,
          lastName: emp.lastName,
          fullName: `${emp.firstName} ${emp.lastName}`,
          phone: emp.phone,
          status: emp.status,
          userStatus: emp.user?.status || "ACTIVE",
          email: emp.user?.email || null,
          roleId: role?.id || null,
          roleName: role?.name || "STAFF",
          branchId: activeAssignment?.branch.id || null,
          branchName: activeAssignment?.branch.name || "Unassigned",
          branchCode: activeAssignment?.branch.code || "-",
          salesCount: emp._count.sales,
          attendancesCount: emp._count.attendances,
          isOwner: role?.name === "OWNER",
          createdAt: emp.createdAt,
        };
      }),
    });
  } catch (error: any) {
    console.error("List employees error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list employees." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "employees.manage");
    }

    const body = await request.json();
    const { firstName, lastName, email, password, phone, roleName, branchId } = body;

    if (!firstName || !lastName || !email || !password || !roleName || !branchId) {
      return NextResponse.json(
        { error: "First name, last name, email, password, role, and branch are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user account with this email address already exists." },
        { status: 400 }
      );
    }

    // Verify Role
    const validRoles = ["MANAGER", "CASHIER", "STOCKKEEPER", "SALESPERSON"];
    if (!validRoles.includes(roleName)) {
      return NextResponse.json(
        { error: "Role must be MANAGER, CASHIER, STOCKKEEPER, or SALESPERSON." },
        { status: 400 }
      );
    }

    const roleRecord = await db.role.findUnique({
      where: { name: roleName },
    });

    if (!roleRecord) {
      return NextResponse.json({ error: `Role '${roleName}' not found.` }, { status: 400 });
    }

    // Verify Branch
    const branch = await db.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return NextResponse.json({ error: "Selected branch does not exist." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const newStaff = await db.$transaction(async (tx) => {
      const employeeCount = await tx.employee.count();
      const paddedNum = String(employeeCount + 1).padStart(4, "0");
      const employeeNumber = `EMP-${branch.code}-${paddedNum}`;

      // 1. Create User
      const createdUser = await tx.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          status: "ACTIVE",
          roles: {
            create: { roleId: roleRecord.id },
          },
        },
      });

      // 2. Create Employee
      const createdEmployee = await tx.employee.create({
        data: {
          userId: createdUser.id,
          employeeNumber,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone?.trim() || null,
          status: "ACTIVE",
        },
      });

      // 3. Create initial Branch Assignment
      await tx.employeeBranchAssignment.create({
        data: {
          employeeId: createdEmployee.id,
          branchId: branch.id,
          startDate: new Date(),
          assignedBy: user.id,
          reason: "Initial onboarding assignment",
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_CREATED",
          userId: user.id,
          branchId: branch.id,
          entityType: "EMPLOYEE",
          entityId: createdEmployee.id,
          description: `Staff member ${createdEmployee.firstName} ${createdEmployee.lastName} (${createdEmployee.employeeNumber}) created as ${roleName} at ${branch.name}.`,
          newValue: {
            employeeNumber,
            email: cleanEmail,
            role: roleName,
            branch: branch.name,
          },
        },
      });

      return {
        ...createdEmployee,
        email: cleanEmail,
        roleName,
        branchName: branch.name,
      };
    });

    return NextResponse.json({ employee: newStaff }, { status: 201 });
  } catch (error: any) {
    console.error("Create employee error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create employee." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
