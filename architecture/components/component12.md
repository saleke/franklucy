# Component 12 — Backend Architecture & Business Rules

Now we're getting into the part that makes the application **trustworthy**.

The frontend will make things easy to use, but the **backend decides whether an operation is actually allowed**.

The core rule:

> **The browser requests an action. The server validates the business rules and records the result.**

---

## 12.1 Backend architecture

We're still keeping the system as a **modular monolith**.

Not:

```text
Sales microservice
Inventory microservice
Payments microservice
Attendance microservice
```

Instead:

```text
                 Next.js Application
                        │
              ┌─────────▼─────────┐
              │    API / Server    │
              └─────────┬─────────┘
                        │
       ┌────────────────┼────────────────┐
       │                │                │
     Sales          Inventory        Customers
       │                │                │
     Cash           Transfers       Payments
       │                │                │
 Attendance       Employees          Audit
       │                │                │
       └────────────────┼────────────────┘
                        │
                  PostgreSQL
```

Each module has its own business logic, but they're inside one application.

---

# 12.2 Don't put business rules in the UI

Suppose the cashier sees:

> Heineken — ₦38,000

The frontend might prevent the cashier from changing it.

But that's **not security**.

Someone could send a request manually:

```text
POST /api/sales

{
  "productId": "123",
  "quantity": 3,
  "unitPrice": 1
}
```

The backend must reject it.

The server should obtain the approved price itself.

```text
Client
  ↓
"Sell 3 Heineken"
  ↓
Server
  ↓
Find approved branch price
  ↓
₦38,000
  ↓
Calculate total
```

Never trust the browser with authoritative values.

---

# 12.3 Request pipeline

Most important operations should pass through roughly the same pipeline:

```text id="p1qk83"
Request
   ↓
Authenticate
   ↓
Identify user
   ↓
Check permission
   ↓
Check branch access
   ↓
Validate input
   ↓
Apply business rules
   ↓
Perform database transaction
   ↓
Write audit event
   ↓
Return result
```

This gives us consistency.

---

# 12.4 Example: completing a sale

This is probably our most important backend workflow.

Cashier presses:

> **Complete Sale**

The server does:

### Step 1 — Authentication

Who is making this request?

```text
User: John
Employee: EMP-023
```

### Step 2 — Authorization

Does John have permission to create sales?

```text
sales.create = true
```

### Step 3 — Branch

Which branch is John operating in?

```text
Ikeja
```

The server does not blindly trust:

```text
branchId = "ikeja"
```

from the browser.

It checks John's authorized branch access.

### Step 4 — Validate items

```text
Heineken × 3
Nutri Milk × 2
```

Verify that:

* products exist
* products are active
* quantities are valid
* products are available at this branch

### Step 5 — Get prices

The server gets:

```text
Heineken = ₦38,000
Nutri Milk = ₦12,000
```

from the approved branch pricing.

### Step 6 — Check stock

If:

```text
Heineken stock = 2 crates
```

the sale for 3 crates is rejected.

We don't allow negative stock in the MVP.

### Step 7 — Calculate totals

Server calculates:

```text
3 × 38,000 = ₦114,000
2 × 12,000 = ₦24,000

Subtotal = ₦138,000
```

Not the browser.

### Step 8 — Create transaction

Inside **one database transaction**:

```text
Sale
SaleItems
Payment
InventoryMovements
AuditLog
```

are created together.

### Step 9 — Commit

Only if everything succeeds.

Otherwise:

> **Nothing gets partially recorded.**

That's extremely important.

---

# 12.5 Database transactions

Imagine this happens:

```text
Sale created ✓
Payment created ✓
Stock reduction ✓
Audit log ✗
```

Now we have inconsistent data.

We don't want that.

Instead:

```text
BEGIN TRANSACTION

create sale
create items
create payment
create inventory movement
create audit event

COMMIT
```

If anything fails:

```text
ROLLBACK
```

Everything goes back.

This is one of the reasons PostgreSQL is a good fit.

---

# 12.6 Stock movement rules

Stock should never be modified directly.

Bad:

```text
inventory.quantity -= 3
```

Better:

```text
createStockMovement({
  type: "SALE",
  quantity: -3,
  reference: saleId
})
```

Then the system has evidence of **why** stock changed.

For example:

```text
Heineken — Ikeja

+100  Received
-20   Sales
-10   Transfer
+2    Return
-3    Damaged
```

Every number has a reason.

---

# 12.7 Stock adjustment

Suppose the system says:

```text
Expected: 120 crates
```

Physical count says:

```text
Actual: 117 crates
```

The employee shouldn't simply type:

```text
stock = 117
```

Instead:

```text
Stock count
Expected: 120
Actual: 117
Difference: -3

Reason: Physical count discrepancy

[Submit for approval]
```

Manager approves.

Then:

```text
ADJUSTMENT -3
```

is recorded.

Now the audit trail tells us exactly what happened.

---

# 12.8 Price changes

Suppose the manager wants to change:

```text
Heineken
₦38,000 → ₦40,000
```

The server checks:

```text
Can this user change prices?
```

Then records:

```text
oldPrice = 38000
newPrice = 40000
changedBy = manager
reason = ...
```

Future sales use ₦40,000.

Existing invoices remain ₦38,000.

---

# 12.9 Discounts

Cashier should not be able to do:

```text
Total: ₦138,000
Discount: ₦100,000
```

without control.

Instead:

```text
Cashier requests discount
       ↓
Reason required
       ↓
Manager approves
       ↓
Discount applied
       ↓
Audit event
```

For small discounts, we can later define an automatic threshold.

Example:

```text
≤ 2%       cashier allowed
2–10%      manager approval
> 10%      owner approval
```

