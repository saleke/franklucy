# Component 16 — Prisma Schema & Database Relationships

Now we can turn the business model into an actual database.

One rule before we start:

> **The database should make invalid business states difficult to represent.**

We don't want to rely entirely on application code to keep the data sane.

---

## 16.1 First database slice

For the first vertical slice, we'll start with:

```text
User
Employee
Role
Branch
EmployeeBranchAssignment

Product
BranchProduct
ProductPriceHistory

Sale
SaleItem
Payment

InventoryMovement

AuditLog
```

Relationship overview:

```text
User
 │
 └── Employee
       │
       └── EmployeeBranchAssignment
                    │
                    ▼
                  Branch


Product
   │
   └── BranchProduct ─── Branch
          │
          └── PriceHistory


Branch
  │
  ├── Sales
  ├── InventoryMovements
  └── AuditLogs

Sale
 │
 ├── SaleItems ─── Product
 └── Payments
```

---

# 16.2 User vs Employee

This distinction remains important.

### User

Answers:

> How does this person access the system?

```text
User
├── id
├── email
├── passwordHash
├── status
└── timestamps
```

### Employee

Answers:

> Who is this person in the business?

```text
Employee
├── id
├── userId
├── employeeNumber
├── firstName
├── lastName
├── phone
├── status
└── timestamps
```

So:

```text
User
   │
   │ 1:1
   ▼
Employee
```

If Daniel leaves the company:

```text
Employee.status = INACTIVE
User.status = INACTIVE
```

But his historical sales remain.

We **never delete Daniel's historical identity**.

---

# 16.3 Roles

For the initial system:

```text
OWNER
MANAGER
CASHIER
STOCKKEEPER
```

I'd still model roles as database records rather than hard-code everything into the user table.

Eventually:

```text
Role
   │
   └── RolePermission
              │
              ▼
         Permission
```

For the first version, this gives us room to evolve without rewriting authentication.

---

# 16.4 Branches

```text
Branch
├── id
├── name
├── code
├── address
├── phone
├── status
└── timestamps
```

Branch codes should be unique.

For example:

```text
MAIN
IKEJA
YABA
```

---

# 16.5 Employee branch assignment

Don't put only:

```text
employee.branchId
```

on Employee.

Why?

Because we need history.

Instead:

```text
Employee
      │
      ▼
EmployeeBranchAssignment
      │
      ▼
Branch
```

Example:

```text
Daniel
─────────────────────
Main Branch
Jan 1 → Jun 30

Ikeja Branch
Jul 1 → present
```

Now historical activity remains explainable.

---

# 16.6 Product

Product is global.

```text
Product
├── id
├── sku
├── name
├── category
├── inventoryUnit
├── status
└── timestamps
```

Example:

```text
Product
────────────────
Heineken
SKU: HEIN-CRATE
Unit: CRATE
```

We don't create another Heineken product for every branch.

---

# 16.7 BranchProduct

This is where branch-specific information lives.

```text
BranchProduct
├── branchId
├── productId
├── sellingPrice
├── reorderLevel
└── status
```

Therefore:

```text
Heineken

Main Branch
₦38,000
Reorder: 20

Ikeja Branch
₦39,000
Reorder: 15
```

And we enforce:

```text
(branchId, productId)
```

as unique.

A branch cannot accidentally have two active records for the same product.

---

# 16.8 Price history

Every meaningful price change should be traceable.

```text
ProductPriceHistory
├── id
├── branchProductId
├── oldPrice
├── newPrice
├── changedBy
├── reason
└── createdAt
```

Example:

```text
Heineken

₦35,000
   ↓
₦38,000

Changed by: Owner
Reason: Supplier price increase
```

The sale itself stores the actual price used.

That means historical invoices don't depend on the current product price.

---

# 16.9 Inventory

This is where we need to be especially careful.

We decided:

> **Stock is derived from movements.**

So we don't want:

```text
BranchProduct.stockQuantity
```

as a freely editable field.

Instead:

```text
InventoryMovement
```

contains:

```text
+100 PURCHASE
-10 SALE
-15 TRANSFER_OUT
+5 RETURN_IN
-2 DAMAGED
```

Current stock is calculated from those movements.

Conceptually:

```text
Stock =
SUM(incoming quantities)
-
SUM(outgoing quantities)
```

---

# 16.10 Inventory movement types

Initial enum:

```text
OPENING_STOCK
PURCHASE
SALE
TRANSFER_IN
TRANSFER_OUT
RETURN_IN
DAMAGED
EXPIRED
ADJUSTMENT
```

We'll eventually add reference information so we can answer:

> Why did this movement happen?

For example:

