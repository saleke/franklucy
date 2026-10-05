import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "products.manage");
    }

    const units = await db.unitOfMeasurement.findMany({
      orderBy: { name: "asc" },
    });

    const allProducts = await db.product.findMany({
      select: { id: true, bulkUnit: true, pieceUnit: true, inventoryUnit: true },
    });

    const bulkCountMap = new Map<string, number>();
    const pieceCountMap = new Map<string, number>();
    const totalCountMap = new Map<string, Set<string>>();

    for (const p of allProducts) {
      const bulkCode = p.bulkUnit || p.inventoryUnit;
      const pieceCode = p.pieceUnit;

      if (bulkCode) {
        bulkCountMap.set(bulkCode, (bulkCountMap.get(bulkCode) || 0) + 1);
        if (!totalCountMap.has(bulkCode)) totalCountMap.set(bulkCode, new Set());
        totalCountMap.get(bulkCode)!.add(p.id);
      }
      if (pieceCode) {
        pieceCountMap.set(pieceCode, (pieceCountMap.get(pieceCode) || 0) + 1);
        if (!totalCountMap.has(pieceCode)) totalCountMap.set(pieceCode, new Set());
        totalCountMap.get(pieceCode)!.add(p.id);
      }
    }

    return NextResponse.json({
      units: units.map((u) => ({
        id: u.id,
        code: u.code,
        name: u.name,
        description: u.description,
        scaleType: (u.scaleType as any) || "UNIVERSAL",
        defaultPieceUnit: u.defaultPieceUnit || null,
        defaultRatio: u.defaultRatio || null,
        isDefault: u.isDefault,
        productsCount: totalCountMap.get(u.code)?.size || 0,
        bulkProductsCount: bulkCountMap.get(u.code) || 0,
        pieceProductsCount: pieceCountMap.get(u.code) || 0,
        createdAt: u.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("List units error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch units of measurement." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "products.manage");
    }

    const body = await request.json();
    const { code, name, description, scaleType, defaultPieceUnit, defaultRatio } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Unit code (e.g. BNDL) and Unit name (e.g. Bundle) are required." },
        { status: 400 }
      );
    }

    const cleanCode = code.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, "");
    const cleanName = name.trim();
    const cleanScaleType = ["BULK", "PIECE", "UNIVERSAL"].includes(scaleType) ? scaleType : "UNIVERSAL";
    const cleanPieceUnit = defaultPieceUnit ? defaultPieceUnit.toUpperCase().trim() : null;
    const parsedRatio = defaultRatio ? parseInt(defaultRatio, 10) : null;
    const cleanRatio = parsedRatio && !isNaN(parsedRatio) && parsedRatio > 0 ? parsedRatio : null;

    if (!cleanCode) {
      return NextResponse.json(
        { error: "Unit code must contain valid alphanumeric characters." },
        { status: 400 }
      );
    }

    const existing = await db.unitOfMeasurement.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Unit with code '${cleanCode}' already exists (${existing.name}).` },
        { status: 400 }
      );
    }

    const unit = await db.unitOfMeasurement.create({
      data: {
        code: cleanCode,
        name: cleanName,
        description: description?.trim() || null,
        scaleType: cleanScaleType,
        defaultPieceUnit: cleanScaleType === "BULK" ? cleanPieceUnit : null,
        defaultRatio: cleanScaleType === "BULK" ? cleanRatio : null,
        isDefault: false,
      },
    });

    await db.auditLog.create({
      data: {
        action: "UNIT_CREATED",
        userId: user.id,
        branchId: user.activeBranchId,
        entityType: "UNIT_OF_MEASUREMENT",
        entityId: unit.id,
        description: `New unit of measurement '${unit.name}' (${unit.code}) created by Owner.`,
        newValue: {
          code: unit.code,
          name: unit.name,
          scaleType: unit.scaleType,
          defaultPieceUnit: unit.defaultPieceUnit,
          defaultRatio: unit.defaultRatio,
        },
      },
    });

    return NextResponse.json({ unit }, { status: 201 });
  } catch (error: any) {
    console.error("Create unit error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create unit of measurement." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
