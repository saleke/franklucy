Perfect. **Component 2 is settled.**

Now we move into one of the most important parts of the system:

# Component 3 — Products & Inventory

This is where we need to be more careful than with the previous components, because **inventory is where the business's physical goods and the database have to stay synchronized**.

The core rule will be:

> **We don't store inventory as a number that employees freely edit. We calculate it from recorded stock movements.**

### 1. Product

A product should contain information such as:

```text
Product
├── Name
├── Category
├── Stock Unit
├── Purchase Price
├── Selling Price
├── Reorder Level
├── Active/Inactive
└── Branch availability
```

Example:

```text
Heineken
Category: Beer
Unit: Crate
Selling Price: ₦38,000
Reorder Level: 20 crates
```

And:

```text
Nutri Milk
Category: Milk
Unit: Crate
Selling Price: ₦12,000
Reorder Level: 15 crates
```

---

## 2. We need to settle the unit problem

Your business uses things like:

* crates
* packs
* bottles/cans

We shouldn't casually treat these as interchangeable.

For example:

```text
Heineken → Crate
Malt → Pack
Nutri Milk → Crate
```

A cashier selling:

> 3 crates Heineken

means:

```text
Quantity = 3
Unit = Crate
```

The system calculates the amount.

---

## 3. Stock belongs to a branch

The same product can exist at multiple branches.

```text
Heineken

Main Branch:     150 crates
Ikeja Branch:     42 crates
Surulere Branch:  27 crates
```

We don't create three different products called "Heineken."

There's one product:

```text
Heineken
```

and branch-specific inventory.

---

# 4. Stock movements

This is the most important part.

Instead of:

```text
Heineken stock = 42
```

being something a user can simply change to `37`, we record **why** it became 37.

For example:

```text
Opening Stock       +50
Purchase            +20
Transfer In         +10
Sale                 -8
Damaged              -2
Transfer Out         -5
--------------------------------
Current Stock        65
```

Every movement gets:

```text
Product
Branch
Quantity
Movement Type
User
Date/Time
Reference
Reason
```

So we can answer:

> "Why are there only 65 crates?"

instead of just knowing that there are 65.

---

# 5. Movement types

We'll eventually support things like:

```text
PURCHASE
SALE
TRANSFER_IN
TRANSFER_OUT
RETURN_IN
DAMAGED
EXPIRED
ADJUSTMENT
OPENING_STOCK
```

Each one has a specific meaning.

For example:

**Sale**

```text
Ikeja
Heineken
-3 crates
Sale #INV-1042
Cashier: John
```

**Damaged**

```text
Ikeja
Heineken
-1 crate
Reason: Damaged bottles
Recorded by: Stockkeeper
```

**Transfer**

```text
Main → Ikeja
Heineken
20 crates
Transfer #TR-0012
```

This gives us traceability.

---

# 6. Damaged and expired goods

We specifically discussed this earlier, so we'll make them first-class inventory events.

### Damaged

```text
Record Damaged Stock

Product: Heineken
Quantity: 2 crates
Reason: Broken bottles
Notes: 6 bottles damaged during unloading

[Submit]
```

### Expired

```text
Record Expired Stock

Product: Nutri Milk
Quantity: 3 crates
Expiry Date: 28/09/2026

[Submit]
```

The system removes those quantities from **available stock**, while preserving the loss record.

The Owner can later see:

```text
September Losses

Damaged:  ₦185,000
Expired:  ₦72,000
```

That is much more useful than discovering at month-end that stock is missing.

---

# 7. Physical stock count

We also need a **Stock Count** feature.

Because even a good system can eventually disagree with reality.

Example:

System says:

```text
Heineken: 50 crates
```

Stockkeeper physically counts:

```text
Heineken: 47 crates
```

They don't simply edit `50 → 47`.

They create:

```text
Stock Count
Expected: 50
Actual: 47
Difference: -3
Reason: ?
```

Then an authorized person approves the adjustment.

This is important because:

> **A discrepancy is evidence of a problem, not automatically proof of theft.**

The system records the discrepancy; management investigates the cause.

---

# 8. Price management

This connects directly to the cashier problem.

A cashier should **not be able to freely change the product's selling price**.

Suppose:

```text
Heineken
Selling Price: ₦38,000
```

Cashier selects:

```text
3 crates
```

System calculates:

```text
3 × ₦38,000
= ₦114,000
```

The cashier doesn't manually type ₦100,000.

If an authorized price change occurs, we keep the history:

```text
Heineken

₦35,000
01–15 Sept

₦38,000
16–30 Sept

₦40,000
01 Oct–present
```

And critically, an old invoice keeps the **actual price used at the time of sale**.

So changing today's price doesn't rewrite yesterday's invoices.

---

# 9. Minimum stock alerts

Each product can have a reorder threshold.

Example:

```text
Heineken
Current: 18 crates
Reorder Level: 20 crates
```

The system generates:

> ⚠️ Heineken is below the reorder level at Ikeja Branch.

The Owner can see this on the dashboard.

---

# 10. Inventory screen

For the stockkeeper, we want something simple:

```text
Inventory — Ikeja

Search product...

Product       Available    Status
Heineken      42 crates    Normal
Nutri Milk    8 crates     Low Stock
Malt          63 packs     Normal

[Receive Goods]
[Transfer Stock]
[Damaged]
[Expired]
[Stock Count]
```

The interface stays simple, while the system underneath maintains the complete history.

---
Exactly. That simplifies the inventory model and matches how the business actually operates.

### Decision locked in: Bulk-unit inventory

The system will track inventory in the **business's selling/bulk unit**, not individual bottles or cans.

For example:

```text
Heineken → Crate
Nutri Milk → Crate
Malt → Pack
```

So if the business has:

```text
Heineken: 75 crates
```

the system only cares about **75 crates**.

It does **not** need to know whether that represents 900 bottles.

### Inventory transactions

A sale:

```text
3 crates Heineken
```

reduces inventory by:

```text
-3 crates
```

A transfer:

```text
20 crates Heineken
```

moves:

```text
Main Branch: -20 crates
Ikeja Branch: +20 crates
```

A damaged-stock record:

```text
2 crates Heineken damaged
```

records:

```text
Available stock: -2 crates
Damaged stock: +2 crates
```

### Product definition

We'll therefore have something like:

```text
Product
├── Name
├── Category
├── Inventory Unit
├── Selling Price
├── Reorder Level
└── Status
```

Example:

```text
Heineken
Inventory Unit: Crate
Selling Price: ₦38,000
Reorder Level: 20 crates
```

And importantly, **we won't build bottle/crate conversion into the MVP**. That would add complexity without solving a current business problem.

If the business later decides it needs to sell individual bottles, we can add unit conversions deliberately rather than designing for it now.

### One more consequence


For the system, I'd expect the normal model to be:

```text
Heineken
Price per crate: ₦38,000

Quantity: 3

Total:
3 × ₦38,000 = ₦114,000
```

We'll make the invoice calculation enforce that rather than relying on the cashier's arithmetic.
