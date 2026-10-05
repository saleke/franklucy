# Component 22 — Stock Receiving & Supplier Deliveries

## Objective

Provide a controlled way to record goods physically received from suppliers into a branch.

The system must establish a trustworthy boundary between:

```text
Supplier delivers goods
        ↓
Branch receives and checks goods
        ↓
System records accepted quantities
        ↓
Inventory increases
```

The receiving process must answer:

* What supplier delivered the goods?
* Which branch received them?
* When were they received?
* Who received them?
* What products arrived?
* How many were accepted?
* Were any quantities damaged/rejected?
* What supplier invoice/reference was associated with the delivery?
* What inventory movement did the delivery create?

---

# 1. Keep Receiving Separate From Purchasing

For the MVP, **do not build a procurement system**.

We do not need:

* purchase orders
* supplier quotations
* purchase approval workflows
* supplier accounts/payables
* supplier invoices as accounting documents
* purchase budgets
* procurement dashboards
* automatic supplier payments

Those are different business processes.

Our immediate requirement is:

> **Record actual stock that physically arrived.**

Therefore the core operation is:

```text
Receive Stock
```

not:

```text
Create Purchase Order
```

---

# 2. Core Receiving Workflow

The workflow should be:

```text
Supplier delivers goods
        ↓
Staff checks delivery
        ↓
Create stock receipt
        ↓
Enter quantities received
        ↓
Record damaged/rejected quantities if applicable
        ↓
Confirm receipt
        ↓
Inventory movements created
        ↓
Audit event created
```

Once confirmed, the receipt becomes historical evidence.

It should not be casually edited.

If something was recorded incorrectly, use a correction process rather than silently changing history.

---

# 3. What Actually Changes Inventory?

Only **confirmed received stock** changes inventory.

Example:

```text
Supplier delivers:

Coca-Cola: 100 crates
Malt:       50 crates
```

The branch checks everything and accepts:

```text
Coca-Cola: 100
Malt:       50
```

The system creates:

```text
PURCHASE
Coca-Cola +100
PURCHASE
Malt +50
```

Inventory increases by those quantities.

---

# 4. Damaged or Rejected Goods

This is an important real-world case.

Suppose the supplier delivers:

```text
Coca-Cola: 100 crates
```

but 3 crates are damaged on arrival.

The system should not simply record:

```text
PURCHASE +100
```

because the business did not actually receive 100 usable crates.

Instead record:

```text
Delivered: 100
Accepted:   97
Damaged:     3
```

The inventory effect is:

```text
PURCHASE   +97
DAMAGED     -3
```

However, the important distinction is that the receipt still records that **100 crates arrived**.

This preserves evidence about what happened at delivery.

The business can then deal with the supplier separately.

No supplier compensation/accounting workflow is required in this component.

---

# 5. Receipt Data Model

Introduce a business document:

```prisma id="m5x1j8"
model StockReceipt {
  id              String   @id @default(cuid())
  referenceNumber String   @unique

  branchId        String
  supplierId      String?

  receivedBy      String

  supplierReference String?

  receivedAt      DateTime @default(now())

  notes           String?

  branch          Branch   @relation(
    fields: [branchId],
    references: [id]
  )

  supplier        Supplier? @relation(
    fields: [supplierId],
    references: [id]
  )

  items           StockReceiptItem[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([branchId, receivedAt])
  @@index([supplierId, receivedAt])
}

model StockReceiptItem {
  id                String       @id @default(cuid())

  receiptId         String
  productId         String

  deliveredQuantity Int
  acceptedQuantity  Int
  damagedQuantity   Int

  receipt           StockReceipt @relation(
    fields: [receiptId],
    references: [id]
  )

  product           Product      @relation(
    fields: [productId],
    references: [id]
  )

  @@unique([receiptId, productId])
}
```

---

# 6. Supplier Model

A small supplier record is justified because supplier information is useful for identifying where stock came from.

But keep it deliberately small.

```prisma id="w9h2kc"
model Supplier {
  id        String         @id @default(cuid())

  name      String
  phone     String?
  address   String?
  status    SupplierStatus @default(ACTIVE)

  receipts  StockReceipt[]

  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}

enum SupplierStatus {
  ACTIVE
  INACTIVE
}
```

