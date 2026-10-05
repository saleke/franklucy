# Component 18A — New Sale: UX + Server Contract

Now we're entering the **core transaction flow**.

The standard we're aiming for is:

> A cashier should be able to complete an ordinary sale in a few deliberate steps without thinking about the underlying database.

At the same time, the server must assume the browser is untrusted.

---

# 18A.1 The sale experience

The cashier's journey should be:

```text
Sales
  ↓
+ New Sale
  ↓
Customer
  ↓
Products
  ↓
Review
  ↓
Payment
  ↓
Complete
  ↓
Success / Invoice
```

But visually, I **don't** want five separate pages.

The cashier should experience one focused workspace.

---

# 18A.2 Desktop layout

The main sale screen:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ New Sale                                                                    │
│ Main Branch · September 30                                                  │
├───────────────────────────────────────────────┬─────────────────────────────┤
│                                               │                             │
│ CUSTOMER                                      │ CURRENT SALE                 │
│                                               │                             │
│ ┌───────────────────────────────────────────┐ │ Walk-in customer            │
│ │ Walk-in customer                       ▾ │ │                             │
│ └───────────────────────────────────────────┘ │ ─────────────────────────── │
│                                               │                             │
│ ADD PRODUCTS                                  │ Heineken Crate               │
│                                               │ 3 × ₦8,500         ₦25,500 │
│ ┌───────────────────────────────────────────┐ │                             │
│ │ 🔍 Search products...                     │ │ Malt Pack                    │
│ └───────────────────────────────────────────┘ │ 2 × ₦1,850          ₦3,700 │
│                                               │                             │
│ ┌─────────────────┐  ┌─────────────────┐      │ ─────────────────────────── │
│ │ Heineken Crate  │  │ Malt Pack       │      │ Subtotal           ₦29,200 │
│ │ ₦8,500          │  │ ₦1,850          │      │ Discount                ₦0 │
│ │ 18 available    │  │ 74 available    │      │                             │
│ └─────────────────┘  └─────────────────┘      │ TOTAL              ₦29,200 │
│                                               │                             │
│ ┌─────────────────┐  ┌─────────────────┐      │ [ Continue to payment ]    │
│ │ Nutri Milk      │  │ More products   │      │                             │
│ │ ₦4,200          │  │                 │      │                             │
│ └─────────────────┘  └─────────────────┘      │                             │
│                                               │                             │
└───────────────────────────────────────────────┴─────────────────────────────┘
```

This gives the cashier two clear mental zones:

### Left

**What can I add?**

### Right

**What am I selling?**

---

# 18A.3 Customer selection

Default:

```text
Customer
[ Walk-in customer ▾ ]
```

That should be the fastest path.

Clicking it opens:

```text
┌─────────────────────────────────────────┐
│ Select customer                          │
│                                         │
│ 🔍 Search name or phone                 │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ WALK-IN                                 │
│ Walk-in customer                        │
│                                         │
│ RECENT                                  │
│ Ade Stores          080...              │
│ Chinedu Drinks      080...              │
│                                         │
│ [+ Create customer]                     │
└─────────────────────────────────────────┘
```

Don't force cashiers to create customer records for ordinary walk-ins.

---

# 18A.4 Product search

The search field should be the primary interaction.

Cashier types:

```text
hei
```

Results:

```text
┌──────────────────────────────────────┐
│ Heineken Crate                       │
│ ₦8,500 · 18 available          [+]  │
├──────────────────────────────────────┤
│ Heineken Can Pack                    │
│ ₦5,200 · 12 available          [+]  │
└──────────────────────────────────────┘
```

We should support keyboard operation too:

```text
↑ ↓
Enter
Esc
```

This matters because a busy cashier shouldn't have to constantly reach for the mouse.

---

# 18A.5 Product cards

Don't turn the screen into a marketplace.

We aren't selling fashion.

The important information is:

```text
Product
Price
Availability
```

Example:

```text
Heineken Crate

₦8,500

18 available

[ + Add ]
```

If stock is low:

```text
Heineken Crate

₦8,500

4 available · Low stock

[ + Add ]
```

If unavailable:

```text
Heineken Crate

₦8,500

Out of stock

[ Unavailable ]
```

Don't let the cashier add impossible stock.

The backend still validates it.

---

# 18A.6 Cart item

Once added:

```text
Heineken Crate

₃ × ₦8,500

[ − ]    3    [ + ]

