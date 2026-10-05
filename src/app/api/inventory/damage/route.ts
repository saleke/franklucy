import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordDamagedStock } from "@/modules/inventory/inventory.service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const body = await request.json();
    const result = await recordDamagedStock(body, {
      userId: user.id,
      employeeId: user.employeeId,
      branchId: user.activeBranchId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Damage log API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record damaged stock." },
      { status: 400 }
    );
  }
}
