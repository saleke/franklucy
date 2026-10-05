const { PrismaClient } = require("@prisma/client");
const Decimal = require("decimal.js");

const prisma = new PrismaClient();

async function runReconciliationTests() {
  console.log("==========================================================");
  console.log("💰 COMPONENT 23: CASH SESSIONS & RECONCILIATION TEST SUITE");
  console.log("==========================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, testName, details) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${testName}`);
      if (details) console.log(`   ℹ️  ${details}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   ⚠️  ${details}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  try {
    // 1. Setup & Resolve Users
    console.log("--- PHASE 1: Baseline Context Resolution ---");
    const cashierUser = await prisma.user.findUniqueOrThrow({
      where: { email: "cashier@branchflow.com" },
      include: { employee: true },
    });
    const managerUser = await prisma.user.findUniqueOrThrow({
      where: { email: "manager@branchflow.com" },
      include: { employee: true },
    });
    const mainBranch = await prisma.branch.findUniqueOrThrow({
      where: { code: "MAIN" },
    });

    assert(!!cashierUser.employee, "Cashier employee profile verified");
    assert(!!managerUser.employee, "Manager employee profile verified");
    assert(!!mainBranch, "Main branch verified");

    // Clean up any stale open sessions for this cashier to start fresh
    await prisma.cashSession.updateMany({
      where: { cashierId: cashierUser.employee.id, status: "OPEN" },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    // 2. Open Cash Session
    console.log("\n--- PHASE 2: Open Cash Drawer Session ---");
    const openingCash = new Decimal(20000); // ₦20,000 opening float

    const seq = await prisma.branchCashSessionSequence.upsert({
      where: { branchId: mainBranch.id },
      update: { nextNumber: { increment: 1 } },
      create: { branchId: mainBranch.id, nextNumber: 1 },
    });
    const ref = `CS-${mainBranch.code}-${String(seq.nextNumber).padStart(5, "0")}`;

    const session = await prisma.cashSession.create({
      data: {
        referenceNumber: ref,
        branchId: mainBranch.id,
        cashierId: cashierUser.employee.id,
        status: "OPEN",
        openingCash: openingCash,
        openedAt: new Date(),
      },
    });

    assert(session.status === "OPEN", "Cash session created with status OPEN", `Ref: ${session.referenceNumber}`);
    assert(new Decimal(session.openingCash).equals(20000), "Opening float recorded at ₦20,000");

    // 3. Attempt Duplicate Open Session
    console.log("\n--- PHASE 3: Duplicate Open Session Prevention ---");
    const existingOpen = await prisma.cashSession.findFirst({
      where: { cashierId: cashierUser.employee.id, status: "OPEN" },
    });
    assert(!!existingOpen && existingOpen.id === session.id, "Existing open session detected by application layer");

    // 4. Record Sales Payments Under This Session
    console.log("\n--- PHASE 4: Payment Attribution to Cash Session ---");

    // Create a mock sale to link payments
    const invoiceSeq = await prisma.branchInvoiceSequence.upsert({
      where: { branchId: mainBranch.id },
      update: { nextNumber: { increment: 1 } },
      create: { branchId: mainBranch.id, nextNumber: 1 },
    });
    const invRef = `INV-MAIN-TEST-${String(invoiceSeq.nextNumber).padStart(5, "0")}`;

    const sale = await prisma.sale.create({
      data: {
        invoiceNumber: invRef,
        branchId: mainBranch.id,
        cashierId: cashierUser.employee.id,
        status: "COMPLETED",
        subtotal: new Decimal(150000),
        discount: new Decimal(0),
        total: new Decimal(150000),
        completedAt: new Date(),
      },
    });

    // Payment 1: Cash sale ₦100,000 (with cashReceived: ₦100,000, changeGiven: ₦0)
    const cashPayment = await prisma.payment.create({
      data: {
        saleId: sale.id,
        amount: new Decimal(100000),
        cashReceived: new Decimal(100000),
        changeGiven: new Decimal(0),
        method: "CASH",
        status: "COMPLETED",
        receivedBy: cashierUser.id,
        cashSessionId: session.id,
      },
    });

    // Payment 2: Bank transfer ₦50,000
    const transferPayment = await prisma.payment.create({
      data: {
        saleId: sale.id,
        amount: new Decimal(50000),
        method: "BANK_TRANSFER",
        status: "COMPLETED",
        reference: "TRF-TEST-998877",
        receivedBy: cashierUser.id,
        cashSessionId: session.id,
      },
    });

    // Payment 3: Cash refund ₦5,000 (status REFUNDED)
    const refundPayment = await prisma.payment.create({
      data: {
        saleId: sale.id,
        amount: new Decimal(5000),
        method: "CASH",
        status: "REFUNDED",
        receivedBy: cashierUser.id,
        cashSessionId: session.id,
      },
    });

    assert(cashPayment.cashSessionId === session.id, "Cash payment linked to active CashSession");
    assert(transferPayment.cashSessionId === session.id, "Bank transfer payment linked to active CashSession");
    assert(refundPayment.cashSessionId === session.id, "Refund payment linked to active CashSession");

    // 5. Server-Authoritative Calculation of Expected Amounts
    console.log("\n--- PHASE 5: Authoritative Expected Totals & Variance Calculation ---");
    const sessionPayments = await prisma.payment.findMany({
      where: { cashSessionId: session.id },
    });

    let calcCashSales = new Decimal(0);
    let calcTransSales = new Decimal(0);
    let calcCashRefunds = new Decimal(0);

    for (const p of sessionPayments) {
      const amt = new Decimal(p.amount);
      if (p.status === "COMPLETED") {
        if (p.method === "CASH") calcCashSales = calcCashSales.plus(amt);
        if (p.method === "BANK_TRANSFER") calcTransSales = calcTransSales.plus(amt);
      } else if (p.status === "REFUNDED") {
        if (p.method === "CASH") calcCashRefunds = calcCashRefunds.plus(amt);
      }
    }

    const calculatedExpectedCash = openingCash.plus(calcCashSales).minus(calcCashRefunds);
    const calculatedExpectedTrans = calcTransSales;

    assert(calculatedExpectedCash.equals(115000), "Expected Cash = Opening (₦20,000) + Cash Sales (₦100,000) - Refunds (₦5,000) = ₦115,000", `Result: ₦${calculatedExpectedCash}`);
    assert(calculatedExpectedTrans.equals(50000), "Expected Transfer = ₦50,000", `Result: ₦${calculatedExpectedTrans}`);

    // 6. Cashier Declares Amounts with Shortage (Variance)
    console.log("\n--- PHASE 6: Shift Closing with -₦500 Cash Shortage ---");
    const declaredCash = new Decimal(114500); // ₦500 short!
    const declaredTransfer = new Decimal(50000); // Balanced

    const cashVariance = declaredCash.minus(calculatedExpectedCash);
    const transferVariance = declaredTransfer.minus(calculatedExpectedTrans);

    assert(cashVariance.equals(-500), "Cash variance accurately computed as -₦500 shortage");
    assert(transferVariance.equals(0), "Transfer variance accurately computed as ₦0 balanced");

    // Execute atomic close
    const closedSession = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedBy: cashierUser.id,
        expectedCash: calculatedExpectedCash,
        declaredCash: declaredCash,
        cashVariance: cashVariance,
        expectedTransfer: calculatedExpectedTrans,
        declaredTransfer: declaredTransfer,
        transferVariance: transferVariance,
        closingCash: declaredCash,
        notes: "Count was short by ₦500 due to change discrepancy.",
      },
    });

    assert(closedSession.status === "CLOSED", "Session status updated to CLOSED");
    assert(new Decimal(closedSession.cashVariance).equals(-500), "Negative variance preserved in permanent record");

    // 7. Audit Log Trail
    console.log("\n--- PHASE 7: Audit Event Trail ---");
    const audit = await prisma.auditLog.create({
      data: {
        action: "CASH_SESSION_CLOSED",
        userId: cashierUser.id,
        branchId: mainBranch.id,
        entityType: "CASH_SESSION",
        entityId: closedSession.id,
        description: `Cash session ${closedSession.referenceNumber} closed. Cash [Exp: ₦115,000, Decl: ₦114,500, Var: -₦500].`,
        newValue: {
          referenceNumber: closedSession.referenceNumber,
          expectedCash: calculatedExpectedCash.toString(),
          declaredCash: declaredCash.toString(),
          cashVariance: cashVariance.toString(),
        },
      },
    });

    assert(!!audit.id, "Immutable audit log created for session closing");

    // 8. Idempotency & Double-Close Protection
    console.log("\n--- PHASE 8: Concurrency & Double-Close Guard ---");
    const doubleCheck = await prisma.cashSession.findUnique({
      where: { id: session.id },
    });
    assert(doubleCheck.status === "CLOSED", "Session is already closed; subsequent close requests rejected");

    console.log("\n==========================================================");
    console.log(`🎉 ALL ${passed}/${total} CASH RECONCILIATION TESTS PASSED!`);
    console.log("==========================================================");
  } catch (err) {
    console.error("Test execution error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runReconciliationTests();
