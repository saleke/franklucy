import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

import crypto from "crypto";

const SESSION_COOKIE_NAME = "franklucy_session";

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.SESSION_SECRET ||
  "franklucy-super-secure-session-secret-key-32chars";

function signToken(payloadStr: string): string {
  const base64 = Buffer.from(payloadStr).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(base64)
    .digest("base64url");
  return `${base64}.${signature}`;
}

function verifyAndDecodeToken(token: string): any | null {
  const parts = token.split(".");
  if (parts.length === 2) {
    const [base64, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", AUTH_SECRET)
      .update(base64)
      .digest("base64url");
    
    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature, "utf-8");
    const expBuf = Buffer.from(expectedSig, "utf-8");
    if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
      try {
        const jsonStr = Buffer.from(base64, "base64url").toString("utf-8");
        return JSON.parse(jsonStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  // Graceful migration support for legacy base64-only tokens
  try {
    const jsonStr = Buffer.from(token, "base64").toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    if (parsed.userId) return parsed;
  } catch {
    return null;
  }
  return null;
}

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  activeBranchId: string;
  activeBranchName: string;
  activeBranchCode: string;
  isOwner: boolean;
  allowedBranches: { id: string; name: string; code: string }[];
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Creates a cryptographically signed session for an authenticated user.
 */
export async function setSessionCookie(
  userId: string,
  preferredBranchId?: string
) {
  const cookieStore = cookies();
  const sessionPayload = JSON.stringify({
    userId,
    branchId: preferredBranchId,
    createdAt: Date.now(),
  });

  const token = signToken(sessionPayload);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Clears session cookie on logout.
 */
export async function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Resolves current authenticated session with fresh database data.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const payload = verifyAndDecodeToken(sessionCookie.value);

    if (!payload?.userId) return null;

    const user = await db.user.findUnique({
      where: { id: payload.userId, status: "ACTIVE" },
      include: {
        roles: {
          include: { role: true },
        },
        employee: {
          include: {
            branchAssignments: {
              where: { endDate: null },
              include: { branch: true },
            },
          },
        },
      },
    });

    if (!user || !user.employee) return null;

    const isOwner = user.roles.some((r) => r.role.name === "OWNER");
    const primaryRole = user.roles[0]?.role.name || "CASHIER";

    // Determine branches
    let allowedBranches: { id: string; name: string; code: string }[] = [];
    if (isOwner) {
      const allBranches = await db.branch.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      });
      allowedBranches = allBranches;
    } else {
      allowedBranches = user.employee.branchAssignments.map((a) => ({
        id: a.branch.id,
        name: a.branch.name,
        code: a.branch.code,
      }));
    }

    if (allowedBranches.length === 0) {
      return null; // Employee has no assigned active branches
    }

    // Determine active branch context (respect requested, then primary assigned, then first allowed)
    const userDefaultBranchId = user.employee.branchAssignments[0]?.branchId;
    const requestedBranch = allowedBranches.find(
      (b) => b.id === payload.branchId
    );
    const primaryBranch = userDefaultBranchId
      ? allowedBranches.find((b) => b.id === userDefaultBranchId)
      : undefined;
    const activeBranch = requestedBranch || primaryBranch || allowedBranches[0];

    return {
      id: user.id,
      email: user.email,
      role: primaryRole,
      isOwner,
      employeeId: user.employee.id,
      employeeName: `${user.employee.firstName} ${user.employee.lastName}`,
      employeeNumber: user.employee.employeeNumber,
      activeBranchId: activeBranch.id,
      activeBranchName: activeBranch.name,
      activeBranchCode: activeBranch.code,
      allowedBranches,
    };
  } catch {
    return null;
  }
}
