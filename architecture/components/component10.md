## Component 10 — Dashboard, Reports & Operational UX

### 1. The main UX model

I don't want the application to start with:

> Tables → records → filters → CRUD forms.

Instead, the user should think:

> **What is happening? What needs my attention? What do I need to do next?**

So the navigation and information architecture should follow the business's activities.

```text
                    BRANCHFLOW
                        │
        ┌───────────────┼────────────────┐
        │               │                │
      TODAY           OPERATE          KNOW
        │               │                │
   What's happening?  Do the work      Understand
        │               │                │
   ┌────┴────┐     ┌────┴────┐     ┌────┴────┐
   Sales     │     Sales     │     Reports   │
   Cash      │     Stock     │     Activity  │
   Stock     │     Transfers │     Customers │
   Staff     │     Returns   │     Inventory │
   Alerts    │     Attendance│     Attendance│
```

The exact labels can change, but the **mental model** is important.

---

# 2. Owner experience

When the owner logs in, they shouldn't be presented with 40 database statistics.

They should immediately understand:

### **Today**

```text
TODAY — 30 September

Sales
₦2.84m
↑ 8.2%

Cash expected
₦1.76m

Cash counted
₦1.71m
⚠ ₦50,000 difference

Stock
3 items low
2 damaged
1 transfer pending

People
18 present
2 late
1 absent

Needs attention
⚠ Cash discrepancy
⚠ Stock adjustment
⚠ Discount approval
```

The important part is that **numbers are entry points into actions**.

If the owner taps:

> `₦50,000 difference`

they should immediately see:

```text
Cash discrepancy

Branch: Ikeja
Date: Today
Expected: ₦1,760,000
Counted:  ₦1,710,000
Difference: -₦50,000

Responsible cashier: John
Manager: Sarah

[Review reconciliation]
```

Not:

> `cash_reconciliation_id = 8237`

---

# 3. Navigation should be task-oriented

I'd structure the application around a small number of primary destinations.

### Main navigation

```text
┌──────────────────────────────┐
│ BranchFlow                   │
│                              │
│ ● Today                      │
│   Sales                      │
│   Stock                      │
│   Customers                  │
│   People                     │
│   Activity                   │
│   Reports                    │
│                              │
│ ──────────────────────────── │
│ Branch: Ikeja ▼              │
│                              │
│ ⚙ Settings                   │
└──────────────────────────────┘
```

But **what appears in the navigation depends on the role**.

A cashier shouldn't see a giant administrative menu.

---

# 4. The "Today" screen

This is probably the most important screen.

Every role gets a version of:

> **What do I need to know/do today?**

### Cashier

```text
Good morning, John

TODAY

₦438,000
Sales

23
Invoices

₦438,000
Collected

──────────────────

Quick actions

[ + New Sale ]

[ Customers ]

──────────────────

Recent sales
INV-00124   ₦38,000
INV-00123   ₦12,000
INV-00122   ₦82,500
```

Very little noise.

---

### Stockkeeper

```text
Good morning, David

STOCK TODAY

12
Receipts

3
Transfers

2
Damaged

──────────────────

Needs attention

⚠ Heineken — 8 crates remaining
⚠ Malt — stock count required

──────────────────

[ Receive Stock ]
[ Transfer Stock ]
[ Record Damage ]
```

Again, **information + operation**.

---

### Manager

```text
GOOD MORNING, SARAH

Ikeja Branch
+ Surulere Branch

TODAY

Sales       ₦1.84m
Cash        ₦1.12m
Stock       842 crates
Attendance  17 / 19

────────────────────────

NEEDS ATTENTION

⚠ ₦50,000 cash discrepancy
⚠ 12 crates transfer awaiting receipt
⚠ 1 attendance correction
⚠ 2 discount approvals

[Review]
```

The manager doesn't have to search for problems.

Problems come to them.

---

# 5. Reports should answer questions

Instead of making users think:

> "Which report do I need?"

we can organize reports around business questions.

### Sales

> **What did we sell?**

* Sales by day
* Sales by branch
* Sales by product
* Sales by cashier
* Discounts
* Voids
* Returns

### Cash

> **Where did the money go?**

