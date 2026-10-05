## Component 13 — Frontend Architecture & Page Structure

Now we turn the backend/business rules into an interface that people can actually use every day.

The goal is **not** to build a collection of CRUD pages.

The goal is:

> **Show me what matters → let me act → explain what happened.**

---

# 13.1 The overall application structure

I would structure the frontend around **workspaces**, not database entities.

```text
App
│
├── Today
├── Sales
├── Stock
├── Customers
├── People
├── Activity
├── Reports
└── Settings
```

The important distinction is:

### Bad mental model

```text
Products
Customers
Payments
InventoryMovements
Sales
Employees
Attendance
...
```

That is how developers think about the database.

### Better mental model

```text
What is happening today?
What do I need to sell?
What stock do I have?
Who owes money?
Who is working?
What went wrong?
What needs my attention?
```

That's how the business thinks.

---

# 13.2 The application shell

Every authenticated screen uses the same basic shell.

```text
┌──────────────────────────────────────────────────────────────┐
│ Branch: Main Branch ▼    Search...       🔔  User ▼          │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│  TODAY       │                                               │
│  SALES       │               PAGE CONTENT                    │
│  STOCK       │                                               │
│  CUSTOMERS   │                                               │
│  PEOPLE      │                                               │
│  ACTIVITY    │                                               │
│  REPORTS     │                                               │
│              │                                               │
│  SETTINGS    │                                               │
│              │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

### Left sidebar

Navigation.

### Top bar

Context.

It should answer:

* Which branch am I looking at?
* Who am I logged in as?
* Are there important alerts?
* Can I search something?

### Main content

The current workspace.

---

# 13.3 Branch context is extremely important

Suppose a manager manages:

```text
Main Branch
Ikeja Branch
Yaba Branch
```

The top bar could show:

```text
Branch: All Branches ▼
```

Selecting:

```text
Main Branch
```

changes the context of the page.

For a cashier assigned only to Main Branch:

```text
Branch: Main Branch
```

There should be **no branch selector**.

The backend already knows:

```text
user → employee → branch assignment
```

This prevents a cashier from accidentally—or intentionally—working under another branch.

---

# 13.4 Role-based navigation

The interface should not expose everything to everybody.

### Owner

```text
Today
Sales
Stock
Customers
People
Activity
Reports
Settings
```

### Manager

```text
Today
Sales
Stock
Customers
People
Activity
Reports
```

### Cashier

```text
Today
Sales
Customers
```

Potentially:

```text
My Activity
```

but not the full audit system.

### Stockkeeper

```text
Today
Stock
Transfers
Activity
```

The backend still enforces permissions.

The frontend is simply making the interface less confusing.

---

# 13.5 "Today" is the most important screen

This should probably be the first screen after login.

Not a generic analytics dashboard.

It should answer:

> **"What is happening right now?"**

---

## Owner's Today

Example:

```text
TODAY
Wednesday, September 30

Sales
₦1,284,500
38 transactions

Cash
Expected       ₦720,000
Actual         ₦698,000
Difference     -₦22,000  ⚠

Stock
3 products low
1 stock discrepancy

Attendance
18 present
2 late
1 absent

Attention
────────────────────────────
⚠ ₦22,000 cash discrepancy
⚠ 45 crates missing at Ikeja
⚠ 3 invoice corrections
⚠ 2 attendance corrections

Recent activity
────────────────────────────
10:42  Sale #INV-10291
10:38  Stock transfer received
10:31  Discount approved
10:20  Cash reconciliation
```

And here's the important part:

**Those numbers are clickable.**

Click:

```text
₦22,000 difference
```

and go directly to the reconciliation.

Click:

```text
45 crates missing
```

and go directly to the stock discrepancy.

Click:

```text
3 invoice corrections
```

and see them.

The dashboard isn't just reporting information.

It is **navigation into the business**.

---

# 13.6 Cashier's Today

Much simpler.

```text
Good morning, Daniel

Main Branch

┌─────────────────────┐
│                     │
│     + New Sale      │
│                     │
└─────────────────────┘

Today's Sales
₦284,500

Transactions
17

Payments
Cash       ₦180,000
Transfer   ₦104,500

Recent Sales
──────────────────
INV-1031   ₦38,000
INV-1030   ₦12,000
INV-1029   ₦82,500
```

The cashier doesn't need:

```text
Inventory movement analysis
Employee audit logs
Role management
Branch administration
```

That would just create cognitive noise.

---

# 13.7 Stockkeeper's Today

Different information.

```text
Stock

Low Stock
──────────────────
Heineken       8 crates
Malt           12 packs
Nutri Milk     5 crates