```text
SALE
referenceType = "SALE"
referenceId = "sale-id"
```

Or:

```text
DAMAGED
referenceType = "DAMAGE_REPORT"
referenceId = "..."
```

---

# 16.11 Sales

Sale is the business transaction.

```text
Sale
├── id
├── invoiceNumber
├── branchId
├── customerId?
├── cashierId
├── status
├── subtotal
├── discount
├── total
├── createdAt
└── completedAt
```

`customerId` is nullable because:

```text
Walk-in customer
```

doesn't require a customer profile.

---

# 16.12 Sale items

Never store only:

```text
Sale.total
```

We need the items.

```text
Sale
   │
   └── SaleItem
          ├── product
          ├── quantity
          ├── unitPrice
          ├── discount
          └── lineTotal
```

Critically:

```text
unitPrice
```

is a snapshot.

Suppose:

```text
Sept 30
Heineken = ₦38,000
```

and October:

```text
Heineken = ₦40,000
```

The September invoice still says:

```text
₦38,000
```

---

# 16.13 Payments

Payment is deliberately separate from Sale.

```text
Sale
 │
 ├── Payment
 ├── Payment
 └── Payment
```

This allows:

```text
Total = ₦100,000

Cash = ₦40,000
Transfer = ₦60,000
```

or:

```text
Total = ₦100,000
Paid = ₦40,000
Outstanding = ₦60,000
```

That gives us the foundation for credit sales.

---

# 16.14 Audit logs

The audit log should point toward the business object.

```text
AuditLog
├── action
├── userId
├── branchId
├── entityType
├── entityId
├── description
├── oldValue
├── newValue
├── reason
└── createdAt
```

For example:

```text
action:
SALE_CREATED

entityType:
SALE

entityId:
sale_123

user:
Daniel

branch:
Main

createdAt:
2026-09-30 10:42
```

---

# 16.15 Prisma schema

At this stage, our initial schema can look roughly like this:

```prisma
enum UserStatus {
  ACTIVE
  INACTIVE
}

enum EmployeeStatus {
  ACTIVE
  INACTIVE
}

enum BranchStatus {
  ACTIVE
  INACTIVE
}

enum ProductStatus {
  ACTIVE
  INACTIVE
}

enum BranchProductStatus {
  ACTIVE
  INACTIVE
}

enum InventoryUnit {
  CRATE
  PACK
  PIECE
  OTHER
}

enum SaleStatus {
  DRAFT
  COMPLETED
  VOIDED
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  OTHER
}

enum PaymentStatus {
  PENDING
  COMPLETED
  REFUNDED
}

enum InventoryMovementType {
  OPENING_STOCK
  PURCHASE
  SALE
  TRANSFER_IN
  TRANSFER_OUT
  RETURN_IN
  DAMAGED
  EXPIRED
  ADJUSTMENT
}
```

Then the core models:

```prisma
model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  status       UserStatus @default(ACTIVE)

  employee Employee?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}
```

Employee:

```prisma
model Employee {
  id             String         @id @default(cuid())
  userId         String?        @unique
  employeeNumber String         @unique
  firstName      String
  lastName       String
  phone          String?
  status         EmployeeStatus @default(ACTIVE)

  user User?

  branchAssignments EmployeeBranchAssignment[]

  sales Sale[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([lastName, firstName])
}
```

---

# 16.16 Roles

Initially:

```prisma
model Role {
  id          String @id @default(cuid())
  name        String @unique
  description String?

  users UserRole[]

  permissions RolePermission[]
}

model UserRole {
  userId String
  roleId String

  user User @relation(fields: [userId], references: [id])
  role Role @relation(fields: [roleId], references: [id])

  @@id([userId, roleId])
}

model Permission {
  id          String @id @default(cuid())
  name        String @unique
  description String?

  roles RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id])
  permission Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
}
```

This may look like more work than:

```prisma
role String
```

but it gives us a much better authorization foundation.

---

# 16.17 Branch

```prisma
model Branch {
  id      String       @id @default(cuid())
  name    String
  code    String       @unique
  address String?
  phone   String?
  status  BranchStatus @default(ACTIVE)

  employeeAssignments EmployeeBranchAssignment[]
  products             BranchProduct[]
  sales                Sale[]
  inventoryMovements   InventoryMovement[]
  auditLogs            AuditLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}
```

Employee assignment:

```prisma
model EmployeeBranchAssignment {
  id         String   @id @default(cuid())
  employeeId String
  branchId   String
  startDate  DateTime
  endDate    DateTime?
  assignedBy String?
  reason     String?

  employee Employee @relation(fields: [employeeId], references: [id])
  branch   Branch   @relation(fields: [branchId], references: [id])

  createdAt DateTime @default(now())

  @@index([employeeId, startDate])
  @@index([branchId, startDate])
}
```

