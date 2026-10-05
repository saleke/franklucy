import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { closeCashSession } from "@/modules/reconciliation/cash-session.service";
import { CashSessionDomainError } from "@/modules/reconciliation/cash-session.errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const body = await request.json();

    const summary = await closeCashSession(body, {
      userId: user.id,
      employeeId: user.employeeId,
      activeBranchId: user.activeBranchId,
      isOwner: user.isOwner,
    });

    return NextResponse.json({ session: summary }, { status: 200 });
  } catch (error: any) {
    if (error instanceof CashSessionDomainError) {
      const status =
        error.code === "CASH_SESSION_NOT_FOUND"
          ? 404
          : error.code === "UNAUTHORIZED_SESSION_ACCESS" || error.code === "PERMISSION_DENIED"
          ? 403
          : 400;

      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status }
      );
    }

    console.error("Close cash session exception:", error);
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred while closing cash session.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