Pending Transfers
──────────────────
Main → Ikeja       40 crates
Yaba → Main        20 crates

Today's Activity
──────────────────
Received shipment
Transferred stock
Recorded damaged stock
```

Then:

```text
+ Receive Stock
+ Create Transfer
+ Record Damage
```

Again:

**information + operation.**

---

# 13.8 Sales workspace

`/sales`

This should not just be:

```text
Sale ID | Customer | Amount | Date
```

Instead:

```text
Sales
────────────────────────────────────────

[ + New Sale ]

Today
₦1,284,500
38 sales

Search invoice/customer...

Filters:
[ Today ▼ ] [ Branch ▼ ] [ Payment ▼ ]

────────────────────────────────────────

Invoice      Customer       Amount       Status
INV-10291    ABC Ltd        ₦82,500      Paid
INV-10290    Walk-in        ₦38,000      Paid
INV-10289    XYZ Store      ₦120,000     Credit
```

Clicking a sale opens:

```text
Sale #INV-10291

ABC Restaurant
Main Branch
Cashier: Daniel
30 Sep 2026, 10:42

Items
────────────────────────
3 × Heineken     ₦114,000
2 × Malt          ₦24,000

Subtotal          ₦138,000
Discount            ₦0
Total             ₦138,000

Payment
Cash              ₦138,000
Status            PAID

[Print Invoice]
[Return]
[Void]     ← only if authorized
```

---

# 13.9 New Sale should feel like a POS

This is one of the most important interfaces in the entire application.

Don't make this a giant form.

Instead:

```text
New Sale

Customer
[ Walk-in Customer ▼ ]

Add products
┌──────────────────────────────────────┐
│ Search product...                    │
└──────────────────────────────────────┘

Heineken
₦38,000 / crate

[ − ]   3   [ + ]

Malt
₦5,500 / pack

[ − ]   2   [ + ]

────────────────────────

Subtotal       ₦125,000
Discount       ₦0

TOTAL          ₦125,000

[Complete Sale]
```

The cashier should mostly be:

> search → select → quantity → pay → complete.

Not:

> manually enter product ID → enter price → calculate subtotal → calculate tax → calculate total...

The computer should do the boring work.

---

# 13.10 Important interaction: price visibility

When the cashier selects:

```text
Heineken
```

the system displays:

```text
₦38,000 / crate
```

But there should be no editable price field.

If the cashier tries to change it, the UI can say:

```text
Price is controlled by the system.

Need a different price?
Request a discount.
```

Then:

```text
Discount requested

Amount: ₦2,000

Reason:
[ Customer buying large quantity ]

[Request Approval]
```

Depending on the business rules, certain discounts can require manager approval.

---

# 13.11 Inventory workspace

`/inventory`

Think of this as a **stock control center**.

```text
Inventory

[ Receive Stock ] [ Transfer ] [ Stock Count ]

Search products...

Filters:
[ Branch ] [ Category ] [ Stock Status ]

────────────────────────────────────────

Product       Available     Status

Heineken      82 crates     ● Healthy
Malt          14 packs      ⚠ Low
Nutri Milk     5 crates      ⚠ Critical
Pepsi         64 crates     ● Healthy
```

Clicking Heineken:

```text
Heineken

Main Branch

Available
82 crates

Reorder level
20 crates

────────────────────

Stock activity

+100 Purchase
-10 Sale
-15 Transfer
+7 Return
-2 Damaged

Current
82
```

This is where our event-based inventory design becomes very useful.

The user can actually understand:

> **Why is the stock 82?**

---

# 13.12 Stock history should tell a story

Instead of showing:

```text
Stock = 82
```

show:

```text
82 crates

How we got here:

Opening              +50
Purchase             +100
Sales                -55
Transfer out         -15
Damaged               -2
Return                +4
────────────────────────
Current               82
```

Then clicking an event opens its source.

For example:

```text
Transfer #TR-1023

Main Branch → Ikeja Branch

Sent: 15 crates
Received: 15 crates

Dispatched by: Michael
Received by: Sarah
```

Now the inventory system becomes an **explanation system**, not just a number system.

---

# 13.13 Transfers workspace

`/transfers`

```text
Stock Transfers

[ + New Transfer ]

Pending
────────────────────────

TR-1023
Main → Ikeja
15 crates Heineken
APPROVED

TR-1024
Main → Yaba
30 crates Malt
IN TRANSIT

Completed
────────────────────────

TR-1020
Main → Ikeja
RECEIVED
```

Open a transfer:

```text
TR-1023

Main Branch
      ↓
Ikeja Branch

Requested
     ✓
Approved
     ✓
Dispatched
     ✓
