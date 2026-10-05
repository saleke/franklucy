Next is **Component 4 — Sales & Invoicing**.

This is probably the most important day-to-day workflow because it connects the cashier, customer, price, inventory, payment, and audit trail.

We’ll design:

1. **Creating a sale**

   * Select customer
   * Select products
   * Enter quantities in crates/packs
   * System calculates totals

2. **Pricing**

   * Cashier cannot freely change prices
   * Authorized discounts/overrides require a reason
   * Price history is preserved

3. **Invoice generation**

   * Unique invoice number
   * Branch
   * Cashier
   * Date/time
   * Items
   * Quantity
   * Unit price
   * Total
   * Payment status

4. **Payments**

   * Cash
   * Transfer
   * Other supported payment methods
   * Amount expected vs amount received

5. **Inventory integration**

   * Completed sale automatically reduces stock.
   * Cashier doesn't separately "update stock."

6. **Corrections**

   * Completed invoices aren't silently edited.
   * Mistakes use a correction/void process with an audit trail.

7. **Returns**

   * Return references the original invoice.
   * Refund is recorded.
   * Returned goods are classified as restocked, damaged, etc.

8. **Daily reconciliation**

   * System calculates how much the branch should have collected.
   * Actual cash/payment records are compared against expected amounts.

9. **Abnormal activity**

   * Excessive voids
   * Unusual discounts
   * Price overrides
   * Returns
   * Payment discrepancies

The key workflow we're aiming for is:

**Customer → Sale → Invoice → Payment → Inventory movement → Audit record**



Let's do it. **Component 4 — Sales & Invoicing** will be designed around one principle:

> **The cashier records what the customer bought; the system calculates and records everything else.**

## 1. Starting a sale

The cashier opens **New Sale**.

```text
NEW SALE

Customer
[ Walk-in Customer ▼ ]

Product
[ Search product... ]

Heineken
Qty: [ 3 ]   ₦38,000/crate   ₦114,000

Nutri Milk
Qty: [ 2 ]   ₦12,000/crate   ₦24,000

--------------------------------
Subtotal                  ₦138,000
Discount                        ₦0
TOTAL                     ₦138,000

[ Cancel ]       [ Continue ]
```

The cashier shouldn't type the price.

The server gets the current authorized price and calculates:

```text
quantity × unit price
```

---

# 2. Walk-in customers

We shouldn't force the cashier to create a customer profile for every person who walks in.

So we'll have:

**Walk-in Customer**

for normal cash sales.

If the customer is a regular business buying on credit or needs records, the cashier can select their customer account.

That keeps the normal workflow fast.

---

# 3. Customer accounts

For registered customers:

```text
Customer
├── Name
├── Phone
├── Address
├── Credit status
├── Credit limit
└── Transaction history
```

This will become important when we build credit sales.

For now, a customer can simply be:

```text
ABC Drinks Shop
```

and their sales history can be viewed later.

---

# 4. Price protection

This is one of our security controls.

Suppose Heineken is:

```text
₦38,000 / crate
```

The cashier cannot enter:

```text
₦30,000
```

just because they want to.

The server determines the price.

If the business genuinely wants to sell below the standard price, the cashier can request a discount:

```text
Discount Request

Original total: ₦114,000

Discount: [ ₦5,000 ]

Reason:
[ Customer negotiated bulk price ]

[ Request Approval ]
```

Depending on the amount/permission, this may require manager approval.

The important thing is that the discount becomes an **explicit business event**.

---

# 5. Invoice calculation

The server should perform the calculation.

For example:

```text
Heineken
3 × ₦38,000 = ₦114,000

Nutri Milk
2 × ₦12,000 = ₦24,000

Malt
15 × ₦5,500 = ₦82,500

--------------------------------
TOTAL = ₦220,500
```

The browser can display calculations for convenience, but the **server recalculates everything before accepting the sale**.

This protects us from someone manipulating the browser request.

---

# 6. Creating the invoice

Once the cashier confirms the sale, the system creates something like:

```text
INVOICE #IKE-000124

Branch: Ikeja
Cashier: John Doe
Customer: Walk-in Customer
Date: 30 Sep 2026
Time: 10:42 AM

--------------------------------
Item          Qty    Price     Total

Heineken       3    ₦38,000   ₦114,000
Nutri Milk     2    ₦12,000    ₦24,000
Malt          15     ₦5,500    ₦82,500

--------------------------------
TOTAL                     ₦220,500
PAYMENT STATUS: PAID
```

The invoice number should be unique.

---

# 7. Payment

After calculating the invoice, the cashier records how the customer paid.

For example:

