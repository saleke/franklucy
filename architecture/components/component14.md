Absolutely. Let's lock down the **visual system and screen behavior** before implementation.

# Component 14 — Design System + Exact Screen Wireframes

The goal here is not to make the app look fancy.

It is to make it:

* fast to understand
* hard to misuse
* consistent
* comfortable for daily work
* clear when something goes wrong

---

# 14.1 Design language

I would use a **clean business application style**.

Think:

```text
Not:
"Corporate enterprise software from 2012"

Also not:
"Fancy startup dashboard"

Instead:
"Modern tool that someone can use for 8 hours without getting tired."
```

### Visual priorities

1. Information hierarchy
2. Readability
3. Clear actions
4. Status visibility
5. Consistency
6. Speed

Decoration comes last.

---

# 14.2 Layout dimensions

We'll establish a few basic rules.

### Desktop

```text
Sidebar:      ~240px
Top bar:       ~64px
Content max:  ~1400px
Page padding: 24px
```

### Mobile

```text
Top bar:      ~56px
Bottom nav:   ~64px
Page padding: 16px
```

We don't need dozens of spacing values.

Use a small spacing scale:

```text
4
8
12
16
24
32
48
64
```

This keeps the application visually consistent.

---

# 14.3 Typography

Keep it simple.

```text
Page title       28px / bold
Section title    20px / semibold
Card title       16px / semibold
Body             14–16px
Secondary text   13–14px
Small metadata   12px
```

The important thing is hierarchy.

For example:

```text
₦1,284,500
38 transactions today
```

The amount should immediately dominate the secondary information.

---

# 14.4 Color semantics

Don't use colors just because they look nice.

Use them to communicate meaning.

```text
Normal       → neutral
Success      → green semantic
Warning      → amber semantic
Critical     → red semantic
Information  → blue semantic
```

For example:

```text
● Paid
● Received
● Active

⚠ Pending
⚠ Low stock
⚠ Discrepancy

✕ Failed
✕ Cancelled
```

And importantly:

**Never communicate important status through color alone.**

Use:

```text
⚠ Low stock
```

not merely a yellow dot.

---

# 14.5 Buttons

We should keep button hierarchy strict.

### Primary

The main thing the user should do.

```text
[ + New Sale ]
```

### Secondary

Useful but not the main action.

```text
[ Export ]
```

### Destructive

Potentially irreversible.

```text
[ Void Sale ]
```

### Text/action

Small contextual operations.

```text
View details →
```

Don't have ten buttons competing for attention.

---

# 14.6 Cards

Cards should represent meaningful pieces of information.

Good:

```text
┌─────────────────────────┐
│ Today's Sales           │
│                         │
│ ₦1,284,500              │
│ 38 transactions         │
└─────────────────────────┘
```

Bad:

```text
┌─────────────────┐
│ id: 1928        │
│ updated: ...    │
│ branchId: ...   │
│ status: ...     │
└─────────────────┘
```

Technical information belongs in detail views.

---

# 14.7 Status badges

Standardize them.

```text
PAID
PARTIALLY PAID
UNPAID

REQUESTED
APPROVED
IN TRANSIT
RECEIVED
CANCELLED

ACTIVE
INACTIVE

PRESENT
LATE
ABSENT
INCOMPLETE
```

This is important because the application will have many state machines.

---

# 14.8 Screen 1 — Today

