import Decimal from "decimal.js";
import { db } from "@/lib/db";
import { requirePermission, hasBranchAccess } from "@/lib/permissions";
import {
  OpenCashSessionInput,
  openCashSessionSchema,
  CloseCashSessionInput,
  closeCashSessionSchema,
  RecordCashPayoutInput,
  recordCashPayoutSchema,
} from "./cash-session.validation";
import { CashSessionDomainError } from "./cash-session.errors";
import { formatNaira } from "@/lib/format";

export interface CashSessionAuthContext {
  userId: string;
  employeeId: string;
  activeBranchId: string;
  isOwner?: boolean;
}

export interface CashSessionResult {
  id: string;
  referenceNumber: string;
  branchId: string;
  cashierId: string;
  status: "OPEN";
  openingCash: string;
  openedAt: Date;
}

/**
 * Authoritative workflow to start a cashier working session by declaring physical opening cash.
 * Implements Specification 23.2 with strict server authority, partial uniqueness safety,
 * atomic sequence generation, and tamper-evident audit logging.
 */
export async function openCashSession(
  input: OpenCashSessionInput,
  context: CashSessionAuthContext
): Promise<CashSessionResult> {
  // 1 & 2. Authenticate user & resolve employee
  if (!context.userId || !context.employeeId) {
    throw new CashSessionDomainError(
      "Unauthenticated user or missing employee profile.",
      "EMPLOYEE_NOT_FOUND"
    );
  }

  // 3. Require permission (cash.session.open)
  try {
    await requirePermission(context.userId, "cash.session.open");
  } catch (err: any) {
    throw new CashSessionDomainError(
      "You do not have permission to open a cash drawer session.",
      "PERMISSION_DENIED"
    );
  }

  // 4. Resolve Employee & Check status
  const employee = await db.employee.findUnique({
    where: { id: context.employeeId },
    include: {
      branchAssignments: {
        where: { endDate: null },
      },
    },
  });

  if (!employee) {
    throw new CashSessionDomainError("Employee record not found.", "EMPLOYEE_NOT_FOUND");
  }

  if (employee.status !== "ACTIVE") {
    throw new CashSessionDomainError(
      "Employee is inactive and cannot start a cash session.",
      "EMPLOYEE_INACTIVE"
    );
  }

  // 5. Authoritative Branch Resolution
  let targetBranchId = context.activeBranchId;
  const isPrivileged = context.isOwner || false;

  if (input.branchId && input.branchId !== targetBranchId) {
    if (!isPrivileged) {
      // Non-privileged cashier cannot override their assigned branch
      const hasAssignment = employee.branchAssignments.some(
        (a) => a.branchId === input.branchId
      );
      if (!hasAssignment) {
        throw new CashSessionDomainError(
          "You are not assigned or authorized to operate at the requested branch.",
          "BRANCH_ACCESS_DENIED"
        );
      }
      targetBranchId = input.branchId;
    } else {
      // Privileged manager/owner can specify target branch after verification
      const access = await hasBranchAccess(context.userId, input.branchId);
      if (!access) {
        throw new CashSessionDomainError(
          "Branch access denied for specified branch.",
          "BRANCH_ACCESS_DENIED"
        );
      }
      targetBranchId = input.branchId;
    }
  }

  // Check branch status
  const branch = await db.branch.findUnique({
    where: { id: targetBranchId },
  });

  if (!branch) {
    throw new CashSessionDomainError("Target branch not found.", "BRANCH_NOT_FOUND");
  }

  if (branch.status !== "ACTIVE") {
    throw new CashSessionDomainError(
      `Branch ${branch.name} is currently inactive.`,
      "BRANCH_INACTIVE"
    );
  }

  // 6. Validate opening cash input using Decimal-safe money parsing
  const parsed = openCashSessionSchema.safeParse(input);
  if (!parsed.success) {
    throw new CashSessionDomainError(
      parsed.error.issues[0]?.message || "Invalid opening cash value.",
      "INVALID_OPENING_CASH",
      parsed.error.issues
    );
  }

  const openingCashDecimal = new Decimal(parsed.data.openingCash.trim());
  if (openingCashDecimal.isNaN() || openingCashDecimal.isNegative()) {
    throw new CashSessionDomainError(
      "Opening cash must be a valid non-negative amount.",
      "INVALID_OPENING_CASH"
    );
  }

  // 7. Check for existing open cash session for this cashier
  const existingSession = await db.cashSession.findFirst({
    where: {
      cashierId: employee.id,
      status: "OPEN",
    },
    select: {
      id: true,
      referenceNumber: true,
      branchId: true,
      openedAt: true,
    },
  });

  if (existingSession) {
    throw new CashSessionDomainError(
      "You already have an open cash session. Close it before starting another.",
      "CASH_SESSION_ALREADY_OPEN",
      {
        existingSessionId: existingSession.id,
        referenceNumber: existingSession.referenceNumber,
        openedAt: existingSession.openedAt,
      }
    );
  }

  // 8. Execute atomic transaction: Sequence generation + Session creation + Audit Log
  try {
    return await db.$transaction(async (tx) => {
      // 8.1 Atomic session sequence generation
      const sequence = await tx.branchCashSessionSequence.upsert({
        where: { branchId: branch.id },
        update: { nextNumber: { increment: 1 } },
        create: { branchId: branch.id, nextNumber: 1 },
      });

      const paddedSeq = String(sequence.nextNumber).padStart(5, "0");
      const referenceNumber = `CS-${branch.code}-${paddedSeq}`;

      // 8.2 Create CashSession record
      const session = await tx.cashSession.create({
        data: {
          referenceNumber,
          branchId: branch.id,
          cashierId: employee.id,
          status: "OPEN",
          openingCash: openingCashDecimal,
          openedAt: new Date(),
        },
      });

      // 8.3 Create Immutable Audit Record
      const formattedCash = formatNaira(Number(openingCashDecimal));
      await tx.auditLog.create({
        data: {
          action: "CASH_SESSION_OPENED",
          userId: context.userId,
          branchId: branch.id,
          entityType: "CASH_SESSION",
          entityId: session.id,
          description: `Cash session ${referenceNumber} opened with opening cash of ${formattedCash}.`,
          newValue: {
            referenceNumber,
            openingCash: openingCashDecimal.toString(),
            cashierId: employee.id,
            branchId: branch.id,
          },
        },
      });

      return {
        id: session.id,
        referenceNumber: session.referenceNumber,
        branchId: session.branchId,
        cashierId: session.cashierId,
        status: "OPEN",
        openingCash: openingCashDecimal.toString(),
        openedAt: session.openedAt,
      };
    });
  } catch (error: any) {
    // Catch database partial unique index or constraint collision
    if (
      error.code === "P2002" ||
      (error.message && error.message.includes("one_open_cash_session_per_cashier"))
    ) {
      throw new CashSessionDomainError(
        "You already have an open cash session. Close it before starting another.",
        "CASH_SESSION_ALREADY_OPEN"
      );
    }
    throw error;
  }
}

