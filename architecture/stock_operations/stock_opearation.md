# Component 19 — Inventory & Stock Operations

## Objective

Build the inventory system that gives the business a reliable answer to:

> **What stock should we have, what stock do we actually have, and what happened to the difference?**

Inventory must be treated as a history of controlled stock movements rather than a manually editable number.

The system should support:

* Opening stock
* Stock receiving
* Sales
* Customer returns
* Damaged goods
* Expired goods
* Stock adjustments
* Physical stock counts
* Low-stock monitoring
* Inventory history
* Branch-specific stock
* Future branch transfers

---

# 1. Core Inventory Principle

Never allow users to directly edit:

```text
Current Stock = 120
```

Instead, stock is derived from movements:

```text
Opening Stock
+ Purchases
+ Transfer In
+ Customer Returns
- Sales
- Transfer Out
- Damaged
- Expired
± Adjustments
────────────────────────
Expected Stock
```

This creates an explainable inventory trail.

If today's stock is wrong, the manager can investigate the movements instead of simply seeing:

```text
Stock: 87
```

with no explanation.

---

# 2. Inventory Workspace

Route:

```text
/inventory
```

Desktop structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ Inventory                              [ Receive Stock ]      │
│ Main Branch                                                  │
├──────────────────────────────────────────────────────────────┤
│ Search products...     Category ▼     Status ▼               │
├──────────────────────────────────────────────────────────────┤
│ Product       Available     Reorder     Status               │
│                                                              │
│ Heineken      42 crates     10          Healthy              │
│ Malt          8 packs       15          Low Stock            │
│ Nutri Milk    0 crates      8           Out of Stock         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    Product Detail                            │
└──────────────────────────────────────────────────────────────┘
```

The screen should answer the most important questions immediately:

* What do we have?
* What is running low?
* What needs attention?
* What changed recently?

---

# 3. Product Inventory Row

Each product row should show:

```text
Product
Available
Reorder Level
Status
Last Movement
```

Example:

```text
Heineken

42 crates
Reorder at 10

Healthy

Last movement:
Sale · 2 crates · 09:42
```

Avoid exposing unnecessary database fields.

The user needs operational information, not a database dump.

---

# 4. Inventory Status

Use meaningful statuses.

### Healthy

```text
Available > reorder level
```

### Low Stock

```text
Available <= reorder level
```

### Out of Stock

```text
Available = 0
```

The exact business rules can later account for pending incoming transfers, but MVP should keep this straightforward.

Status should not rely on color alone.

Use:

```text
● Healthy
● Low Stock
● Out of Stock
```

with appropriate semantic colors and text.

---

# 5. Product Detail

Clicking a product opens a detailed workspace/drawer.

Example:

```text
┌──────────────────────────────────────────┐
│ Heineken                          Active │
│                                          │
│ Available                                │
│ 42 crates                                │
│                                          │
│ Reorder level                            │
│ 10 crates                                │
│                                          │
│ ──────────────────────────────────────── │
│                                          │
│ Recent Activity                          │
│                                          │
│ 09:42  Sale             -2               │
│ 08:30  Stock Received   +20              │
│ Yesterday Transfer Out -10               │
│                                          │
│ [ Stock Count ]                          │
│ [ Record Damage ]                        │
│ [ Record Expiry ]                        │
└──────────────────────────────────────────┘
```

The movement history is one of the most important pieces of the inventory UI.

---

# 6. Inventory Movement

Every stock-changing operation creates an `InventoryMovement`.

Current movement types:

```text
OPENING_STOCK
PURCHASE
SALE
TRANSFER_IN
TRANSFER_OUT
RETURN_IN
DAMAGED
EXPIRED
ADJUSTMENT
```

Each movement should answer:

```text
What happened?
Which product?
Which branch?
How much?
Why?
Who recorded it?
When?
What business record caused it?
```

For example:

```text
Sale
Heineken
-2 crates
Invoice INV-MAIN-000482
Cashier: John
09:42
```

---

# 7. Opening Stock

Opening stock is how the initial physical inventory enters the system.

Example:

```text
Heineken → 50 crates
Malt → 30 packs
Nutri Milk → 20 crates
```

Create:

```text
OPENING_STOCK
```

movements.

Opening stock should be a controlled setup operation.

It should not be available as an everyday cashier action.

Recommended permission:

```text
inventory.opening_stock
```

Initially:

* Owner
* Manager

---

# 8. Receiving Stock

Route/workflow:

```text
Inventory
→ Receive Stock
```

Form:

```text
Receive Stock

