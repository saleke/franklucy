import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordCashSessionPayout } from "@/modules/reconciliation/cash-session.service";
import { CashSessionDomainError } from "@/modules/reconciliation/cash-session.errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const body = await request.json();

    const result = await recordCashSessionPayout(body, {
      userId: user.id,
      employeeId: user.employeeId,
      activeBranchId: user.activeBranchId,
      isOwner: user.isOwner,
    });

    return NextResponse.json({ payout: result }, { status: 201 });
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

    console.error("Record cash payout exception:", error);
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred while recording cash payout.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