/**
 * Retrieves the currently active open cash session for a cashier.
 */
export async function getActiveCashSession(
  cashierId: string,
  branchId?: string
): Promise<CashSessionResult | null> {
  const session = await db.cashSession.findFirst({
    where: {
      cashierId,
      branchId: branchId || undefined,
      status: "OPEN",
    },
    orderBy: { openedAt: "desc" },
  });

  if (!session) return null;

  return {
    id: session.id,
    referenceNumber: session.referenceNumber,
    branchId: session.branchId,
    cashierId: session.cashierId,
    status: "OPEN",
    openingCash: session.openingCash.toString(),
    openedAt: session.openedAt,
  };
}

export interface CashSessionSummary {
  id: string;
  referenceNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  cashierId: string;
  cashierName: string;
  cashierCode: string;
  status: "OPEN" | "CLOSED";
  openingCash: string;
  openedAt: Date;
  closedAt: Date | null;
  closedBy: string | null;
  notes: string | null;

  expectedCash: string;
  declaredCash: string | null;
  cashVariance: string | null;

  expectedTransfer: string;
  declaredTransfer: string | null;
  transferVariance: string | null;

  cashSales: string;
  transferSales: string;
  otherSales: string;
  cashRefunds: string;
  transferRefunds: string;
  cashPayouts: string;
  payouts?: Array<{
    id: string;
    amount: string;
    category: string;
    recipient: string | null;
    reason: string;
    reference: string | null;
    createdAt: Date;
    authorizedBy: string;
  }>;
  totalSalesCount: number;
  totalRevenue: string;
}

