Good. We’ll move from **architecture into the first working implementation slice**.

# Component 17 — Authentication + Seed Data + First Working Screen

The goal of this component is not to build a beautiful login page. The goal is to prove:

> **A real employee can log in → the server knows who they are → their role and branch are known → they see the correct Today screen.**

Once this works, the rest of the system has a trustworthy identity foundation.

---

## 17.1 The authentication model

We have three separate concepts:

```text
Employee
   ↓
User account
   ↓
Role / permissions
   ↓
Branch access
```

Example:

```text
Employee
John Mensah
EMP-001
        │
        ▼
User
john@example.com
        │
        ▼
Role
CASHIER
        │
        ▼
Branch assignment
Main Branch
```

Don't combine these into one table.

### Why?

Because an employee can exist without having login access.

For example:

```text
Employee:
Mary — Stockkeeper

User:
none
```

She can still exist in employee records and attendance, but cannot log into the system.

Later:

```text
Mary
  ↓
User created
  ↓
STOCKKEEPER role
```

---

# 17.2 Authentication vs authorization

These are different.

### Authentication

> "Who are you?"

Example:

```text
john@example.com
password
```

System verifies the credentials and creates a session.

### Authorization

> "What are you allowed to do?"

For example:

```text
John
CASHIER
Main Branch
```

He may:

```text
sales.create       ✓
sales.view         ✓
customers.create   ✓
inventory.adjust   ✗
price.change       ✗
employees.manage   ✗
```

The browser should **never** be trusted to decide this.

---

# 17.3 Don't build authentication yourself

This is one place where I strongly don't want you experimenting.

Don't write:

```ts
if (password === user.password) ...
```

Don't invent your own session token system.

Don't store passwords.

Use an established authentication solution compatible with Next.js.

For this project, I'd structure it around:

```text
Next.js
   ↓
Auth library
   ↓
User credentials
   ↓
Secure session
```

The exact auth provider/library can be selected during implementation based on the deployment setup, but our application should depend on an abstraction like:

```ts
getCurrentUser()
```

rather than having every page know how authentication works.

For example:

```ts
const user = await getCurrentUser();

if (!user) {
  redirect("/login");
}
```

The rest of the application doesn't care whether the underlying session mechanism changes later.

---

# 17.4 What should be inside the session?

Keep the session relatively small.

Conceptually:

```ts
type SessionUser = {
  id: string;
  employeeId: string;
  email: string;
};
```

Don't blindly put the entire employee, branch, permissions, etc. into a JWT/session.

Why?

Because roles and assignments can change.

Imagine:

```text
9:00 AM
John = CASHIER
```

Manager changes him:

```text
10:00 AM
John = STOCKKEEPER
```

If authorization information is permanently embedded in an old token, you can create dangerous stale permissions.

Instead:

```text
Session
   ↓
User ID
   ↓
Database
   ↓
Current employee
   ↓
Current roles
   ↓
Current branch access
   ↓
Permission check
```

For sensitive operations, the server gets the current truth.

---

# 17.5 Login flow

The login flow should be:

```text
                 ┌──────────────┐
                 │ Login screen │
                 └──────┬───────┘
                        │
                 email + password
                        │
                        ▼
                 Authenticate
                        │
                ┌───────┴────────┐
                │                │
             invalid           valid
                │                │
                ▼                ▼
             error          create session
                                 │
                                 ▼
                         load employee
                                 │
                                 ▼
                         load permissions
                                 │
                                 ▼
                              /today
```

---

# 17.6 Login UI

Keep it boring.

That's good.

```text
┌─────────────────────────────────┐
│                                 │
│          DRINKS SYSTEM          │
│                                 │
│   Sign in                       │
│                                 │
│   Email                         │
│   ┌─────────────────────────┐   │
│   │ john@example.com         │   │
│   └─────────────────────────┘   │
│                                 │
│   Password                      │
│   ┌─────────────────────────┐   │
│   │ •••••••••••             │   │
│   └─────────────────────────┘   │
│                                 │
│   [        Sign in          ]   │
│                                 │
│   Forgot password               │
│                                 │
└─────────────────────────────────┘
```

No dashboard information.

No giant registration form.

No role selector.

Especially:

### Never put this on the login page:

```text
Role:
[ CASHIER ▼ ]
```

A user should not be able to tell the system:

> "I'm a manager."

The database decides that.

---

# 17.7 What happens after login?

The server resolves:

```text
User
 ↓
Employee
 ↓
Role
 ↓
Branch assignments
```

Then the application redirects to:

```text
/today
```

The Today page gets its information from the authenticated user's context.

---

# 17.8 Seed data

Before building real UI, we need development data.

A fresh database should be able to become a usable development system with one command.

Conceptually:

```bash
npm run db:seed
```

It should create:

### Roles

```text
OWNER
MANAGER
CASHIER
STOCKKEEPER
```

### Permissions

Start with the permissions we actually need.

For example:

