import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { firstName, lastName, email, password, role, branchId, phone } =
      await request.json();

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: "First name, last name, email, and password are required." },
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
        { error: "An account with this email address already exists. Please sign in instead." },
        { status: 400 }
      );
    }

    // Resolve Role
    const targetRoleName = (role || "OWNER").toUpperCase().trim();
    const roleRecord = await db.role.findUnique({
      where: { name: targetRoleName },
    });

    if (!roleRecord) {
      return NextResponse.json(
        { error: `Invalid role specified: ${targetRoleName}` },
        { status: 400 }
      );
    }

    // Resolve Branch
    let targetBranchId = branchId;
    if (!targetBranchId) {
      const defaultBranch = await db.branch.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { code: "asc" },
      });

      if (defaultBranch) {
        targetBranchId = defaultBranch.id;
      } else {
        // Create initial branch if none exists
        const createdBranch = await db.branch.create({
          data: {
            name: "Main HQ Branch",
            code: "MAIN",
            address: "Lagos Central Commercial District",
            status: "ACTIVE",
          },
        });
        targetBranchId = createdBranch.id;
      }
    }

    const branch = await db.branch.findUnique({
      where: { id: targetBranchId },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Selected branch does not exist." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Atomically create User, Employee, Role mapping, Branch assignment, and Audit log
    const result = await db.$transaction(async (tx) => {
      const employeeCount = await tx.employee.count();
      const paddedNum = String(employeeCount + 1).padStart(4, "0");
      const employeeNumber = `EMP-${branch.code}-${paddedNum}`;

      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          status: "ACTIVE",
          roles: {
            create: {
              roleId: roleRecord.id,
            },
          },
        },
      });

      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          employeeNumber,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone?.trim() || null,
          status: "ACTIVE",
          branchAssignments: {
            create: {
              branchId: branch.id,
              startDate: new Date(),
              reason: "Initial Staff Account Provisioning",
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "USER_REGISTERED",
          userId: user.id,
          branchId: branch.id,
          entityType: "USER",
          entityId: user.id,
          description: `User ${user.email} registered with role ${roleRecord.name} as ${employee.firstName} ${employee.lastName} (${employeeNumber}).`,
          newValue: {
            email: user.email,
            role: roleRecord.name,
            employeeNumber,
            branchCode: branch.code,
          },
        },
      });

      return { user, employee };
    });

    // Establish immediate session cookie
    await setSessionCookie(result.user.id, branch.id);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: `${result.employee.firstName} ${result.employee.lastName}`,
          role: roleRecord.name,
          branchName: branch.name,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}