```text
Payment

Amount Due: ₦220,500

Payment Method:
○ Cash
○ Bank Transfer
○ Other

Amount Received:
[ ₦220,500 ]

[ Complete Sale ]
```

For a split payment, we can eventually support:

```text
Cash:       ₦100,000
Transfer:   ₦120,500
-------------------
Total:      ₦220,500
```

I'd include split payments in the design because real businesses often encounter them.

---

# 8. What happens when "Complete Sale" is clicked?

This is where several systems interact.

The backend performs the transaction:

```text
SALE
  │
  ├── Create invoice
  ├── Create sale items
  ├── Record payment
  ├── Reduce inventory
  └── Create audit event
```

For example:

```text
Heineken
Ikeja inventory
42 → 39 crates
```

The cashier doesn't separately update inventory.

---

# 9. What if stock isn't enough?

Suppose the system has:

```text
Heineken: 2 crates available
```

Customer wants:

```text
5 crates
```

The sale should **not simply create a negative stock balance**.

The cashier gets:

> Insufficient stock. Available: 2 crates.

Then management can decide how to handle the situation.

For the MVP, I recommend **no negative stock** unless we explicitly introduce a controlled backorder feature later.

---

# 10. Completed invoices should become immutable

This is important.

Once:

```text
INV-000124
```

is completed, the cashier shouldn't be able to open it and change:

```text
3 crates → 5 crates
```

or:

```text
₦38,000 → ₦25,000
```

Instead, mistakes use controlled actions.

### Example: wrong quantity

Cashier realizes they entered 5 instead of 3.

They select:

**Request Correction**

```text
Invoice: IKE-000124

Problem:
Quantity entered incorrectly

Requested correction:
Heineken
5 → 3 crates

Reason:
Entered wrong quantity

[ Submit Request ]
```

A manager/authorized person approves it.

The system records the correction rather than pretending the original event never happened.

---

# 11. Voiding a sale

Sometimes an entire invoice genuinely needs to be cancelled.

We use:

**Void Invoice**

with a mandatory reason.

```text
Void Invoice

Invoice: IKE-000124

Reason:
[ Customer cancelled order ]

[ Cancel ] [ Request Void ]
```

Depending on the user's permission, this may require approval.

If the invoice had already reduced inventory, the void process creates the appropriate **inventory reversal**, rather than simply deleting the inventory movement.

---

# 12. Returns

Returns will reference the original invoice.

Example:

```text
Return

Invoice: IKE-000124

Heineken
Sold: 3 crates
Return: [ 1 crate ]

Reason:
[ Damaged product ]

Returned stock:
○ Restock
○ Damaged
○ Expired
```

This distinction is important.

If the customer returns an unopened good crate:

```text
Inventory +1
```

If they return damaged goods:

```text
Available inventory: unchanged
Damaged inventory: +1
```

And the refund/payment reversal is recorded.

---

# 13. Daily reconciliation

At the end of the day, the system should help the manager/owner answer:

> **How much money should this branch have received today?**

Example:

```text
IKEJA — 30 SEP

Sales
₦2,450,000

Cash Sales
₦1,100,000

Bank Transfers
₦1,350,000

Refunds
-₦50,000

Expected Net
₦2,400,000
```

Then actual amounts can be reconciled.

For cash:

```text
Expected Cash: ₦1,100,000
Actual Cash:   ₦1,070,000

Difference:    -₦30,000
```

The system should flag this.

But again:

> **A discrepancy is not automatically labelled theft.**

It becomes something management investigates.

---

# 14. Abnormal activity

This connects directly to the owner's requirement of knowing about unusual activity.

The system can flag things like:

```text
⚠ 4 discount requests by John today

⚠ 3 invoices voided at Ikeja

⚠ ₦30,000 cash discrepancy

⚠ 2 returns processed

⚠ Invoice correction requested
```

These aren't accusations. They're **signals requiring attention**.

---

# 15. The final sales flow

The complete flow becomes:

```text
Customer
   ↓
Cashier creates sale
   ↓
Select products + quantities
   ↓
Server validates prices + stock
   ↓
System calculates total
   ↓
Payment recorded
   ↓
Invoice completed
   ↓
Inventory reduced
   ↓
Audit event created
   ↓
Sale appears in reports
```

And if something goes wrong:

```text
Completed Sale
      ↓
Correction / Return / Void
      ↓
Authorization where required
      ↓
Reversal or adjustment
      ↓
Audit trail preserved
```

That gives us a strong foundation for the financial side of the application.

### Next: Component 5 — Payments & Cash Reconciliation

We should separate this from Sales even though they're connected. **Sales answer "what was sold?" while payments answer "what money was actually received?"**

That's where we can properly design cash, transfers, split payments, refunds, daily closing, discrepancies, and the owner's end-of-day process.