```text
sales.view
sales.create

inventory.view
inventory.receive
inventory.transfer
inventory.adjust

customers.view
customers.create
customers.payment

employees.view
employees.manage

attendance.view
attendance.correct

reports.view

activity.view

branches.manage

products.manage

prices.change
discounts.approve
returns.create
refunds.approve
cash.reconcile
```

Don't create 200 permissions now.

We can expand them as real workflows require them.

---

# 17.9 Role mapping

Initial mapping:

### OWNER

Everything.

### MANAGER

```text
sales.view
sales.create
inventory.view
inventory.receive
inventory.transfer
customers.view
customers.create
employees.view
attendance.view
attendance.correct
reports.view
activity.view
discounts.approve
returns.create
cash.reconcile
```

### CASHIER

```text
sales.view
sales.create
customers.view
customers.create
customers.payment
returns.create
```

### STOCKKEEPER

```text
inventory.view
inventory.receive
inventory.transfer
activity.view
```

The exact permission matrix can evolve.

The important architectural decision is:

> **Roles are collections of permissions.**

Don't scatter checks throughout the application like:

```ts
if (user.role === "MANAGER") ...
```

Prefer:

```ts
requirePermission(user, "inventory.transfer");
```

That gives us flexibility later.

---

# 17.10 Seed branches

Create development branches such as:

```text
MAIN
IKEJA
```

But don't create fake business history.

For example, don't seed:

```text
Main Branch
₦12,483,290 sales
```

unless we actually need demo data.

Initially:

```text
Main Branch
Ikeja Branch
```

is enough.

---

# 17.11 Seed employees

Create a small development organization.

Example:

```text
Owner
├── owner@example.test
│   └── OWNER
│
├── manager@example.test
│   └── MANAGER
│       ├── Main Branch
│       └── Ikeja Branch
│
├── cashier@example.test
│   └── CASHIER
│       └── Main Branch
│
└── stock@example.test
    └── STOCKKEEPER
        └── Main Branch
```

These should be clearly development accounts.

Do **not** put real production passwords into Git.

---

# 17.12 Seed credentials safely

For development, we can use environment variables.

For example:

```env
SEED_OWNER_PASSWORD=
SEED_MANAGER_PASSWORD=
SEED_CASHIER_PASSWORD=
SEED_STOCKKEEPER_PASSWORD=
```

Then:

```bash
npm run db:seed
```

The seed script hashes the password before putting it in the database.

The database gets:

```text
passwordHash
```

Never:

```text
password
```

---

# 17.13 Password hashing

Conceptually:

```text
User enters:

MyPassword123

        ↓

password hashing

        ↓

$argon2id$....

        ↓

database
```

When logging in:

```text
entered password
       ↓
verify against hash
       ↓
valid / invalid
```

You never decrypt a password.

There is nothing to decrypt.

---

# 17.14 First database migration

At this stage, our schema should contain the foundation we've already designed.

But there's an important rule:

### Don't keep changing the initial migration manually forever.

The workflow should be:

```text
change Prisma schema
       ↓
create migration
       ↓
apply migration
       ↓
test
```

For development:

```bash
npx prisma migrate dev
```

For production later:

```bash
npx prisma migrate deploy
```

---

# 17.15 Seed opening stock

Since stock comes from movements, don't do this:

```text
BranchProduct.stockQuantity = 500
```

Instead:

```text
InventoryMovement

type:
OPENING_STOCK

quantity:
500

branch:
Main

product:
Heineken

createdBy:
Owner
```

Then the stock calculation sees:

```text
+500 opening
-20 sale
+100 purchase
-10 damaged

=570
```

This is extremely important.

The database is storing the **history of stock events**, not merely today's number.

---

# 17.16 First working screen: Today

Once authentication works, the next test is `/today`.

For a cashier:

```text
┌───────────────────────────────────────────┐
│ Main Branch                 John     🔔    │
├─────────────┬─────────────────────────────┤
│ Today       │                             │
│ Sales       │ Good morning, John          │
│ Customers   │                             │
│             │ Today's sales               │
│             │ ┌─────────┐ ┌────────────┐ │
│             │ │ ₦85,000 │ │ 17 sales   │ │
│             │ └─────────┘ └────────────┘ │
│             │                             │
│             │ [ + New Sale ]              │
│             │                             │
│             │ Recent sales                │
│             │ ─────────────────────────── │
│             │ INV-MAIN-001   ₦12,000      │
│             │ INV-MAIN-002   ₦8,500       │
└─────────────┴─────────────────────────────┘
```

For the owner, completely different information can appear.

---

# 17.17 Don't build one universal dashboard

This is important.

We don't want:

```text
Dashboard
    27 cards
    4 charts
    11 tables
    19 filters
```

Instead:

### Owner Today

```text
Sales
Cash
Stock
Attendance
Alerts
Recent activity
```

### Manager Today

```text
Branch sales
Cash
Stock
Attendance
Pending approvals
Abnormal activity
```

### Cashier Today

```text
New Sale
Today's sales
Payments
Recent invoices
```

### Stockkeeper Today

