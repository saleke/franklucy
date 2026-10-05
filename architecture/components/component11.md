# Component 11 — Database Design

Now we're moving from **what the system does** to **how the system stores the truth**.

The most important principle here is:

> **The database should represent business events, not just current numbers.**

For example, we don't want:

```text
Heineken stock = 120
```

with no explanation.

We want the system to be able to explain:

```text
Opening stock       +50
Received            +100
Sold                -20
Transferred out     -10
Returned             +2
Damaged              -2
Adjustment            0
────────────────────────
Current stock       =120
```

That is what makes the system auditable.

---

# 11.1 Core database structure

At a high level:

```text
                    ┌─────────────┐
                    │   BRANCH    │
                    └──────┬──────┘
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          ▼                ▼                 ▼
      EMPLOYEES         INVENTORY          SALES
          │                │                 │
          ▼                ▼                 ▼
     ATTENDANCE       STOCK MOVEMENTS     SALE ITEMS
                                             │
                                             ▼
                                         PAYMENTS
                                             │
                                             ▼
                                         CUSTOMER
```

And around all of them:

```text
                    ┌─────────────┐
                    │ AUDIT LOG   │
                    └─────────────┘
                           ▲
                           │
              important business actions
```

---

# 11.2 User

A `User` represents someone who can log into the application.

```text
User
────
id
email
username
passwordHash
status
createdAt
updatedAt
```

Important:

**User ≠ Employee.**

A person can exist as an employee record even if their login is later disabled.

---

# 11.3 Employee

An `Employee` represents the actual person working in the business.

```text
Employee
────────
id
userId
employeeNumber
firstName
lastName
phone
status
createdAt
updatedAt
```

The user account handles authentication.

The employee record handles employment/business information.

---

# 11.4 Roles

Initially:

```text
OWNER
MANAGER
CASHIER
STOCKKEEPER
```

We can eventually have:

```text
Role
────
id
name
```

and:

```text
Permission
──────────
id
code
description
```

Then:

```text
RolePermission
──────────────
roleId
permissionId
```

This gives us flexibility.

Instead of hardcoding:

```text
if user.role === "MANAGER"
```

everywhere, the backend can ask:

```text
Does this user have inventory.transfer.approve?
```

That's much easier to maintain as the application grows.

---

# 11.5 Branch

```text
Branch
──────
id
name
code
address
phone
status
createdAt
updatedAt
```

Example:

```text
IKEJA
SURULERE
YABA
```

Every important operational record should be associated with a branch where appropriate.

---

# 11.6 Employee branch assignments

Because managers can handle multiple branches and employees can be transferred:

```text
EmployeeBranchAssignment
────────────────────────
id
employeeId
branchId
startDate
endDate
assignedBy
reason
```

This is extremely important.

Suppose John worked at Ikeja in January and Surulere in February.

We shouldn't overwrite history.

We preserve:

```text
John
│
├── Ikeja
│   Jan 1 → Jan 31
│
└── Surulere
    Feb 1 → current
```

Historical sales and attendance remain correctly associated with the branch where they happened.

---

# 11.7 Product

```text
Product
───────
id
name
sku
categoryId
inventoryUnit
sellingPrice
reorderLevel
status
createdAt
updatedAt
```

Example:

```text
Heineken
SKU: HEI-001
Unit: CRATE
Price: ₦38,000
Reorder level: 20
```

But there's an important refinement here.

### Don't store only one global selling price.

Different branches may eventually have different prices.

So we should separate the product from its branch price.

```text
Product
   │
   ├── BranchProduct
   │
   ├── BranchProduct
   └── BranchProduct
```

`BranchProduct`:

```text
BranchProduct
─────────────
id
branchId
productId
sellingPrice
reorderLevel
status
```

Now Ikeja can sell Heineken at one price while another branch has a different approved price.

---

# 11.8 Price history

Because prices must be auditable:

