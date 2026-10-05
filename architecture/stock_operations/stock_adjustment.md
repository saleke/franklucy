# Component 21 — Stock Counts & Inventory Adjustments

## Objective

Provide a controlled way to compare the stock physically present at a branch with the stock the system expects.

The system must be able to answer:

> **What does the system say we have, what did we actually count, and what difference was found?**

If there is a difference, the system records it as an inventory adjustment with a reason and audit trail.

The system must never silently overwrite stock.

---

# 1. Core Principle

Inventory remains movement-based.

A stock count does **not** directly change inventory.

It compares:

```text
Expected Stock
      ↓
Physical Count
      ↓
Difference
      ↓
Approved Adjustment
      ↓
Inventory Movement
```

Example:

```text
System stock:     47 crates
Physical count:   44 crates
Difference:       -3 crates
```

The system records:

```text
ADJUSTMENT
quantity = -3
```

The original stock history remains intact.

---

# 2. Stock Count Workflow

Keep the workflow simple.

### Step 1 — Start count

An authorized employee selects:

* branch
* products to count

The system records the expected quantity from the inventory ledger.

### Step 2 — Physical count

The employee enters what they actually find.

Example:

| Product   | Expected | Counted | Difference |
| --------- | -------: | ------: | ---------: |
| Coca-Cola |       47 |      44 |         -3 |
| Malt      |       31 |      31 |          0 |
| Sprite    |       20 |      22 |         +2 |

The difference is calculated by the server.

```text
difference = countedQuantity - expectedQuantity
```

The client must not be trusted to submit the difference.

### Step 3 — Submit count

The count is saved with:

* employee
* branch
* timestamp
* expected quantity
* counted quantity
* difference

### Step 4 — Adjustment

If differences exist, an authorized user confirms the adjustment.

The system creates the corresponding inventory movements.

---

# 3. Stock Count Model

Add a business document for the physical count.

```prisma id="t9r3k7"
model StockCount {
  id          String        @id @default(cuid())
  branchId    String
  countedBy   String
  status      StockCountStatus

  startedAt   DateTime      @default(now())
  completedAt DateTime?

  notes       String?

  branch      Branch        @relation(
    fields: [branchId],
    references: [id]
  )

  items       StockCountItem[]

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([branchId, createdAt])
}

model StockCountItem {
  id                String     @id @default(cuid())
  stockCountId      String
  productId         String

  expectedQuantity  Int
  countedQuantity   Int
  difference        Int

  stockCount        StockCount @relation(
    fields: [stockCountId],
    references: [id]
  )

  product           Product    @relation(
    fields: [productId],
    references: [id]
  )

  @@unique([stockCountId, productId])
}

enum StockCountStatus {
  IN_PROGRESS
  COMPLETED
  ADJUSTED
}
```

The status exists only to represent the simple lifecycle of the count itself.

It is not an elaborate approval workflow.

---

# 4. Important Concurrency Rule

This is critical.

Suppose:

```text
10:00 AM
System stock = 50
```

An employee starts counting.

Then a cashier sells:

```text
5 crates
```

Now actual system stock is:

```text
45
```

If the employee submits a count based on the old expected quantity of 50, blindly applying:

```text
50 → 45
```

could create an incorrect adjustment.

Therefore, when the count is submitted or adjusted, the server must re-check the current inventory.

The system must not assume that the expected quantity from the beginning of the count is still current.

---

# 5. Handling Stock Changes During a Count

For the MVP, keep this simple and safe.

When a stock count is submitted:

1. Read the current authoritative stock.
2. Compare it against the physical count.
3. Calculate the adjustment from the **current** stock.
4. Record the adjustment.

Example:

```text
Count started:
Expected = 50

Sale occurs:
5 sold

Current system stock:
45

Physical count:
44

Actual adjustment:
44 - 45 = -1
```

Not:

```text
44 - 50 = -6
```

This prevents normal sales activity during a count from becoming a fake stock discrepancy.

---

# 6. Adjustment Rules

An adjustment is an inventory movement.

Examples:

### Missing stock

```text
Expected: 45
Counted: 42

ADJUSTMENT
quantity: -3
```

### Extra stock