```text
Low stock
Pending receipts
Pending transfers
Stock activity
```

Same `/today` route.

Different role-specific operational view.

---

# 17.18 Branch context

The top bar should show:

```text
Main Branch
```

For a cashier assigned only to Main:

```text
[ Main Branch ]
```

No dropdown.

There's nothing to choose.

For a manager assigned to:

```text
Main Branch
Ikeja Branch
```

the UI can show:

```text
[ Main Branch ▼ ]
```

The selected branch becomes an explicit application context.

But remember:

> The browser selecting `Main Branch` does not grant access to Main Branch.

The server checks:

```text
Does this employee actually have access to Main Branch?
```

---

# 17.19 Current user context

Create a central server-side function conceptually like:

```ts
getCurrentUserContext()
```

It should return something similar to:

```ts
{
  user: {
    id,
    email
  },

  employee: {
    id,
    employeeNumber,
    firstName,
    lastName
  },

  roles: [
    "CASHIER"
  ],

  permissions: [
    "sales.view",
    "sales.create",
    "customers.view"
  ],

  branches: [
    {
      id,
      code: "MAIN",
      name: "Main Branch"
    }
  ]
}
```

Now your server-side workflows can consistently use this context.

---

# 17.20 Authorization helper

Build this once.

Conceptually:

```ts
requirePermission("sales.create")
```

If the user doesn't have it:

```text
403 Forbidden
```

Not:

```text
return []
```

Not:

```text
hide button and hope
```

And not:

```text
if (role === "CASHIER")
```

The frontend can hide the button for convenience, but the backend must enforce it.

---

# 17.21 Branch authorization helper

We'll also need:

```ts
requireBranchAccess(branchId)
```

For example:

```text
Cashier
   ↓
POST /sales
   ↓
branchId = IKEJA
   ↓
Does cashier have IKEJA access?
   ↓
NO
   ↓
reject
```

Even if someone manually modifies the request.

---

# 17.22 Middleware vs business authorization

Don't put all authorization into Next.js middleware.

Middleware is useful for broad things like:

```text
Not logged in?
→ /login
```

But business authorization belongs close to the actual operation.

For example:

```text
POST /api/sales
       ↓
authenticate
       ↓
require sales.create
       ↓
require branch access
       ↓
validate input
       ↓
complete sale
```

That's much safer.

---

# 17.23 The first vertical slice

At the end of Component 17, we should be able to do this:

```text
1. Start application
       ↓
2. Open /login
       ↓
3. Login as cashier
       ↓
4. Session created
       ↓
5. Server identifies employee
       ↓
6. Server identifies role
       ↓
7. Server identifies branch
       ↓
8. Redirect /today
       ↓
9. Cashier sees cashier Today
```

And:

```text
Login as OWNER
       ↓
/today
       ↓
Owner Today
```

And:

```text
Cashier manually requests
manager-only endpoint
       ↓
403
```

That last test is extremely important.

---

# 17.24 Definition of done

Component 17 is **not finished** because the login page looks nice.

It's finished when these work:

### Authentication

* [ ] User can log in.
* [ ] Invalid credentials fail.
* [ ] Password isn't stored plaintext.
* [ ] Session persists across navigation.
* [ ] Logout works.
* [ ] Unauthenticated users cannot access `/today`.

### Identity

* [ ] User maps to employee.
* [ ] Employee has branch assignment.
* [ ] User has role.
* [ ] Role resolves to permissions.

### Authorization

* [ ] Permission helper exists.
* [ ] Branch access helper exists.
* [ ] Server rejects unauthorized operations.
* [ ] UI hides irrelevant actions but doesn't rely on that for security.

### Database

* [ ] Migration works from empty database.
* [ ] Seed script works.
* [ ] Development accounts are generated from environment values.
* [ ] Roles and permissions are seeded.
* [ ] Branches are seeded.
* [ ] Employees are seeded.
* [ ] Opening inventory is represented through movements.

### UI

* [ ] Login screen.
* [ ] App shell.
* [ ] Today screen.
* [ ] Role-specific Today.
* [ ] Branch context.
* [ ] Loading state.
* [ ] Error state.
* [ ] Empty state.

---

# Then Component 18

Once this is working, we move to the **first genuinely important business transaction**:

# New Sale → Complete Sale

This is where the architecture gets tested for real.

The workflow will be:

```text
Cashier
   ↓
New Sale
   ↓
Select customer / Walk-in
   ↓
Select product
   ↓
Enter quantity
   ↓
Server gets current branch price
   ↓
Server checks stock
   ↓
Server calculates totals
   ↓
Server creates Sale
   ↓
Server creates SaleItems
   ↓
Server creates Payment
   ↓
Server creates SALE inventory movements
   ↓
Server creates AuditLog
   ↓
COMMIT
```

All of that happens inside **one database transaction**.

If inventory fails:

```text
Sale ❌
Payment ❌
Inventory ❌
Audit ❌
```

Nothing partially succeeds.

That will be the point where this stops being a CRUD application and starts becoming the actual business system.