Received
     ✓

Items

Heineken
Sent       15
Received   15

Malt
Sent       20
Received   18
⚠ Difference: 2
```

That difference becomes an investigation point.

---

# 13.14 Customers workspace

`/customers`

Keep it simple.

```text
Customers

[ + Customer ]

Search...

ABC Restaurant
₦120,000 outstanding

XYZ Stores
₦0 outstanding

John Doe
₦35,000 outstanding
```

Open:

```text
ABC Restaurant

Contact
080...

Credit Limit
₦500,000

Outstanding
₦120,000

────────────────────

Transactions

30 Sep   Sale      +₦150,000
30 Sep   Payment   -₦30,000

Balance             ₦120,000
```

The balance isn't an editable field.

It's the result of transactions.

---

# 13.15 People workspace

This is where employees live.

```text
People

Employees
────────────────────────

Name          Role        Branch       Status

Daniel        Cashier     Main         Active
Sarah         Manager     Ikeja        Active
Michael       Stockkeeper Main         Active
```

Open Daniel:

```text
Daniel Okafor

Cashier
Main Branch
Active

────────────────

Attendance
Sales
Activity
Branch Assignment

[Transfer Branch]
[Deactivate Employee]
```

The employee profile becomes a hub.

---

# 13.16 Attendance

`/attendance`

Manager sees:

```text
Attendance
30 September

Main Branch

Present     12
Late         2
Absent       1
Incomplete   1

────────────────────────

Employee       Clock In    Status

Daniel         08:02       Present
Michael        08:17       Late
John           —           Absent
Sarah          07:55       Present
```

Clicking:

```text
Michael — Late
```

opens:

```text
Michael

Scheduled: 08:00
Clocked in: 08:17

Late by: 17 minutes

[Request Correction]
```

If correction occurs:

```text
Original: 08:17
Corrected: 08:00

Reason:
"System clock issue"

Requested by: Manager
Approved by: Owner
```

The original value never disappears.

---

# 13.17 Activity workspace

This is one of the most powerful screens.

`/activity`

Think of it as:

> **"Show me what happened."**

```text
Activity

Filters
[ Branch ] [ Employee ] [ Action ] [ Date ]

────────────────────────────────────

10:42  Daniel
Created sale INV-10291
₦138,000

10:38  Sarah
Received transfer TR-1023

10:31  Sarah
Approved ₦5,000 discount

10:20  Michael
Recorded 2 damaged crates

10:10  Daniel
Failed permission check:
Attempted price modification
```

Notice the last one.

We can record suspicious/unauthorized attempts without claiming the employee stole anything.

The system records **evidence**.

Management decides what it means.

---

# 13.18 Activity severity

We can visually distinguish:

```text
Normal
Attention
Critical
```

Examples:

### Normal

```text
Sale created
Payment received
Stock received
Clock in
```

### Attention

```text
Discount approved
Attendance corrected
Stock adjustment
Invoice correction
```

### Critical

```text
Large cash discrepancy
Large stock discrepancy
Repeated unauthorized attempts
```

But don't make the interface scream "FRAUD" every time something unusual happens.

The system should say:

> **Something needs investigation.**

Not:

> **This employee stole money.**

That's an important product-design distinction.

---

# 13.19 Reports

Reports shouldn't be a huge menu of 50 reports.

Start with business questions.

```text
Reports

Sales
└── What did we sell?

Cash
└── Where did the money go?

Stock
└── Where did the goods go?

People
└── Who was working?

Customers
└── Who owes us?

Activity
└── What happened?
```

This is much easier for a business owner to understand.

---

# 13.20 Drill-down is the secret sauce

Suppose the owner sees:

```text
Cash discrepancy
-₦22,000
```

Click it.

```text
Cash Reconciliation

Expected
₦720,000

Actual
₦698,000

Difference
-₦22,000
```

Then:

```text
Why?

Cash sales:
₦650,000

Cash refunds:
-₦10,000

Other cash:
₦80,000

Expected:
₦720,000
```

Then click a suspicious refund:

```text
Refund #RF-1021

Original sale:
INV-9982

Amount:
₦10,000

Customer:
ABC Restaurant

Approved by:
Sarah

