Good. **Component 1 is now settled.** Let's move to **Component 2: Branch Management**.

## Component 2 — Branch Management

The branch system is important because almost every business transaction needs to answer:

> **Which branch did this happen in?**

A branch isn't just a name and address. It becomes the boundary for sales, stock, employees, cash, attendance, and reporting.

### 1. Branch structure

Each branch should have:

```text
Branch
├── Name
├── Code
├── Address
├── Phone
├── Status
├── Manager(s)
├── Employees
├── Inventory
├── Sales
├── Cash records
└── Activity history
```

Example:

```text
Main Branch
Code: MAIN
Status: Active

Ikeja Branch
Code: IKE
Status: Active

Surulere Branch
Code: SUR
Status: Active
```

The **branch code** becomes useful for invoices and internal references.

For example:

```text
IKE-INV-000124
SUR-INV-000087
```

That makes it immediately obvious where an invoice originated.

---

## 2. Branch status

A branch should have a status rather than simply deleting it.

```text
ACTIVE
INACTIVE
```

If a branch closes temporarily or permanently, the Owner can deactivate it.

We **do not delete the branch**, because historical transactions still belong to it.

For example:

> Ikeja Branch — Inactive

But its historical sales, stock movements, attendance, etc. remain accessible.

---

## 3. Creating a branch

Only the Owner/Admin should initially be able to create a branch.

The form can be simple:

```text
Create Branch

Branch Name *
Branch Code *
Address
Phone Number
Manager

[Cancel] [Create Branch]
```

The system should validate that the branch code is unique.

---

## 4. Branch access

This connects directly to the employee system we just designed.

A user shouldn't automatically gain access to every branch simply because they have an account.

For example:

```text
John Doe
Role: Cashier

Branch Access:
✓ Ikeja
✗ Surulere
✗ Lekki
```

If John is transferred:

```text
Before:
Ikeja ✓
Surulere ✗

After:
Ikeja ✗
Surulere ✓
```

Again, this **doesn't modify John's historical records**.

---

## 5. Owner vs Manager branch visibility

The Owner has global visibility:

```text
Viewing: ALL BRANCHES
```

They can switch to:

```text
Viewing: Ikeja
Viewing: Surulere
Viewing: All Branches
```

A Manager should normally only see branches they're authorized to manage.

For example:

```text
Manager Sarah

Branch Access:
✓ Ikeja
✓ Surulere
✗ Lekki
```

The frontend can make this easy with a branch selector, but the **backend must enforce the restriction**.

Someone shouldn't be able to simply change:

```text
?branchId=lekki
```

in the browser and suddenly access Lekki's data.

---

# 6. Branch-scoped transactions

This is one of the most important architectural rules.

A sale isn't just:

```text
Sale
├── customer
├── items
└── total
```

It should conceptually be:

```text
Sale
├── branch
├── employee/user
├── customer
├── items
├── payments
├── timestamp
└── status
```

Same principle for:

* Inventory movements
* Stock transfers
* Attendance
* Expenses
* Returns
* Damaged goods
* Expired goods
* Cash reconciliation
* Purchase/receiving records

This gives us reliable branch-level reporting.

---

# 7. Branch transfers of stock

This is where branches become particularly important.

Suppose Main Branch sends:

```text
20 crates Heineken
10 crates Malt
```

to Ikeja.

We shouldn't simply subtract 20 from Main and add 20 to Ikeja.

We create a **stock transfer**:

```text
Transfer #TR-00031

From:
Main Branch

To:
Ikeja Branch

Items:
20 × Heineken
10 × Malt

Requested by:
Manager

Approved by:
Owner

Status:
In Transit
```

Then:

```text
Main Branch
-20 Heineken
-10 Malt

Ikeja Branch
+20 Heineken
+10 Malt
```

But there's an important question here: **when does Ikeja actually receive the stock?**

That's something we'll design properly in the Inventory component.

---

# 8. Branch dashboard

Each branch should have its own operational view.

For example:

### Ikeja — Today

```text
Sales
₦1,245,000

Cash Expected
₦830,000

Transfer In
20 crates

Low Stock
4 products

Damaged
3 crates

Expired
1 crate

Attendance
8 / 9 employees

Alerts
2
```

The Owner's dashboard can then aggregate:

```text
ALL BRANCHES — TODAY

Total Sales
₦4,820,000

Expected Cash
₦3,100,000

Stock Alerts
12

Attendance Issues
4

Abnormal Activity
3

Pending Approvals
5
```

The important part is that these numbers aren't manually entered. They're calculated from the underlying transactions.

---

# 9. Branch deletion

I don't want a normal **Delete Branch** button.

Instead:

```text
Deactivate Branch
```

Once inactive:

* No new sales.
* No new attendance.
* No new stock transactions.
* No new employees can normally be assigned to it.
* Historical records remain available.

If the business reopens that location, the Owner can reactivate it.

---

# 10. What we're establishing architecturally

At this point our structure is becoming:

```text
BUSINESS
│
├── BRANCHES
│   ├── Main
│   ├── Ikeja
│   └── Surulere
│
├── EMPLOYEES
│   ├── User Account
│   ├── Role
│   └── Branch Assignment History
│
├── SALES
│   └── Branch
│
├── INVENTORY
│   └── Branch
│
├── ATTENDANCE
│   └── Branch
│
├── TRANSFERS
│   ├── From Branch
│   └── To Branch
│
└── AUDIT LOG
    └── User + Branch + Action + Time
```
