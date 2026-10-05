import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { listCashSessions } from "@/modules/reconciliation/cash-session.service";
import { ReconciliationWorkspace } from "@/components/reconciliation/reconciliation-workspace";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: "Cash Reconciliation | FrankLucy",
  description: "End-of-day cashier drawer balancing and payment variance audit.",
};

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: {
    branchId?: string;
    date?: string;
    status?: "ALL" | "OPEN" | "CLOSED";
    window?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Permission check: only Managers and Owners can access the reconciliation workspace
  const canReconcile =
    user.isOwner || (await hasPermission(user.id, "cash.reconcile"));

  if (!canReconcile) {
    return (
      <AppShell user={user}>
        <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-status-danger-subtle text-status-danger flex items-center justify-center mx-auto">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-text-primary">Access Restricted</h2>
          <p className="text-sm text-text-secondary">
            You do not have permission to view the branch cash reconciliation workspace. Only authorized branch managers and owners can audit cashier cash drawers.
          </p>
        </div>
      </AppShell>
    );
  }

  // Load user's accessible branches
  const accessibleBranches = user.isOwner
    ? await db.branch.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      })
    : user.allowedBranches;

  const branchId = searchParams.branchId || user.activeBranchId;
  const rawWindow = searchParams.window || (searchParams.date ? undefined : "24h");
  const validWindows = ["24h", "7d", "30d", "all"];
  const activeWindow = rawWindow && validWindows.includes(rawWindow) ? rawWindow : (searchParams.date ? undefined : "24h");

  // Fetch initial reconciliation list and KPIs
  const initialData = await listCashSessions(
    {
      branchId,
      status: searchParams.status || "ALL",
      date: searchParams.date,
      window: activeWindow,
    },
    {
      userId: user.id,
      employeeId: user.employeeId,
      activeBranchId: user.activeBranchId,
      isOwner: user.isOwner,
    }
  );

  return (
    <AppShell user={user}>
      <div className="max-w-7xl mx-auto py-2">
        <ReconciliationWorkspace
          initialSessions={initialData.sessions}
          initialKPIs={initialData.kpis}
          branches={accessibleBranches}
          currentBranchId={branchId}
          isOwner={user.isOwner}
          activeWindow={activeWindow}
        />
      </div>
    </AppShell>
  );
}