Supplier
[ Supplier Name ]

Reference
[ PO / Delivery Note ]

Product
[ Search product ]

Quantity
[ 20 ]

Unit
Crates

[ Add Item ]

────────────────────

Heineken     20 crates
Malt         10 packs

[ Receive Stock ]
```

On completion:

```text
InventoryMovement
type = PURCHASE
quantity = received quantity
```

The system records:

* branch
* employee
* date/time
* supplier/reference
* products
* quantities

---

# 9. Receiving Must Be Atomic

If a receiving document contains:

```text
Heineken 20
Malt 10
Nutri Milk 15
```

all movements should be created in one transaction.

If something fails:

```text
Heineken +20
Malt +10
Nutri Milk +15
```

should not partially enter the system.

Either:

```text
everything succeeds
```

or:

```text
nothing succeeds
```

---

# 10. Damaged Goods

Damaged stock should not simply disappear.

Workflow:

```text
Product
→ Record Damage
```

Example:

```text
Record Damaged Stock

Product
Heineken

Available
42 crates

Damaged quantity
[ 2 ]

Reason
[ Damaged packaging ]

Notes
[ __________________ ]

[ Record Damage ]
```

Creates:

```text
DAMAGED
quantity = 2
```

Stock becomes:

```text
42 → 40
```

But the system preserves:

```text
2 crates
DAMAGED
Reason: Damaged packaging
Recorded by: Employee
Time: ...
```

This directly addresses the current business problem of damaged goods being poorly tracked.

---

# 11. Expired Goods

Expired stock follows a similar workflow:

```text
Record Expiry

Product
Expiration date
Quantity
Reason/notes

[ Record Expired Stock ]
```

Creates:

```text
EXPIRED
```

movement.

Do not combine damaged and expired into a generic adjustment.

They represent different operational causes and should remain distinguishable in reports.

---

# 12. Physical Stock Count

This is one of the most important inventory workflows.

The system may say:

```text
Expected:
42 crates
```

The employee physically counts:

```text
Actual:
39 crates
```

The system calculates:

```text
Difference:
-3 crates
```

The employee cannot simply type:

```text
Stock = 39
```

Instead:

```text
Expected stock
42

Actual stock
39

Difference
-3

Reason
[ __________________ ]

[ Submit Count ]
```

---

# 13. Stock Count Is Evidence

The system should distinguish:

```text
Expected stock
```

from:

```text
Physical stock
```

and then create:

```text
ADJUSTMENT
```

only after the appropriate approval process.

This matters because:

```text
Stock is missing
```

does **not** automatically mean:

```text
Employee stole it
```

The system records the discrepancy.

Management investigates.

The software preserves the evidence.

---

# 14. Adjustment Approval

For MVP, stock adjustments should be controlled.

Suggested flow:

```text
Physical Count
      ↓
Difference detected
      ↓
Adjustment Request
      ↓
Manager reviews
      ↓
Approved / Rejected
      ↓
If approved:
ADJUSTMENT movement
```

This prevents a stockkeeper from simply correcting suspicious inventory without oversight.

---

# 15. Stock Count UI

Example:

```text
┌──────────────────────────────────────────────────────────┐
│ Stock Count — Main Branch                                │
├──────────────────────────────────────────────────────────┤
│ Product       Expected      Actual       Difference      │
│                                                          │
│ Heineken      42            39           -3              │
│ Malt          18            18            0              │
│ Nutri Milk    25            27           +2              │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ 2 discrepancies require review                           │
│                                                          │
│ [ Submit Count ]                                         │
└──────────────────────────────────────────────────────────┘
```

Zero-difference products should be visually quiet.

Discrepancies should attract attention.

---

# 16. Low Stock

The inventory workspace should surface low stock without requiring a report.

Example:

```text
Attention

3 products are below reorder level.

Malt
8 / 15 packs

Nutri Milk
4 / 10 crates

Water
6 / 20 crates

