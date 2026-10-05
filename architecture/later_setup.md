# Component 15 — Project Setup & Implementation Foundation

Now we're moving from design into **actual engineering**.

I want to make one change to our earlier approach:

> **We should not build every module one by one in isolation.**

Instead, we'll build **vertical slices**.

For example:

```text
Login
  ↓
Authenticated user
  ↓
Today
  ↓
New Sale
  ↓
Payment
  ↓
Inventory movement
  ↓
Audit event
```

If that entire path works, we know our architecture is actually working.

---

# 15.1 Stack

For the first implementation:

```text
Frontend
├── Next.js
├── TypeScript
├── Tailwind CSS
└── React

Backend
├── Next.js server-side code
├── Prisma
└── PostgreSQL

Validation
└── Zod

Testing
├── Vitest
└── Playwright

Development
├── Git
└── GitHub
```

We are intentionally **not** adding another backend framework yet.

Next.js can handle the frontend and backend application layer for this system.

---

# 15.2 Architecture

The overall project:

```text
Browser
   │
   ▼
Next.js
   │
   ├── UI
   │
   ├── Server Actions / Route Handlers
   │
   ├── Business Services
   │
   ├── Authorization
   │
   ├── Validation
   │
   └── Audit
   │
   ▼
Prisma
   │
   ▼
PostgreSQL
```

The important thing is that **Prisma isn't the business layer**.

For example, we don't want:

```text
UI
 ↓
prisma.sale.create()
```

directly.

Instead:

```text
UI
 ↓
completeSale()
 ↓
validate
 ↓
authorize
 ↓
business rules
 ↓
database transaction
 ↓
audit
```

That separation will save us later.

---

# 15.3 Project structure

I'd start with:

```text
src/
│
├── app/
│   ├── (auth)/
│   │   └── login/
│   │
│   ├── (dashboard)/
│   │   ├── today/
│   │   ├── sales/
│   │   ├── inventory/
│   │   ├── transfers/
│   │   ├── customers/
│   │   ├── people/
│   │   ├── attendance/
│   │   ├── activity/
│   │   ├── reports/
│   │   └── settings/
│   │
│   └── api/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── sales/
│   ├── inventory/
│   ├── transfers/
│   ├── customers/
│   └── activity/
│
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
│   ├── db/
│   ├── auth/
│   ├── permissions/
│   ├── validation/
│   ├── errors/
│   └── audit/
│
└── types/
```

The exact folders can evolve.

Don't become obsessed with folder architecture.

The important separation is:

```text
UI
Business logic
Database
```

---

# 15.4 Why `modules`?

Suppose we have sales.

Everything related to sales should have a natural home:

```text
modules/sales/
```

For example:

```text
modules/sales/
├── sales.service.ts
├── sales.validation.ts
├── sales.types.ts
├── sales.repository.ts
└── sales.test.ts
```

Then inventory:

```text
modules/inventory/
├── inventory.service.ts
├── inventory.validation.ts
├── inventory.types.ts
└── inventory.test.ts
```

This prevents our project from eventually becoming:

```text
utils.ts
utils2.ts
helper.ts
helper-final.ts
helper-final-2.ts
```

which happens surprisingly easily in inexperienced projects.

---

# 15.5 Database setup

Our first database should be PostgreSQL.

We'll have Prisma manage the schema.

Conceptually:

```text
PostgreSQL
      ▲
      │
    Prisma
      ▲
      │
Application
```

We should use migrations from day one.

For example:

```text
prisma/
├── schema.prisma
└── migrations/
```

Never casually modify production tables manually once the application is deployed.

---

# 15.6 Environment variables

We need to separate configuration from code.

Something conceptually like:

```text
DATABASE_URL=...
AUTH_SECRET=...
```

Later we'll add:

```text
APP_URL=...
```

and provider-specific configuration if needed.

### Never

```text
const password = "mypassword123";
```

### Never commit secrets to Git.

We'll also have:

```text
.env.local
```

ignored by Git.

And:

```text
.env.example
```

containing variable names but no real secrets.

---

# 15.7 Database IDs

Let's make a deliberate decision here.

We don't want users seeing:

```text
id = 738291
```

on invoices.

Internally, IDs can be UUIDs or another stable identifier.

Business-facing identifiers are separate.

For example:

```text
Database ID
c9c8...uuid...

Invoice number
INV-MAIN-20260930-0012
```

Same concept for transfers:

```text
TR-MAIN-IKE-20260930-0004
```

The exact format can be finalized later.

The important distinction is:

> **Database identity ≠ business reference.**

---

# 15.8 Money representation

This is important.

