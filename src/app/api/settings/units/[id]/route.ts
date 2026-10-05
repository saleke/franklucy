import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "products.manage");
    }

    const unit = await db.unitOfMeasurement.findUnique({
      where: { id: params.id },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit of measurement not found." }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, scaleType, defaultPieceUnit, defaultRatio } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Unit name cannot be empty." }, { status: 400 });
    }

    const cleanScaleType = scaleType && ["BULK", "PIECE", "UNIVERSAL"].includes(scaleType) ? scaleType : unit.scaleType;
    const isBulk = cleanScaleType === "BULK";

    let cleanPieceUnit: string | null = null;
    let cleanRatio: number | null = null;

    if (isBulk) {
      if (defaultPieceUnit !== undefined) {
        cleanPieceUnit = defaultPieceUnit ? defaultPieceUnit.toUpperCase().trim() : null;
      } else {
        cleanPieceUnit = unit.defaultPieceUnit;
      }

      if (defaultRatio !== undefined) {
        const parsed = parseInt(defaultRatio, 10);
        cleanRatio = !isNaN(parsed) && parsed > 0 ? parsed : null;
      } else {
        cleanRatio = unit.defaultRatio;
      }
    }

    const updated = await db.unitOfMeasurement.update({
      where: { id: unit.id },
      data: {
        name: name.trim(),
        description: description !== undefined ? description?.trim() || null : unit.description,
        scaleType: cleanScaleType,
        defaultPieceUnit: cleanPieceUnit,
        defaultRatio: cleanRatio,
      },
    });

    await db.auditLog.create({
      data: {
        action: "UNIT_UPDATED",
        userId: user.id,
        branchId: user.activeBranchId,
        entityType: "UNIT_OF_MEASUREMENT",
        entityId: unit.id,
        description: `Unit of measurement '${unit.code}' updated: Name="${updated.name}", Scale="${updated.scaleType}".`,
        oldValue: {
          name: unit.name,
          description: unit.description,
          scaleType: unit.scaleType,
          defaultPieceUnit: unit.defaultPieceUnit,
          defaultRatio: unit.defaultRatio,
        },
        newValue: {
          name: updated.name,
          description: updated.description,
          scaleType: updated.scaleType,
          defaultPieceUnit: updated.defaultPieceUnit,
          defaultRatio: updated.defaultRatio,
        },
      },
    });

    return NextResponse.json({ unit: updated });
  } catch (error: any) {
    console.error("Update unit error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update unit of measurement." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    if (!user.isOwner) {
      await requirePermission(user.id, "products.manage");
    }

    const unit = await db.unitOfMeasurement.findUnique({
      where: { id: params.id },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit of measurement not found." }, { status: 404 });
    }

    // Guard: Check if products are currently using this unit as bulkUnit, pieceUnit, or inventoryUnit
    const referencedProductsCount = await db.product.count({
      where: {
        OR: [
          { inventoryUnit: unit.code },
          { bulkUnit: unit.code },
          { pieceUnit: unit.code },
        ],
      },
    });

    if (referencedProductsCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete unit '${unit.name}' (${unit.code}) because ${referencedProductsCount} product(s) in your catalog currently use this unit. Reassign or update those products first.`,
          code: "UNIT_IN_USE",
          productsCount: referencedProductsCount,
        },
        { status: 400 }
      );
    }

    await db.unitOfMeasurement.delete({
      where: { id: unit.id },
    });

    await db.auditLog.create({
      data: {
        action: "UNIT_DELETED",
        userId: user.id,
        branchId: user.activeBranchId,
        entityType: "UNIT_OF_MEASUREMENT",
        entityId: unit.id,
        description: `Unit of measurement '${unit.name}' (${unit.code}) was deleted by Owner.`,
        oldValue: { code: unit.code, name: unit.name, description: unit.description },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Unit '${unit.name}' (${unit.code}) was successfully deleted.`,
    });
  } catch (error: any) {
    console.error("Delete unit error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete unit of measurement." },
      { status: error.name === "AuthorizationError" ? 403 : 500 }
    );
  }
}
