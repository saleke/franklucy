# Component 20 — Branch Stock Transfers

## Objective

Allow authorized staff to move stock directly from one branch to another while keeping inventory accurate and providing a clear record of who moved what, where, and when.

The transfer system should be **simple**.

This business does not need a large warehouse-management workflow with requests, approvals, dispatch queues, receiving stages, or artificial bureaucracy.

The owner or manager decides when stock should move.

The system's job is to **record and enforce the movement correctly**.

---

## 1. Transfer Workflow

The MVP workflow is:

```text
Create Transfer
      ↓
Validate
      ↓
Remove stock from source
      ↓
Add stock to destination
      ↓
Record transfer
      ↓
Record audit event
```

Everything happens inside **one database transaction**.

If anything fails, the entire operation rolls back.

There should be no situation where:

```text
Source loses stock
but
Destination does not receive it
```

---

# 2. Who Can Transfer Stock?

Initial permissions:

| Role        | Transfer Stock |
| ----------- | -------------: |
| Owner       |              ✓ |
| Manager     |              ✓ |
| Stockkeeper |       Optional |
| Cashier     |              — |

The exact Stockkeeper permission can be decided based on how the business operates.

The important rule is:

> A cashier cannot move stock between branches.

The backend must enforce this permission.

Hiding the transfer button is not sufficient security.

---

# 3. Transfer Data Model

Use a simple business document.

```prisma
model StockTransfer {
  id                  String   @id @default(cuid())
  referenceNumber     String   @unique

  sourceBranchId      String
  destinationBranchId String

  createdBy           String

  reason              String?
  notes               String?

  createdAt           DateTime @default(now())

  sourceBranch        Branch   @relation(
    "TransferSource",
    fields: [sourceBranchId],
    references: [id]
  )

  destinationBranch   Branch   @relation(
    "TransferDestination",
    fields: [destinationBranchId],
    references: [id]
  )

  items               StockTransferItem[]

  @@index([sourceBranchId, createdAt])
  @@index([destinationBranchId, createdAt])
}

model StockTransferItem {
  id          String        @id @default(cuid())
  transferId  String
  productId   String
  quantity    Int

  transfer    StockTransfer @relation(
    fields: [transferId],
    references: [id]
  )

  product     Product       @relation(
    fields: [productId],
    references: [id]
  )

  @@unique([transferId, productId])
}
```

No transfer status is required for the MVP.

No:

```text
REQUESTED
APPROVED
DISPATCHED
IN_TRANSIT
RECEIVED
CANCELLED
```

unless the actual business later demonstrates that one of these states is necessary.

---

# 4. Transfer Reference

Every transfer receives a server-generated reference number.

Example:

```text
TRF-MAIN-00001
TRF-MAIN-00002
TRF-IKEJA-00003
```

The client does not provide this value.

The database `UNIQUE` constraint provides the final protection against duplicates.

---

# 5. Transfer Rules

The backend must enforce:

### Source and destination must differ

```text
sourceBranchId !== destinationBranchId
```

A branch cannot transfer stock to itself.

### At least one item

A transfer with no products is invalid.

### Positive quantities

```text
quantity > 0
```

Only positive integer quantities are allowed in the MVP.

### No duplicate products

A product should appear once per transfer.

The database enforces this with:

```prisma
@@unique([transferId, productId])
```

### Product must be active

Inactive products cannot be transferred.

### Product must exist at the source

The product must be available for the source branch.

### Sufficient stock

The source branch must have enough available stock.

The server calculates the authoritative stock.

The client cannot tell the server:

```text
"I have 500 crates"
```

and expect that to be trusted.

---

# 6. Inventory Effect

When a transfer succeeds, create two inventory movements for every item.

Example:

```text
20 crates Coca-Cola
Main → Ikeja
```

creates:

```text
Main:
TRANSFER_OUT
quantity = 20

Ikeja:
TRANSFER_IN
quantity = 20
```

The resulting stock becomes:

```text
Main:   -20
Ikeja:  +20
```

This happens in the same database transaction as the transfer record.

---

# 7. Inventory Remains Movement-Based

Do not add a separate `stockQuantity` field to the transfer system.

Inventory continues to come from the movement ledger:

```text
Opening Stock
+ Purchases
+ Transfer In
+ Returns
- Sales
- Transfer Out
- Damaged
- Expired
± Adjustments
```

A transfer is simply another reason inventory changed.

---

# 8. Authoritative Backend Operation

Create one main service:

```ts
createTransfer(input, context)
```

The server workflow is:

```text
1. Authenticate user

2. Check transfer permission

3. Determine authorized branch context

4. Validate input

5. Verify source and destination branches

6. Load requested products

7. Verify products are active

8. Calculate current source stock

9. Verify sufficient stock

10. Generate transfer reference

11. Create StockTransfer

12. Create StockTransferItems

13. Create TRANSFER_OUT movements

14. Create TRANSFER_IN movements

15. Create audit event

16. Commit transaction
```

No frontend calculation is authoritative.

---

# 9. Concurrency Protection