export interface ListCashSessionsResult {
  sessions: CashSessionSummary[];
  kpis: {
    totalSessions: number;
    openSessions: number;
    closedSessions: number;
    sessionsWithDiscrepancy: number;
    totalCashVariance: number;
    totalTransferVariance: number;
  };
}

/**
 * Calculates current or historical metrics for a given cash session.
 */
export async function getCashSessionSummary(
  sessionId: string,
  context: CashSessionAuthContext
): Promise<CashSessionSummary> {
  const session = await db.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      branch: true,
      cashier: true,
    },
  });

  if (!session) {
    throw new CashSessionDomainError("Cash session not found.", "CASH_SESSION_NOT_FOUND");
  }

  // Authorization check
  if (session.cashierId !== context.employeeId) {
    const isPrivileged =
      context.isOwner || (await hasBranchAccess(context.userId, session.branchId));
    if (!isPrivileged) {
      throw new CashSessionDomainError(
        "You are not authorized to view this cash session.",
        "UNAUTHORIZED_SESSION_ACCESS"
      );
    }
  }

  const [payments, payouts] = await Promise.all([
    db.payment.findMany({
      where: { cashSessionId: session.id },
    }),
    db.cashSessionPayout.findMany({
      where: { cashSessionId: session.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let cashSales = new Decimal(0);
  let transferSales = new Decimal(0);
  let otherSales = new Decimal(0);
  let cashRefunds = new Decimal(0);
  let transferRefunds = new Decimal(0);
  const saleIds = new Set<string>();

  for (const p of payments) {
    saleIds.add(p.saleId);
    const amt = new Decimal(p.amount.toString());
    if (p.status === "COMPLETED") {
      if (p.method === "CASH") cashSales = cashSales.plus(amt);
      else if (p.method === "BANK_TRANSFER") transferSales = transferSales.plus(amt);
      else otherSales = otherSales.plus(amt);
    } else if (p.status === "REFUNDED") {
      if (p.method === "CASH") cashRefunds = cashRefunds.plus(amt);
      else if (p.method === "BANK_TRANSFER") transferRefunds = transferRefunds.plus(amt);
    }
  }

  let cashPayouts = new Decimal(0);
  for (const po of payouts) {
    cashPayouts = cashPayouts.plus(new Decimal(po.amount.toString()));
  }

  const openingCash = new Decimal(session.openingCash.toString());
  const expectedCash = session.expectedCash
    ? new Decimal(session.expectedCash.toString())
    : openingCash.plus(cashSales).minus(cashRefunds).minus(cashPayouts);
  const expectedTransfer = session.expectedTransfer
    ? new Decimal(session.expectedTransfer.toString())
    : transferSales.minus(transferRefunds);

  return {
    id: session.id,
    referenceNumber: session.referenceNumber,
    branchId: session.branchId,
    branchName: session.branch.name,
    branchCode: session.branch.code,
    cashierId: session.cashierId,
    cashierName: `${session.cashier.firstName} ${session.cashier.lastName}`,
    cashierCode: session.cashier.employeeNumber,
    status: session.status,
    openingCash: session.openingCash.toString(),
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    closedBy: session.closedBy,
    notes: session.notes,
    expectedCash: expectedCash.toString(),
    declaredCash: session.declaredCash ? session.declaredCash.toString() : null,
    cashVariance: session.cashVariance ? session.cashVariance.toString() : null,
    expectedTransfer: expectedTransfer.toString(),
    declaredTransfer: session.declaredTransfer ? session.declaredTransfer.toString() : null,
    transferVariance: session.transferVariance ? session.transferVariance.toString() : null,
    cashSales: cashSales.toString(),
    transferSales: transferSales.toString(),
    otherSales: otherSales.toString(),
    cashRefunds: cashRefunds.toString(),
    transferRefunds: transferRefunds.toString(),
    cashPayouts: cashPayouts.toString(),
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      category: p.category,
      recipient: p.recipient,
      reason: p.reason,
      reference: p.reference,
      createdAt: p.createdAt,
      authorizedBy: p.authorizedBy,
    })),
    totalSalesCount: saleIds.size,
    totalRevenue: cashSales.plus(transferSales).plus(otherSales).toString(),
  };
}

/**
 * Atomically closes an active cash session, computes server-authoritative expected cash
 * and transfers, calculates variances, writes audit logs, and marks the session CLOSED.
 */
export async function closeCashSession(
  input: CloseCashSessionInput,
  context: CashSessionAuthContext
): Promise<CashSessionSummary> {
  if (!context.userId || !context.employeeId) {
    throw new CashSessionDomainError(
      "Unauthenticated user or missing employee profile.",
      "EMPLOYEE_NOT_FOUND"
    );
  }

  const parsed = closeCashSessionSchema.safeParse(input);
  if (!parsed.success) {
    throw new CashSessionDomainError(
      parsed.error.issues[0]?.message || "Invalid declared amounts.",
      "INVALID_DECLARED_AMOUNTS",
      parsed.error.issues
    );
  }

  const session = await db.cashSession.findUnique({
    where: { id: parsed.data.sessionId },
    include: {
      branch: true,
      cashier: true,
    },
  });

  if (!session) {
    throw new CashSessionDomainError("Cash session not found.", "CASH_SESSION_NOT_FOUND");
  }

  if (session.status === "CLOSED") {
    throw new CashSessionDomainError(
      "This cash session is already closed.",
      "CASH_SESSION_ALREADY_CLOSED"
    );
  }

  // Authorization check: cashier closes own session, or privileged manager/owner
  if (session.cashierId !== context.employeeId) {
    const isPrivileged =
      context.isOwner || (await hasBranchAccess(context.userId, session.branchId));
    if (!isPrivileged) {
      throw new CashSessionDomainError(
        "You are not authorized to close another cashier's session.",
        "UNAUTHORIZED_SESSION_ACCESS"
      );
    }
  }

  return await db.$transaction(async (tx) => {
    // Concurrency check inside transaction
    const lockedSession = await tx.cashSession.findUnique({
      where: { id: session.id },
      include: {
        branch: true,
        cashier: true,
      },
    });

    if (!lockedSession || lockedSession.status !== "OPEN") {
      throw new CashSessionDomainError(
        "This cash session has already been closed by another concurrent transaction.",
        "CASH_SESSION_ALREADY_CLOSED"
      );
    }

    // Server-authoritative computation of sales, refunds, and payouts
    const [payments, payouts] = await Promise.all([
      tx.payment.findMany({
        where: { cashSessionId: session.id },
      }),
      tx.cashSessionPayout.findMany({
        where: { cashSessionId: session.id },
      }),
    ]);

    let cashSales = new Decimal(0);
    let transferSales = new Decimal(0);
    let otherSales = new Decimal(0);
    let cashRefunds = new Decimal(0);
    let transferRefunds = new Decimal(0);
    const saleIds = new Set<string>();

    for (const p of payments) {
      saleIds.add(p.saleId);
      const amt = new Decimal(p.amount.toString());
      if (p.status === "COMPLETED") {
        if (p.method === "CASH") cashSales = cashSales.plus(amt);
        else if (p.method === "BANK_TRANSFER") transferSales = transferSales.plus(amt);
        else otherSales = otherSales.plus(amt);
      } else if (p.status === "REFUNDED") {
        if (p.method === "CASH") cashRefunds = cashRefunds.plus(amt);
        else if (p.method === "BANK_TRANSFER") transferRefunds = transferRefunds.plus(amt);
      }
    }

    let cashPayouts = new Decimal(0);
    for (const po of payouts) {
      cashPayouts = cashPayouts.plus(new Decimal(po.amount.toString()));
    }

    const openingCash = new Decimal(lockedSession.openingCash.toString());
    const expectedCash = openingCash.plus(cashSales).minus(cashRefunds).minus(cashPayouts);
    const expectedTransfer = transferSales.minus(transferRefunds);

    const declaredCash = new Decimal(parsed.data.declaredCash.trim());
    const declaredTransfer = new Decimal(parsed.data.declaredTransfer.trim());

    const cashVariance = declaredCash.minus(expectedCash);
    const transferVariance = declaredTransfer.minus(expectedTransfer);

    // Atomically update session to CLOSED
    const closed = await tx.cashSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedBy: context.userId,
        expectedCash,
        declaredCash,
        cashVariance,
        expectedTransfer,
        declaredTransfer,
        transferVariance,
        closingCash: declaredCash,
        notes: parsed.data.notes?.trim() || null,
      },
      include: {
        branch: true,
        cashier: true,
      },
    });

    // Create immutable audit log
    const formattedExpCash = formatNaira(Number(expectedCash));
    const formattedDecCash = formatNaira(Number(declaredCash));
    const formattedVarCash = formatNaira(Number(cashVariance));
    const formattedExpTrans = formatNaira(Number(expectedTransfer));
    const formattedDecTrans = formatNaira(Number(declaredTransfer));
    const formattedVarTrans = formatNaira(Number(transferVariance));

    await tx.auditLog.create({
      data: {
        action: "CASH_SESSION_CLOSED",
        userId: context.userId,
        branchId: lockedSession.branchId,
        entityType: "CASH_SESSION",
        entityId: session.id,
        description: `Cash session ${lockedSession.referenceNumber} closed. Cash [Exp: ${formattedExpCash}, Decl: ${formattedDecCash}, Var: ${formattedVarCash}]. Transfer [Exp: ${formattedExpTrans}, Decl: ${formattedDecTrans}, Var: ${formattedVarTrans}].`,
        newValue: {
          referenceNumber: lockedSession.referenceNumber,
          expectedCash: expectedCash.toString(),
          declaredCash: declaredCash.toString(),
          cashVariance: cashVariance.toString(),
          expectedTransfer: expectedTransfer.toString(),
          declaredTransfer: declaredTransfer.toString(),
          transferVariance: transferVariance.toString(),
          notes: parsed.data.notes?.trim() || null,
        },
      },
    });

    const totalRevenue = cashSales.plus(transferSales).plus(otherSales).toString();

    return {
      id: closed.id,
      referenceNumber: closed.referenceNumber,
      branchId: closed.branchId,
      branchName: closed.branch.name,
      branchCode: closed.branch.code,
      cashierId: closed.cashierId,
      cashierName: `${closed.cashier.firstName} ${closed.cashier.lastName}`,
      cashierCode: closed.cashier.employeeNumber,
      status: "CLOSED",
      openingCash: closed.openingCash.toString(),
      openedAt: closed.openedAt,
      closedAt: closed.closedAt,
      closedBy: closed.closedBy,
      notes: closed.notes,
      expectedCash: expectedCash.toString(),
      declaredCash: declaredCash.toString(),
      cashVariance: cashVariance.toString(),
      expectedTransfer: expectedTransfer.toString(),
      declaredTransfer: declaredTransfer.toString(),
      transferVariance: transferVariance.toString(),
      cashSales: cashSales.toString(),
      transferSales: transferSales.toString(),
      otherSales: otherSales.toString(),
      cashRefunds: cashRefunds.toString(),
      transferRefunds: transferRefunds.toString(),
      cashPayouts: cashPayouts.toString(),
      payouts: payouts.map((po) => ({
        id: po.id,
        amount: po.amount.toString(),
        category: po.category,
        recipient: po.recipient,
        reason: po.reason,
        reference: po.reference,
        createdAt: po.createdAt,
        authorizedBy: po.authorizedBy,
      })),
      totalSalesCount: saleIds.size,
      totalRevenue,
    };
  });
}