Let's make this concrete.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Main Branch ▼                     Search        🔔   Daniel ▼     │
├───────────────┬──────────────────────────────────────────────────┤
│               │                                                  │
│ TODAY         │  Good morning, Daniel                            │
│               │  Wednesday, 30 September                         │
│ SALES         │                                                  │
│ STOCK         │  ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│ CUSTOMERS     │  │ Sales      │ │ Cash       │ │ Stock      │   │
│ PEOPLE        │  │ ₦1.28m     │ │ ₦698k      │ │ 3 low      │   │
│ ACTIVITY      │  │ 38 sales   │ │ ⚠ -₦22k    │ │ ⚠ items    │   │
│ REPORTS       │  └────────────┘ └────────────┘ └────────────┘   │
│               │                                                  │
│ SETTINGS      │  Needs attention                                 │
│               │  ┌──────────────────────────────────────────┐   │
│               │  │ ⚠ Cash discrepancy            ₦22,000 → │   │
│               │  │ ⚠ Stock discrepancy            45 →     │   │
│               │  │ ⚠ Invoice corrections            3 →    │   │
│               │  └──────────────────────────────────────────┘   │
│               │                                                  │
│               │  Recent activity                                │
│               │  ──────────────────────────────────────────────  │
│               │  10:42  Sale completed           INV-10291     │
│               │  10:38  Transfer received        TR-1023       │
│               │  10:31  Discount approved        ₦5,000        │
└───────────────┴──────────────────────────────────────────────────┘
```

The key design decision:

### Every important metric is an entrance into another workflow.

The dashboard isn't the destination.

It's the map.

---

# 14.9 Screen 2 — New Sale

This deserves special attention.

```text
┌──────────────────────────────────────────────────────────┐
│ New Sale                                      Main Branch │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Customer                                                 │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Walk-in Customer                              ▼      │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Add products                                             │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 🔍 Search product...                                 │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Heineken                               ₦38,000/crate │ │
│ │                                                      │ │
│ │                         [ − ]  3  [ + ]              │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Nutri Milk                            ₦12,000/crate  │ │
│ │                                                      │ │
│ │                         [ − ]  2  [ + ]              │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ Order summary                                            │
│                                                          │
│ Subtotal                                    ₦138,000    │
│ Discount                                    ₦0           │
│                                                          │
│ TOTAL                                       ₦138,000    │
│                                                          │
│ Payment                                                 │
│ [ Cash ] [ Bank Transfer ] [ Other ]                    │
│                                                          │
│                         [ Cancel ] [ Complete Sale ]     │
└──────────────────────────────────────────────────────────┘
```

The cashier should rarely need to touch a keyboard beyond searching.

---

# 14.10 Quantity interaction

We shouldn't force users to click `+` twenty times for a large order.

Allow direct quantity input too.

```text
[ − ]   [ 20 ]   [ + ]
```

But validate it.

If stock is:

```text
Available: 15 crates
```

and they enter:

```text
20
```

show immediately:

```text
⚠ Only 15 crates available
```

The backend still checks it when the sale is submitted.

The frontend is for fast feedback.

The backend is for authority.

---

# 14.11 Payment step

For a simple cash sale:

```text
Payment

Total
₦138,000

Method
● Cash
○ Bank Transfer
○ Other

Amount received
[ ₦150,000 ]

Change
₦12,000

[Complete Sale]
```

For exact cash:

```text
Amount received
₦138,000

Change
₦0
```

For bank transfer:

```text
Method
Bank Transfer

Reference
[ TRX-982738 ]

Amount
₦138,000
```

Remember: recording a transfer reference does **not** automatically mean the bank transfer has been verified.

---

# 14.12 Sale completion

After success:

```text
┌──────────────────────────────────────┐
│          ✓ Sale completed            │
│                                      │
│ Invoice #INV-10291                   │
│                                      │
│ Total                     ₦138,000   │
│ Paid                      ₦138,000   │
│                                      │
│ [ View Invoice ]  [ New Sale ]       │
└──────────────────────────────────────┘
```

Don't dump the cashier back onto the sales list.

Give them the obvious next action:

> New Sale.

---

# 14.13 Screen 3 — Sale Details

```text
Sale #INV-10291
PAID

ABC Restaurant
Main Branch
30 Sep 2026 · 10:42

────────────────────────────────────────

Items

Heineken
3 × ₦38,000                         ₦114,000

Nutri Milk
2 × ₦12,000                          ₦24,000

────────────────────────────────────────

Subtotal                             ₦138,000
Discount                                   ₦0
TOTAL                                ₦138,000

Payment
Cash                                 ₦138,000

────────────────────────────────────────

Created by
Daniel

[ Print ] [ Return ] [ More ▼ ]
```

`More` might contain:

```text
Void sale
View activity
```

depending on permissions.

Don't display dangerous actions prominently.

---

# 14.14 Screen 4 — Inventory

```text
Inventory

[ Receive Stock ] [ Transfer ] [ Stock Count ]

Search products...

┌───────────────────────────────────────────────────────────┐
│ Product        Available     Reorder       Status          │
├───────────────────────────────────────────────────────────┤
│ Heineken       82 crates     20 crates     ● Healthy       │
│ Malt           14 packs      20 packs      ⚠ Low           │
│ Nutri Milk      5 crates     15 crates      ⚠ Critical      │
└───────────────────────────────────────────────────────────┘
```

Clicking a product:

```text
Heineken
82 crates available

[ Receive ] [ Transfer ] [ Adjust ]

Stock movement
────────────────────────────────────

Today

+100  Purchase
-10   Sale
-15   Transfer
-2    Damaged