Reason:
Damaged goods
```

Now the owner can move from:

**summary → explanation → original event**

without manually searching through five different tables.

That's the experience we want.

---

# 13.21 Reusable frontend components

We should build a small design system rather than styling every page independently.

Core components:

```text
Button
Input
Select
SearchInput
Modal
Drawer
Dropdown
Tabs
Badge
StatusBadge
Card
DataTable
EmptyState
LoadingState
ErrorState
ConfirmDialog
DatePicker
Pagination
Toast
Alert
MetricCard
ActivityItem
Timeline
```

Then business components:

```text
ProductSelector
CustomerSelector
BranchSelector
EmployeeSelector
MoneyDisplay
StockStatus
PaymentMethodSelector
InvoiceSummary
SaleItemRow
StockMovementTimeline
TransferStatus
ApprovalPanel
AuditTimeline
```

This gives us consistency without building some giant design framework.

---

# 13.22 Loading, empty and error states

This is often ignored by beginners.

Every important screen needs at least:

### Loading

```text
Loading sales...
```

Prefer skeletons where appropriate.

### Empty

```text
No sales today.

[Create First Sale]
```

### Error

```text
We couldn't load today's sales.

[Try Again]
```

### Success

```text
Sale completed successfully.

Invoice #INV-10291
[View Invoice]
```

The interface should always tell the user what happened.

---

# 13.23 Mobile

We should make the application responsive, but **not pretend the phone is a desktop**.

Desktop:

```text
Sidebar
Main workspace
```

Mobile:

```text
┌───────────────────────┐
│ Main Branch       🔔  │
├───────────────────────┤
│                       │
│       Content         │
│                       │
│                       │
├───────────────────────┤
│ Today Sales Stock More│
└───────────────────────┘
```

For cashier, mobile/tablet usage could be especially important.

But we shouldn't build separate mobile and desktop applications.

One responsive web app first.

---

# 13.24 The frontend architecture

At the code level, I'd keep the same modular structure as the backend.

```text
src/
│
├── app/
│   ├── login/
│   ├── today/
│   ├── sales/
│   ├── inventory/
│   ├── transfers/
│   ├── customers/
│   ├── people/
│   ├── attendance/
│   ├── activity/
│   ├── reports/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── sales/
│   ├── inventory/
│   ├── customers/
│   ├── people/
│   └── activity/
│
├── modules/
│   ├── sales/
│   ├── inventory/
│   ├── customers/
│   ├── attendance/
│   └── ...
│
└── lib/
    ├── auth/
    ├── permissions/
    ├── api/
    ├── validation/
    └── formatting/
```

The exact Next.js route structure can be refined when we actually start coding.

---

# 13.25 One important architectural rule

Don't put business logic into React components.

For example, **don't** do this conceptually:

```text
React component:
"if cashier then calculate sale..."
```

Instead:

```text
UI
 ↓
Server action/API
 ↓
Business service
 ↓
Database
```

The UI can display:

```text
Price: ₦38,000
```

But the server decides:

```text
Is this user allowed?
Is this product available?
What is the real price?
Is there enough stock?
What is the total?
Can this discount happen?
```

The frontend is the interface.

The backend is the authority.

---

# 13.26 Our frontend interaction philosophy

I want us to consistently follow these five rules:

### 1. Don't make users enter information the system already knows.

Bad:

```text
Select branch
Enter cashier
Enter date
```

when the system already knows all three.

---

### 2. Don't make users calculate things the system can calculate.

Bad:

```text
Price × quantity = ?
Subtotal + discount = ?
```

The system handles it.

---

### 3. Don't make users navigate to another page unnecessarily.

If I am looking at:

```text
Stock discrepancy
```

I should be able to inspect the relevant transfer directly.

---

### 4. Don't hide important consequences.

If someone records:

```text
2 damaged crates
```

show the effect:

```text
Available stock: 82 → 80
```

---

### 5. Don't turn every operation into a form.

Some operations should feel like workflows.

For example:

```text
Receive Transfer
```

should be:

```text
What arrived?

Heineken
Expected: 20
Received: [18]

Malt
Expected: 10
Received: [10]

[Confirm Receipt]
```

Not a generic database form.

---

# 13.27 The frontend is now conceptually complete

Our architecture is becoming:

```text
                    ┌───────────────┐
                    │     USER      │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   FRONTEND    │
                    │               │
                    │ Information   │
                    │ Operation     │
                    │ Navigation    │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │    BACKEND    │
                    │               │
                    │ Auth          │
                    │ Permissions   │
                    │ Validation    │
                    │ Business rules│
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  PostgreSQL   │
                    │               │
                    │ Master data   │
                    │ Business      │
                    │ events        │
                    │ Audit evidence│
                    └───────────────┘
```

And the user's journey becomes:

```text
LOGIN
  ↓
TODAY
  ↓
Understand what's happening
  ↓
Take an action
  ↓
Backend validates it
  ↓
Business event recorded
  ↓
Audit recorded
  ↓
UI reflects the result
  ↓
Owner/manager can investigate later
```

That is the foundation I'd want before writing the actual UI.

