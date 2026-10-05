# Component 18B — `completeSale()` Server Workflow

## Objective

`completeSale()` is the authoritative backend operation for completing a sale.

It is responsible for making these records agree:

```text
Sale
Sale Items
Payment
Inventory
Cash Session
Audit Log
```

A completed sale must never exist with only some of those records.

The operation is therefore one database transaction.

---

# 1. Client Contract

The browser sends only information that the cashier is actually entering.

```ts
type CompleteSaleInput = {
  customerId?: string | null;

  items: {
    productId: string;
    quantity: number;
  }[];

  payment: {
    method: "CASH" | "BANK_TRANSFER" | "OTHER";
    amount: string;
    reference?: string;
  };
};
```

The browser must **not** send:

* branch ID
* cashier ID
* cash session ID
* unit prices
* subtotal
* discount total
* final total
* invoice number
* stock quantity

The server determines those.

---

# 2. Meaning of `payment.amount`

This needs to be explicit.

For the MVP, a completed sale must be fully paid.

Therefore:

### Cash

`payment.amount` means:

> **cash physically received from the customer**

Example:

```text
Sale total:       ₦29,200
Cash received:    ₦30,000
Change:              ₦800
```

Client sends:

```ts
payment.amount = "30000"
```

The server calculates:

```text
Sale amount:      ₦29,200
Cash received:    ₦30,000
Change:              ₦800
```

The database stores:

```text
Payment.amount       ₦29,200
Payment.cashReceived ₦30,000
Payment.changeGiven    ₦800
```

This gives us clean semantics:

* `Payment.amount` = amount applied to the sale
* `cashReceived` = physical cash received
* `changeGiven` = physical cash returned

### Bank transfer / Other

For non-cash payments:

```text
payment.amount = sale total
```

So:

```text
Sale total:       ₦29,200
Payment.amount:   ₦29,200
```

There is no `cashReceived` or `changeGiven`.

---

# 3. No Partial Payment in This Workflow

For the MVP, `completeSale()` requires full payment.

Therefore:

### Cash

```text
cashReceived >= saleTotal
```

is valid.

### Bank transfer / Other

```text
payment.amount === saleTotal
```

is required.

We should **not** quietly introduce partial payment or credit logic here.

Credit sales are a separate business capability and should use the customer/credit workflow deliberately.

Therefore the normal completed sale has:

```text
paymentStatus = PAID
```

There is no need for `PARTIALLY_PAID` or `UNPAID` from this particular operation.

---

# 4. Service Context

The service receives trusted application context:

```ts
type SaleContext = {
  userId: string;
  employeeId: string;
  branchId: string;
  idempotencyKey: string;
};
```

Important:

`branchId` is not trusted merely because the client supplied it.

It should be resolved from the authenticated user's authorized branch context.

For a normal cashier, this should be the branch they are currently assigned to.

---

# 5. Service Result

```ts
type CompleteSaleResult = {
  saleId: string;
  invoiceNumber: string;
  total: string;
  paymentStatus: "PAID";
  changeGiven: string;
};
```

Example:

```json
{
  "saleId": "sale_123",
  "invoiceNumber": "INV-MAIN-000482",
  "total": "29200",
  "paymentStatus": "PAID",
  "changeGiven": "800"
}
```

---

# 6. Authoritative Workflow

The complete operation is:

```text
completeSale(input, context)
        │
        ├── Authenticate user
        ├── Check sales.create
        ├── Resolve authorized branch
        ├── Validate input shape
        │
        └── DATABASE TRANSACTION
              │
              ├── Check idempotency key
              ├── Verify active cash session
              ├── Load customer
              ├── Normalize cart
              ├── Load branch products + prices
              ├── Lock/check inventory
              ├── Validate stock
              ├── Calculate sale totals
              ├── Validate payment
              ├── Generate invoice number
              ├── Create Sale
              ├── Create SaleItems
              ├── Create Payment
              ├── Create SALE inventory movements
              ├── Create AuditLog
              └── Save idempotency result
```

If anything fails:

```text
NO sale
NO payment
NO stock movement
NO audit event
```

The entire transaction rolls back.

---

# 7. Authentication and Permission

First:

```ts
await requirePermission(
  context.userId,
  "sales.create"
);
```

Then verify the authenticated user has access to the branch.

Never accept:

```ts
input.cashierId
input.branchId
input.cashSessionId
```

as authoritative identity information.

---

# 8. Cash Session Requirement

This is the major addition to the original 18B.

Before completing a cashier sale, find the cashier's current open session:

```text
Employee
   ↓
OPEN CashSession
   ↓
Payment
```

Conceptually:

```ts
const session = await getOpenCashSession(
  tx,
  context.employeeId,
  context.branchId
);
```

If none exists:

```text
CASH_SESSION_REQUIRED
```

The sale should not proceed.

The cashier must first open a cash session.

---

# 9. Why We Require the Session

This gives us an explicit relationship:

```text
Sale
 ↓
Payment
 ↓
CashSession
 ↓
Cashier
 ↓
Branch
```

Later, reconciliation can calculate:

```text
Opening cash
+ cash payments
- cash refunds
= expected cash
```

without trying to guess which cashier handled which transaction.

---

# 10. What About Bank Transfers?

The cashier should still have an active session when recording the sale.

The session is not only a cash drawer.

It represents:

> **the cashier's operational working period.**

Therefore:

```text
Cash sale
       → session

Bank transfer sale
       → session

Other payment sale
       → session
```

This allows the session to provide a complete record of that cashier's activity.

---

# 11. Validate Input With Zod

```ts
const completeSaleSchema = z.object({
  customerId: z.string().nullable().optional(),

  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),

  payment: z.object({
    method: z.enum([
      "CASH",
      "BANK_TRANSFER",
      "OTHER",
    ]),

    amount: z.string(),

    reference: z.string().optional(),
  }),
});
```

Then perform business validation separately.

Zod answers:

> Is this request shaped correctly?

The service answers:

> Is this transaction actually allowed?

---

# 12. Idempotency

Generate the idempotency key on the client when the cashier begins the submission.

Example:

```ts
const idempotencyKey = crypto.randomUUID();
```

The key must remain the same when retrying that submission.

The server checks whether it has already completed that operation.

If yes:

```text
return original result
```

If no:

```text
perform transaction
```

This protects against:

```text
Cashier clicks Complete
       ↓
Sale succeeds
       ↓
Network response lost
       ↓
Cashier retries
```

without creating two sales.

---

# 13. Normalize Cart Items

If the client somehow sends:

```ts
[
  { productId: "A", quantity: 2 },
  { productId: "A", quantity: 3 }
]
```

normalize it to:

```text
A → 5
```

before calculating the sale.

This prevents duplicate product lines from creating inconsistent calculations.

---

# 14. Validate Customer

If:

```ts
customerId
```

was supplied:

* customer must exist
* customer must be active

Otherwise:

```text
Walk-in customer
```

is allowed.

The client cannot provide an arbitrary customer ID and bypass customer validation.

---

# 15. Load Branch Products

Inside the transaction:

```ts
const branchProducts = await tx.branchProduct.findMany({
  where: {
    branchId: context.branchId,
    productId: {
      in: productIds,
    },
    status: "ACTIVE",
  },
  include: {
    product: true,
  },
});
```

Every requested product must be:

```text
Product ACTIVE
+
BranchProduct ACTIVE
+
configured for this branch
```

Otherwise:

```text
PRODUCT_NOT_AVAILABLE
```

---

# 16. Server-Authoritative Pricing

The server obtains:

```text
BranchProduct.sellingPrice
```

The client does not determine price.

Example:

```text
Client claims:
Heineken = ₦10

Server:
Heineken = ₦18,500
```

The server uses:

```text
₦18,500
```

The fake client value is irrelevant.

---

# 17. Discounts

The original design included discounts, but the current MVP should keep this deliberately controlled.

A cashier must not be able to submit:

```ts
discount: 10000
```

from the browser and reduce the sale.

If discounts are supported, they need their own explicit permission/rule.

For the basic `completeSale()` path:

```text
discount = ₦0
```

unless the authorized discount workflow has already been implemented.

Do not add an unrestricted discount field merely because the UI could display one.

---

# 18. Inventory

There is no mutable:

```text
stockQuantity
```

field.

Stock comes from inventory movements.

Before creating the sale, the server must determine authoritative available stock for every product.

Example:

```text
Heineken
Available: 12
Requested: 4
```

Valid.

If:

```text
Available: 3
Requested: 4
```

reject:

```text
INSUFFICIENT_STOCK
```

---

# 19. Concurrency Protection

This is critical.

Consider:

```text
Stock = 5
```

Two cashiers simultaneously sell:

```text
Cashier A → 5
Cashier B → 5
```

Both requests must not independently see:

```text
5 available
```

and both succeed.

The inventory operation needs concurrency protection.

The final implementation should use PostgreSQL transaction/locking semantics around the authoritative inventory state so that only one transaction can successfully consume the remaining stock.