* Expected cash
* Actual cash
* Cash differences
* Bank transfers
* Refunds
* Handover history

### Stock

> **Where did the goods go?**

* Current stock
* Stock received
* Stock sold
* Transfers
* Damaged
* Expired
* Adjustments
* Discrepancies

### People

> **Who was working?**

* Attendance
* Late arrivals
* Absences
* Corrections

### Customers

> **Who owes us?**

* Outstanding balances
* Credit sales
* Payments
* Returns
* Customer history

### Activity

> **What happened?**

* Corrections
* Discounts
* Returns
* Stock adjustments
* Permission changes
* Other sensitive actions

That's much more understandable than a generic "Reports" page full of database tables.

---

# 6. Drill-down is important

The dashboard should **summarize**, but never hide the evidence.

For example:

```text
Stock
842 crates
↓
```

Tap it:

```text
Inventory

Heineken       120 crates
Nutri Milk      84 crates
Malt            62 crates
...
```

Tap Heineken:

```text
Heineken — Ikeja

Available       120 crates
In transit       20 crates
Damaged           4 crates
Expired           0 crates

Recent movement

+50  Received
-12  Sale
-20  Transfer
+2   Return
-4   Damaged
```

Tap the transfer:

```text
Transfer TR-00041

Ikeja → Surulere

Sent:       20 crates
Received:   18 crates
Difference:  2 crates

Dispatched by: David
Received by:   Michael
Status:        ⚠ Discrepancy
```

That creates a very natural **information trail**.

---

# 7. Forms should feel like workflows

Don't give the cashier a huge "Create Sale" database form.

Give them:

```text
NEW SALE

Customer
[ Walk-in customer ▼ ]

Product
[ Search products... ]

Heineken
[ - ]  3  [ + ]

Nutri Milk
[ - ]  2  [ + ]

────────────────

Subtotal       ₦138,000
Discount       ₦0
TOTAL          ₦138,000

Payment
○ Cash
○ Transfer

[ Complete Sale ]
```

The system handles the complexity.

The user handles the business operation.

---

# 8. Progressive disclosure

This will be one of our major UX rules.

**Simple by default. Detailed when needed.**

For example:

```text
Sale completed ✓

INV-00124
₦138,000

[Print] [Share] [Done]

────────────────────
View details ↓
```

Most users don't need to see:

* database IDs
* audit metadata
* internal movement IDs
* permission information
* technical timestamps

But the manager can open the details when investigating something.

---

# 9. Navigation should be contextual

Suppose the manager is looking at a cash discrepancy.

The page shouldn't make them navigate:

```text
Dashboard
→ Reports
→ Cash
→ Reconciliation
→ Find branch
→ Find date
→ Find cashier
```

Instead:

```text
Dashboard
   ↓
⚠ ₦50,000 discrepancy
   ↓
Cash reconciliation
   ↓
[Review]
```

The interface itself should **connect related information**.

That's how we'll make it feel like an operational system rather than a collection of CRUD pages.

---

# 10. One more important UX rule

We should avoid making every screen a dashboard.

That's a common mistake.

Some screens should be **workspaces**.

For example:

**Sales**

```text
Sales

[ + New Sale ]

Today's sales
────────────────────────
INV-00124   John    ₦38k
INV-00123   Mary    ₦12k
INV-00122   John    ₦82.5k
```

**Inventory**

```text
Inventory

[ Receive ] [ Transfer ] [ Count ]

Search product...

Heineken      120 crates   ● Healthy
Nutri Milk     84 crates   ● Healthy
Malt           12 crates   ⚠ Low
```

**Activity**

```text
Activity

⚠ Cash discrepancy
John • Ikeja • 10:42

Price changed
Sarah • Ikeja • 09:51

Stock received
David • Ikeja • 09:12
```

Each screen has a **job**.

---

## Our UX principle

I want us to keep this sentence visible throughout implementation:

> **The system should show the user what matters, help them do the next thing, and preserve the detail needed to explain what happened.**

That gives us three layers:

**1. Understand** → information
**2. Act** → operation
**3. Investigate** → detail/audit

That's the interaction model I'd carry into the actual frontend design.