Current: 82
```

---

# 14.15 Screen 5 — Stock Count

This is important because physical stock can differ.

```text
Stock Count

Main Branch

Product        System       Actual

Heineken       82           [ 82 ]
Malt           14           [ 12 ]
Nutri Milk      5           [ 5 ]

                                  ↓

Malt discrepancy: -2 packs

Reason
[ Physical count found shortage ]

[ Submit Count ]
```

Then the backend creates the appropriate controlled adjustment.

It does **not** silently change:

```text
14 → 12
```

without evidence.

---

# 14.16 Screen 6 — Transfer

New transfer:

```text
New Stock Transfer

From
[ Main Branch ]

To
[ Ikeja Branch ]

Products

Heineken
Quantity: [ 20 ]

Malt
Quantity: [ 10 ]

Reason
[ Restocking branch ]

[ Submit Request ]
```

Then the transfer page becomes a timeline:

```text
TR-1023

Main Branch
     ↓
Ikeja Branch

✓ Requested
   Sarah · 09:20

✓ Approved
   Owner · 09:35

✓ Dispatched
   Michael · 10:00

● Awaiting Receipt
```

Once received:

```text
✓ Received
   David · 12:20

Sent       20
Received   18
Difference  2 ⚠
```

This timeline is much easier to understand than a raw status field.

---

# 14.17 Screen 7 — Cash reconciliation

This should feel almost like a checklist.

```text
End of Day
Main Branch

Expected cash

₦720,000

Cash counted

[ ₦698,000 ]

Difference

-₦22,000 ⚠

────────────────────────────

Why is there a difference?

[ Select reason ]

Notes

[ __________________________________ ]

────────────────────────────

[ Submit Reconciliation ]
```

The expected amount is read-only.

The user only enters:

> What did you actually count?

Then the system calculates the difference.

---

# 14.18 Screen 8 — Activity

```text
Activity

Today · Main Branch

[ Search ] [ Employee ▼ ] [ Action ▼ ]

────────────────────────────────────────────

⚠ 10:42
Daniel
Sale completed
INV-10291
₦138,000

● 10:38
Sarah
Transfer received
TR-1023

⚠ 10:31
Sarah
Discount approved
₦5,000

⚠ 10:20
Michael
Damaged stock recorded
2 crates

────────────────────────────────────────────

[ Load more ]
```

Click an event:

```text
Discount approved

Employee
Sarah

Amount
₦5,000

Reason
Bulk purchase

Approved by
Owner

Time
10:31

Related sale
INV-10290
```

This is the "investigate" layer of the product.

---

# 14.19 Screen 9 — Alerts

Instead of sending notifications everywhere initially, have one central attention area.

```text
🔔

Needs attention

3 items

────────────────────

⚠ Cash discrepancy
Main Branch
₦22,000

⚠ Stock discrepancy
Ikeja Branch
45 crates

⚠ Attendance correction
Sarah
08:10 → 08:00
```

Clicking an alert goes directly to the relevant object.

This is enough for MVP.

We don't need email + SMS + WhatsApp + push notifications yet.

---

# 14.20 Screen 10 — Mobile New Sale

The cashier experience should remain excellent on a smaller screen.

```text
┌─────────────────────────┐
│ ← New Sale              │
│ Main Branch             │
├─────────────────────────┤
│ Customer                │
│ Walk-in Customer    ▼   │
│                         │
│ 🔍 Search product       │
│                         │
│ Heineken                │
│ ₦38,000 / crate         │
│                         │
│       [−] 3 [+]         │
│                         │
│ Nutri Milk              │
│ ₦12,000 / crate         │
│                         │
│       [−] 2 [+]         │
│                         │
│─────────────────────────│
│ Total                   │
│ ₦138,000                │
│                         │
│ [ Complete Sale ]       │
└─────────────────────────┘
```

The payment interface can open as a bottom sheet.

That's a natural mobile interaction.

---

# 14.21 Navigation on mobile

Don't cram the entire sidebar into a hamburger menu.

For the most common actions:

```text
┌─────────────────────────┐
│                         │
│       Content           │
│                         │
├─────────────────────────┤
│ Today Sales Stock More  │
└─────────────────────────┘
```

`More` contains:

```text
Customers
People
Activity
Reports
Settings
```

The exact mobile navigation can be adjusted after we test the workflows.

---

# 14.22 The most important reusable interaction: drawers

Not every click should navigate away.

For example, on inventory:

```text
Product list
      ↓
