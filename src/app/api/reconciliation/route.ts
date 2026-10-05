import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listCashSessions } from "@/modules/reconciliation/cash-session.service";
import { CashSessionDomainError } from "@/modules/reconciliation/cash-session.errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || user.activeBranchId;
    const statusParam = searchParams.get("status") as "ALL" | "OPEN" | "CLOSED" | null;
    const cashierId = searchParams.get("cashierId") || undefined;
    const date = searchParams.get("date") || undefined;
    const windowParam = searchParams.get("window") || (date ? undefined : "24h");

    const data = await listCashSessions(
      {
        branchId,
        status: statusParam || "ALL",
        cashierId,
        date,
        window: windowParam,
      },
      {
        userId: user.id,
        employeeId: user.employeeId,
        activeBranchId: user.activeBranchId,
        isOwner: user.isOwner,
      }
    );

    return NextResponse.json(data);
  } catch (error: any) {
    if (error instanceof CashSessionDomainError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "PERMISSION_DENIED" ? 403 : 400 }
      );
    }

    console.error("List cash sessions reconciliation exception:", error);
    return NextResponse.json(
      { error: "Failed to retrieve cash reconciliation sessions." },
      { status: 500 }
    );
  }
}
