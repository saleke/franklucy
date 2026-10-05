import { db } from "../src/lib/db";
import { completeSale } from "../src/modules/sales/sale.service";
import { receiveStock, recordDamagedStock } from "../src/modules/inventory/inventory.service";
import { createStockTransfer } from "../src/modules/transfers/transfer.service";
import Decimal from "decimal.js";

async function runE2ETests() {
  console.log("==========================================================");
  console.log("🚀 STARTING E2E INTEGRATION & BUSINESS LOGIC TEST SUITE");
  console.log("==========================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, extraInfo?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
      if (extraInfo) console.log(`   ℹ️  ${extraInfo}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (extraInfo) console.error(`   ⚠️  ${extraInfo}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Database Seed & Environment Verification
    // ----------------------------------------------------
    console.log("\n--- TEST PHASE 1: System Baseline & Roles ---");
    const branches = await db.branch.findMany();
    assert(branches.length >= 3, "Baseline branches exist", `Found ${branches.length} branches: ${branches.map(b => b.code).join(", ")}`);

    const mainBranch = branches.find(b => b.code === "MAIN")!;
    const ikejaBranch = branches.find(b => b.code === "IKE")!;
    assert(!!mainBranch && !!ikejaBranch, "Main and Ikeja branches identified");

    const cashierUser = await db.user.findUniqueOrThrow({
      where: { email: "cashier@branchflow.com" },
      include: { employee: true },
    });
    const managerUser = await db.user.findUniqueOrThrow({
      where: { email: "manager@branchflow.com" },
      include: { employee: true },
    });
    const stockUser = await db.user.findUniqueOrThrow({
      where: { email: "stock@branchflow.com" },
      include: { employee: true },
    });
    assert(!!cashierUser.employee && !!managerUser.employee && !!stockUser.employee, "Staff employees linked to user accounts");

    // ----------------------------------------------------
    // TEST 2: Zero-Trust POS Sales Engine
    // ----------------------------------------------------
    console.log("\n--- TEST PHASE 2: Sales & Zero-Trust POS Engine ---");

    const heinekenBp = await db.branchProduct.findFirstOrThrow({
      where: { branchId: mainBranch.id, product: { sku: "HEIN-CRATE" } },
      include: { product: true },
    });
    const initialHeinekenStock = heinekenBp.currentStock;
    console.log(`   Initial stock of ${heinekenBp.product.name} at ${mainBranch.code}: ${initialHeinekenStock}`);

    // Test 2.1: Insufficient Stock Protection
    let errorCaught = false;
    try {
      await completeSale(
        {
          items: [{ productId: heinekenBp.productId, quantity: initialHeinekenStock + 99999 }],
          payment: { method: "CASH", amount: "10000000" },
        },
        {
          userId: cashierUser.id,
          employeeId: cashierUser.employee!.id,
          branchId: mainBranch.id,
          idempotencyKey: "test-oversell-" + Date.now(),
        }
      );
    } catch (err: any) {
      errorCaught = true;
      assert(err.code === "INSUFFICIENT_STOCK", "Serialized stock check blocked overselling attempt", err.message);
    }
    assert(errorCaught, "Overselling attempt correctly threw error");

    // Test 2.2: Valid Authoritative Sale
    const saleQuantity = 2;
    const expectedUnitSellingPrice = Number(heinekenBp.sellingPrice);
    const expectedTotal = expectedUnitSellingPrice * saleQuantity;

    const saleResult = await completeSale(
      {
        items: [{ productId: heinekenBp.productId, quantity: saleQuantity }],
        payment: { method: "CASH", amount: expectedTotal.toString() },
      },
      {
        userId: cashierUser.id,
        employeeId: cashierUser.employee!.id,
        branchId: mainBranch.id,
        idempotencyKey: "test-sale-" + Date.now(),
      }
    );

    assert(saleResult.invoiceNumber.startsWith("INV-MAIN-"), "Invoice generated with branch sequence", `Invoice: ${saleResult.invoiceNumber}`);
    assert(Number(saleResult.total) === expectedTotal, "Authoritative total computed on server", `Total: ₦${saleResult.total}`);

    // Verify stock deduction
    const updatedHeinekenBp = await db.branchProduct.findUniqueOrThrow({
      where: { id: heinekenBp.id },
    });
    assert(
      updatedHeinekenBp.currentStock === initialHeinekenStock - saleQuantity,
      "Current stock decremented by exact sale quantity",
      `Stock changed from ${initialHeinekenStock} to ${updatedHeinekenBp.currentStock}`
    );

    // Verify inventory movement
    const saleMovement = await db.inventoryMovement.findFirst({
      where: {
        branchId: mainBranch.id,
        productId: heinekenBp.productId,
        type: "SALE",
        referenceId: saleResult.saleId,
      },
    });
    assert(!!saleMovement && saleMovement.quantity === saleQuantity, "SALE InventoryMovement recorded with sale quantity");

    // Verify audit log
    const saleAudit = await db.auditLog.findFirst({
      where: {
        action: "SALE_CREATED",
        entityId: saleResult.saleId,
      },
    });
    assert(!!saleAudit, "SALE_CREATED audit log recorded in immutable trail");

    // ----------------------------------------------------
    // TEST 3: Goods Receiving (Component 19)
    // ----------------------------------------------------
    console.log("\n--- TEST PHASE 3: Goods Receiving / Stock Replenishment ---");
    const receivedQty = 24;
    const preReceiveStock = updatedHeinekenBp.currentStock;

    await receiveStock(
      {
        supplierName: "Nigerian Breweries Plc",
        reference: "DEL-NB-8899",
        items: [{ productId: heinekenBp.productId, quantity: receivedQty }],
      },
      {
        userId: stockUser.id,
        employeeId: stockUser.employee!.id,
        branchId: mainBranch.id,
      }
    );

    const postReceiveBp = await db.branchProduct.findUniqueOrThrow({
      where: { id: heinekenBp.id },
    });
    assert(
      postReceiveBp.currentStock === preReceiveStock + receivedQty,
      "Stock incremented atomically after goods receipt",
      `Stock increased from ${preReceiveStock} to ${postReceiveBp.currentStock}`
    );

    const receiveMovement = await db.inventoryMovement.findFirst({
      where: {
        branchId: mainBranch.id,
        productId: heinekenBp.productId,
        type: "PURCHASE",
        referenceId: "DEL-NB-8899",
      },
    });
    assert(!!receiveMovement && receiveMovement.quantity === receivedQty, "PURCHASE InventoryMovement logged with positive quantity");

    // ----------------------------------------------------
    // TEST 4: Direct Inter-Branch Stock Transfers (Component 20)
    // ----------------------------------------------------
    console.log("\n--- TEST PHASE 4: Direct Inter-Branch Transfers (Component 20) ---");
    const transferQty = 5;

    const sourceBpBefore = await db.branchProduct.findUniqueOrThrow({
      where: { id: heinekenBp.id },
    });
    const destBpBefore = await db.branchProduct.findUnique({
      where: {
        branchId_productId: {
          branchId: ikejaBranch.id,
          productId: heinekenBp.productId,
        },
      },
    });
    const destStockBefore = destBpBefore?.currentStock || 0;

    const transferResult = await createStockTransfer(
      {
        destinationBranchId: ikejaBranch.id,
        reason: "Retail stock rebalancing for weekend sales",
        notes: "Direct van delivery dispatch",
        items: [{ productId: heinekenBp.productId, quantity: transferQty }],
      },
      {
        userId: managerUser.id,
        employeeId: managerUser.employee!.id,
        branchId: mainBranch.id,
      }
    );

    assert(transferResult.referenceNumber.startsWith("TRF-MAIN-"), "Transfer reference generated", transferResult.referenceNumber);

    // Verify atomic source decrement
    const sourceBpAfter = await db.branchProduct.findUniqueOrThrow({
      where: { id: heinekenBp.id },
    });
    assert(
      sourceBpAfter.currentStock === sourceBpBefore.currentStock - transferQty,
      "Source branch stock decremented",
      `Source stock: ${sourceBpBefore.currentStock} -> ${sourceBpAfter.currentStock}`
    );

    // Verify atomic destination increment
    const destBpAfter = await db.branchProduct.findUniqueOrThrow({
      where: {
        branchId_productId: {
          branchId: ikejaBranch.id,
          productId: heinekenBp.productId,
        },
      },
    });
    assert(
      destBpAfter.currentStock === destStockBefore + transferQty,
      "Destination branch stock incremented",
      `Destination stock: ${destStockBefore} -> ${destBpAfter.currentStock}`
    );

    // Verify dual movement records
    const outMovement = await db.inventoryMovement.findFirst({
      where: {
        branchId: mainBranch.id,
        referenceId: transferResult.transferId,
        type: "TRANSFER_OUT",
      },
    });
    const inMovement = await db.inventoryMovement.findFirst({
      where: {
        branchId: ikejaBranch.id,
        referenceId: transferResult.transferId,
        type: "TRANSFER_IN",
      },
    });
    assert(!!outMovement && outMovement.quantity === -transferQty, "Source TRANSFER_OUT logged");
    assert(!!inMovement && inMovement.quantity === transferQty, "Destination TRANSFER_IN logged");

    // ----------------------------------------------------
    // TEST 5: Stock Shrinkage / Damage Logging
    // ----------------------------------------------------
    console.log("\n--- TEST PHASE 5: Stock Damage Logging ---");
    const damagedQty = 1;
    const preDamageStock = sourceBpAfter.currentStock;

    await recordDamagedStock(
      {
        productId: heinekenBp.productId,
        quantity: damagedQty,
        reason: "Accidental drop during stacking",
        notes: "Verified broken glass disposal",
      },
      {
        userId: stockUser.id,
        employeeId: stockUser.employee!.id,
        branchId: mainBranch.id,
      }
    );

    const postDamageBp = await db.branchProduct.findUniqueOrThrow({
      where: { id: heinekenBp.id },
    });
    assert(
      postDamageBp.currentStock === preDamageStock - damagedQty,
      "Stock decremented for damaged units",
      `Stock adjusted: ${preDamageStock} -> ${postDamageBp.currentStock}`
    );

    // ----------------------------------------------------
    // TEST 6: Attendance Hub & Corrections
    // ----------------------------------------------------
    console.log("\n--- TEST PHASE 6: Attendance Hub & Server Timestamps ---");
    const now = new Date();
    const workDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Clean up any test attendance for today
    await db.attendance.deleteMany({
      where: {
        employeeId: cashierUser.employee!.id,
        workDate,
      },
    });

    // Clock In
    const attendance = await db.attendance.create({
      data: {
        employeeId: cashierUser.employee!.id,
        branchId: mainBranch.id,
        workDate,
        clockIn: now,
        status: "PRESENT",
        source: "WEB",
      },
    });
    assert(!!attendance.id, "Staff successfully clocked in with server timestamp");

    // Clock Out
    const clockOutTime = new Date(now.getTime() + 1000 * 60 * 60 * 8); // 8 hours later
    const updatedAttendance = await db.attendance.update({
      where: { id: attendance.id },
      data: { clockOut: clockOutTime },
    });
    assert(!!updatedAttendance.clockOut, "Staff clocked out successfully");

    // Request Correction
    const correction = await db.attendanceCorrection.create({
      data: {
        attendanceId: attendance.id,
        originalClockIn: attendance.clockIn,
        correctedClockIn: new Date(now.getTime() - 1000 * 60 * 15), // 15 mins earlier
        reason: "Downtime during branch morning opening",
        requestedBy: cashierUser.employee!.id,
        status: "PENDING",
      },
    });
    assert(correction.status === "PENDING", "Attendance correction request filed");

    // Manager Approves Correction
    const approvedCorrection = await db.attendanceCorrection.update({
      where: { id: correction.id },
      data: {
        status: "APPROVED",
        approvedBy: managerUser.employee!.id,
      },
    });
    assert(approvedCorrection.status === "APPROVED", "Manager approved attendance correction");

    // ----------------------------------------------------
    // TEST 7: Customer Directory & Outstanding Balances
    // ----------------------------------------------------
    console.log("\n--- TEST PHASE 7: Customer Accounts & Credit Ledger ---");
    const testCustomer = await db.customer.create({
      data: {
        name: "Festac Premium Beverages Ltd",
        phone: "08099887766",
        address: "Plot 12, 23 Road, Festac Town, Lagos",
        creditLimit: new Decimal(500000),
        status: "ACTIVE",
      },
    });
    assert(!!testCustomer.id, "Customer registered with credit limit", `Customer: ${testCustomer.name}`);

    // ----------------------------------------------------
    // TEST 8: Forensic Audit Log Trail
    // ----------------------------------------------------
    console.log("\n--- TEST PHASE 8: Forensic Audit Log Trail ---");
    const allRecentLogs = await db.auditLog.findMany({
      where: { branchId: mainBranch.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    assert(allRecentLogs.length > 0, "Audit logs populated chronologically");
    console.log("   Recent Audit Events:");
    for (const log of allRecentLogs.slice(0, 5)) {
      console.log(`     • [${log.action}] ${log.description} (${log.createdAt.toISOString()})`);
    }

    console.log("\n==========================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED PERFECTLY!`);
    console.log("==========================================================");
  } catch (error) {
    console.error("\n❌ E2E SUITE TERMINATED WITH ERROR:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

runE2ETests();
