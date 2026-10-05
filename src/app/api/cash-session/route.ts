import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  openCashSession,
  getActiveCashSession,
} from "@/modules/reconciliation/cash-session.service";
import { CashSessionDomainError } from "@/modules/reconciliation/cash-session.errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const body = await request.json();

    const session = await openCashSession(body, {
      userId: user.id,
      employeeId: user.employeeId,
      activeBranchId: user.activeBranchId,
      isOwner: user.isOwner,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error: any) {
    if (error instanceof CashSessionDomainError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 400 }
      );
    }

    console.error("Open cash session exception:", error);
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred while opening cash session.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || user.activeBranchId;

    const session = await getActiveCashSession(user.employeeId, branchId);

    return NextResponse.json({ session });
  } catch (error: any) {
    console.error("Get active cash session exception:", error);
    return NextResponse.json(
      { error: "Failed to retrieve active cash session." },
      { status: 500 }
    );
  }
}
