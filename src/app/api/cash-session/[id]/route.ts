import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCashSessionDetails } from "@/modules/reconciliation/cash-session.service";
import { CashSessionDomainError } from "@/modules/reconciliation/cash-session.errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const session = await getCashSessionDetails(params.id, {
      userId: user.id,
      employeeId: user.employeeId,
      activeBranchId: user.activeBranchId,
      isOwner: user.isOwner,
    });

    return NextResponse.json({ session });
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

    console.error("Get cash session details exception:", error);
    return NextResponse.json(
      { error: "Failed to retrieve cash session details." },
      { status: 500 }
    );
  }
}
