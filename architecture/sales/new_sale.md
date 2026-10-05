# Component 18D — New Sale / POS Workspace

## Objective

Build the cashier-facing New Sale experience and connect it to the authoritative `completeSale()` backend workflow.

This is the first complete end-to-end business journey in the system:

**Cashier → Sale Workspace → Product Selection → Cart → Payment → `completeSale()` → Sale + Payment + Inventory + Audit**

The interface should feel like a professional POS and operations tool: fast, clear, modern, and easy to use under real working conditions.

---

## Routes

```text
/sales
/sales/new
/sales/[saleId]
```

### `/sales`

Sales workspace containing:

* Today's sales
* Search
* Filters
* Invoice number
* Customer
* Cashier
* Amount
* Payment status
* Sale status
* Date/time
* New Sale action

### `/sales/new`

Cashier's sale workspace.

### `/sales/[saleId]`

Canonical sale detail page.

---

# 1. New Sale Workspace

Desktop layout:

```text
┌─────────────────────────────────────────────────────────────────┐
│ New Sale                                      [Cancel]           │
├───────────────────────────────────────┬─────────────────────────┤
│                                       │                         │
│ Customer                              │ Current Sale             │
│ [ Walk-in Customer             ▼ ]    │                         │
│                                       │ Heineken        x2       │
│ Products                              │ ₦18,500 each            │
│ [ Search products...             ]     │ ₦37,000                 │
│                                       │                         │
│ Heineken                              │ Malt            x1       │
│ ₦18,500   Available: 12               │ ₦8,500                  │
│                                       │                         │
│ Nutri Milk                            │ ─────────────────────── │
│ ₦12,000   Available: 8                │ Subtotal       ₦45,500  │
│                                       │ Discount            ₦0  │
│ Malt                                  │ Total          ₦45,500  │
│ ₦8,500    Available: 20               │                         │
│                                       │ [ Continue to payment ] │
└───────────────────────────────────────┴─────────────────────────┘
```

The exact visual design should be refined during implementation, but the workflow should remain this simple.

---

# 2. Customer Selection

Default:

**Walk-in Customer**

The cashier should not have to create a customer for every transaction.

Customer selector supports:

* Walk-in
* Search existing customer
* Recently used customers
* Create customer
* View selected customer's basic information

Customer information shown when selected:

```text
John Trading
080...
Balance: ₦120,000
```

Customer balance is informational and comes from the backend.

The cashier does not manually edit the balance.

---

# 3. Product Search

Product search should be fast enough for a busy cashier.

Search by:

* Product name
* SKU
* Other configured identifiers later

Each result displays:

```text
Heineken
₦18,500
Available: 12
```

Unavailable products should be visibly unavailable and should not be addable.

The cashier does **not** enter a price.

The browser may display the current price, but the server remains authoritative.

---

# 4. Cart

Each cart item displays:

```text
Heineken

[ − ]   2   [ + ]

₦18,500 × 2
₦37,000
```

Quantity can be changed by:

* `+`
* `−`
* Direct quantity entry

Rules:

* Quantity must be a positive integer.
* Quantity cannot become zero through an invalid state.
* Client-side availability feedback is helpful but not authoritative.
* Server validates stock again during completion.

The cart should make it very difficult to accidentally sell the wrong quantity.

---

# 5. Price Protection

The cashier must never see an editable price input.

Do not build:

```text
Price: [ ₦________ ]
```

Instead:

```text
Heineken
₦18,500
```

If the business later allows discounts or special pricing:

```text
[ Add discount ]
```

becomes an explicit controlled workflow.

A discount must have:

* amount/percentage
* reason
* requesting employee
* approval where required

The cashier cannot simply overwrite the product price.

---

# 6. Sale Summary

Always show:

```text
Subtotal       ₦45,500
Discount            ₦0
──────────────────────
Total          ₦45,500
```

The displayed total is for user feedback.

The authoritative total is recalculated by `completeSale()`.

Therefore the client must never submit:

```text
subtotal
discount total
total
unit price
```

