const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting FrankLucy database seed...");

  // 1. Roles
  const roles = [
    { name: "OWNER", description: "Full business ownership and global visibility" },
    { name: "MANAGER", description: "Branch operations, reconciliations, approvals, transfers" },
    { name: "CASHIER", description: "Point of sale operations, payments, and invoice creation" },
    { name: "STOCKKEEPER", description: "Warehouse receiving, damage logging, stock counts" },
    { name: "SALESPERSON", description: "Frontline sales & inventory associate: POS sales, stock receiving, customer service" },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
  }
  console.log("✓ Roles seeded");

  // 2. Permissions
  const permissions = [
    "sales.create", "sales.view",
    "inventory.view", "inventory.receive", "inventory.opening_stock",
    "inventory.damage", "inventory.expiry", "inventory.count",
    "inventory.adjust", "inventory.adjust.approve",
    "transfers.create", "transfers.view",
    "customers.view", "customers.create", "customers.payment",
    "attendance.view", "attendance.clock", "attendance.correct", "attendance.correct.approve",
    "cash.reconcile", "cash.handover", "cash.session.open", "cash.session.close",
    "employees.view", "employees.manage",
    "branches.manage", "products.manage",
    "prices.change", "discounts.approve",
    "returns.create", "refunds.approve",
    "reports.view", "activity.view", "audit.view"
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { name: p },
      update: {},
      create: { name: p, description: `Permission to ${p}` },
    });
  }
  console.log("✓ Permissions seeded");

  // Map permissions to roles
  const ownerRole = await prisma.role.findUnique({ where: { name: "OWNER" } });
  const managerRole = await prisma.role.findUnique({ where: { name: "MANAGER" } });
  const cashierRole = await prisma.role.findUnique({ where: { name: "CASHIER" } });
  const stockRole = await prisma.role.findUnique({ where: { name: "STOCKKEEPER" } });
  const salespersonRole = await prisma.role.findUnique({ where: { name: "SALESPERSON" } });

  const allPerms = await prisma.permission.findMany();

  // Clear existing role permissions for clean idempotency
  await prisma.rolePermission.deleteMany({});

  // Owner gets all
  for (const p of allPerms) {
    await prisma.rolePermission.create({
      data: { roleId: ownerRole.id, permissionId: p.id },
    });
  }

  // Manager permissions
  const managerPermNames = [
    "sales.create", "sales.view", "inventory.view", "inventory.receive",
    "inventory.damage", "inventory.expiry", "inventory.count", "inventory.adjust",
    "inventory.adjust.approve", "transfers.create", "transfers.view",
    "customers.view", "customers.create", "customers.payment",
    "attendance.view", "attendance.clock", "attendance.correct", "attendance.correct.approve",
    "cash.reconcile", "cash.handover", "cash.session.open", "cash.session.close", "employees.view",
    "prices.change", "discounts.approve", "returns.create", "refunds.approve",
    "reports.view", "activity.view"
  ];
  for (const p of allPerms.filter(x => managerPermNames.includes(x.name))) {
    await prisma.rolePermission.create({
      data: { roleId: managerRole.id, permissionId: p.id },
    });
  }

  // Cashier permissions
  const cashierPermNames = [
    "sales.create", "sales.view", "customers.view", "customers.create",
    "customers.payment", "attendance.clock", "cash.session.open", "cash.session.close"
  ];
  for (const p of allPerms.filter(x => cashierPermNames.includes(x.name))) {
    await prisma.rolePermission.create({
      data: { roleId: cashierRole.id, permissionId: p.id },
    });
  }

  // Stockkeeper permissions
  const stockPermNames = [
    "inventory.view", "inventory.receive", "inventory.damage",
    "inventory.expiry", "inventory.count", "transfers.create",
    "transfers.view", "attendance.clock", "activity.view"
  ];
  for (const p of allPerms.filter(x => stockPermNames.includes(x.name))) {
    await prisma.rolePermission.create({
      data: { roleId: stockRole.id, permissionId: p.id },
    });
  }

  // Salesperson permissions (combined frontline retail duties)
  const salespersonPermNames = [
    "sales.create", "sales.view",
    "inventory.view", "inventory.receive", "inventory.count",
    "transfers.create", "transfers.view",
    "customers.view", "customers.create", "customers.payment",
    "attendance.clock",
    "cash.session.open", "cash.session.close",
    "activity.view"
  ];
  for (const p of allPerms.filter(x => salespersonPermNames.includes(x.name))) {
    await prisma.rolePermission.create({
      data: { roleId: salespersonRole.id, permissionId: p.id },
    });
  }
  console.log("✓ Role permissions mapped (including SALESPERSON)");

  // 3. Branches
  const mainBranch = await prisma.branch.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      name: "Main Branch",
      code: "MAIN",
      address: "12 Commercial Avenue, Yaba, Lagos",
      phone: "+234 802 111 0001",
    },
  });

  const ikejaBranch = await prisma.branch.upsert({
    where: { code: "IKE" },
    update: {},
    create: {
      name: "Ikeja Branch",
      code: "IKE",
      address: "44 Allen Avenue, Ikeja, Lagos",
      phone: "+234 802 111 0002",
    },
  });

  const surulereBranch = await prisma.branch.upsert({
    where: { code: "SUR" },
    update: {},
    create: {
      name: "Surulere Branch",
      code: "SUR",
      address: "18 Adeniran Ogunsanya, Surulere, Lagos",
      phone: "+234 802 111 0003",
    },
  });

  // Ensure sequences
  for (const b of [mainBranch, ikejaBranch, surulereBranch]) {
    await prisma.branchInvoiceSequence.upsert({
      where: { branchId: b.id },
      update: {},
      create: { branchId: b.id, nextNumber: 1001 },
    });
    await prisma.branchTransferSequence.upsert({
      where: { branchId: b.id },
      update: {},
      create: { branchId: b.id, nextNumber: 101 },
    });
  }
  console.log("✓ Branches and sequence generators ready");

  // 4. Staff Users & Employees
  const salt = await bcrypt.genSalt(10);
  const commonPassword = await bcrypt.hash("Password123!", salt);

  const staff = [
    {
      email: "admin@franklucy.com",
      firstName: "System",
      lastName: "Administrator",
      employeeNumber: "EMP-ADMIN",
      role: ownerRole,
      branches: [mainBranch, ikejaBranch, surulereBranch],
    },
    {
      email: "owner@franklucy.com",
      firstName: "Adeyemi",
      lastName: "Adeleke",
      employeeNumber: "EMP-001",
      role: ownerRole,
      branches: [mainBranch, ikejaBranch, surulereBranch],
    },
    {
      email: "manager@franklucy.com",
      firstName: "Sarah",
      lastName: "Okonjo",
      employeeNumber: "EMP-002",
      role: managerRole,
      branches: [mainBranch, ikejaBranch],
    },
    {
      email: "cashier@franklucy.com",
      firstName: "John",
      lastName: "Mensah",
      employeeNumber: "EMP-003",
      role: cashierRole,
      branches: [mainBranch],
    },
    {
      email: "stock@franklucy.com",
      firstName: "David",
      lastName: "Cole",
      employeeNumber: "EMP-004",
      role: stockRole,
      branches: [mainBranch],
    },
  ];

  for (const s of staff) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { passwordHash: commonPassword },
      create: {
        email: s.email,
        username: s.email.split("@")[0],
        passwordHash: commonPassword,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: s.role.id } },
      update: {},
      create: { userId: user.id, roleId: s.role.id },
    });

    const emp = await prisma.employee.upsert({
      where: { employeeNumber: s.employeeNumber },
      update: { userId: user.id },
      create: {
        userId: user.id,
        employeeNumber: s.employeeNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        phone: "+234 803 000 0000",
      },
    });

    // Assignments
    for (const b of s.branches) {
      const existing = await prisma.employeeBranchAssignment.findFirst({
        where: { employeeId: emp.id, branchId: b.id, endDate: null },
      });
      if (!existing) {
        await prisma.employeeBranchAssignment.create({
          data: {
            employeeId: emp.id,
            branchId: b.id,
            startDate: new Date("2026-01-01"),
            reason: "Initial baseline appointment",
          },
        });
      }
    }
  }
  console.log("✓ Employees and user accounts seeded");

  // 5. Products catalog
  // 5. Products catalog with bulk and piece units
  const products = [
    { sku: "HEIN-CRATE", name: "Heineken Premium Lager", category: "Beer", inventoryUnit: "CRATE", bulkUnit: "CRATE", pieceUnit: "BOTTLE", piecesPerBulk: 24 },
    { sku: "GUIN-CRATE", name: "Guinness Foreign Extra Stout", category: "Stout", inventoryUnit: "CRATE", bulkUnit: "CRATE", pieceUnit: "BOTTLE", piecesPerBulk: 24 },
    { sku: "MALT-PACK", name: "Maltina Classic (Pack)", category: "Malt", inventoryUnit: "PACK", bulkUnit: "PACK", pieceUnit: "CAN", piecesPerBulk: 12 },
    { sku: "NUTRI-CRATE", name: "Nutri Milk Crate", category: "Dairy", inventoryUnit: "CRATE", bulkUnit: "CRATE", pieceUnit: "BOTTLE", piecesPerBulk: 24 },
    { sku: "COKE-CRATE", name: "Coca-Cola 50cl", category: "Soft Drinks", inventoryUnit: "CRATE", bulkUnit: "CRATE", pieceUnit: "BOTTLE", piecesPerBulk: 24 },
    { sku: "EVA-PACK", name: "Eva Table Water 75cl", category: "Water", inventoryUnit: "PACK", bulkUnit: "PACK", pieceUnit: "BOTTLE", piecesPerBulk: 12 },
  ];

  const seededProducts = [];
  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        category: p.category,
        inventoryUnit: p.inventoryUnit,
        bulkUnit: p.bulkUnit,
        pieceUnit: p.pieceUnit,
        piecesPerBulk: p.piecesPerBulk,
      },
      create: p,
    });
    seededProducts.push(prod);
  }
  console.log("✓ Product catalog seeded with bulk and unit specifications");

  // 6. Branch Product pricing and initial stock
  const ownerEmp = await prisma.employee.findUnique({ where: { employeeNumber: "EMP-001" } });

  const mainPrices = {
    "HEIN-CRATE": { price: 38000, piecePrice: 1700, stock: 120, reorder: 20 },
    "GUIN-CRATE": { price: 34000, piecePrice: 1500, stock: 80, reorder: 15 },
    "MALT-PACK": { price: 8500, piecePrice: 750, stock: 95, reorder: 25 },
    "NUTRI-CRATE": { price: 12000, piecePrice: 550, stock: 45, reorder: 15 },
    "COKE-CRATE": { price: 9000, piecePrice: 400, stock: 110, reorder: 20 },
    "EVA-PACK": { price: 3500, piecePrice: 300, stock: 150, reorder: 30 },
  };

  const ikejaPrices = {
    "HEIN-CRATE": { price: 38500, piecePrice: 1700, stock: 40, reorder: 15 },
    "GUIN-CRATE": { price: 34500, piecePrice: 1550, stock: 35, reorder: 10 },
    "MALT-PACK": { price: 8500, piecePrice: 750, stock: 50, reorder: 20 },
    "NUTRI-CRATE": { price: 12500, piecePrice: 550, stock: 30, reorder: 10 },
    "COKE-CRATE": { price: 9200, piecePrice: 400, stock: 60, reorder: 15 },
    "EVA-PACK": { price: 3500, piecePrice: 300, stock: 80, reorder: 20 },
  };

  for (const prod of seededProducts) {
    const piecesPerBulk = prod.piecesPerBulk || 1;

    // Main Branch
    const mConfig = mainPrices[prod.sku];
    const mStockPieces = mConfig.stock * piecesPerBulk;
    const mReorderPieces = mConfig.reorder * piecesPerBulk;

    const bpMain = await prisma.branchProduct.upsert({
      where: { branchId_productId: { branchId: mainBranch.id, productId: prod.id } },
      update: {
        sellingPrice: mConfig.price,
        piecePrice: mConfig.piecePrice,
        currentStock: mStockPieces,
        reorderLevel: mReorderPieces,
      },
      create: {
        branchId: mainBranch.id,
        productId: prod.id,
        sellingPrice: mConfig.price,
        piecePrice: mConfig.piecePrice,
        currentStock: mStockPieces,
        reorderLevel: mReorderPieces,
      },
    });

    // Check if initial opening stock movement exists
    const existingMovementMain = await prisma.inventoryMovement.findFirst({
      where: { branchId: mainBranch.id, productId: prod.id, type: "OPENING_STOCK" },
    });
    if (!existingMovementMain) {
      await prisma.inventoryMovement.create({
        data: {
          branchId: mainBranch.id,
          productId: prod.id,
          type: "OPENING_STOCK",
          quantity: mStockPieces,
          reason: "Initial physical inventory audit baseline",
          createdBy: ownerEmp.id,
        },
      });
    }

    // Ikeja Branch
    const iConfig = ikejaPrices[prod.sku];
    const iStockPieces = iConfig.stock * piecesPerBulk;
    const iReorderPieces = iConfig.reorder * piecesPerBulk;

    const bpIkeja = await prisma.branchProduct.upsert({
      where: { branchId_productId: { branchId: ikejaBranch.id, productId: prod.id } },
      update: {
        sellingPrice: iConfig.price,
        piecePrice: iConfig.piecePrice,
        currentStock: iStockPieces,
        reorderLevel: iReorderPieces,
      },
      create: {
        branchId: ikejaBranch.id,
        productId: prod.id,
        sellingPrice: iConfig.price,
        piecePrice: iConfig.piecePrice,
        currentStock: iStockPieces,
        reorderLevel: iReorderPieces,
      },
    });

    const existingMovementIkeja = await prisma.inventoryMovement.findFirst({
      where: { branchId: ikejaBranch.id, productId: prod.id, type: "OPENING_STOCK" },
    });
    if (!existingMovementIkeja) {
      await prisma.inventoryMovement.create({
        data: {
          branchId: ikejaBranch.id,
          productId: prod.id,
          type: "OPENING_STOCK",
          quantity: iStockPieces,
          reason: "Initial physical inventory audit baseline",
          createdBy: ownerEmp.id,
        },
      });
    }
  }
  console.log("✓ Branch products and opening inventory movements created");

  // 7. Customers
  const customers = [
    { name: "ABC Lounge & Bar", phone: "08034567890", address: "14 Isaac John St, GRA Ikeja", creditLimit: 500000 },
    { name: "De Palms Restaurant", phone: "08023456781", address: "22 Commercial Ave, Yaba", creditLimit: 300000 },
    { name: "Apex Chillout Club", phone: "08098765432", address: "55 Ogunlana Drive, Surulere", creditLimit: 400000 },
  ];

  for (const c of customers) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    if (!existing) {
      await prisma.customer.create({ data: c });
    }
  }
  console.log("✓ Baseline regular customers seeded");

  console.log("\n🚀 Database seed completed successfully!");
  console.log("--------------------------------------------------");
  console.log("Default Accounts (Password for all: Password123!)");
  console.log("👑 Owner:        owner@franklucy.com");
  console.log("👔 Manager:      manager@franklucy.com");
  console.log("💳 Cashier:      cashier@franklucy.com");
  console.log("📦 Stockkeeper:  stock@franklucy.com");
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
