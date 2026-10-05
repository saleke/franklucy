import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import {
  ActivityWorkspace,
  AuditRecord,
  ActivityMetrics,
} from "@/components/activity/activity-workspace";

export const dynamic = "force-dynamic";

interface ActivityPageProps {
  searchParams?: {
    window?: string;
    from?: string;
    to?: string;
    branchId?: string;
  };
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Duration window resolution (defaults strictly to last 24 hours)
  const rawWindow = searchParams?.window || "24h";
  const validWindows = ["24h", "7d", "30d", "custom", "all"];
  const activeWindow = validWindows.includes(rawWindow) ? rawWindow : "24h";

  const fromParam = searchParams?.from || "";
  const toParam = searchParams?.to || "";
  const selectedBranchId =
    searchParams?.branchId !== undefined
      ? searchParams.branchId
      : user.activeBranchId;

  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (activeWindow === "24h") {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (activeWindow === "7d") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (activeWindow === "30d") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (activeWindow === "custom") {
    if (fromParam) {
      const parsedFrom = new Date(fromParam);
      if (!isNaN(parsedFrom.getTime())) {
        startDate = parsedFrom;
      }
    }
    if (toParam) {
      const parsedTo = new Date(toParam);
      if (!isNaN(parsedTo.getTime())) {
        if (toParam.length === 10) {
          parsedTo.setHours(23, 59, 59, 999);
        }
        endDate = parsedTo;
      }
    }
  } else if (activeWindow === "all") {
    // No date boundary constraints
  }

  // Construct query filter
  const whereClause: any = {};

  // Branch scoping (defaults to active branch for all roles including owner unless ALL is explicitly requested)
  if (!user.isOwner) {
    whereClause.branchId = user.activeBranchId;
  } else if (selectedBranchId === "ALL") {
    // Owner explicitly requested consolidated historical view across all branches
  } else {
    whereClause.branchId = selectedBranchId || user.activeBranchId;
  }

  // Date boundary scoping
  if (startDate && endDate) {
    whereClause.createdAt = { gte: startDate, lte: endDate };
  } else if (startDate) {
    whereClause.createdAt = { gte: startDate };
  } else if (endDate) {
    whereClause.createdAt = { lte: endDate };
  }

  const [rawLogs, totalCountInWindow, branches] = await Promise.all([
    db.auditLog.findMany({
      where: whereClause,
      include: {
        branch: true,
        user: {
          include: {
            employee: true,
            roles: {
              include: { role: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    db.auditLog.count({ where: whereClause }),
    user.isOwner
      ? db.branch.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const initialLogs: AuditRecord[] = rawLogs.map((log) => {
    const employee = log.user?.employee;
    const userName = employee
      ? `${employee.firstName} ${employee.lastName}`
      : log.user?.username || log.user?.email || "System";
    const userRole = log.user?.roles[0]?.role.name || "SYSTEM";

    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      description: log.description,
      branchName: log.branch?.name || "Global",
      branchCode: log.branch?.code || "HQ",
      userName,
      userRole,
      oldValue: log.oldValue,
      newValue: log.newValue,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
    };
  });

  const salesCount = rawLogs.filter((l) =>
    ["Sale", "Payment", "CashRegister", "CashTransaction"].includes(l.entityType) ||
    l.action.toLowerCase().includes("sale") ||
    l.action.toLowerCase().includes("payment")
  ).length;

  const inventoryCount = rawLogs.filter((l) =>
    ["Product", "PackagingUnit", "InventoryMovement", "StockTransfer", "TransferShipment"].includes(l.entityType) ||
    l.action.toLowerCase().includes("stock") ||
    l.action.toLowerCase().includes("transfer") ||
    l.action.toLowerCase().includes("damage")
  ).length;

  const securityCount = rawLogs.filter((l) =>
    ["User", "Role", "Permission", "Branch", "System", "Settings"].includes(l.entityType) ||
    l.action.toLowerCase().includes("auth") ||
    l.action.toLowerCase().includes("delete") ||
    l.action.toLowerCase().includes("login")
  ).length;

  const metrics: ActivityMetrics = {
    totalCount: totalCountInWindow,
    salesCount,
    inventoryCount,
    securityCount,
  };

  return (
    <AppShell user={user}>
      <ActivityWorkspace
        initialLogs={initialLogs}
        activeWindow={activeWindow}
        fromParam={fromParam}
        toParam={toParam}
        selectedBranchId={selectedBranchId}
        metrics={metrics}
        branches={branches}
        isOwner={user.isOwner}
      />
    </AppShell>
  );
}