[ Review Low Stock ]
```

This can also appear on the Today dashboard.

---

# 17. Inventory Search

Search should support:

* Product name
* SKU
* Category

Filters:

* Healthy
* Low stock
* Out of stock
* Active
* Inactive

Later:

* Supplier
* Movement type
* Date range
* Branch

Do not overload the first version with every conceivable filter.

---

# 18. Branch Scope

Every inventory query is branch-scoped.

A cashier at:

```text
Main Branch
```

should not see:

```text
Ikeja Branch stock
```

unless their permissions explicitly allow it.

A manager responsible for multiple branches can switch branch context.

Owner can inspect all branches.

The backend enforces this.

---

# 19. Permissions

Initial permissions:

```text
inventory.view
inventory.receive
inventory.opening_stock
inventory.damage
inventory.expiry
inventory.count
inventory.adjust
inventory.adjust.approve
```

Suggested initial access:

| Operation          | Owner | Manager | Stockkeeper | Cashier |
| ------------------ | ----: | ------: | ----------: | ------: |
| View inventory     |     ✓ |       ✓ |           ✓ | limited |
| Receive stock      |     ✓ |       ✓ |           ✓ |       — |
| Opening stock      |     ✓ |       ✓ |           — |       — |
| Record damage      |     ✓ |       ✓ |           ✓ |       — |
| Record expiry      |     ✓ |       ✓ |           ✓ |       — |
| Perform count      |     ✓ |       ✓ |           ✓ |       — |
| Request adjustment |     ✓ |       ✓ |           ✓ |       — |
| Approve adjustment |     ✓ |       ✓ |           — |       — |

These are permissions, not security implemented solely through hidden UI elements.

---

# 20. Audit Requirements

Every inventory-sensitive operation must create an audit event.

Examples:

```text
STOCK_RECEIVED
DAMAGED_RECORDED
EXPIRED_RECORDED
STOCK_COUNT_SUBMITTED
STOCK_ADJUSTED
```

Audit information:

```text
Who
Branch
When
Product
Quantity
Reason
Related record
```

For adjustments, preserve:

```text
Expected
Actual
Difference
Reason
Approved by
```

---

# 21. Inventory APIs / Server Operations

Do not make the UI directly manipulate `InventoryMovement`.

Create authoritative business operations:

```ts
receiveStock()
recordDamagedStock()
recordExpiredStock()
submitStockCount()
approveStockAdjustment()
```

Each operation should follow:

```text
Authenticate
    ↓
Permission
    ↓
Branch access
    ↓
Validate input
    ↓
Validate business rules
    ↓
Database transaction
    ↓
Inventory movement
    ↓
Audit event
    ↓
Return result
```

The UI never decides what movement type to create.

For example, it should call:

```ts
recordDamagedStock(...)
```

rather than:

```ts
createInventoryMovement({
  type: "DAMAGED"
})
```

This keeps business meaning inside the backend.

---

# 22. Inventory Concurrency

The inventory system must use the same concurrency discipline established for sales.

If two operations happen simultaneously:

```text
Sale: -5
Damage: -2
```

and available stock is:

```text
5
```

the system must not accidentally permit:

```text
5 - 5 - 2 = -2
```

when negative stock is prohibited.

The authoritative stock operation must therefore validate against the latest transactionally consistent state.

---

# 23. Inventory Reports

Do not start with giant analytics dashboards.

Start with useful questions:

### Current Stock

```text
What do we currently have?
```

### Low Stock

```text
What needs replenishment?
```

### Stock Movement

```text
What changed?
```

### Discrepancies

```text
Where does physical stock differ from expected?
```

### Damaged / Expired

```text
What stock was lost because of damage or expiry?
```

### Stock Value

This can be introduced later once the business's costing method is properly defined.

Do not invent a valuation method prematurely.

---

# 24. Inventory Detail Example

A manager opening Heineken should see something like:

```text
Heineken
Main Branch

Available
40 crates

Reorder level
10 crates

────────────────────────

Movement History

Today 09:42
Sale
-2
INV-MAIN-000482
John

Today 08:30
Received
+20
Delivery #4821
Peter

Yesterday 17:15
Damaged
-1
Damaged packaging
James

Yesterday 14:00
Sale
-4
INV-MAIN-000471
Mary

────────────────────────