Do **not** turn this into a supplier accounting system.

For example, we are deliberately not adding:

```text
supplierBalance
amountOwed
creditTerms
bankAccount
paymentHistory
```

Those belong to a future accounting/payables component if the business eventually needs them.

---

# 7. Receipt Reference Number

Every receipt gets a server-generated reference.

Example:

```text id="w7o3tq"
REC-MAIN-00001
REC-MAIN-00002
REC-IKEJA-00003
```

The client does not provide this.

The database enforces uniqueness.

---

# 8. Receipt Rules

The server must enforce these rules.

### Branch

The receiving branch must be active.

The user must have permission to receive stock into that branch.

The client cannot simply choose an unauthorized branch.

### Supplier

If a supplier is selected:

* supplier must exist
* supplier must be active

### Products

Every product must:

* exist
* be active
* be available to the receiving branch

### Quantities

All quantities must be non-negative integers.

```text id="x1t6bg"
deliveredQuantity >= 0
acceptedQuantity >= 0
damagedQuantity >= 0
```

And:

```text id="r6dr7y"
acceptedQuantity + damagedQuantity
    =
deliveredQuantity
```

This invariant is important.

The system should never accept:

```text
Delivered: 100
Accepted: 90
Damaged: 5
```

because 5 units have disappeared from the record.

---

# 9. At Least One Accepted or Damaged Quantity

A receipt with:

```text
delivered = 0
accepted = 0
damaged = 0
```

is meaningless.

Therefore a receipt must contain actual delivery information.

At least one item must have:

```text
deliveredQuantity > 0
```

---

# 10. Inventory Movements

For each receipt item:

### Normal delivery

```text
Delivered: 100
Accepted: 100
Damaged: 0
```

Create:

```text
PURCHASE +100
```

### Delivery with damage

```text
Delivered: 100
Accepted: 97
Damaged: 3
```

Create:

```text
PURCHASE +97
DAMAGED  -3
```

Both movements reference the receipt.

For example:

```text id="z6t4be"
referenceType = "STOCK_RECEIPT"
referenceId   = receipt.id
```

This gives us a traceable chain:

```text
Inventory movement
       ↓
Stock receipt
       ↓
Supplier
       ↓
Person who received it
       ↓
Date/time
```

---

# 11. Why Record `deliveredQuantity` Separately?

This is important enough to make explicit.

If we only store:

```text
receivedQuantity = 97
```

we lose the information that the supplier actually delivered 100 and 3 were damaged/rejected.

With:

```text
delivered = 100
accepted  = 97
damaged   = 3
```

management can later investigate supplier delivery problems.

It also prevents someone from quietly changing:

```text
100 → 97
```

without explaining where the missing 3 went.

---

# 12. No Purchase Price Yet

Do **not** put purchase price into this component unless the business specifically needs it now.

The current inventory system needs to know:

> How many units entered the branch?

It does not necessarily need to know:

> What accounting value should we assign to those units?

That becomes important for accounting, cost of goods sold, profit reporting, and supplier payable tracking.

Those are larger financial decisions.

We should not introduce them casually.

---

# 13. Receiving Permissions

Keep this simple.

| Role        | View | Receive |
| ----------- | ---: | ------: |
| Owner       |    ✓ |       ✓ |
| Manager     |    ✓ |       ✓ |
| Stockkeeper |    ✓ |       ✓ |
| Cashier     |    — |       — |

The exact Stockkeeper permission can be changed according to the real operating procedure.

A cashier should not be able to increase inventory by creating a fake supplier delivery.

---

# 14. Authoritative Backend Operation

Use one primary operation:

```ts id="5ak3j1"
receiveStock(input, context)
```

The server should:

```text id="3q4xqy"
1. Authenticate user

2. Check inventory.receive permission

3. Determine authorized branch

4. Validate input

5. Validate supplier if supplied

6. Validate products

7. Validate quantities

8. Generate receipt reference

9. Create StockReceipt

10. Create StockReceiptItems

11. Create PURCHASE movements
    for accepted quantities

12. Create DAMAGED movements
    for damaged quantities

13. Create audit event

14. Commit transaction
```