Stock transfers must protect against two people moving the same stock at the same time.

Example:

```text
Available stock = 20

Manager A transfers 15
Manager B transfers 10
```

Both requests must not succeed.

The database transaction must ensure that only one operation can consume the available stock.

This uses the same inventory-concurrency strategy established for sales.

---

# 10. Audit Event

Every completed transfer creates an audit record.

Example:

```text
Action:
TRANSFER_CREATED

User:
John

Source:
Main Branch

Destination:
Ikeja Branch

Products:
Coca-Cola × 20
Malt × 10

Time:
2026-09-30 14:32
```

The transfer record itself stores the business information.

The audit log records the security/activity trail.

These serve different purposes.

---

# 11. Transfer UI

The UI should be equally simple.

## `/transfers`

Show:

| Reference      | From | To    | Items | Created By | Date  |
| -------------- | ---- | ----- | ----: | ---------- | ----- |
| TRF-MAIN-00021 | Main | Ikeja |     3 | John       | Today |

Actions:

* Search
* Filter by branch
* Filter by date
* View transfer
* New Transfer

---

# 12. New Transfer

`/transfers/new`

The screen should contain:

### From

Select source branch.

### To

Select destination branch.

### Products

Search products and add quantities.

Example:

```text
Coca-Cola       Available: 80     Qty: 20
Malt            Available: 42     Qty: 10
Sprite          Available: 35     Qty: 5
```

The UI should clearly show available source stock.

### Reason

Optional.

Examples:

```text
Low stock at Ikeja
Branch restocking
Stock redistribution
```

### Notes

Optional.

### Transfer

A clear primary action:

```text
Transfer Stock
```

Before submission, show a concise confirmation:

```text
Main Branch → Ikeja Branch

Coca-Cola    20
Malt         10
Sprite        5

Total items: 35

[Transfer Stock]
```

---

# 13. Transfer Detail

The detail page should show:

```text
TRF-MAIN-00021

Main Branch → Ikeja Branch

Created by:
John

Date:
30 Sep 2026, 2:32 PM
```

Then:

| Product   | Quantity |
| --------- | -------: |
| Coca-Cola |       20 |
| Malt      |       10 |
| Sprite    |        5 |

And:

```text
Reason
Branch restocking
```

There is no unnecessary workflow timeline because there are no workflow stages.

---

# 14. Error Handling

Useful business errors include:

```text
TRANSFER_NOT_FOUND
TRANSFER_PERMISSION_DENIED
INVALID_SOURCE_BRANCH
INVALID_DESTINATION_BRANCH
SAME_SOURCE_AND_DESTINATION
TRANSFER_HAS_NO_ITEMS
INVALID_TRANSFER_QUANTITY
PRODUCT_NOT_FOUND
PRODUCT_NOT_AVAILABLE
INSUFFICIENT_STOCK
```

The user should see a useful explanation rather than:

```text
500 Internal Server Error
```

For example:

> Not enough Coca-Cola stock at Main Branch. Available: 12 crates.

---

# 15. Tests

The transfer module must test the important business rules.

### Successful transfer

Verify:

* transfer created
* transfer items created
* source stock decreases
* destination stock increases
* audit event created

### Invalid transfer

Reject:

* same source/destination
* empty transfer
* zero quantity
* negative quantity
* inactive product
* missing product
* insufficient stock
* unauthorized user

### Security

Verify that:

* cashier cannot create transfers
* unauthorized branch access is rejected
* client-supplied branch context cannot bypass authorization

### Transaction rollback

If creating a movement or audit record fails, the transfer must not partially exist.

### Concurrency

Two simultaneous transfers cannot consume more stock than is actually available.

---

# 16. What We Are Deliberately Not Building

For the MVP, do **not** add:

* transfer requests
* approval queues
* dispatch workflow
* receiving workflow
* transfer status machine
* shipment tracking
* delivery tracking
* transport management
* transfer cancellation workflow
* warehouse management
* barcode scanning specifically for transfers
* notifications specifically for transfers

If the business later needs one of these, we add it because there is an actual operational problem to solve.

Not because enterprise software commonly has it.

---

# 17. Definition of Done

Branch transfers are complete when an authorized user can:

1. Choose a source branch.
2. Choose a destination branch.
3. Add products and quantities.
4. See available source stock.
5. Provide an optional reason.
6. Submit the transfer.
7. Have the server validate everything.
8. Have source inventory decrease.
9. Have destination inventory increase.
10. Receive a unique transfer reference.
11. See the transfer in transfer history.
12. View who created it and when.
13. See the activity in the audit log.
14. Be prevented from transferring stock they don't have.
15. Be prevented from performing transfers without permission.

The entire operation must be atomic and concurrency-safe.

---

## Implementation Order

Implement only these pieces:

```text
20.1  Add StockTransfer + StockTransferItem
20.2  Implement createTransfer()
20.3  Add transfer tests
20.4  Build /transfers
20.5  Build /transfers/new
20.6  Build transfer detail
```

Then move on.

Do not expand the transfer system until the actual business gives us a reason to.