/**
 * Queries sessions for Manager/Owner Reconciliation workspace with aggregated KPIs.
 */
export async function listCashSessions(
  params: {
    branchId?: string;
    status?: "ALL" | "OPEN" | "CLOSED";
    cashierId?: string;
    date?: string;
    window?: string;
  },
  context: CashSessionAuthContext
): Promise<ListCashSessionsResult> {
  const targetBranchId = params.branchId || context.activeBranchId;
  const isAllBranches = context.isOwner && targetBranchId === "ALL";

  if (!isAllBranches) {
    const isPrivileged =
      context.isOwner || (await hasBranchAccess(context.userId, targetBranchId));
    if (!isPrivileged) {
      throw new CashSessionDomainError(
        "You are not authorized to view cash reconciliation for this branch.",
        "PERMISSION_DENIED"
      );
    }
  }

  const whereClause: any = {};
  if (!isAllBranches) {
    whereClause.branchId = targetBranchId;
  }

  if (params.status && params.status !== "ALL") {
    whereClause.status = params.status;
  }

  if (params.cashierId) {
    whereClause.cashierId = params.cashierId;
  }

  if (params.date) {
    const startOfDay = new Date(params.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(params.date);
    endOfDay.setHours(23, 59, 59, 999);
    whereClause.openedAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  } else if (params.window && params.window !== "all") {
    const now = new Date();
    if (params.window === "24h") {
      whereClause.openedAt = { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
    } else if (params.window === "7d") {
      whereClause.openedAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    } else if (params.window === "30d") {
      whereClause.openedAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    }
  }

  const sessions = await db.cashSession.findMany({
    where: whereClause,
    include: {
      branch: true,
      cashier: true,
      payments: {
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          saleId: true,
        },
      },
      payouts: {
        select: {
          id: true,
          amount: true,
          category: true,
          reason: true,
          recipient: true,
          reference: true,
          createdAt: true,
          authorizedBy: true,
        },
      },
    },
    orderBy: { openedAt: "desc" },
    take: 100,
  });

  let totalSessions = sessions.length;
  let openSessions = 0;
  let closedSessions = 0;
  let sessionsWithDiscrepancy = 0;
  let totalCashVariance = new Decimal(0);
  let totalTransferVariance = new Decimal(0);

  const formattedSessions: CashSessionSummary[] = sessions.map((s) => {
    if (s.status === "OPEN") {
      openSessions++;
    } else {
      closedSessions++;
      if (s.cashVariance && !new Decimal(s.cashVariance.toString()).isZero()) {
        sessionsWithDiscrepancy++;
      } else if (s.transferVariance && !new Decimal(s.transferVariance.toString()).isZero()) {
        sessionsWithDiscrepancy++;
      }
      if (s.cashVariance) {
        totalCashVariance = totalCashVariance.plus(new Decimal(s.cashVariance.toString()));
      }
      if (s.transferVariance) {
        totalTransferVariance = totalTransferVariance.plus(new Decimal(s.transferVariance.toString()));
      }
    }

    let cashSales = new Decimal(0);
    let transferSales = new Decimal(0);
    let otherSales = new Decimal(0);
    let cashRefunds = new Decimal(0);
    let transferRefunds = new Decimal(0);
    const saleIds = new Set<string>();

    for (const p of s.payments) {
      saleIds.add(p.saleId);
      const amt = new Decimal(p.amount.toString());
      if (p.status === "COMPLETED") {
        if (p.method === "CASH") cashSales = cashSales.plus(amt);
        else if (p.method === "BANK_TRANSFER") transferSales = transferSales.plus(amt);
        else otherSales = otherSales.plus(amt);
      } else if (p.status === "REFUNDED") {
        if (p.method === "CASH") cashRefunds = cashRefunds.plus(amt);
        else if (p.method === "BANK_TRANSFER") transferRefunds = transferRefunds.plus(amt);
      }
    }

    let cashPayouts = new Decimal(0);
    for (const po of s.payouts) {
      cashPayouts = cashPayouts.plus(new Decimal(po.amount.toString()));
    }

    const openingCash = new Decimal(s.openingCash.toString());
    const expectedCash = s.expectedCash
      ? new Decimal(s.expectedCash.toString())
      : openingCash.plus(cashSales).minus(cashRefunds).minus(cashPayouts);
    const expectedTransfer = s.expectedTransfer
      ? new Decimal(s.expectedTransfer.toString())
      : transferSales.minus(transferRefunds);

    return {
      id: s.id,
      referenceNumber: s.referenceNumber,
      branchId: s.branchId,
      branchName: s.branch.name,
      branchCode: s.branch.code,
      cashierId: s.cashierId,
      cashierName: `${s.cashier.firstName} ${s.cashier.lastName}`,
      cashierCode: s.cashier.employeeNumber,
      status: s.status,
      openingCash: s.openingCash.toString(),
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      closedBy: s.closedBy,
      notes: s.notes,
      expectedCash: expectedCash.toString(),
      declaredCash: s.declaredCash ? s.declaredCash.toString() : null,
      cashVariance: s.cashVariance ? s.cashVariance.toString() : null,
      expectedTransfer: expectedTransfer.toString(),
      declaredTransfer: s.declaredTransfer ? s.declaredTransfer.toString() : null,
      transferVariance: s.transferVariance ? s.transferVariance.toString() : null,
      cashSales: cashSales.toString(),
      transferSales: transferSales.toString(),
      otherSales: otherSales.toString(),
      cashRefunds: cashRefunds.toString(),
      transferRefunds: transferRefunds.toString(),
      cashPayouts: cashPayouts.toString(),
      payouts: s.payouts.map((po) => ({
        id: po.id,
        amount: po.amount.toString(),
        category: po.category,
        recipient: po.recipient,
        reason: po.reason,
        reference: po.reference,
        createdAt: po.createdAt,
        authorizedBy: po.authorizedBy,
      })),
      totalSalesCount: saleIds.size,
      totalRevenue: cashSales.plus(transferSales).plus(otherSales).toString(),
    };
  });

  return {
    sessions: formattedSessions,
    kpis: {
      totalSessions,
      openSessions,
      closedSessions,
      sessionsWithDiscrepancy,
      totalCashVariance: totalCashVariance.toNumber(),
      totalTransferVariance: totalTransferVariance.toNumber(),
    },
  };
}

/**
 * Provides comprehensive session drill-down with payment ledger and sales attribution.
 */
export async function getCashSessionDetails(
  sessionId: string,
  context: CashSessionAuthContext
) {
  const session = await db.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      branch: true,
      cashier: true,
      payments: {
        include: {
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              total: true,
              createdAt: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!session) {
    throw new CashSessionDomainError("Cash session not found.", "CASH_SESSION_NOT_FOUND");
  }

  // Authorization check
  if (session.cashierId !== context.employeeId) {
    const isPrivileged =
      context.isOwner || (await hasBranchAccess(context.userId, session.branchId));
    if (!isPrivileged) {
      throw new CashSessionDomainError(
        "You are not authorized to view this cash session.",
        "UNAUTHORIZED_SESSION_ACCESS"
      );
    }
  }

  const summary = await getCashSessionSummary(sessionId, context);

  return {
    ...summary,
    payments: session.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      method: p.method,
      status: p.status,
      reference: p.reference,
      cashReceived: p.cashReceived ? p.cashReceived.toString() : null,
      changeGiven: p.changeGiven ? p.changeGiven.toString() : null,
      createdAt: p.createdAt,
      sale: p.sale
        ? {
            id: p.sale.id,
            invoiceNumber: p.sale.invoiceNumber,
            total: p.sale.total.toString(),
            customerName: p.sale.customer?.name || "Walk-in Customer",
            createdAt: p.sale.createdAt,
          }
        : null,
    })),
  };
}