Everything happens in one transaction.

---

# 15. No Direct Stock Editing

The receiving UI must never do something like:

```ts id="9w5xpl"
product.stock += 100
```

There is no direct stock field to modify.

The UI calls:

```text id="u2n2b7"
receiveStock()
```

and the backend creates the appropriate inventory movements.

---

# 16. Idempotency

Receiving stock is a financial/operationally important operation.

A user might press:

```text
Receive Stock
```

and experience a network timeout.

They might press it again.

The system must not create:

```text
PURCHASE +100
PURCHASE +100
```

because the first request may already have succeeded.

Therefore `receiveStock()` should support an idempotency key, just like `completeSale()`.

A retry with the same idempotency key should return the original receipt instead of creating another one.

---

# 17. Receipt UI

## `/inventory/receiving`

Show recent deliveries:

| Reference       | Supplier      | Branch | Items | Received By | Date      |
| --------------- | ------------- | ------ | ----: | ----------- | --------- |
| REC-MAIN-00041  | ABC Drinks    | Main   |     5 | John        | Today     |
| REC-IKEJA-00040 | XYZ Beverages | Ikeja  |     3 | Mary        | Yesterday |

Actions:

* Search
* Filter by branch
* Filter by supplier
* Filter by date
* View receipt
* Receive Stock

---

# 18. Receive Stock Screen

`/inventory/receiving/new`

### Branch

The branch should normally come from the user's authenticated branch context.

If the user can operate multiple branches, allow them to select an authorized branch.

Never allow arbitrary branch IDs.

### Supplier

Search/select supplier.

Provide:

```text
+ New Supplier
```

but keep supplier creation simple.

### Supplier Reference

Optional field for:

* supplier invoice number
* delivery note number
* supplier reference

Example:

```text
INV-ABC-20491
```

This is a reference only.

It does not mean the system has verified the supplier's invoice.

### Products

Search and add products.

Example:

| Product   | Delivered | Accepted | Damaged |
| --------- | --------: | -------: | ------: |
| Coca-Cola |       100 |       97 |       3 |
| Malt      |        50 |       50 |       0 |

The system calculates the relationship:

```text
accepted + damaged = delivered
```

The user should not manually enter a separate unexplained inventory adjustment.

---

# 19. Simplify the Normal Case

Most deliveries will probably have no damage.

The normal UI should therefore make this easy.

For example:

```text
Product       Quantity
Coca-Cola     [100]
Malt          [50]
Sprite        [30]
```

Damage/rejection details can be expanded when necessary:

```text
Coca-Cola
Received: 100

Damaged/rejected: [3]
Accepted: 97
```

Do not force users through unnecessary fields every time.

---

# 20. Confirmation

Before final submission:

```text id="v5n7aa"
Receive Stock

Branch:
Main Branch

Supplier:
ABC Drinks

Reference:
INV-ABC-20491

Products:

Coca-Cola       100 delivered
                 97 accepted
                  3 damaged

Malt             50 delivered
                 50 accepted
                  0 damaged

[Confirm Receipt]
```

Once confirmed, the receipt is recorded.

---

# 21. Receipt Detail

Show:

```text id="a5df7x"
REC-MAIN-00041

ABC Drinks
Main Branch

Received by:
John

Received:
30 Sep 2026, 11:24 AM

Supplier reference:
INV-ABC-20491
```

Then:

| Product   | Delivered | Accepted | Damaged |
| --------- | --------: | -------: | ------: |
| Coca-Cola |       100 |       97 |       3 |
| Malt      |        50 |       50 |       0 |

And optionally:

```text
Inventory impact

Coca-Cola
+97 PURCHASE
-3 DAMAGED

Malt
+50 PURCHASE
```

This makes the relationship between receiving and inventory transparent.

---

# 22. Corrections

Completed receipts should not be directly edited.

Suppose someone accidentally records:

```text
Coca-Cola: 100
```

when the actual accepted quantity was:

```text
90
```

Do not simply change the old receipt from 100 to 90.

That destroys historical evidence.