---

# 16.18 Product

```prisma
model Product {
  id            String        @id @default(cuid())
  sku           String        @unique
  name          String
  category      String?
  inventoryUnit InventoryUnit
  status        ProductStatus @default(ACTIVE)

  branchProducts    BranchProduct[]
  saleItems         SaleItem[]
  inventoryMovements InventoryMovement[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name])
  @@index([status])
}
```

---

# 16.19 BranchProduct

```prisma
model BranchProduct {
  id            String              @id @default(cuid())
  branchId      String
  productId     String
  sellingPrice  Decimal             @db.Decimal(12, 2)
  reorderLevel  Int                 @default(0)
  status        BranchProductStatus  @default(ACTIVE)

  branch  Branch  @relation(fields: [branchId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  priceHistory ProductPriceHistory[]

  @@unique([branchId, productId])
  @@index([branchId, status])
  @@index([productId])
}
```

Price history:

```prisma
model ProductPriceHistory {
  id             String   @id @default(cuid())
  branchProductId String
  oldPrice       Decimal  @db.Decimal(12, 2)
  newPrice       Decimal  @db.Decimal(12, 2)
  changedBy      String
  reason         String?
  createdAt      DateTime @default(now())

  branchProduct BranchProduct @relation(
    fields: [branchProductId],
    references: [id]
  )

  @@index([branchProductId, createdAt])
}
```

---

# 16.20 Sale

```prisma
model Sale {
  id            String     @id @default(cuid())
  invoiceNumber String     @unique
  branchId      String
  customerId    String?
  cashierId     String
  status        SaleStatus @default(DRAFT)

  subtotal Decimal @db.Decimal(12, 2)
  discount Decimal @db.Decimal(12, 2)
  total    Decimal @db.Decimal(12, 2)

  branch   Branch    @relation(fields: [branchId], references: [id])
  customer Customer? @relation(fields: [customerId], references: [id])
  cashier  Employee  @relation(fields: [cashierId], references: [id])

  items    SaleItem[]
  payments Payment[]

  createdAt   DateTime  @default(now())
  completedAt DateTime?

  @@index([branchId, createdAt])
  @@index([cashierId, createdAt])
  @@index([customerId, createdAt])
  @@index([status])
}
```

We haven't defined Customer yet in the first slice, so when we actually run the migration we either:

1. include the basic Customer model now, or
2. temporarily make `customerId` nullable without the relation and add it in the next migration.

I'd choose **option 1**.

Customers are already part of the sale workflow because repeat/credit customers matter.

---

# 16.21 Customer

```prisma
enum CustomerStatus {
  ACTIVE
  INACTIVE
}

model Customer {
  id          String         @id @default(cuid())
  name        String
  phone       String?
  address     String?
  creditLimit Decimal        @default(0) @db.Decimal(12, 2)
  status      CustomerStatus @default(ACTIVE)

  sales Sale[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name])
  @@index([phone])
}
```

Notice:

There is **no password**.

This is a business customer record, not a customer login.

---

# 16.22 SaleItem

```prisma
model SaleItem {
  id        String @id @default(cuid())
  saleId    String
  productId String

  quantity  Int
  unitPrice Decimal @db.Decimal(12, 2)
  discount  Decimal @default(0) @db.Decimal(12, 2)
  lineTotal Decimal @db.Decimal(12, 2)

  sale    Sale    @relation(fields: [saleId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@index([saleId])
  @@index([productId])
}
```

---

# 16.23 Payment

```prisma
model Payment {
  id         String        @id @default(cuid())
  saleId     String
  amount     Decimal       @db.Decimal(12, 2)
  method     PaymentMethod
  status     PaymentStatus @default(COMPLETED)
  reference  String?
  receivedBy String

  sale Sale @relation(fields: [saleId], references: [id])

  createdAt DateTime @default(now())

  @@index([saleId, createdAt])
  @@index([method, createdAt])
}
```

Eventually we may want payment reversal/refund relationships, but we don't need to overcomplicate the first migration.

---

# 16.24 InventoryMovement

```prisma
model InventoryMovement {
  id            String                  @id @default(cuid())
  branchId      String
  productId     String
  type          InventoryMovementType

  quantity      Int

  referenceType String?
  referenceId   String?

  reason    String?
  createdBy String
  createdAt DateTime @default(now())

  branch  Branch  @relation(fields: [branchId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@index([branchId, productId, createdAt])
  @@index([referenceType, referenceId])
  @@index([type, createdAt])
}
```

One thing to notice:

There is no:

```text
stockQuantity
```

