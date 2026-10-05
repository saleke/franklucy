Absolutely. **Component 6 — Stock Receiving & Branch Transfers**.

This is where we complete the other side of inventory. Component 3 established *how we track stock*; now we define *how stock gets into a branch and moves between branches*.

# Component 6 — Stock Receiving & Transfers

The fundamental rule:

> **Stock should enter or leave a branch only through a recorded business event.**

No employee should simply type:

> “Ikeja now has 200 crates.”

The system should know **why** Ikeja has 200 crates.

---

## 1. How stock enters the business

There are two main scenarios from your business description.

### Scenario A — Goods arrive at the main branch

Example:

```text
Supplier
   ↓
Main Branch
   ↓
Stock received
```

Suppose the business receives:

```text
50 crates Heineken
100 crates Nutri Milk
80 packs Malt
```

The stockkeeper records a **Goods Receipt**.

```text
RECEIVE GOODS

Supplier: ABC Distributors

Heineken     50 crates
Nutri Milk  100 crates
Malt         80 packs

[Receive Stock]
```

Once confirmed:

```text
Main Branch

Heineken    +50
Nutri Milk +100
Malt        +80
```

And the system creates the corresponding inventory movements.

---

# 2. Scenario B — Supplier delivers directly to a sub-branch

Your business may also order goods directly for a particular branch.

So:

```text
Supplier
   ↓
Ikeja Branch
```

The stock receipt belongs directly to Ikeja.

```text
Ikeja Branch

Heineken +30 crates
Malt     +50 packs
```

This means the inventory system doesn't assume everything must pass through Main Branch.

---

# 3. Goods receiving should be controlled

A stockkeeper shouldn't be able to receive:

```text
100 crates
```

when only 50 actually arrived without leaving a record.

The receiving process should capture:

```text
Receipt
├── Branch
├── Supplier
├── Items
├── Quantities
├── Date/time
├── Received by
└── Reference
```

Potentially later:

```text
├── Purchase order
├── Supplier invoice
└── Cost
```

We don't need a full procurement system yet, but we should leave room for it.

---

# 4. Stock transfers

Now the major use case.

Suppose Main Branch has:

```text
Heineken: 100 crates
```

and Ikeja needs:

```text
20 crates
```

We create:

**Stock Transfer**

```text
TRANSFER STOCK

From:
Main Branch

To:
Ikeja Branch

Heineken:
20 crates

Reason:
Branch replenishment

[Submit Transfer]
```

The system generates:

```text
TR-00045
```

---

# 5. Transfer states

This is important because physical movement takes time.

A transfer shouldn't immediately mean:

> Ikeja has received the goods.

I'd use:

```text
DRAFT
REQUESTED
APPROVED
IN_TRANSIT
RECEIVED
CANCELLED
```

Example:

```text
Main
   │
   │ Transfer 20 crates
   ↓
REQUESTED
   ↓
APPROVED
   ↓
IN TRANSIT
   ↓
Ikeja receives
   ↓
RECEIVED
```

---

# 6. Why this matters

Imagine Main sends:

> 20 crates Heineken

but Ikeja only receives:

> 18 crates.

We **must not automatically put 20 into Ikeja's stock**.

Instead:

```text
Transfer:

Sent:       20 crates
Received:   18 crates
Difference:  2 crates
```

That immediately creates something management can investigate.

---

# 7. Inventory effect of a transfer

This is subtle and important.

### When dispatched

Main:

```text
Available stock: -20
```

But the 20 crates should be considered:

```text
In Transit
```

not simply lost.

### When received

Ikeja:

```text
Available stock: +18
```

If 2 are missing:

```text
Transfer discrepancy: 2
```

This means we can distinguish:

```text
Main stock
Ikeja stock
Stock currently in transit
Missing/discrepant stock
```

That's much better than simply subtracting from one branch and adding to another immediately.

---

# 8. Who can create a transfer?

I'd structure it like this initially:

