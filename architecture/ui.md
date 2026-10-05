Let's do it properly.

# Component 17.5 — Design System + App Shell

This is the visual foundation for the entire application. We should **not build individual pages with ad-hoc Tailwind classes** and try to standardize later.

The rule is:

> **Build the visual language once, then compose the product from it.**

---

# 17.5.1 Visual direction

The product should feel like a serious operations platform.

### Overall character

* clean
* modern
* restrained
* high information density
* excellent typography
* subtle depth
* strong hierarchy
* minimal decoration
* fast interactions

I would avoid the usual:

```text
🌈 gradients
💥 huge shadows
🟣 purple everything
📊 charts everywhere
🧊 excessive glassmorphism
⭕ giant rounded cards
```

Instead, we'll use **surface, typography, spacing, borders, and hierarchy** to make it feel premium.

---

# 17.5.2 Design tokens

First, establish tokens.

Conceptually:

```text
┌──────────────────────────────────────────┐
│ COLOR                                    │
├──────────────────────────────────────────┤
│ background                               │
│ surface                                  │
│ surface-elevated                         │
│ border                                   │
│ border-subtle                            │
│ text                                     │
│ text-secondary                           │
│ text-muted                               │
│ brand                                    │
│ success                                  │
│ warning                                  │
│ danger                                   │
│ info                                     │
└──────────────────────────────────────────┘
```

Don't hardcode:

```tsx
text-gray-600
bg-blue-600
border-gray-200
```

randomly throughout the application.

Instead, components should use semantic tokens.

For example:

```tsx
className="text-text-secondary"
```

or whatever naming scheme we establish.

That means if we later decide:

> "The application needs a slightly warmer visual identity."

we change the design system rather than 200 components.

---

# 17.5.3 Border radius

Don't make everything a pill.

I'd use roughly:

```text
small controls       8px
inputs               8–10px
cards                12px
drawers              16px
large surfaces       16px
pill/status          999px
```

Buttons shouldn't look like:

```text
(   Save   )
```

unless they are deliberately pill-shaped.

Most controls should have a confident, slightly rounded rectangular shape.

---

# 17.5.4 Shadows

Very restrained.

Most surfaces should rely on:

```text
background
+
border
```

rather than:

```text
████████████
huge shadow
████████████
```

Use shadow mainly for things floating above the interface:

* dropdown
* command palette
* modal
* drawer
* popover

This creates hierarchy without visual noise.

---

# 17.5.5 Spacing system

Use a predictable scale.

```text
4
8
12
16
20
24
32
40
48
64
```

For example:

### Page

```text
padding: 24px
```

### Section

```text
margin-bottom: 32px
```

### Card content

```text
padding: 20px
```

### Form fields

```text
gap: 16px
```

This consistency is one of the things users subconsciously perceive as "professional."

---

# 17.5.6 Page width

Don't let content stretch across a 4K monitor indefinitely.

Use:

```text
main content
max-width: ~1440px
```

But the actual workspace can use more width when appropriate.

For example:

### POS

Wide.

### Invoice detail

Moderate.

### Employee profile

Moderate.

### Reports

Potentially wide.

The layout should respond to the content.

---

# 17.5.7 App Shell