₦25,500
```

Clicking the quantity should optionally allow direct entry:

```text
[ − ] [ 3 ] [ + ]
```

For example:

```text
[ − ] [ 12 ] [ + ]
```

But don't make the cashier manually type the price.

Ever.

---

# 18A.7 Price protection

The UI should communicate that the price is controlled.

For example:

```text
Heineken Crate
₦8,500 / crate
```

No editable price input.

Not:

```text
Price
[ ₦8,500 ]
```

because that subtly suggests:

> "You can change this."

If a discount is needed, that's a separate operation.

---

# 18A.8 Discounts

Don't put:

```text
Discount [________]
```

on the ordinary cashier screen.

Instead:

```text
Discount

[ Add discount ]
```

Click:

```text
┌─────────────────────────────────────┐
│ Request discount                    │
│                                     │
│ Amount                              │
│ [ ₦________________ ]               │
│                                     │
│ Reason                              │
│ [_______________________________]   │
│                                     │
│ This discount requires approval.    │
│                                     │
│ [ Cancel ]        [ Request ]       │
└─────────────────────────────────────┘
```

Depending on policy, the manager may approve it immediately or it may create an approval event.

This keeps ordinary sales fast while protecting an important leakage point.

---

# 18A.9 Sale summary

The right side should always remain visible on desktop.

```text
CURRENT SALE

2 items · 5 units

Heineken Crate
3 × ₦8,500
₦25,500

Malt Pack
2 × ₦1,850
₦3,700

──────────────────────

Subtotal        ₦29,200
Discount             ₦0

TOTAL           ₦29,200

[ Continue to payment ]
```

The total should have the strongest visual hierarchy.

---

# 18A.10 Payment

After clicking Continue:

Don't navigate away.

Turn the right side into the payment step.

```text
PAYMENT

Amount due

₦29,200


Payment method

┌────────────┐ ┌────────────────┐ ┌────────────┐
│   CASH     │ │ BANK TRANSFER  │ │   OTHER    │
└────────────┘ └────────────────┘ └────────────┘
```

Cash:

```text
Cash received

[ ₦________________ ]

Change

₦800
```

If:

```text
Amount due = ₦29,200
Cash = ₦30,000
```

server/UI calculation shows:

```text
Change
₦800
```

But the server still validates the payment.

---

# 18A.11 Bank transfer

```text
Bank transfer

Reference

[ TRX-123456____________ ]
```

Important:

The UI should say:

> **Reference recorded. Transfer verification is not performed automatically.**

Unless we later integrate with a banking/payment provider.

We shouldn't imply that entering a reference means money has been verified.

---

# 18A.12 Payment completion

Primary action:

```text
[ Complete sale · ₦29,200 ]
```

Once pressed:

```text
Completing sale...
```

The button becomes disabled.

This prevents:

```text
click
click
click
click
```

from creating multiple sales.

---

# 18A.13 Sale success

Don't just say:

```text
Success!
```

Give the cashier useful closure.

```text
┌───────────────────────────────────────────┐
│                                           │
│               ✓ Sale completed            │
│                                           │
│              ₦29,200                      │
│                                           │
│          INV-MAIN-00482                   │
│                                           │
│  Walk-in customer                         │
│  2 products · 5 units                     │
│                                           │
│  [ View invoice ]                         │
│  [ New sale ]                             │
│                                           │
└───────────────────────────────────────────┘
```

For a cashier, **New sale** should be the obvious next action.

---

# 18A.14 The URL structure

I'd use:

```text
/sales
```

for the sales workspace.

And:

```text
/sales/new
```

for the sale workflow.

Then:

```text
/sales/[saleId]
```

for the completed sale.

Example:

```text
/sales
/sales/new
/sales/clx8...
```

Don't use:

```text
/sales/create-sale-page
```

Keep routes clean.

---

# 18A.15 The client request

The browser should send only the information the user actually controls.

Something like:

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

Notice what's missing:

```text
branchId
unitPrice
subtotal
discount
total
cashierId
```

Those should **not be trusted from the client**.

---

# 18A.16 Why branch isn't in the trusted request

The browser may know:

```text
Main Branch
```

but the server should derive the effective branch from the authenticated user's context.

For a manager who can operate multiple branches, the selected branch can be supplied as context, but the server verifies:

```text
Does this user actually have access to this branch?
```

So:

```text
client says Main
       ↓
server checks access
       ↓
allowed
```

or:

```text
client says Ikeja
       ↓
server checks access
       ↓
denied
```

---

# 18A.17 Server workflow

Our authoritative function becomes conceptually:

```ts
completeSale(input, context)
```

where `context` comes from the authenticated server-side user.

Workflow:

```text
1. Authenticate
        ↓
2. require sales.create
        ↓
3. determine branch
        ↓
4. validate input
        ↓