/**
 * Records a cash payout (petty cash expense, safe drop, logistics, supplies, owner withdrawal)
 * directly against an active open cash drawer session.
 * Enforces that payout amount cannot exceed physical cash currently in the drawer.
 */
export async function recordCashSessionPayout(
  input: RecordCashPayoutInput,
  context: CashSessionAuthContext
): Promise<{
  id: string;
  amount: string;
  category: string;
  reason: string;
  recipient: string | null;
  reference: string | null;
  remainingExpectedCash: string;
}> {
  if (!context.userId || !context.employeeId) {
    throw new CashSessionDomainError(
      "Unauthenticated user or missing employee profile.",
      "EMPLOYEE_NOT_FOUND"
    );
  }

  const parsed = recordCashPayoutSchema.safeParse(input);
  if (!parsed.success) {
    throw new CashSessionDomainError(
      parsed.error.issues[0]?.message || "Invalid payout details.",
      "INVALID_PAYOUT_AMOUNT",
      parsed.error.issues
    );
  }

  const payoutAmount = new Decimal(parsed.data.amount.trim());

  return await db.$transaction(async (tx) => {
    const session = await tx.cashSession.findUnique({
      where: { id: parsed.data.sessionId },
      include: { branch: true },
    });

    if (!session) {
      throw new CashSessionDomainError("Cash session not found.", "CASH_SESSION_NOT_FOUND");
    }

    if (session.status !== "OPEN") {
      throw new CashSessionDomainError(
        "Cannot record a cash payout on a closed session.",
        "CASH_SESSION_ALREADY_CLOSED"
      );
    }

    // Check authorization: cashier or privileged user
    if (session.cashierId !== context.employeeId) {
      const isPrivileged =
        context.isOwner || (await hasBranchAccess(context.userId, session.branchId));
      if (!isPrivileged) {
        throw new CashSessionDomainError(
          "You are not authorized to record payouts for this session.",
          "UNAUTHORIZED_SESSION_ACCESS"
        );
      }
    }

    // Compute currently available cash in drawer
    const [payments, existingPayouts] = await Promise.all([
      tx.payment.findMany({
        where: { cashSessionId: session.id, method: "CASH" },
      }),
      tx.cashSessionPayout.findMany({
        where: { cashSessionId: session.id },
      }),
    ]);

    let cashSales = new Decimal(0);
    let cashRefunds = new Decimal(0);
    for (const p of payments) {
      const amt = new Decimal(p.amount.toString());
      if (p.status === "COMPLETED") cashSales = cashSales.plus(amt);
      else if (p.status === "REFUNDED") cashRefunds = cashRefunds.plus(amt);
    }

    let totalPayouts = new Decimal(0);
    for (const po of existingPayouts) {
      totalPayouts = totalPayouts.plus(new Decimal(po.amount.toString()));
    }

    const openingCash = new Decimal(session.openingCash.toString());
    const availableCash = openingCash.plus(cashSales).minus(cashRefunds).minus(totalPayouts);

    if (payoutAmount.greaterThan(availableCash)) {
      throw new CashSessionDomainError(
        `Insufficient cash in drawer. Currently available cash is ${formatNaira(Number(availableCash))}, but requested payout is ${formatNaira(Number(payoutAmount))}.`,
        "INSUFFICIENT_DRAWER_CASH"
      );
    }

    const payout = await tx.cashSessionPayout.create({
      data: {
        cashSessionId: session.id,
        amount: payoutAmount,
        category: parsed.data.category,
        recipient: parsed.data.recipient?.trim() || null,
        reason: parsed.data.reason.trim(),
        reference: parsed.data.reference?.trim() || null,
        authorizedBy: context.userId,
      },
    });

    const remainingExpectedCash = availableCash.minus(payoutAmount);

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: context.userId,
        branchId: session.branchId,
        action: "CASH_SESSION_PAYOUT",
        entityType: "CASH_SESSION",
        entityId: session.id,
        description: `Cash payout of ${formatNaira(Number(payoutAmount))} recorded for [${parsed.data.category}]: ${parsed.data.reason}.`,
        newValue: {
          payoutId: payout.id,
          amount: payoutAmount.toString(),
          category: parsed.data.category,
          reason: parsed.data.reason,
          remainingExpectedCash: remainingExpectedCash.toString(),
        },
      },
    });

    return {
      id: payout.id,
      amount: payout.amount.toString(),
      category: payout.category,
      reason: payout.reason,
      recipient: payout.recipient,
      reference: payout.reference,
      remainingExpectedCash: remainingExpectedCash.toString(),
    };
  });
}