```text
ProductPriceHistory
───────────────────
id
branchProductId
oldPrice
newPrice
changedBy
reason
createdAt
```

So we can answer:

> Who changed Heineken from ₦38,000 to ₦40,000?

---

# 11.9 Inventory

Here's where we need to be disciplined.

I don't want inventory to simply be:

```text
stockQuantity = 120
```

Instead:

```text
InventoryMovement
─────────────────
id
branchId
productId
type
quantity
referenceType
referenceId
reason
createdBy
createdAt
```

Types:

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

The current stock is derived from those movements.

Conceptually:

```text
Current Stock =
Σ positive movements
-
Σ negative movements
```

We can optimize the implementation later if necessary, but the movement history remains the source of truth.

---

# 11.10 Sales

A sale has a header and items.

```text
Sale
────
id
invoiceNumber
branchId
customerId
cashierId
status
subtotal
discount
total
createdAt
completedAt
```

Then:

```text
SaleItem
────────
id
saleId
productId
quantity
unitPrice
discount
lineTotal
```

Notice something important:

### `unitPrice` is stored on `SaleItem`.

Why?

Suppose Heineken was ₦38,000 when the sale happened.

Two months later the price becomes ₦42,000.

The old invoice must still say:

```text
Heineken × 3
₦38,000 each
```

So historical transactions never depend on the current product price.

---

# 11.11 Payments

A sale and its payment are separate.

```text
Payment
───────
id
saleId
amount
method
reference
status
receivedBy
createdAt
```

Methods:

```text
CASH
BANK_TRANSFER
OTHER
```

This also allows:

```text
Sale = ₦200,000

Cash          ₦100,000
Bank transfer ₦100,000
```

instead of forcing the entire sale into one payment method.

---

# 11.12 Customers

```text
Customer
────────
id
name
phone
address
creditLimit
status
createdAt
updatedAt
```

A walk-in customer doesn't necessarily need a record.

A regular business customer can have one.

---

# 11.13 Customer payments / account transactions

For credit customers, we need more than just a `balance` field.

We'll eventually want a customer ledger.

Conceptually:

```text
CustomerLedgerEntry
───────────────────
id
customerId
type
amount
referenceType
referenceId
createdAt
createdBy
```

Types could include:

```text
CREDIT_SALE
PAYMENT
REFUND
RETURN
ADJUSTMENT
```

Then:

```text
Customer balance =
credit charges
-
payments
-
credits/refunds
```

Again, we don't want employees directly editing:

```text
customer.balance = 500000
```

---

# 11.14 Stock transfers

Transfers deserve their own model because they're multi-step operations.

```text
StockTransfer
─────────────
id
transferNumber
fromBranchId
toBranchId
status
requestedBy
approvedBy
dispatchedBy
receivedBy
requestedAt
approvedAt
dispatchedAt
receivedAt
reason
```

Then:

```text
StockTransferItem
─────────────────
id
transferId
productId
quantitySent
quantityReceived
```

Example:

```text
TR-00041

Ikeja → Surulere

Heineken
Sent:     20
Received: 18

Status: DISCREPANCY
```

That difference is preserved.

---

# 11.15 Goods receiving

Supplier → branch is different from branch → branch.

```text
GoodsReceipt
────────────
id
receiptNumber
branchId
supplierId
receivedBy
reference
createdAt
```

Items:

```text
GoodsReceiptItem
────────────────
id
goodsReceiptId
productId
quantity
```

Receiving stock generates inventory movements.

---

# 11.16 Attendance

```text
Attendance
──────────
id
employeeId
branchId
workDate
clockIn
clockOut
status
source
createdAt
```

Correction shouldn't overwrite history.

So:

```text
AttendanceCorrection
─────────────────────
id
attendanceId
originalValue
correctedValue
reason
requestedBy
approvedBy
status
createdAt
```

---

# 11.17 Returns

Returns reference the original sale.