Expected:

```text
Cashier A → SUCCESS
Cashier B → INSUFFICIENT_STOCK
```

or vice versa.

Never:

```text
A → SUCCESS
B → SUCCESS
```

with resulting negative stock.

This should be covered by an integration test before the sales module is considered complete.

---

# 20. Calculate Totals

For every line:

```text
lineTotal =
serverUnitPrice × quantity
```

Then:

```text
subtotal =
sum(lineTotal)
```

Then:

```text
total =
subtotal - discount
```

All money calculations use `Decimal`.

Never use ordinary JavaScript floating-point arithmetic for business money.

---

# 21. Validate Payment

After the server knows the authoritative sale total:

### Cash

```text
cashReceived >= total
```

Example:

```text
Total:         ₦29,200
Cash received: ₦30,000
```

Server calculates:

```text
Change: ₦800
```

### Bank transfer

```text
amount === total
```

### Other

```text
amount === total
```

If invalid:

```text
INVALID_PAYMENT
```

---

# 22. Payment Reference

For bank transfer:

```text
reference
```

may be recorded.

But the reference is only recorded evidence.

The system must not claim:

> Bank transfer verified

unless an actual verification mechanism exists.

For the MVP:

```text
Bank transfer reference ≠ bank confirmation
```

---

# 23. Generate Invoice Number

The server generates the invoice.

Example:

```text
INV-MAIN-000482
```

Do not use:

```ts
count + 1
```

because concurrent requests can produce duplicate numbers.

Use a database-backed sequence/counter with transaction-safe incrementing.

Also keep:

```prisma
invoiceNumber String @unique
```

as the final database protection.

---

# 24. Create Sale

```ts
const sale = await tx.sale.create({
  data: {
    invoiceNumber,
    branchId: context.branchId,
    customerId: input.customerId ?? null,
    cashierId: context.employeeId,

    status: "COMPLETED",

    subtotal,
    discount,
    total,

    completedAt: new Date(),
  },
});
```

The important identities are server-derived:

```text
branch
cashier
price
total
invoice
timestamp
```

---

# 25. Create Sale Items

For every normalized item:

```ts
await tx.saleItem.create({
  data: {
    saleId: sale.id,
    productId,
    quantity,
    unitPrice,
    discount: lineDiscount,
    lineTotal,
  },
});
```

The stored `unitPrice` is the historical price actually used for the sale.

This means future price changes cannot alter old invoices.

---

# 26. Create Payment

For cash:

```ts
await tx.payment.create({
  data: {
    saleId: sale.id,

    amount: total,
    method: "CASH",
    status: "COMPLETED",

    cashReceived,
    changeGiven: cashReceived.sub(total),

    receivedBy: context.employeeId,
    cashSessionId: session.id,
  },
});
```

For bank transfer:

```ts
await tx.payment.create({
  data: {
    saleId: sale.id,

    amount: total,
    method: "BANK_TRANSFER",
    status: "COMPLETED",

    reference: input.payment.reference,

    receivedBy: context.employeeId,
    cashSessionId: session.id,
  },
});
```

Same basic structure applies to `OTHER`.

---

# 27. Create Inventory Movements

For every sold product:

```ts
await tx.inventoryMovement.create({
  data: {
    branchId: context.branchId,
    productId,
    type: "SALE",
    quantity,
    referenceType: "SALE",
    referenceId: sale.id,
    createdBy: context.employeeId,
  },
});
```

The inventory ledger now has direct evidence that the stock left because of this sale.

---

# 28. Create Audit Event

Create:

```text
SALE_CREATED
```

with:

```text
user
employee
branch
sale
invoice
total
timestamp
```

Example:

```text
Sale INV-MAIN-000482 completed for ₦29,200.
```

The audit event is created inside the same transaction.

---

# 29. Save Idempotency Result

Once the operation has successfully produced:

```text
Sale
Payment
Inventory
Audit
```

save the result against the idempotency key.

A retry can then return:

```ts
{
  saleId,
  invoiceNumber,
  total,
  paymentStatus,
  changeGiven
}
```

without creating anything again.

---

# 30. Complete Transaction

The complete transaction is therefore:

```text
BEGIN
  │
  ├── idempotency check
  ├── session validation
  ├── customer validation
  ├── product validation
  ├── inventory validation/locking
  ├── price calculation
  ├── payment validation
  ├── invoice generation
  │
  ├── Sale
  ├── SaleItems
  ├── Payment
  ├── InventoryMovements
  ├── AuditLog
  └── Idempotency result
  │
COMMIT
```