```text
Expected: 20
Counted: 22

ADJUSTMENT
quantity: +2
```

### No difference

```text
Expected: 30
Counted: 30

No adjustment movement required.
```

Do not create meaningless zero-quantity movements.

---

# 7. Reasons

Every non-zero adjustment requires a reason.

Initial options:

```text
COUNTING_ERROR
MISSING_STOCK
DAMAGED_STOCK
DATA_CORRECTION
OTHER
```

The UI can present these as simple choices.

For `OTHER`, require a short explanation.

Do not create a complicated reason-management system yet.

---

# 8. No Automatic Theft Classification

A stock discrepancy is evidence of a difference.

It is not automatically evidence of theft.

For example:

```text
Expected: 100
Counted: 97
Difference: -3
```

The system should say:

> Stock variance: -3

It should not say:

> Theft detected.

Management can investigate the discrepancy separately.

---

# 9. Adjustment Permissions

Keep permissions straightforward.

| Role        | Count Stock | Adjust Stock |
| ----------- | ----------: | -----------: |
| Owner       |           ✓ |            ✓ |
| Manager     |           ✓ |            ✓ |
| Stockkeeper |           ✓ |            — |
| Cashier     |           — |            — |

A Stockkeeper can physically count stock without having the authority to change the inventory ledger.

The Owner/Manager can review the difference and apply the adjustment.

If the actual business later decides Stockkeepers can adjust small discrepancies, we can change the permission.

---

# 10. Authoritative Backend Operations

Use explicit business operations.

```ts id="2n2b2u"
startStockCount(...)
submitStockCount(...)
adjustStock(...)
```

Do not expose generic:

```ts
updateStock(...)
```

because that would make it too easy for different parts of the application to bypass inventory rules.

---

# 11. `startStockCount()`

The server should:

1. Authenticate user.
2. Check `inventory.count` permission.
3. Verify branch access.
4. Verify branch is active.
5. Create `StockCount`.
6. Add selected products.
7. Record the expected quantity for display/history.

No inventory movement is created.

---

# 12. `submitStockCount()`

The server should:

1. Authenticate user.
2. Check permission.
3. Load the count.
4. Verify it is still `IN_PROGRESS`.
5. Verify branch access.
6. Validate counted quantities.
7. Recalculate current inventory.
8. Calculate differences.
9. Store the results.
10. Mark the count `COMPLETED`.
11. Create an audit event.

No inventory adjustment occurs merely because the count was submitted.

---

# 13. `adjustStock()`

The server should:

1. Authenticate user.
2. Check `inventory.adjust`.
3. Load the completed stock count.
4. Verify it has not already been adjusted.
5. Re-check authoritative current stock.
6. Calculate the required adjustment.
7. Create `ADJUSTMENT` inventory movement(s).
8. Mark the count `ADJUSTED`.
9. Create an audit event.
10. Commit everything in one transaction.

---

# 14. Inventory Movement

Continue using the existing:

```text id="a2xq49"
InventoryMovement
```

model.

A stock adjustment becomes:

```text
type = ADJUSTMENT
quantity = difference
```

The movement should reference the stock count.

For example:

```text
referenceType = "STOCK_COUNT"
referenceId   = stockCount.id
```

This lets us trace:

```text
Inventory movement
      ↓
Stock count
      ↓
Physical count
      ↓
Person who counted
```

---

# 15. Audit Events

Add:

```text id="h9p5cx"
STOCK_COUNT_STARTED
STOCK_COUNT_COMPLETED
STOCK_ADJUSTED
```

For an adjustment, capture useful information such as:

```text
Expected:
45

Counted:
42

Difference:
-3

Reason:
MISSING_STOCK
```

The audit log should also identify:

* branch
* product
* employee/user
* timestamp
* stock count
* adjustment

---

# 16. Stock Count UI

## `/inventory/counts`

Show recent counts:

| Date      | Branch | Counted By | Differences | Status    |
| --------- | ------ | ---------- | ----------: | --------- |
| Today     | Main   | John       |           2 | Completed |
| Yesterday | Ikeja  | Mary       |           0 | Adjusted  |

Actions:

* Start Count
* View Count

---