Now the actual shell.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR        │ TOP BAR                                                │
│                ├─────────────────────────────────────────────────────────┤
│                │                                                         │
│                │                                                         │
│                │                                                         │
│                │                  WORKSPACE                              │
│                │                                                         │
│                │                                                         │
│                │                                                         │
│                │                                                         │
│                │                                                         │
│                │                                                         │
└────────────────┴─────────────────────────────────────────────────────────┘
```

Desktop:

```text
Sidebar = 240px
Top bar = 64px
```

Mobile:

```text
Top bar = 56px
Bottom navigation = ~64px
```

---

# 17.5.8 Sidebar

Let's make the navigation intentional.

```text
┌───────────────────────┐
│                       │
│  DRINKS               │
│  Operations           │
│                       │
│  ◉  Today             │
│                       │
│  SALES                │
│  ▸ Sales              │
│                       │
│  INVENTORY            │
│  ▸ Stock              │
│  ▸ Transfers          │
│                       │
│  CUSTOMERS            │
│  ▸ Customers          │
│                       │
│  PEOPLE               │
│  ▸ Employees          │
│  ▸ Attendance         │
│                       │
│  INSIGHT              │
│  ▸ Activity           │
│  ▸ Reports            │
│                       │
│                       │
│  ───────────────────  │
│                       │
│  ⚙  Settings         │
│                       │
│  ┌─────────────────┐ │
│  │ JM              │ │
│  │ John Mensah     │ │
│  │ Cashier         │ │
│  └─────────────────┘ │
└───────────────────────┘
```

### Important:

The sidebar does **not** contain every feature.

For example, we don't need:

```text
Products
Product Categories
Prices
Payments
Invoices
Stock Movements
Stock Adjustments
Audit Logs
Branches
Roles
Permissions
```

as separate navigation entries.

Those are features/workflows inside the larger workspaces.

This keeps the application understandable.

---

# 17.5.9 Navigation by role

The sidebar dynamically shows what matters.

### Owner

```text
Today
Sales
Stock
Transfers
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
Transfers
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

### Stockkeeper

```text
Today
Stock
Transfers
Activity
```

This isn't merely hiding things visually.

The backend still enforces permissions.

---

# 17.5.10 Top bar

Let's make it clean.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Main Branch ▾                 Search anything... ⌘K       ◉ John ▾ │
└─────────────────────────────────────────────────────────────────────┘
```

### Branch

For owner/manager:

```text
Main Branch ▾
```

Click:

```text
┌─────────────────────────┐
│ SWITCH BRANCH           │
│                         │
│ ✓ Main Branch           │
│   Ikeja Branch          │
│                         │
└─────────────────────────┘
```

For a cashier assigned only to Main:

```text
Main Branch
```

No unnecessary dropdown.

---

# 17.5.11 Global search

This should eventually become one of the application's best productivity features.

Keyboard:

```text
⌘K
```

or:

```text
Ctrl + K
```

Opens:

```text
┌───────────────────────────────────────────────┐
│ 🔍 Search invoices, customers, products...   │
├───────────────────────────────────────────────┤
│                                               │
│ RECENT                                        │
│                                               │
│ Invoice INV-MAIN-00482                        │
│ Customer Ade Stores                           │
│ Heineken Crate                                │
│                                               │
└───────────────────────────────────────────────┘
```

Later it can support commands:

```text
New sale
Create transfer
Record stock receipt
Find invoice
Find customer
```

But we don't need to implement all of that now.

The component should be designed so we can add it later.

---

# 17.5.12 User menu

Simple.

```text
┌──────────────────────────┐
│ John Mensah              │
│ john@example.com         │
│ Cashier                  │
├──────────────────────────┤
│ Profile                  │
│ Security                 │
├──────────────────────────┤
│ Sign out                 │
└──────────────────────────┘
```

No unnecessary profile complexity in MVP.

---

# 17.5.13 Page header

Every major workspace should have a consistent header.

Example:

```text
Sales

Manage invoices, payments and customer purchases.

                         [ + New Sale ]
```

For inventory:

```text
Stock

Monitor availability, movement and stock levels.

                    [ Receive stock ] [ Transfer ]
```

For Customers:

```text
Customers

Manage customer records, balances and transaction history.

                         [ + Customer ]