5. validate products
        ↓
6. load current branch prices
        ↓
7. load inventory
        ↓
8. check quantities
        ↓
9. calculate totals
        ↓
10. create sale
        ↓
11. create sale items
        ↓
12. create payment
        ↓
13. create inventory movements
        ↓
14. create audit event
        ↓
15. commit
```

All inside one database transaction.

---

# 18A.18 Server calculates the price

Suppose browser sends:

```json
{
  "productId": "heineken-id",
  "quantity": 3
}
```

Server finds:

```text
Branch: Main
Product: Heineken
Current price: ₦8,500
```

Then:

```text
3 × ₦8,500
= ₦25,500
```

The browser's displayed price is irrelevant to the financial truth.

That's exactly what we want.

---

# 18A.19 Server calculates the total

Suppose browser attempts:

```json
{
  "items": [
    {
      "productId": "heineken",
      "quantity": 3
    }
  ],
  "total": "₦1"
}
```

The server simply ignores that fake total.

It calculates:

```text
3 × 8500 = 25500
```

and stores:

```text
₦25,500
```

---

# 18A.20 Stock validation

Suppose:

```text
Heineken available = 2
Requested = 5
```

The transaction fails.

Response should be a **business error**, not:

```text
500 Internal Server Error
```

Something like:

```text
INSUFFICIENT_STOCK
```

with useful information:

```text
Heineken Crate has 2 crates available.
You requested 5.
```

The UI can then show:

```text
Heineken Crate

Only 2 crates are available.

[ Adjust quantity ]
```

---

# 18A.21 Sale creation

The sale record gets:

```text
id
invoiceNumber
branchId
customerId
cashierId
status
subtotal
discount
total
createdAt
completedAt
```

Example:

```text
INV-MAIN-00482
```

The invoice number must be generated by the server.

Not:

```ts
`INV-${Date.now()}`
```

from the browser.

---

# 18A.22 Sale items

For each product:

```text
SaleItem

productId
quantity
unitPrice
discount
lineTotal
```

Example:

```text
Heineken
quantity: 3
unitPrice: 8500
lineTotal: 25500
```

This historical price is critical.

If Heineken later changes to:

```text
₦9,000
```

the old invoice still says:

```text
3 × ₦8,500
```

because that was the actual transaction.

---

# 18A.23 Inventory movements

The sale creates:

```text
InventoryMovement

branch:
Main

product:
Heineken

type:
SALE

quantity:
-3

referenceType:
SALE

referenceId:
saleId
```

Now the stock history tells us exactly why stock decreased.

---

# 18A.24 Payment

The payment is separate from the sale.

Example:

```text
Payment

saleId
amount: ₦30,000
method: CASH
status: COMPLETED
```

If total was:

```text
₦29,200
```

we need to decide whether the stored payment amount should represent:

### Option A

Amount applied to sale:

```text
₦29,200
```

and change:

```text
₦800
```

is recorded separately.

### Option B

Amount physically received:

```text
₦30,000
```

with:

```text
change = ₦800
```

I recommend **Option B**, because cash reconciliation needs to know what physically entered the till.

But we'll formalize this in the payment/reconciliation component before implementing it.

---

# 18A.25 Audit event

Finally:

```text
AuditLog

action:
SALE_CREATED

user:
John Mensah

branch:
Main

entity:
Sale

entityId:
...

description:
Sale INV-MAIN-00482 completed

createdAt:
...
```

This is automatically generated by the server.

The cashier doesn't fill out an audit form.

---

# 18A.26 Transaction boundary

This is the critical part.

Conceptually:

```ts
await db.$transaction(async (tx) => {
  const sale = await createSale(tx);

  await createSaleItems(tx, sale);

  await createPayment(tx, sale);

  await createInventoryMovements(tx, sale);

  await createAuditLog(tx, sale);
});
```

If this happens:

```text
Sale ✓
SaleItems ✓
Payment ✓
Inventory ✓
Audit ✗
```

the database rolls back.

Final result:

```text
Sale ✗
Payment ✗
Inventory ✗
Audit ✗
```

No half-created sale.

---

# 18A.27 Idempotency

This is another important protection.

Imagine:

```text
Cashier clicks Complete
       ↓
request reaches server
       ↓
sale succeeds
       ↓
network becomes slow
       ↓
browser thinks it failed
       ↓
cashier clicks again
```

Without protection:

```text
Two sales
```

Bad.

We need an idempotency key for sale completion.

Conceptually:

```text
requestId:
01J...
```

The server records it.

If the same request is submitted again:

```text
same request
     ↓
already processed
     ↓