# 17. Start Count

The user selects:

```text
Branch
```

Then products.

For efficiency, the system should support:

```text
Search product
```

and ideally:

```text
Count all active products
```

for a full stock count.

But don't force every count to include every product.

A manager might only want to count:

```text
Coca-Cola
Malt
Sprite
```

after noticing something unusual.

---

# 18. Count Screen

Use a simple table:

| Product   | Expected | Actual |
| --------- | -------: | -----: |
| Coca-Cola |       47 |   [44] |
| Malt      |       31 |   [31] |
| Sprite    |       20 |   [22] |

The difference should appear after entering the actual quantity.

The employee should **not** enter the difference manually.

---

# 19. Adjustment Review

After submission, show a review screen:

```text
Stock Count — Main Branch

3 products counted

Variance found:

Coca-Cola   -3
Sprite      +2

[Adjust Stock]
```

For each difference, show the reason.

The adjustment action should be clearly separate from simply completing the physical count.

---

# 20. Important UX Rule

Do not make stock counting feel like accounting software.

The person counting stock is usually standing in a store/warehouse looking at physical goods.

The interface should therefore prioritize:

* large quantity inputs
* fast product search
* minimal fields
* clear expected quantity
* clear actual quantity
* obvious difference
* fast navigation

Avoid unnecessary forms.

---

# 21. Error Handling

Useful business errors:

```text
STOCK_COUNT_NOT_FOUND
STOCK_COUNT_ALREADY_COMPLETED
STOCK_COUNT_ALREADY_ADJUSTED
INVALID_COUNTED_QUANTITY
BRANCH_ACCESS_DENIED
COUNT_PERMISSION_DENIED
ADJUSTMENT_PERMISSION_DENIED
INVENTORY_CHANGED_DURING_COUNT
```

The user should receive actionable messages.

Example:

> Inventory changed while this count was being processed. The current stock has been recalculated. Review the updated variance before applying the adjustment.

---

# 22. Tests

### Stock count

Test:

* authorized user can start count
* unauthorized user cannot start count
* inactive branch rejected
* inactive product rejected
* duplicate product rejected
* negative counted quantity rejected

### Difference calculation

```text
expected 50
counted 47
difference -3
```

```text
expected 50
counted 53
difference +3
```

```text
expected 50
counted 50
difference 0
```

### Adjustment

Verify:

* correct movement created
* correct quantity
* correct branch
* correct product
* count marked `ADJUSTED`
* audit event created

### Safety

Verify:

* same count cannot be adjusted twice
* unauthorized employee cannot adjust
* failed adjustment rolls back
* concurrent stock changes do not produce incorrect adjustments

---

# 23. What We Are Not Building

Do not add:

* automatic theft detection
* disciplinary management
* complex stock-count scheduling
* barcode hardware integration
* cycle-count algorithms
* warehouse zones
* stock-count approval chains
* automatic notifications
* sophisticated variance analytics

Those can be added if the business later needs them.

---

# 24. Definition of Done

Stock counting and adjustment are complete when an authorized employee can:

1. Start a stock count.
2. Select a branch.
3. Select products.
4. See expected quantities.
5. Enter physical quantities.
6. Submit the count.
7. See calculated differences.
8. Provide reasons for discrepancies.
9. Have an authorized manager/owner apply the adjustment.
10. Have the inventory ledger updated through an `ADJUSTMENT` movement.
11. Have the entire action recorded in the audit log.
12. Trace the adjustment back to the physical count.

The system must never silently overwrite the inventory quantity.

---

## Implementation Order

```text id="d0x7la"
21.1  Add StockCount + StockCountItem models
21.2  Implement startStockCount()
21.3  Implement submitStockCount()
21.4  Implement adjustStock()
21.5  Add tests and concurrency protection
21.6  Build stock count UI
21.7  Build count history/detail
```

After this component, inventory will have a complete basic control loop:

```text
Stock enters
     ↓
Stock moves
     ↓
Stock is sold/returned/damaged
     ↓
Physical stock is counted
     ↓
Differences are recorded
     ↓
Inventory is corrected
```

That is enough for the MVP. Don't add more inventory machinery until the business gives us a concrete reason.