field.

That's deliberate.

---

# 16.25 AuditLog

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  action      String
  userId      String
  branchId    String?

  entityType  String
  entityId    String

  description String?
  oldValue    Json?
  newValue    Json?
  reason      String?

  createdAt DateTime @default(now())

  branch Branch? @relation(fields: [branchId], references: [id])

  @@index([userId, createdAt])
  @@index([branchId, createdAt])
  @@index([entityType, entityId])
  @@index([action, createdAt])
}
```

`oldValue` and `newValue` being JSON is intentional.

Audit data isn't our core transactional data model.

It's evidence describing changes.

---

# 16.26 One problem: audit user relation

We currently have:

```text
userId
```

but haven't added:

```prisma
user User @relation(...)
```

We should.

```prisma
user User @relation(fields: [userId], references: [id])
```

Then User gets:

```prisma
auditLogs AuditLog[]
```

This gives us:

```text
User
 ↓
AuditLog
```

and lets us query:

> Show everything Daniel did.

---

# 16.27 Another important decision: deletion

For core business data:

```text
Sale
Payment
InventoryMovement
AuditLog
```

we should **not** expose normal delete operations.

No:

```text
DELETE /sales/123
```

for ordinary application use.

Instead:

```text
Sale
 ↓
VOID
 ↓
Reversal events
 ↓
Audit
```

Same principle for inventory.

We don't delete a stock movement because someone made a mistake.

We create a correcting movement.

---

# 16.28 Database constraints vs business rules

Some rules belong directly in the database.

Examples:

```text
invoiceNumber UNIQUE
product SKU UNIQUE
branch code UNIQUE
employeeNumber UNIQUE
(branchId, productId) UNIQUE
```

Other rules belong in application services:

```text
Cashier cannot void sale
Manager cannot access unauthorized branch
Sale cannot exceed stock
Discount requires approval
Transfer cannot jump from REQUESTED → RECEIVED
```

The distinction is important.

Database:

> **Is this data structurally valid?**

Business service:

> **Is this operation allowed?**

---

# 16.29 Indexes

We'll add indexes around common queries.

For example:

```text
Sales by branch/date
Inventory by branch/product/date
Activity by branch/date
Payments by sale/date
Employees by status
Products by name
```

But don't add an index to every field.

Indexes have a cost too.

We'll add them based on actual query patterns.

---

# 16.30 The resulting database

Conceptually:

```text
                    ┌──────────┐
                    │   User   │
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │ Employee │
                    └────┬─────┘
                         │
                         ▼
                ┌───────────────────┐
                │ Branch Assignment │
                └─────────┬─────────┘
                          │
                          ▼
                       Branch
                          │
             ┌────────────┼─────────────┐
             │            │             │
             ▼            ▼             ▼
           Sales       Inventory      Audit
             │         Movements
             │
        ┌────┴─────┐
        ▼          ▼
    SaleItems    Payments
        │
        ▼
     Product
        │
        ▼
  BranchProduct
        │
        ▼
 PriceHistory
```

That's a pretty strong foundation.

---

# 16.31 One thing we're intentionally postponing

We have **not** fully implemented:

```text
Returns
Transfers
Attendance
Cash reconciliation
Customer ledger
Goods receipts
Approvals
```

yet.

That's intentional.

We'll add them as vertical slices instead of creating a giant schema we haven't tested against actual workflows.

---

# 16.32 Next step: seed data

Before building the actual sales UI, we need development data.

We'll create:

```text
Roles
├── OWNER
├── MANAGER
├── CASHIER
└── STOCKKEEPER

Branches
├── Main Branch
└── Example Sub Branch

Employees
├── Owner
├── Manager
├── Cashier
└── Stockkeeper

Products
├── Heineken
├── Nutri Milk
├── Malt
└── Pepsi
```

And opening inventory.

For example:

```text
Main Branch

Heineken       100 crates
Nutri Milk      50 crates
Malt            80 packs
```

The stock doesn't get magically inserted into a `stock` column.

Instead:

```text
OPENING_STOCK
+100 Heineken
+50 Nutri Milk
+80 Malt
```

That immediately tests whether our event-based inventory model works.

---

# 16.33 Then we build the first complete feature

The next component should therefore be:

## **Component 17 — Authentication + Seed Data + First Working Screen**

We'll actually establish:

```text
Database
   ↓
Seed
   ↓
Login
   ↓
Session
   ↓
Role
   ↓
Branch
   ↓
Today page
```

Then immediately after that:

```text
Component 18 — New Sale + Complete Sale Transaction
```

That is where we'll write our first serious business service and prove that **sale + payment + stock + audit all succeed or fail together**.