Don't store money as JavaScript floating-point numbers.

Bad:

```text
138000.50
```

as a floating number.

We need exact monetary representation.

With PostgreSQL/Prisma, we can use a decimal type.

Conceptually:

```text
Decimal
```

Then:

```text
₦138,000.00
```

isn't vulnerable to ordinary floating-point calculation problems.

The server calculates financial totals.

---

# 15.9 Quantity representation

Our current MVP uses whole selling units:

```text
3 crates
15 packs
```

So initially quantities can be integers.

But we should think ahead.

If the business later sells:

```text
0.5 crate
```

or starts tracking individual bottles, we may need a more flexible quantity model.

For MVP:

```text
quantity = integer
```

is appropriate because it matches the actual business process we documented.

Don't solve a future problem today.

---

# 15.10 Product pricing

Remember:

```text
Product
     │
     └── BranchProduct
             │
             └── current selling price
```

Why?

Because:

```text
Heineken
Main Branch → ₦38,000
Ikeja Branch → ₦39,000
```

could eventually be valid.

And historical sales retain:

```text
SaleItem.unitPrice
```

So if the price changes tomorrow:

```text
₦38,000 → ₦40,000
```

yesterday's invoice remains:

```text
₦38,000
```

---

# 15.11 Authentication

Authentication should establish:

```text
Who are you?
```

Authorization establishes:

```text
What are you allowed to do?
```

These are different.

Example:

```text
Daniel logs in
      ↓
User = Daniel
      ↓
Employee = Daniel
      ↓
Role = CASHIER
      ↓
Branch = Main Branch
      ↓
Permissions = sales.create, sales.view...
```

A user should never be able to send:

```text
role = OWNER
```

from the browser and magically become an owner.

The server determines their role.

---

# 15.12 Authorization helper

Conceptually, we want something like:

```text
requirePermission(
    user,
    "sales.create",
    branchId
)
```

It checks:

```text
Is authenticated?
        ↓
Has permission?
        ↓
Has access to branch?
        ↓
Continue
```

Otherwise:

```text
403 Forbidden
```

This logic should be reusable everywhere.

---

# 15.13 Validation

We'll use a schema validation layer.

For example, a sale request conceptually contains:

```text
customerId
items[]
payment
```

Each item:

```text
productId
quantity
```

The validation layer checks basic input shape.

Then business logic checks deeper rules.

### Validation

```text
quantity must be > 0
```

### Business rule

```text
Does the branch actually have enough stock?
```

Those aren't the same thing.

---

# 15.14 Error handling

We need business-friendly errors.

For example:

Instead of:

```text
PrismaClientKnownRequestError:
Unique constraint failed on Sale_invoiceNumber_key
```

the user sees:

```text
We couldn't create this invoice.

Please try again.
```

Meanwhile, developers get the technical error in logs.

For expected business failures:

```text
InsufficientStockError
PermissionDeniedError
InvalidTransferStateError
DiscountApprovalRequiredError
```

the UI can display useful messages.

---

# 15.15 Database transactions

This is probably the most important backend concept we'll implement.

When completing a sale:

```text
Create sale
Create sale items
Create payment
Reduce inventory
Create audit event
```

These operations belong together.

We don't want:

```text
Sale created ✓
Payment created ✓
Inventory update failed ✗
```

and suddenly the business has a sale that didn't reduce stock.

Instead:

```text
BEGIN TRANSACTION

Create sale
Create items
Create payment
Create inventory movements
Create audit event

COMMIT
```

If something fails:

```text
ROLLBACK
```

Everything rolls back.

---

# 15.16 The first real business workflow

This is what we're going to implement first.

## Complete Sale

```text
Cashier
  ↓
New Sale
  ↓
Select customer
  ↓
Select products
  ↓
Enter quantities
  ↓
Server fetches prices
  ↓
Server checks stock
  ↓
Server calculates total
  ↓
Payment recorded
  ↓
Sale created
  ↓
Inventory movement created
  ↓
Audit event created
  ↓
Success
```

This single workflow touches:

```text
Authentication
Authorization
Branches
Products
Inventory
Sales
Payments
Audit
Database transactions
Frontend
```

That's why it's the right first vertical slice.

---

# 15.17 Idempotency

There's another subtle problem.

Imagine the cashier presses:

```text
[Complete Sale]
```

and the network is slow.

They press it again.

Without protection:

```text
Sale #1
Sale #2
```

Now you've accidentally sold twice.

We need idempotency for sensitive operations.

Conceptually:

```text
requestId = unique value
```

The server remembers that it already processed that request.

Second identical request:

```text
Already processed.
Return existing result.
```

