import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createStockTransfer, TransferBusinessError } from "@/modules/transfers/transfer.service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const body = await request.json();

    const result = await createStockTransfer(body, {
      userId: user.id,
      employeeId: user.employeeId,
      branchId: body.sourceBranchId || user.activeBranchId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error instanceof TransferBusinessError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 400 }
      );
    }

    if (error.name === "AuthorizationError" || error.name === "BranchAccessError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        {
          error: "Invalid transfer payload format.",
          code: "VALIDATION_ERROR",
          issues: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("Stock transfer exception:", error);
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred while processing the transfer.",
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
    const branchFilter = searchParams.get("branchId") || user.activeBranchId;

    const transfers = await db.stockTransfer.findMany({
      where: user.isOwner
        ? undefined
        : {
            OR: [
              { sourceBranchId: branchFilter },
              { destinationBranchId: branchFilter },
            ],
          },
      include: {
        sourceBranch: true,
        destinationBranch: true,
        employee: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ transfers });
  } catch (error: any) {
    console.error("Transfers list exception:", error);
    return NextResponse.json(
      { error: "Failed to retrieve transfers." },
      { status: 500 }
    );
  }
}
