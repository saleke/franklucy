import { NextResponse } from "next/server";
import { getCurrentUser, setSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branchId } = await request.json();
    if (!branchId) {
      return NextResponse.json({ error: "Branch ID required" }, { status: 400 });
    }

    // Verify user is permitted to access this branch
    const isAllowed = user.allowedBranches.some((b) => b.id === branchId);
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Access to specified branch is not authorized" },
        { status: 403 }
      );
    }

    await setSessionCookie(user.id, branchId);

    return NextResponse.json({ success: true, activeBranchId: branchId });
  } catch (error) {
    console.error("Switch branch error:", error);
    return NextResponse.json(
      { error: "Failed to switch branch context" },
      { status: 500 }
    );
  }
}