```

Notice:

### Title

What am I looking at?

### Description

Why does this screen exist?

### Primary action

What should I do?

That's a very strong pattern.

---

# 17.5.14 Buttons

We need a strict hierarchy.

### Primary

Used for the main action.

```text
[ + New Sale ]
```

### Secondary

Supporting action.

```text
[ Export ]
```

### Tertiary/text

Low-emphasis action.

```text
View all →
```

### Destructive

Only dangerous operations.

```text
[ Void invoice ]
```

We should never have five equally prominent buttons.

If everything screams:

> CLICK ME!

nothing has hierarchy.

---

# 17.5.15 Status badges

Status should be readable even without color.

For example:

```text
● Paid
● Pending
● Refunded
● Voided
```

or:

```text
[ Paid ]
[ Pending ]
[ Low stock ]
```

The status text itself must communicate meaning.

Never depend solely on:

```text
🟢
🟡
🔴
```

because that's inaccessible and ambiguous.

---

# 17.5.16 Cards

Cards should represent **meaningful concepts**.

Good:

```text
┌──────────────────────────────┐
│ Today's sales                │
│                              │
│ ₦1,842,500                   │
│ 42 completed sales           │
└──────────────────────────────┘
```

Bad:

```text
┌──────────┐
│ id       │
│ 8d9f...  │
└──────────┘
```

A card isn't a prettier database field.

---

# 17.5.17 The Today page

Let's establish the owner's version as our reference design.

```text
Good morning

Business overview · September 30


┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ SALES              │ │ CASH               │ │ STOCK              │
│                    │ │                    │ │                    │
│ ₦1.84m             │ │ ₦1.31m             │ │ 3 low-stock        │
│ 126 transactions   │ │ expected            │ │ 1 discrepancy      │
│                    │ │                    │ │                    │
└────────────────────┘ └────────────────────┘ └────────────────────┘


NEEDS ATTENTION

┌──────────────────────────────────────────────────────────────────┐
│ Cash discrepancy                                      Review →  │
│ Main Branch · ₦12,500                                         │
├──────────────────────────────────────────────────────────────────┤
│ Stock discrepancy                                   Review →  │
│ Heineken · 8 crates                                            │
├──────────────────────────────────────────────────────────────────┤
│ Attendance correction                              Review →  │
│ Main Branch · John Mensah                                      │
└──────────────────────────────────────────────────────────────────┘


RECENT ACTIVITY                              View all →

10:42   Sale completed       INV-MAIN-00482     ₦32,000
10:35   Stock received       GR-00082           50 crates
10:28   Payment recorded     INV-MAIN-00481     ₦18,500
```

This is much closer to the product's purpose.

---

# 17.5.18 Information hierarchy

Notice the page doesn't say:

```text
Here's every piece of information we have.
```

Instead:

```text
WHAT HAPPENED?
     ↓
WHAT NEEDS ATTENTION?
     ↓
WHAT RECENTLY HAPPENED?
     ↓
DRILL DOWN
```

That's the design philosophy I want throughout the entire application.

---

# 17.5.19 Empty states

These matter.

Imagine a new branch has no sales.

Don't show:

```text
No data.
```

Instead:

```text
No sales yet

Sales recorded today will appear here.

[ Create first sale ]
```

For transfers:

```text
No transfers

There aren't any stock transfers requiring your attention.

[ Create transfer ]
```

For activity:

```text
Nothing here yet

Important operational activity will appear here as your team uses the system.
```

Empty states should explain the system.

---

# 17.5.20 Loading states

No giant:

```text
LOADING...
```

Use skeletons.

For example:

```text
┌─────────────────────────┐
│ █████████               │
│                         │
│ ████████                │
│ █████                   │
└─────────────────────────┘
```

Tables should have row skeletons.

Cards should have card skeletons.

This makes the application feel substantially faster.

---

# 17.5.21 Error states

A server error shouldn't produce:

```text
Something went wrong.
```

with no useful information.

Instead:

```text
Unable to load today's sales

We couldn't retrieve the latest sales for Main Branch.

[ Try again ]
```

For a business operation:

```text
Sale couldn't be completed

Heineken Crate only has 2 crates available.
You attempted to sell 5.

No changes were made.

[ Review sale ]
```

That's excellent UX because it explains the **business consequence**.

---

# 17.5.22 Toasts

Use toasts for lightweight confirmation.

Good:

```text
✓ Sale completed
  INV-MAIN-00482
```

or:

```text
✓ Stock received
  50 crates added to Main Branch