as trusted values.

---

# 7. Payment

Selecting:

**Continue to payment**

moves the cashier into the payment step.

Payment methods:

```text
○ Cash
○ Bank Transfer
○ Other
```

### Cash

Show:

```text
Total

₦45,500

Amount received

[ ₦50,000 ]

Change

₦4,500
```

The cashier can immediately see the change.

### Bank Transfer

Show:

```text
Transfer reference

[ __________________ ]

Reference recorded.
Transfer verification is not automatic.
```

Do not tell the cashier that the bank transfer has been verified unless the system actually verifies it.

### Other

Record the configured payment information without pretending that external verification occurred.

---

# 8. Completing the Sale

The primary action:

```text
[ Complete Sale ]
```

When clicked:

1. Disable the button.
2. Show progress state.
3. Generate/reuse an idempotency key.
4. Submit the sale to the server.
5. Server executes `completeSale()`.
6. Display the result.

The browser must not independently:

* create an invoice
* reduce stock
* create a payment
* create an audit event

All of those happen through the authoritative backend workflow.

---

# 9. Success State

After successful completion:

```text
┌──────────────────────────────────────┐
│                                      │
│              ✓                       │
│        Sale completed                │
│                                      │
│        INV-MAIN-000482               │
│                                      │
│        Total                         │
│        ₦45,500                       │
│                                      │
│        Customer                      │
│        Walk-in Customer              │
│                                      │
│   [ View Invoice ]   [ New Sale ]    │
│                                      │
└──────────────────────────────────────┘
```

The invoice number comes from the server.

---

# 10. Error Handling

Errors should explain what happened in business language.

### Insufficient stock

Instead of:

```text
500 Internal Server Error
```

show:

```text
Not enough Heineken stock.

Available: 3
Requested: 5

Update the quantity and try again.
```

### Product unavailable

```text
This product is no longer available
at this branch.
```

### Session/permission issue

```text
You don't have permission to complete
this sale.

Contact your manager if this is unexpected.
```

### Network failure

Do not immediately assume the sale failed.

Because the request may have reached the server successfully, the UI should handle retrying through the same idempotency key.

This prevents:

```text
Network timeout
→ cashier clicks again
→ duplicate sale
```

---

# 11. Loading States

Every important async operation needs a deliberate loading state.

Examples:

```text
Searching products...
Loading customer...
Completing sale...
```

Use skeletons where appropriate.

Do not freeze the entire application unnecessarily.

---

# 12. Mobile Experience

The mobile layout should not simply be the desktop layout squeezed onto a small screen.

For mobile:

```text
┌───────────────────────┐
│ New Sale              │
├───────────────────────┤
│ Customer              │
│ Walk-in Customer   ▼  │
├───────────────────────┤
│ Search products...    │
├───────────────────────┤
│ Heineken              │
│ ₦18,500               │
│ Available: 12         │
│              [ + ]    │
├───────────────────────┤
│ Nutri Milk            │
│ ₦12,000               │
│ Available: 8          │
│              [ + ]    │
├───────────────────────┤
│                       │
│ 2 items               │
│ Total: ₦45,500        │
│                       │
│ [ Continue ]          │
└───────────────────────┘
```

Payment can appear as a bottom sheet.

Priorities:

* large touch targets
* minimal typing
* fast search
* visible total
* easy quantity adjustment
* no unnecessary navigation

---

# 13. Sale Detail

`/sales/[saleId]` is the canonical view of a completed sale.

Display:

### Header

```text
INV-MAIN-000482
Completed
Today, 09:42
```

### Customer

```text
Walk-in Customer
```

### Items

```text
Heineken
2 × ₦18,500
₦37,000

Malt
1 × ₦8,500
₦8,500
```

### Summary

```text
Subtotal     ₦45,500
Discount          ₦0
Total        ₦45,500
```

### Payment

```text
Cash
Received     ₦50,000
Change        ₦4,500
```

### Metadata

```text
Cashier: John Doe
Branch: Main
Completed: 09:42
```

Dangerous actions should be under:

```text
More ▾
```

Examples:

* Request correction
* Void sale
* Return items

These are controlled workflows, not direct edits.

---

# 14. Component Structure

```text
src/components/sales/
  sale-workspace.tsx
  customer-selector.tsx
  product-search.tsx
  product-result.tsx
  sale-cart.tsx
  sale-cart-item.tsx
  sale-summary.tsx
  discount-request.tsx
  payment-step.tsx
  cash-payment.tsx
  transfer-payment.tsx
  sale-success.tsx
  sale-detail.tsx
```

Keep components meaningful.

Avoid creating tiny components that exist only because a `div` was moved into another file.

---

# 15. Client State

The New Sale workspace needs temporary client state for:

```text
selected customer
cart items
selected payment method
payment input
discount request
submission state
errors
```

But this state is only the **draft sale**.

It is not authoritative business data.

The moment the sale is submitted, the backend becomes the authority.

---

# 16. Server Contract

The client sends approximately:

```ts
type CompleteSaleInput = {
  customerId?: string | null;

  items: {
    productId: string;
    quantity: number;
  }[];

  payment: {
    method:
      | "CASH"
      | "BANK_TRANSFER"
      | "OTHER";

    amount: string;
    reference?: string;
  };
};
```

And receives:

```ts
type CompleteSaleResult = {
  saleId: string;
  invoiceNumber: string;
  total: string;

  paymentStatus:
    | "PAID"
    | "PARTIALLY_PAID"
    | "UNPAID";
};
```

The frontend must not depend on internal Prisma models.

---

# 17. Design Quality Standard

This screen is one of the most important screens in the application.

It must not look like:

* a generic admin template
* a CRUD form
* a collection of giant cards
* a dashboard overloaded with charts
* a flashy startup landing page

It should feel like:

**a professional POS + operations workspace.**

Priorities:

1. Speed
2. Clarity
3. Error prevention
4. Information hierarchy
5. Touch usability
6. Visual polish

Use restrained depth, excellent typography, clear spacing, strong alignment, subtle borders, and semantic status colors.

Avoid unnecessary animation.

---

# 18. Testing Requirements

Before considering 18D complete:

### UI

* [ ] Cashier can create a walk-in sale
* [ ] Cashier can select an existing customer
* [ ] Cashier can search products
* [ ] Cashier can add products
* [ ] Cashier can change quantity
* [ ] Price cannot be edited
* [ ] Total updates correctly
* [ ] Cash payment calculates change
* [ ] Bank transfer accepts reference
* [ ] Complete Sale submits correctly
* [ ] Success state displays invoice
* [ ] View Invoice works
* [ ] New Sale resets correctly

### Error states

* [ ] Insufficient stock
* [ ] Inactive product
* [ ] Invalid payment
* [ ] Permission failure
* [ ] Network failure
* [ ] Duplicate submission

### Responsive

* [ ] Desktop
* [ ] Tablet
* [ ] Mobile
* [ ] Touch-friendly controls

### Integration

* [ ] Sale reaches `completeSale()`
* [ ] Server calculates authoritative price
* [ ] Server calculates authoritative total
* [ ] Inventory movement occurs
* [ ] Payment is recorded
* [ ] Audit event is created
* [ ] Invoice number comes from server

---

## Component 18D Definition of Done

18D is complete when a real cashier can perform this entire journey:

```text
Login
  ↓
Today
  ↓
New Sale
  ↓
Choose customer / Walk-in
  ↓
Search product
  ↓
Add quantity
  ↓
Review cart
  ↓
Payment
  ↓
Complete Sale
  ↓
Invoice generated
  ↓
Stock reduced
  ↓
Payment recorded
  ↓
Audit recorded
  ↓
View Invoice / New Sale
```

At that point we have our **first complete vertical slice** of the application—not just isolated screens or database tables.

The next major business component after 18D will be **Inventory & Stock Operations**, because that is where we handle receiving, opening stock, stock counts, damaged/expired goods, adjustments, low-stock alerts, and eventually branch transfers.