If any operation fails:

```text
ROLLBACK
```

Nothing from the sale survives.

---

# 31. Domain Errors

Use business-level errors such as:

```text
PERMISSION_DENIED
BRANCH_ACCESS_DENIED
CASH_SESSION_REQUIRED
CUSTOMER_NOT_FOUND
CUSTOMER_INACTIVE
PRODUCT_NOT_AVAILABLE
INSUFFICIENT_STOCK
INVALID_PAYMENT
INVALID_PAYMENT_REFERENCE
SALE_ALREADY_COMPLETED
```

The API layer translates these into appropriate HTTP responses.

The UI can then provide useful messages.

For example:

```text
INSUFFICIENT_STOCK
```

becomes:

> Heineken only has 3 crates available.

Not:

> Internal server error.

---

# 32. What the Cashier Sees

The backend complexity should remain invisible.

For a cash sale:

```text
Sale total       ₦29,200

Cash received
[ ₦30,000 ]

Change
₦800

[ Complete Sale ]
```

After success:

```text
✓ Sale completed

INV-MAIN-000482

Total
₦29,200

Cash received
₦30,000

Change
₦800

[ View Invoice ]
[ New Sale ]
```

---

# 33. Important Relationship After This Change

The sales system now has:

```text
Cashier
   ↓
CashSession
   ↓
Payment
   ↓
Sale
   ↓
SaleItems
   ↓
InventoryMovements
```

with:

```text
Branch
```

attached throughout the authoritative server context.

This is what allows Component 23 to later answer:

> How much cash should this cashier have at closing?

without reconstructing history from timestamps or guessing which cashier made which transaction.

---

# 34. Tests

The existing 18B tests remain, but add session-specific tests.

### Session

* [ ] cashier with open session can sell
* [ ] cashier without open session cannot sell
* [ ] closed session cannot receive new payments
* [ ] session from another branch cannot be used
* [ ] another cashier's session cannot be used

### Payment

* [ ] exact cash payment
* [ ] cash payment with change
* [ ] cash below total rejected
* [ ] bank transfer requires exact total
* [ ] other payment requires exact total
* [ ] cash payment stores `cashReceived`
* [ ] cash payment stores calculated `changeGiven`
* [ ] non-cash payment has no cash fields

### Security

* [ ] fake price ignored
* [ ] fake total ignored
* [ ] fake cashier ignored
* [ ] fake branch ignored
* [ ] fake cash session ignored

### Inventory

* [ ] insufficient stock rejected
* [ ] stock movement created
* [ ] concurrent sale against remaining stock handled correctly

### Reliability

* [ ] transaction rolls back on failure
* [ ] duplicate idempotency key returns original sale
* [ ] duplicate submission does not duplicate stock movement
* [ ] invoice numbers remain unique under concurrency

---

# 35. Definition of Done

`completeSale()` is complete when:

### Authentication

* [ ] user authenticated
* [ ] `sales.create` enforced
* [ ] employee identity comes from authentication

### Session

* [ ] active cash session required
* [ ] session belongs to authenticated cashier
* [ ] session belongs to authorized branch

### Financial correctness

* [ ] server calculates prices
* [ ] server calculates totals
* [ ] cash received is separated from sale amount
* [ ] change is server-calculated
* [ ] Decimal money handling
* [ ] full payment required
* [ ] invoice generated server-side

### Inventory

* [ ] stock calculated server-side
* [ ] concurrency protected
* [ ] SALE movement created
* [ ] stock cannot become negative

### Reliability

* [ ] one database transaction
* [ ] rollback on failure
* [ ] idempotency protection
* [ ] duplicate requests cannot create duplicate sales

### Auditability

* [ ] sale has cashier
* [ ] sale has branch
* [ ] payment has session
* [ ] inventory movement references sale
* [ ] audit event created

---

# 36. Final Architecture

The authoritative sale operation is now:

```text
                    AUTHENTICATED USER
                           │
                           ▼
                    EMPLOYEE / BRANCH
                           │
                           ▼
                    OPEN CASH SESSION
                           │
                           ▼
                       COMPLETE
                         SALE
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
            SALE        PAYMENT      INVENTORY
              │            │            │
              ▼            ▼            ▼
         SALE ITEMS    CASH SESSION   MOVEMENTS
                           │
                           ▼
                      AUDIT LOG
```

Everything is committed together.

The browser initiates the operation, but it does not decide what the transaction means.

The server does.