[ Stock Count ]
[ Record Damage ]
[ Record Expiry ]
```

This is much more useful than:

```text
Product ID
Branch ID
Stock quantity
Updated at
```

---

# 25. Database Considerations

The existing `InventoryMovement` model remains central.

However, as we implement the workflow, we should consider adding dedicated records for operations where additional information matters.

For example:

```text
StockReceipt
StockCount
StockAdjustmentRequest
```

These are business documents.

They can then generate inventory movements.

Conceptually:

```text
StockReceipt
     ↓
InventoryMovement(PURCHASE)
```

and:

```text
StockCount
     ↓
Adjustment approval
     ↓
InventoryMovement(ADJUSTMENT)
```

This is preferable to trying to force every piece of business information into `InventoryMovement`.

---

# 26. Important distinction

`InventoryMovement` answers:

> What changed?

A business document answers:

> Why did it change and what process produced it?

For example:

```text
StockReceipt
  supplier = ABC Drinks
  reference = DN-4821
  receivedBy = Peter

        ↓

InventoryMovement
  type = PURCHASE
  quantity = 20
```

That separation will make future reporting much easier.

---

# 27. Component Structure

Suggested frontend:

```text
src/components/inventory/
  inventory-workspace.tsx
  inventory-table.tsx
  inventory-row.tsx
  inventory-filters.tsx
  inventory-status.tsx
  product-inventory-drawer.tsx
  movement-history.tsx
  receive-stock-form.tsx
  damage-stock-form.tsx
  expiry-stock-form.tsx
  stock-count-workspace.tsx
  adjustment-review.tsx
  low-stock-panel.tsx
```

Backend:

```text
src/modules/inventory/
  inventory.service.ts
  inventory.repository.ts
  inventory.validation.ts
  inventory.errors.ts
  stock-calculation.ts
  receiving.service.ts
  stock-count.service.ts
  adjustment.service.ts
```

---

# 28. Testing

### Receiving

* [ ] Receive valid stock
* [ ] Quantity must be positive
* [ ] Product must exist
* [ ] Product must be active
* [ ] Correct branch
* [ ] Movement created
* [ ] Audit created
* [ ] Failure rolls back

### Damage

* [ ] Cannot damage more than available
* [ ] Creates DAMAGED movement
* [ ] Requires reason
* [ ] Audit created

### Expiry

* [ ] Cannot expire more than available
* [ ] Creates EXPIRED movement
* [ ] Audit created

### Stock count

* [ ] Expected stock calculated by server
* [ ] Actual quantity recorded
* [ ] Difference calculated by server
* [ ] Adjustment requires approval
* [ ] Original count preserved

### Permissions

* [ ] Cashier cannot adjust stock
* [ ] Stockkeeper cannot approve own adjustment
* [ ] Wrong branch rejected
* [ ] Unauthorized operations rejected

### Concurrency

* [ ] Concurrent stock-changing operations cannot create invalid negative stock
* [ ] Transactions roll back correctly

---

# 29. Definition of Done

Component 19 is complete when a branch can realistically operate its inventory through the system:

```text
Opening Stock
     ↓
Receive Stock
     ↓
Available Inventory
     ↓
       ├── Sale
       ├── Damage
       ├── Expiry
       ├── Customer Return
       └── Transfer
               ↓
        Updated Inventory
               ↓
        Physical Stock Count
               ↓
        Discrepancy
               ↓
       Controlled Adjustment
```

And management can answer:

> **What do we have?**

> **What changed?**

> **Who changed it?**

> **Why did it change?**

> **What should we have physically?**

> **Where are the discrepancies?**

That is the actual purpose of the inventory module.

---

## Implementation order

Do not build all of Component 19 at once.

Build it in this sequence:

```text
19.1  Inventory calculation
      ↓
19.2  Inventory workspace
      ↓
19.3  Product movement history
      ↓
19.4  Stock receiving
      ↓
19.5  Damaged / expired stock
      ↓
19.6  Physical stock count
      ↓
19.7  Adjustment approval
      ↓
19.8  Low-stock alerts
      ↓
19.9  Tests + concurrency verification
```

**19.1 is the immediate next implementation step:** establish the authoritative `getAvailableStock()` calculation and its database/concurrency behavior before building the inventory screens on top of it.