```text
Return
──────
id
returnNumber
saleId
customerId
branchId
reason
status
requestedBy
approvedBy
createdAt
```

Items:

```text
ReturnItem
──────────
id
returnId
saleItemId
quantity
disposition
refundAmount
```

Disposition:

```text
RESTOCK
DAMAGED
EXPIRED
```

That connects returns directly to inventory and refunds.

---

# 11.18 Cash reconciliation

```text
CashReconciliation
───────────────────
id
branchId
businessDate
expectedAmount
actualAmount
difference
countedBy
reviewedBy
status
reason
createdAt
```

The key rule:

```text
expectedAmount
```

is calculated by the system.

The cashier enters:

```text
actualAmount
```

The system calculates:

```text
difference = actual - expected
```

The cashier cannot simply type:

> "No discrepancy."

---

# 11.19 Cash handover

```text
CashHandover
────────────
id
branchId
amount
handedOverBy
receivedBy
status
createdAt
```

So we can trace:

```text
Sales
  ↓
Expected cash
  ↓
Cash count
  ↓
Handover
  ↓
Recipient
```

---

# 11.20 Audit log

Finally:

```text
AuditLog
────────
id
action
userId
branchId
entityType
entityId
description
oldValue
newValue
reason
createdAt
```

This becomes our investigative trail.

For example:

```text
PRICE_CHANGED

User: Sarah
Branch: Ikeja
Product: Heineken

Old: ₦38,000
New: ₦40,000

Reason:
Supplier price increase

Time:
10:32 AM
```

---

# 11.21 The important relationships

The resulting system roughly looks like this:

```text
                         ┌──────────┐
                         │   USER   │
                         └────┬─────┘
                              │
                         ┌────▼─────┐
                         │ EMPLOYEE │
                         └────┬─────┘
                              │
                    ┌─────────▼─────────┐
                    │ BRANCH ASSIGNMENT │
                    └─────────┬─────────┘
                              │
                              ▼
                           BRANCH
                              │
          ┌───────────────────┼────────────────────┐
          │                   │                    │
          ▼                   ▼                    ▼
      ATTENDANCE          INVENTORY              SALES
                              │                    │
                              ▼                    ├── SALE ITEMS
                    STOCK MOVEMENTS               │
                                                   ▼
                                               PAYMENTS
                                                   │
                                                   ▼
                                               CUSTOMER
                                                   │
                                      ┌────────────┴───────────┐
                                      ▼                        ▼
                                   RETURNS                LEDGER
```

And separately:

```text
BRANCH
  │
  ├── GOODS RECEIPTS
  ├── STOCK TRANSFERS
  ├── CASH RECONCILIATIONS
  └── AUDIT LOGS
```

---

# 11.22 One architectural decision I want us to lock

We should distinguish **master data**, **current state**, and **events**.

### Master data

Things that describe the business:

```text
User
Employee
Branch
Product
Customer
Role
Permission
```

### Business events

Things that happened:

```text
Sale
Payment
Return
Refund
Stock receipt
Stock transfer
Attendance
Cash reconciliation
Price change
```

### Audit evidence

Things that explain sensitive changes:

```text
AuditLog
Approval records
Correction records
```

This separation will make the system much easier to reason about.

---

## One thing I would change before we code

We should **not start writing Prisma models yet**.

First we need to settle the exact business rules around:

* Which records are immutable
* Which actions require approval
* How stock quantities are calculated
* How credit balances are calculated
* How branch access works
* What happens when transactions fail halfway through

Those rules determine the schema.

### So next is Component 12 — Backend Architecture & Business Rules

There we'll define the actual server-side workflows, such as:

**Complete Sale**

```text
Validate user
→ Validate branch
→ Validate products
→ Get approved prices
→ Validate stock
→ Calculate totals
→ Create sale
→ Create sale items
→ Create payment
→ Create inventory movements
→ Create audit event
→ Commit transaction
```

That is where the system starts becoming a **real application architecture**, rather than just a collection of tables.