return existing sale
```

No duplicate invoice.

---

# 18A.28 Business invariants

These are rules that must **always** hold.

### Rule 1

A completed sale must have at least one item.

### Rule 2

Quantity must be positive.

```text
quantity > 0
```

### Rule 3

Product must be active.

### Rule 4

Product must be available at the selected branch.

### Rule 5

Selling price comes from the server.

### Rule 6

Stock cannot go negative in MVP.

### Rule 7

Total is server calculated.

### Rule 8

Completed sale can't be edited directly.

### Rule 9

Payment must correspond to the sale's payment rules.

### Rule 10

Every completed sale produces inventory and audit evidence.

These are more important than the UI.

---

# 18A.29 Validation vs business rules

Keep these separate.

### Zod/input validation

Answers:

> Is this request structurally valid?

For example:

```text
quantity must be integer
quantity >= 1
productId must be valid
payment method must be supported
```

### Business rules

Answers:

> Is this operation allowed?

For example:

```text
Product is inactive.
Insufficient stock.
Cashier lacks permission.
Branch access denied.
Credit limit exceeded.
```

This separation keeps the backend clean.

---

# 18A.30 What happens if payment fails?

Suppose:

```text
Sale creation
✓

Inventory
✓

Payment
✗
```

Because everything is in one transaction:

```text
ROLLBACK
```

No stock was actually consumed.

No completed invoice exists.

The cashier can retry.

---

# 18A.31 What happens after completion?

Return a minimal result:

```ts
{
  saleId,
  invoiceNumber,
  total,
  paymentStatus
}
```

Then frontend navigates to:

```text
/sales/[saleId]
```

or shows the success state and lets the cashier choose.

---

# 18A.32 The sale detail page

This becomes the canonical record.

```text
Invoice
INV-MAIN-00482

PAID

Main Branch
Sep 30, 10:42
Cashier: John Mensah


ITEMS

Heineken Crate       3 × ₦8,500     ₦25,500
Malt Pack            2 × ₦1,850      ₦3,700


Subtotal                              ₦29,200
Discount                                   ₦0
TOTAL                                 ₦29,200


PAYMENT

Cash                                  ₦30,000
Change                                   ₦800


CUSTOMER

Walk-in customer
```

Then dangerous actions live under:

```text
More ▾
```

such as:

```text
Void sale
Request correction
```

not beside the primary information screaming for attention.

---

# 18A.33 Component structure

Frontend:

```text
src/components/sales/
│
├── sale-workspace.tsx
├── customer-selector.tsx
├── product-search.tsx
├── product-result.tsx
├── sale-cart.tsx
├── sale-cart-item.tsx
├── sale-summary.tsx
├── discount-request.tsx
├── payment-step.tsx
├── cash-payment.tsx
├── transfer-payment.tsx
├── sale-success.tsx
└── sale-detail.tsx
```

Server:

```text
src/modules/sales/
│
├── sale.service.ts
├── sale.repository.ts
├── sale.validation.ts
├── sale.errors.ts
├── sale.number.ts
└── sale.types.ts
```

Payment-specific logic:

```text
src/modules/payments/
```

Inventory-specific logic:

```text
src/modules/inventory/
```

The sale service orchestrates them.

---

# 18A.34 One authoritative workflow

I want one main function:

```text
completeSale()
```

Not:

```text
createInvoice()
updateStock()
recordPayment()
createAudit()
```

called independently from the browser.

The browser says:

> **Complete this sale.**

The business layer decides everything required to complete it.

That's a major architectural principle.

---

# 18A.35 Tests before UI polish

Before we consider the sale feature complete, these should pass:

```text
✓ valid sale creates invoice
✓ correct prices are captured
✓ total is calculated correctly
✓ stock decreases
✓ payment is recorded
✓ audit event is created
✓ insufficient stock rejects
✓ inactive product rejects
✓ unauthorized cashier rejects
✓ unauthorized branch rejects
✓ fake client total cannot manipulate sale
✓ fake client price cannot manipulate sale
✓ duplicate request doesn't create duplicate sale
✓ transaction rolls back on failure
```

Then we can confidently make the UI beautiful without worrying that we're polishing a broken workflow.

---

# The next implementation slice

So the immediate build sequence is now:

```text
18A  Sale domain + input contract
       ↓
18B  completeSale() transaction
       ↓
18C  automated tests
       ↓
18D  New Sale UI
       ↓
18E  Invoice detail + success
```

**18B is next.**

That's where we'll define the actual `completeSale()` algorithm, Prisma transaction, invoice-number generation, stock calculation, payment handling, audit creation, and idempotency in concrete TypeScript—not just architecture.