This becomes especially important for:

* sales
* payments
* refunds
* transfers
* stock receiving

---

# 15.18 Audit architecture

The audit system should not depend on someone remembering:

```text
await createAuditLog(...)
```

in every random UI component.

Business services should explicitly produce audit events.

For example:

```text
completeSale()
```

does:

```text
create sale
create payment
create inventory movement
record audit event
```

This means the important business workflow owns its evidence.

---

# 15.19 Testing strategy

We don't need 100% test coverage.

We need **high confidence around important business rules**.

### Unit tests

Test things like:

```text
calculateSaleTotal()
calculateCashDifference()
calculateCustomerBalance()
validateTransferTransition()
```

### Integration tests

Test:

```text
Complete sale
Receive transfer
Record payment
Create stock adjustment
```

against a test database.

### End-to-end tests

Use Playwright for critical journeys:

```text
Login
→ New sale
→ Complete payment
→ Verify invoice
→ Verify stock changed
```

That's far more valuable than testing whether a random button has a border.

---

# 15.20 Git strategy

Don't wait until the application is finished before using Git.

From the first day:

```text
main
```

should always represent a reasonably working state.

Feature branches:

```text
feature/auth
feature/sales
feature/inventory
feature/transfers
```

Commit messages should explain what changed:

```text
feat: add sale creation workflow
fix: prevent negative inventory
feat: add branch authorization
```

Not:

```text
update
stuff
changes
final
final2
```

---

# 15.21 Development workflow

For every feature:

```text
1. Define business rule
2. Define database changes
3. Define server workflow
4. Define validation
5. Define permissions
6. Build UI
7. Add tests
8. Test manually
9. Commit
```

Don't start by opening VS Code and immediately writing JSX.

That's how projects become spaghetti.

---

# 15.22 Our first implementation milestone

We're going to aim for this:

```text
MILESTONE 1

✓ Project boots
✓ Database connected
✓ Authentication works
✓ User can log in
✓ User has role
✓ User has branch
✓ Today loads
✓ Product exists
✓ Stock exists
✓ Cashier can create sale
✓ Payment recorded
✓ Inventory decreases
✓ Audit event created
✓ Sale appears in history
```

Once that works, we have a real foundation.

---

# 15.23 Then the next slices

### Milestone 2

```text
Inventory
├── Receive stock
├── Stock count
├── Damaged
└── Expired
```

### Milestone 3

```text
Transfers
├── Request
├── Approve
├── Dispatch
└── Receive
```

### Milestone 4

```text
Customers
├── Customer records
├── Credit sales
├── Payments
└── Returns
```

### Milestone 5

```text
People
├── Employees
├── Branch assignment
├── Attendance
└── Corrections
```

### Milestone 6

```text
Cash
├── Reconciliation
├── Handover
└── Discrepancy investigation
```

### Milestone 7

```text
Reports
Activity
Alerts
```

That's a much safer development path than trying to build the whole system simultaneously.

---

# 15.24 One thing I would change from our original plan

We previously listed a lot of database entities.

**Do not create all of them immediately.**

We'll introduce tables as the corresponding vertical slice needs them.

For the first slice, we primarily need:

```text
User
Employee
Branch
Role
Product
BranchProduct
Sale
SaleItem
Payment
InventoryMovement
AuditLog
```

Then we migrate forward.

This keeps the database understandable while we're still learning from the real workflow.

---

# 15.25 What we're ready to build

Our current architecture is:

```text
                    ┌───────────────┐
                    │    Browser    │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │    Next.js    │
                    │               │
                    │ UI            │
                    │ Server        │
                    │ Auth          │
                    │ Validation    │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Business      │
                    │ Services      │
                    │               │
                    │ Sales         │
                    │ Inventory     │
                    │ Payments      │
                    │ Audit         │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │    Prisma     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ PostgreSQL    │
                    └───────────────┘
```

And the first actual feature is:

```text
             CASHIER
                │
                ▼
           ┌─────────┐
           │ New Sale│
           └────┬────┘
                │
                ▼
       ┌─────────────────┐
       │ Complete Sale   │
       │ Server Workflow │
       └───────┬─────────┘
               │
       ┌───────┼───────────┐
       ▼       ▼           ▼
     Sale    Payment    Inventory
       │       │           │
       └───────┼───────────┘
               ▼
             Audit
               │
               ▼
            Success
```

**Next is Component 16: we actually define the initial Prisma schema and database relationships.** That's the point where our architecture becomes concrete code, and we'll be careful about the exact relationships, constraints, indexes, enums, and transaction boundaries rather than blindly translating our earlier entity list into tables.