click Heineken
      ↓
right-side drawer
```

```text
┌───────────────────────────────┐
│ Heineken                   X  │
│                               │
│ 82 crates available           │
│                               │
│ [Transfer] [Receive]          │
│                               │
│ Recent activity               │
│ -10 Sale                      │
│ -15 Transfer                  │
│ -2 Damaged                    │
│                               │
│ [View full history]           │
└───────────────────────────────┘
```

This keeps users in context.

Use full pages when the task becomes substantial.

---

# 14.23 When to use a modal vs drawer vs page

We'll establish a rule.

### Modal

Small decision.

```text
Are you sure you want to void this sale?
```

### Drawer

Inspect something without leaving context.

```text
Product details
Activity details
Customer quick view
```

### Full page

A real workflow.

```text
New Sale
Receive Stock
Create Transfer
Cash Reconciliation
Employee Profile
Reports
```

This prevents navigation from becoming exhausting.

---

# 14.24 The design system should enforce business safety

Some UX rules should be structural.

For example:

### Destructive action

```text
[ Void Sale ]
```

opens:

```text
Void Sale

Invoice #INV-10291

This will reverse the sale and related inventory/payment effects.

Reason
[_____________________]

[ Cancel ] [ Confirm Void ]
```

No one should accidentally void a sale with one click.

---

### Stock adjustment

```text
Adjust Stock

System quantity
82

Physical quantity
[ 78 ]

Difference
-4

Reason required
[_____________________]

[ Submit Adjustment ]
```

The UI itself reinforces the business rule.

---

# 14.25 Design tokens

Before implementation, we'll create a small set of tokens:

```text
spacing
radius
font sizes
font weights
shadows
borders
semantic colors
breakpoints
```

Then components use those tokens instead of random values everywhere.

That makes later redesign much easier.

---

# 14.26 What we should NOT build yet

This is where I want to be disciplined.

Don't add:

```text
❌ Fancy animations
❌ Dark mode initially
❌ Drag-and-drop dashboards
❌ Custom dashboard builder
❌ Complex chart library everywhere
❌ Real-time WebSocket infrastructure
❌ Offline-first synchronization
❌ AI assistant
❌ Customer mobile app
❌ Online ordering UI
❌ Payroll UI
❌ Full accounting UI
```

None of those solves the owner's immediate problem.

---

# 14.27 Our MVP frontend map

So our first real implementation can be:

```text
AUTH
└── Login

CORE
├── Today
├── Sales
│   ├── Sales List
│   ├── New Sale
│   └── Sale Details
│
├── Inventory
│   ├── Inventory Overview
│   ├── Product Details
│   ├── Receive Stock
│   └── Stock Count
│
├── Transfers
│   ├── Transfer List
│   ├── New Transfer
│   └── Transfer Details
│
├── Customers
│   ├── Customer List
│   └── Customer Details
│
├── People
│   ├── Employee List
│   └── Employee Details
│
├── Attendance
│   └── Attendance Overview
│
├── Activity
│   └── Activity Feed
│
└── Reports
    ├── Sales
    ├── Cash
    ├── Stock
    ├── Customers
    └── People
```

That's already a substantial application.

---

# 14.28 One final architectural decision before coding

We now have enough design to make an important distinction:

### Server state

Things that come from the database:

```text
sales
products
stock
customers
employees
attendance
transfers
activity
```

### UI state

Things that only exist because the user is interacting with the screen:

```text
open drawer
selected product
search text
current step
modal open
selected filters
quantity being edited
```

We should **not** dump everything into one giant global state store.

For example, a product search should not somehow become global application state.

We'll keep server data and UI state conceptually separate.

That will make the application much easier to maintain.

---

# 14.29 Where we are now

We've gone from:

```text
Business problems
      ↓
Business rules
      ↓
Database model
      ↓
Backend architecture
      ↓
Frontend architecture
      ↓
Design system
      ↓
Concrete workflows
```

The next step is finally where we start getting our hands dirty.

## Component 15 — Project Setup & Implementation Foundation

We'll define the actual project:

```text
Next.js
TypeScript
Tailwind
PostgreSQL
Prisma
Auth
Validation
Testing
Git structure
Environment variables
Database migrations
Module structure
```

Then we'll build the **first vertical slice** rather than spending weeks creating empty pages:

> **Login → Today → New Sale → Complete Sale → Inventory movement → Audit event**

That gives us a real end-to-end business operation very early, and everything afterward can build on the same architecture.