Instead, create a controlled correction mechanism later if needed.

For the MVP, the simplest safe approach is:

> Once confirmed, the receipt is immutable.

Any correction is handled through an inventory adjustment with a reason and audit trail.

This is consistent with the rest of the system.

---

# 23. Damaged-on-Arrival vs Later Damage

This distinction matters.

### Damaged during supplier delivery

Recorded on the receipt:

```text
delivered = 100
accepted = 97
damaged = 3
```

### Product becomes damaged after entering stock

Use the normal inventory damage workflow:

```text
DAMAGED
```

This preserves the difference between:

> “It arrived damaged.”

and:

> “We damaged/lost it after receiving it.”

That information can become useful when investigating supplier problems or internal stock handling.

---

# 24. Audit Events

Add:

```text id="e2bd9f"
STOCK_RECEIVED
SUPPLIER_CREATED
```

For `STOCK_RECEIVED`, record:

* user
* branch
* supplier
* receipt reference
* products
* accepted quantities
* damaged quantities
* timestamp

Do not create separate audit events for every individual item unless there is a specific need.

The receipt itself contains the item details.

---

# 25. Tests

### Normal receipt

Verify:

```text
Receipt created
Receipt items created
PURCHASE movements created
Audit event created
Inventory increases correctly
```

### Damaged delivery

Example:

```text
Delivered: 100
Accepted: 97
Damaged: 3
```

Verify:

```text
PURCHASE +97
DAMAGED -3
```

and final inventory increases by only 94 net relative to the movement ledger.

### Invalid quantities

Reject:

```text
accepted > delivered
damaged > delivered
accepted + damaged != delivered
negative quantities
zero-delivery receipt
```

### Security

Verify:

* cashier cannot receive stock
* unauthorized branch cannot receive stock
* inactive supplier cannot be selected
* inactive product cannot be received

### Idempotency

Send the same receipt request twice with the same idempotency key.

Verify:

```text
one receipt
one set of movements
one audit event
```

### Transaction rollback

If movement creation fails:

```text
no receipt
no partial inventory movement
no partial audit record
```

---

# 26. What We Are Deliberately Not Building

Do not add:

* purchase orders
* purchase approval
* supplier payment
* accounts payable
* supplier credit balances
* purchase accounting
* automatic invoice verification
* procurement workflows
* supplier performance scoring
* complex purchase pricing
* cost accounting
* landed cost
* tax accounting

These are separate concerns.

The MVP only needs reliable physical stock receiving.

---

# 27. Definition of Done

Stock receiving is complete when an authorized employee can:

1. Select an authorized branch.
2. Select a supplier.
3. Enter an optional supplier reference.
4. Add products.
5. Enter delivered quantities.
6. Record damaged/rejected quantities.
7. See accepted quantities.
8. Confirm the receipt.
9. Have accepted quantities added through `PURCHASE` inventory movements.
10. Have damaged-on-arrival quantities recorded appropriately.
11. Receive a unique receipt reference.
12. View the completed receipt later.
13. Trace the inventory movement back to the receipt.
14. See who received the goods and when.
15. Retry safely without duplicating the receipt.

---

# 28. Implementation Order

Implement in this order:

```text
22.1  Add Supplier + StockReceipt + StockReceiptItem
22.2  Implement receiveStock()
22.3  Add receiving tests + idempotency
22.4  Build receiving history
22.5  Build receive-stock screen
22.6  Build receipt detail
```

Do not build purchasing/accounting around this.

The important inventory lifecycle will then be:

```text
SUPPLIER
   ↓
STOCK RECEIPT
   ↓
PURCHASE MOVEMENT
   ↓
BRANCH STOCK
   ↓
 ┌───────────────┬───────────────┬───────────────┐
 ↓               ↓               ↓
SALE          TRANSFER        DAMAGE/EXPIRY
 ↓               ↓
OUT             OTHER BRANCH
                 ↓
              SALE
```

And physical counts provide the control mechanism around the entire system:

```text
Expected stock
      ↓
Physical count
      ↓
Variance
      ↓
Controlled adjustment
```

That gives us a complete, traceable basic inventory lifecycle without turning the application into a full ERP.
