import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { completeSale, SaleBusinessError } from "@/modules/sales/sale.service";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("idempotency-key") ||
      crypto.randomUUID();

    const body = await request.json();

    const result = await completeSale(body, {
      userId: user.id,
      employeeId: user.employeeId,
      branchId: user.activeBranchId,
      idempotencyKey,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof SaleBusinessError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 400 }
      );
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        {
          error: "Invalid request payload format.",
          code: "VALIDATION_ERROR",
          issues: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("Sale completion exception:", error);
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred while completing the sale.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