| Action           | Owner | Manager | Stockkeeper | Cashier |
| ---------------- | ----: | ------: | ----------: | ------: |
| Request transfer |     ✅ |       ✅ |           ✅ |       ❌ |
| Approve transfer |     ✅ |       ✅ |           ❌ |       ❌ |
| Dispatch         |     ✅ |       ✅ |           ✅ |       ❌ |
| Receive          |     ✅ |       ✅ |           ✅ |       ❌ |
| Cancel           |     ✅ |       ✅ |  Controlled |       ❌ |

We can refine this once we understand how the actual employees work.

---

# 9. Separation of duties

There's a useful control we can introduce here.

If possible:

> **The person sending stock should not be the only person confirming that it arrived.**

Example:

```text
Main Branch

Prepared by:
Stockkeeper A

Approved by:
Manager

Dispatched by:
Stockkeeper A
```

Then:

```text
Ikeja Branch

Received by:
Stockkeeper B
```

Now there's a basic chain of accountability.

For a small business, we shouldn't make this unnecessarily bureaucratic, but for high-value stock transfers it can be valuable.

---

# 10. Transfer record

A completed transfer might look like:

```text
TRANSFER #TR-00045

From: Main Branch
To: Ikeja Branch

Heineken
Sent:      20 crates
Received:  20 crates

Nutri Milk
Sent:      10 crates
Received:   9 crates

Status: RECEIVED

Sent by: John
Received by: Peter

Created: 10:15 AM
Received: 11:42 AM
```

The system automatically identifies:

> ⚠️ 1 crate discrepancy

---

# 11. Damaged goods during transfer

This is another real-world situation.

Suppose:

```text
Sent: 20 crates
Received: 19 crates
```

and one crate arrived damaged.

The receiver can record:

```text
Received:
19 crates

Damaged:
1 crate

Reason:
Damaged during transportation
```

Then we don't incorrectly classify it as unexplained missing stock.

The audit trail shows exactly what happened.

---

# 12. Transfer history

The Owner should be able to see:

```text
STOCK TRANSFERS

TR-00045
Main → Ikeja
20 Heineken
Received
✓

TR-00046
Ikeja → Surulere
15 Malt
In Transit
⚠

TR-00047
Main → Lekki
30 Nutri Milk
Discrepancy
⚠
```

Clicking a transfer shows its complete history.

---

# 13. Receiving stock from suppliers

We should use the same philosophy.

A receipt might show:

```text
RECEIPT #GR-00124

Branch: Main
Supplier: ABC Distributors

Heineken       50 crates
Nutri Milk    100 crates
Malt           80 packs

Received by:
Peter

Date:
30 Sep 2026
```

The inventory movements are then:

```text
Heineken     +50
Nutri Milk  +100
Malt         +80
```

---

# 14. Eventually, purchasing can connect to this

Later we can build:

```text
Purchase Order
      ↓
Supplier delivers
      ↓
Goods Receipt
      ↓
Inventory increases
      ↓
Supplier payable
```

But **we don't need full purchasing/accounting yet**.

For MVP, we can simply record:

> Where did this stock come from, what quantity arrived, who received it, and when?

---

# 15. Owner visibility

This component directly supports the owner's requirement for immediate abnormal activity.

The dashboard could show:

```text
STOCK ACTIVITY — TODAY

Received
₦3,200,000 worth

Transfers
7

In Transit
2

Transfer Discrepancies
1

Damaged During Transfer
3 crates

Pending Approvals
2
```

The owner can immediately investigate the discrepancy rather than discovering it weeks later during a stock count.

---

# The complete inventory lifecycle

We're now getting a proper model:

```text
SUPPLIER
   │
   ↓
GOODS RECEIVED
   │
   ↓
BRANCH INVENTORY
   │
   ├──────── SALE ────────→ CUSTOMER
   │
   ├──────── DAMAGE ──────→ LOSS
   │
   ├──────── EXPIRE ──────→ LOSS
   │
   └──────── TRANSFER
                    │
                    ↓
                 IN TRANSIT
                    │
                    ↓
              OTHER BRANCH
```

And every movement leaves a record.

That is the backbone of the inventory-control side of the system.

---

## Next: Component 7 — Attendance

Now we tackle the other major problem you mentioned: **employees arriving late and writing an earlier time in the attendance book.**

We'll design the attendance system around **automatic timestamps**, branch/location context, late detection, attendance corrections, and management visibility—without building payroll yet.
