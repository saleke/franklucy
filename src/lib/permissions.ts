import { db } from "@/lib/db";

export type AppPermission =
  | "sales.create"
  | "sales.view"
  | "inventory.view"
  | "inventory.receive"
  | "inventory.opening_stock"
  | "inventory.damage"
  | "inventory.expiry"
  | "inventory.count"
  | "inventory.adjust"
  | "inventory.adjust.approve"
  | "transfers.create"
  | "transfers.view"
  | "customers.view"
  | "customers.create"
  | "customers.payment"
  | "attendance.view"
  | "attendance.clock"
  | "attendance.correct"
  | "attendance.correct.approve"
  | "cash.reconcile"
  | "cash.handover"
  | "cash.session.open"
  | "cash.session.close"
  | "employees.view"
  | "employees.manage"
  | "branches.manage"
  | "products.manage"
  | "prices.change"
  | "discounts.approve"
  | "returns.create"
  | "refunds.approve"
  | "reports.view"
  | "activity.view"
  | "audit.view";

export class AuthorizationError extends Error {
  code = "FORBIDDEN";
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class BranchAccessError extends Error {
  code = "BRANCH_ACCESS_DENIED";
  constructor(message = "You do not have access to this branch.") {
    super(message);
    this.name = "BranchAccessError";
  }
}

/**
 * Checks if a user possesses a specific permission.
 * Re-queries user roles and permissions to ensure zero stale token vulnerabilities.
 */
export async function hasPermission(
  userId: string,
  permissionName: AppPermission
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId, status: "ACTIVE" },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return false;

  // Check if user has OWNER role (grant all)
  const isOwner = user.roles.some((r) => r.role.name === "OWNER");
  if (isOwner) return true;

  // Check explicit permission
  for (const userRole of user.roles) {
    for (const rp of userRole.role.permissions) {
      if (rp.permission.name === permissionName) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Asserts user has permission or throws AuthorizationError.
 */
export async function requirePermission(
  userId: string,
  permissionName: AppPermission
): Promise<void> {
  const allowed = await hasPermission(userId, permissionName);
  if (!allowed) {
    throw new AuthorizationError(
      `Permission denied: Missing required permission '${permissionName}'.`
    );
  }
}

/**
 * Verifies that a user is authorized to operate within a specific branch.
 */
export async function requireBranchAccess(
  userId: string,
  branchId: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId, status: "ACTIVE" },
    include: {
      employee: {
        include: {
          branchAssignments: {
            where: {
              branchId,
              endDate: null, // Active assignment
            },
          },
        },
      },
      roles: {
        include: { role: true },
      },
    },
  });

  if (!user) {
    throw new BranchAccessError("Active user session not found.");
  }

  // Owner has global branch visibility
  const isOwner = user.roles.some((r) => r.role.name === "OWNER");
  if (isOwner) return;

  // Check if branch assignment exists and is active
  const hasActiveAssignment =
    (user.employee?.branchAssignments.length ?? 0) > 0;

  if (!hasActiveAssignment) {
    throw new BranchAccessError(
      "Unauthorized branch access: You are not assigned to this branch."
    );
  }
}

/**
 * Checks if a user is authorized to operate within a specific branch.
 */
export async function hasBranchAccess(
  userId: string,
  branchId: string
): Promise<boolean> {
  try {
    await requireBranchAccess(userId, branchId);
    return true;
  } catch {
    return false;
  }
}