```

Don't use a toast for critical information that the user needs to act on.

---

# 17.5.23 Mobile navigation

We don't need five levels of hamburger menus.

Bottom navigation:

```text
┌──────────────────────────────────────────┐
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  Today    Sales      +      Stock   More │
└──────────────────────────────────────────┘
```

The `+` can become the primary action for users who frequently create things.

For cashier:

```text
Today
Sales
+
Customers
More
```

Clicking `+`:

```text
┌──────────────────────────┐
│ New Sale                 │
│                          │
│ Find Customer            │
│ Receive Payment          │
│                          │
│ Cancel                   │
└──────────────────────────┘
```

This is much faster than navigating through menus.

---

# 17.5.24 Component architecture

Now we translate the design into code architecture.

```text
src/
│
├── app/
│
├── components/
│   │
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── status-badge.tsx
│   │   ├── card.tsx
│   │   ├── metric-card.tsx
│   │   ├── table.tsx
│   │   ├── drawer.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   ├── alert.tsx
│   │   ├── skeleton.tsx
│   │   ├── empty-state.tsx
│   │   └── error-state.tsx
│   │
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── sidebar.tsx
│   │   ├── top-bar.tsx
│   │   ├── mobile-nav.tsx
│   │   ├── branch-switcher.tsx
│   │   ├── user-menu.tsx
│   │   └── page-header.tsx
│   │
│   ├── sales/
│   ├── inventory/
│   ├── customers/
│   ├── transfers/
│   ├── people/
│   └── activity/
│
├── modules/
│
└── lib/
```

This gives us a clean separation:

```text
ui/
   visual primitives

layout/
   application structure

sales/
   sales-specific UI

modules/
   business logic
```

---

# 17.5.25 The most important rule for React components

Don't make one giant component.

Not:

```tsx
<DashboardEverything />
```

containing 1,500 lines.

Instead:

```tsx
<TodayPage>
  <PageHeader />
  <TodayMetrics />
  <AttentionPanel />
  <RecentActivity />
</TodayPage>
```

And:

```tsx
<TodayMetrics>
  <MetricCard />
  <MetricCard />
  <MetricCard />
</TodayMetrics>
```

Small, composable components.

---

# 17.5.26 But don't over-componentize either

We don't need:

```text
TodaySalesMetricContainerWrapper
TodaySalesMetricContainerWrapperInner
TodaySalesMetricNumberWrapper
```

That becomes architecture theater.

A component should exist because it:

* has reusable behavior
* has meaningful responsibility
* improves readability
* isolates complexity

Not because the file is getting longer.

---

# 17.5.27 One more major decision: icons

Use one consistent icon set.

No mixing:

```text
Lucide
+
Font Awesome
+
random SVGs
+
emoji
```

I'd use a consistent modern icon library such as **Lucide**.

Icons should support meaning, not decorate every sentence.

Good:

```text
Search icon
Bell icon
Plus icon
Arrow-right icon
Chevron-down
```

Bad:

```text
✨ Sales
🚀 Inventory
💰 Customers
🔥 Reports
```

---

# 17.5.28 What we should build now

The actual implementation sequence is now:

```text
17.5.1  Design tokens
        ↓
17.5.2  Typography
        ↓
17.5.3  Base UI components
        ↓
17.5.4  App Shell
        ↓
17.5.5  Sidebar
        ↓
17.5.6  Top Bar
        ↓
17.5.7  Mobile navigation
        ↓
17.5.8  Role-aware navigation
        ↓
17.5.9  Today page
        ↓
17.5.10 Loading/error/empty states
```

Then:

```text
18A  Sale backend
18B  Sale transaction
18C  New Sale UI
18D  Invoice UI
18E  Sale tests
```

---

## One thing I want to lock in

From this point forward, **we don't judge the UI by whether it "works."**

It has two separate standards:

### Functional quality

```text
Does it perform the correct business operation?
```

### Product quality

```text
Does it feel obvious, fast, trustworthy and polished?
```

Both have to pass.

A button that successfully creates a sale but makes the cashier hunt around for it is **not finished**.

A beautiful sale screen that allows a cashier to manipulate the price is also **not finished**.

We need both.

**Next: Component 18A — we'll design the actual New Sale experience and its server-side contract together, so the polished UI and secure business workflow are built around the same model.**
