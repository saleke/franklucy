import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCashSessionSummary } from "@/modules/reconciliation/cash-session.service";
import { CashSessionDomainError } from "@/modules/reconciliation/cash-session.errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId parameter." }, { status: 400 });
    }

    const summary = await getCashSessionSummary(sessionId, {
      userId: user.id,
      employeeId: user.employeeId,
      activeBranchId: user.activeBranchId,
      isOwner: user.isOwner,
    });

    return NextResponse.json({ summary });
  } catch (error: any) {
    if (error instanceof CashSessionDomainError) {
      const status =
        error.code === "CASH_SESSION_NOT_FOUND"
          ? 404
          : error.code === "UNAUTHORIZED_SESSION_ACCESS" || error.code === "PERMISSION_DENIED"
          ? 403
          : 400;

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }

    console.error("Get cash session summary exception:", error);
    return NextResponse.json(
      { error: "Failed to retrieve session summary." },
      { status: 500 }
    );
  }
}
