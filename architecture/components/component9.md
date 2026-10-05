## Component 9 — Customers, Credit Sales & Returns

Now that we’ve clarified the terminology, we’ll design this around the **actual business workflow**, not online customer accounts.

### 9.1 Customer types

We need only two concepts for the MVP:

**Walk-in customer**

* No profile required.
* Cashier selects `Walk-in Customer`.
* Sale is still fully recorded.

**Customer record**

* Created when the business wants to identify and track a customer.
* No login/password.
* Useful for regular customers, businesses, and credit customers.

Example:

```text
ABC Restaurant
Phone: 080...
Address: Ikeja
Credit Limit: ₦500,000
Outstanding Balance: ₦180,000
```

---

## 9.2 Why create a customer record?

Because the business may need to answer:

> “How much does this customer owe us?”

or:

> “What has ABC Restaurant bought from us this month?”

or:

> “They returned 5 crates from invoice INV-00124. What should we refund?”

So the customer record connects related business transactions.

```text
Customer
   │
   ├── Sales
   ├── Credit invoices
   ├── Payments
   ├── Returns
   └── Refunds
```

---

# 9.3 Credit sales

This is where customer records become particularly important.

Suppose ABC Restaurant buys:

```text
10 crates → ₦200,000
```

They don't pay immediately.

The cashier records:

```text
Invoice: INV-00124
Customer: ABC Restaurant
Total: ₦200,000
Paid: ₦0
Outstanding: ₦200,000
```

The inventory is still reduced because the goods actually left the branch.

The customer now owes the business ₦200,000.

---

## 9.4 Partial payment

Suppose they later pay ₦100,000.

We **do not modify the original invoice**.

Instead:

```text
Invoice total:       ₦200,000
Payment 1:           ₦100,000
Outstanding:         ₦100,000
```

Later they pay the remaining ₦100,000:

```text
Payment 2:           ₦100,000
Outstanding:         ₦0
```

This gives us a proper payment history.

---

# 9.5 Credit limits

A customer can have a configurable credit limit.

Example:

```text
Credit limit: ₦500,000
Outstanding: ₦450,000
New sale:     ₦100,000
```

That would take their exposure to ₦550,000.

The system should **not silently allow that**.

Instead:

> ⚠️ Credit limit exceeded

Depending on the business policy, a manager can approve the sale or reject it.

This is another useful audit event.

---

# 9.6 Customer payments

A customer payment should be its own record.

For example:

```text
Customer: ABC Restaurant
Amount: ₦100,000
Method: Bank Transfer
Reference: TRX12345
Received by: Cashier John
Date: ...
```

The payment can then be allocated against one or more outstanding invoices.

That means we can answer:

> “Which invoices has this payment settled?”

rather than simply changing a balance number.

---

# 9.7 Returns

Returns should reference the original sale.

Example:

```text
Invoice INV-00124

10 crates Heineken
2 crates Nutri Milk
```

Customer returns:

```text
2 crates Heineken
```

The system records:

```text
Return
Original invoice: INV-00124
Product: Heineken
Quantity: 2
Reason: Damaged
Approved by: Manager
```

Then we need to decide what happens to those 2 crates.

### Option A — Restock

If they're still sellable:

```text
Returned → Available Stock
```

### Option B — Damaged

If they're no longer sellable:

```text
Returned → Damaged Stock
```

### Option C — Expired

```text
Returned → Expired Stock
```

This is important because **a return shouldn't automatically increase sellable inventory**.

---

# 9.8 Refunds

Suppose the customer originally paid ₦200,000 and returns goods worth ₦40,000.

The system records a refund:

```text
Refund: ₦40,000
Reason: Customer return
Original invoice: INV-00124
Approved by: Manager
```

Again, we don't rewrite the original sale.

We create a separate financial event.

That gives us a clean history:

```text
Sale       +₦200,000
Payment    +₦200,000
Return     -₦40,000
Refund     -₦40,000
```

---

# 9.9 Customer transaction history

A customer's page could look roughly like:

```text
ABC Restaurant

Outstanding Balance: ₦180,000
Credit Limit:        ₦500,000

─────────────────────────────
Recent Transactions

INV-00124   ₦200,000   Credit
INV-00118   ₦150,000   Paid
PAY-00045   ₦100,000   Payment
RET-00007   ₦20,000    Return
─────────────────────────────
Outstanding: ₦180,000
```

The manager can quickly understand the customer's financial relationship with the business.

---

# 9.10 Permissions

We shouldn't let every employee manipulate customer balances.

| Action                        | Owner | Manager | Cashier             | Stockkeeper |
| ----------------------------- | ----- | ------- | ------------------- | ----------- |
| View customers                | ✅     | ✅       | ✅                   | Limited     |
| Create customer               | ✅     | ✅       | ✅                   | ❌           |
| Edit customer details         | ✅     | ✅       | Limited             | ❌           |
| Create credit sale            | ✅     | ✅       | According to policy | ❌           |
| Approve credit-limit override | ✅     | ✅       | ❌                   | ❌           |
| Record payment                | ✅     | ✅       | ✅                   | ❌           |
| Process return                | ✅     | ✅       | Request             | ❌           |
| Approve refund                | ✅     | ✅       | ❌                   | ❌           |
| View customer balance         | ✅     | ✅       | ✅                   | ❌           |

The exact cashier permissions can be adjusted when we define the owner's business rules.

---

# 9.11 Important rule: balance is calculated

Don't create a database field like:

```text
customer.balance = 180000
```

and let employees directly edit it.

Instead, the balance comes from the underlying transactions:

```text
Credit sales
+ payments
+ returns
+ refunds
= current balance
```

That makes manipulation much harder and gives us an audit trail.

---

# 9.12 What we're NOT building

For this MVP:

❌ Customer login
❌ Customer mobile app
❌ Online ordering
❌ Online payment gateway
❌ Delivery tracking
❌ Customer self-service portal

Those can be added later without redesigning the core sales system.

---

## Component 9 in one picture

```text
                    CUSTOMER
                       │
          ┌────────────┴────────────┐
          │                         │
     WALK-IN                  CUSTOMER RECORD
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                  SALES            PAYMENTS          RETURNS
                    │                 │                 │
              Credit/paid       Against invoices    Refund/restock
                    │
              OUTSTANDING BALANCE
```

The key idea is that **customers are an accounting/transaction identity inside our business system, not necessarily users of the software.**

With Component 9 done, the next logical piece is **Component 10 — Dashboard & Reports**: what the owner, manager, cashier, and stockkeeper actually see when they log in, and which numbers/alerts matter on a daily basis.
