import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    let lookupEmail = email.toLowerCase().trim();
    let user = await db.user.findUnique({
      where: { email: lookupEmail },
      include: {
        employee: {
          include: {
            branchAssignments: {
              where: { endDate: null },
            },
          },
        },
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user && lookupEmail.includes("@branchflow.com")) {
      user = await db.user.findUnique({
        where: { email: lookupEmail.replace("@branchflow.com", "@franklucy.com") },
        include: {
          employee: {
            include: {
              branchAssignments: {
                where: { endDate: null },
              },
            },
          },
          roles: {
            include: { role: true },
          },
        },
      });
    }

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Determine initial branch
    let initialBranchId: string | undefined = user.employee?.branchAssignments?.[0]?.branchId;

    if (!initialBranchId) {
      const isOwner = user.roles.some((r) => r.role.name === "OWNER");
      if (isOwner) {
        const firstBranch = await db.branch.findFirst({
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
        });
        initialBranchId = firstBranch?.id;
      }
    }

    await setSessionCookie(user.id, initialBranchId);

    // Record login audit
    await db.auditLog.create({
      data: {
        action: "USER_LOGGED_IN",
        userId: user.id,
        branchId: initialBranchId ?? null,
        entityType: "USER",
        entityId: user.id,
        description: `User ${user.email} authenticated successfully`,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.employee
          ? `${user.employee.firstName} ${user.employee.lastName}`
          : user.email,
        role: user.roles[0]?.role.name || "CASHIER",
      },
    });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