But those percentages are **business configuration**, not hardcoded yet.

We'll get the owner's actual policy before implementing them.

---

# 12.10 Returns

Return workflow:

```text
Original invoice
      ↓
Select item
      ↓
Quantity returned
      ↓
Reason
      ↓
Manager approval if required
      ↓
Determine disposition
      ↓
Inventory movement
      ↓
Refund / customer credit
      ↓
Audit event
```

The original sale remains untouched.

---

# 12.11 Transfer workflow

We already defined:

```text
REQUESTED
    ↓
APPROVED
    ↓
IN_TRANSIT
    ↓
RECEIVED
```

The backend enforces valid transitions.

For example:

```text
REQUESTED → RECEIVED
```

should not be allowed.

And:

```text
CANCELLED → RECEIVED
```

should not be allowed.

This is called a **state machine**.

We'll use this pattern for several parts of the system.

---

# 12.12 Cash reconciliation

At the end of the day:

```text
System:
Expected cash = ₦1,760,000
```

Cashier counts:

```text
Actual = ₦1,710,000
```

Server calculates:

```text
Difference = -₦50,000
```

The cashier cannot modify:

```text
Expected = ₦1,710,000
```

They can only enter the actual count.

Then:

```text
Difference
   ↓
Reason
   ↓
Manager review
```

The discrepancy remains in history even after the manager records an explanation.

---

# 12.13 Attendance

Clock-in should be generated by the server.

Not:

```text
clockIn = "08:00"
```

from the browser.

Instead:

```text
POST /attendance/clock-in
```

Server:

```text
authenticated employee
+
authorized branch
+
server timestamp
```

creates:

```text
Clock-in: 08:17
```

Then the system determines:

```text
Expected: 08:00
Actual:   08:17

Status: LATE
```

If the employee claims:

> "I actually arrived at 7:55."

They request a correction.

Original:

```text
08:17
```

remains preserved.

---

# 12.14 Permissions

Authorization should happen at the server/module level.

For example:

```text
requirePermission(user, "inventory.transfer.create")
```

and:

```text
requireBranchAccess(user, branchId)
```

So even if somebody manipulates the frontend, the backend still protects the operation.

---

# 12.15 Audit logging

We should make audit logging part of the business service rather than something developers have to remember manually every time.

For important operations:

```text
perform operation
      ↓
create audit event
```

For example:

```text
saleService.completeSale()
```

can internally record:

```text
SALE_CREATED
PAYMENT_RECORDED
INVENTORY_MOVED
```

This reduces the chance of developers forgetting the audit trail.

---

# 12.16 Error handling

The UI shouldn't show:

> `PrismaClientKnownRequestError`

to a cashier.

Instead:

```text
Unable to complete sale

Heineken only has 2 crates available.
You requested 3.

[Review Sale]
```

For developers, the server logs the technical error.

For users, the system explains the business problem.

This directly supports the UX principle we established.

---

# 12.17 Idempotency

This is especially important for payments and sales.

Imagine the cashier presses:

> **Complete Sale**

and the network is slow.

They press it again.

We don't want:

```text
Invoice 00124
Invoice 00125
```

for the same sale.

The request should have an idempotency key or equivalent protection.

Conceptually:

```text
Request ID: abc123
```

If the same request arrives twice:

```text
First request  → process
Second request → return existing result
```

This becomes particularly important later when we integrate online payments.

---

# 12.18 What the frontend actually does

The frontend becomes much simpler.

It primarily handles:

### Show

```text
Products
Prices
Stock
Forms
Alerts
Results
```

### Collect

```text
Quantity
Customer
Payment method
Reason
```

### Request

```text
Create sale
Request transfer
Submit correction
```

### Explain

```text
Loading
Success
Validation
Errors
```

The backend handles:

```text
Is this allowed?
Is the data valid?
What's the correct price?
Is there enough stock?
Who is doing this?
Which branch?
What should change?
What audit event should exist?
```

---

# 12.19 Suggested server module structure

When we eventually write the code, I'd organize the application roughly like:

```text
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── employees/
│   ├── branches/
│   ├── products/
│   ├── inventory/
│   ├── sales/
│   ├── payments/
│   ├── customers/
│   ├── transfers/
│   ├── attendance/
│   ├── returns/
│   ├── reconciliation/
│   ├── reports/
│   └── audit/
│
├── lib/
│   ├── auth/
│   ├── permissions/
│   ├── db/
│   ├── validation/
│   ├── errors/
│   └── audit/
│
└── app/
    └── ...
```

The exact Next.js structure can be refined when we start implementation.

---

# 12.20 The architectural rule I'd lock in

Every important business operation should have a **single authoritative server-side workflow**.

For example:

```text
Complete Sale
Create Transfer
Receive Transfer
Receive Stock
Approve Discount
Approve Return
Record Payment
Reconcile Cash
Clock In
Correct Attendance
Adjust Stock
Change Price
```

We don't want three different pieces of code calculating stock differently.

There should be one authoritative implementation of each business operation.

---

## Where we are now

We now have:

```text
BUSINESS
   ↓
UX
   ↓
DATA MODEL
   ↓
BUSINESS RULES
   ↓
BACKEND WORKFLOWS
```

The next step is **Component 13 — Frontend Architecture & Page Structure**.

That's where we'll turn the UX philosophy into an actual application structure:

```text
/login

/today
/sales
/sales/new
/sales/:id

/inventory
/inventory/:product

/transfers
/transfers/new
/transfers/:id

/customers
/customers/:id

/people
/attendance

/activity

/reports

/settings
```

But we'll design these as **workspaces and flows**, not generic CRUD pages, and we'll determine exactly what each role sees on each screen.
