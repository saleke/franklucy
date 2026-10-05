Good. **Component 5 — Payments & Cash Reconciliation**.

This component exists because a sale and money received are related, but they're **not the same thing**.

A cashier could record a ₦500,000 sale, but the business still needs to know:

> Did we actually receive ₦500,000, through which method, and where is that money now?

---

# Component 5 — Payments & Cash Reconciliation

## 1. Payment methods

We'll initially support:

```text
CASH
BANK_TRANSFER
OTHER
```

We can add POS/card later if the business uses it.

A sale can have one or multiple payments.

### Single payment

```text
Invoice Total: ₦220,500

Payment:
Bank Transfer — ₦220,500

Status: PAID
```

### Split payment

```text
Invoice Total: ₦220,500

Cash:          ₦100,000
Bank Transfer: ₦120,500
----------------------
Total Paid:    ₦220,500
```

The invoice is only considered fully paid when:

```text
Total Payments >= Amount Due
```

---

# 2. Payment status

An invoice should have an explicit payment state.

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
PARTIALLY_REFUNDED
```

For example:

```text
Invoice: ₦500,000

Paid: ₦300,000

Status:
PARTIALLY_PAID
```

This becomes particularly useful when we introduce **credit sales**.

---

# 3. Cash is different from transfer

This distinction is extremely important.

If the customer pays:

```text
₦100,000 CASH
```

the branch physically has cash.

If they pay:

```text
₦100,000 BANK TRANSFER
```

the business should have money in its bank account.

So the system shouldn't simply say:

> Today's payments = ₦5,000,000

It should break them down.

```text
TODAY — IKEJA

Cash             ₦1,200,000
Bank Transfer    ₦2,800,000
Other              ₦100,000
--------------------------------
Total            ₦4,100,000
```

---

# 4. End-of-day reconciliation

This is one of the most valuable features for the owner.

At closing time, the manager opens:

**End of Day**

The system calculates what should have been received.

Example:

```text
IKEJA — 30 SEP 2026

Sales                    ₦4,500,000

Payments
Cash                     ₦1,800,000
Bank Transfer            ₦2,700,000

Refunds                    -₦50,000

Expected Net             ₦4,450,000
```

Then the manager enters the actual physical cash:

```text
Expected Cash:
₦1,800,000

Actual Cash:
[ ₦1,770,000 ]

Difference:
-₦30,000
```

The system flags:

> ⚠️ Cash discrepancy: ₦30,000

---

# 5. The cashier shouldn't be able to hide the discrepancy

This is important given the original business problem.

The cashier should **not** be able to simply change:

```text
Expected: ₦1,800,000
```

to:

```text
Expected: ₦1,770,000
```

The expected figure comes from the transaction records.

Only the **actual amount counted** is entered during reconciliation.

That creates a clean comparison:

```text
SYSTEM EXPECTATION
        ↓
₦1,800,000
        │
        │ compare
        ↓
PHYSICAL CASH
        ↓
₦1,770,000
        │
        ↓
Difference = -₦30,000
```

---

# 6. Who performs reconciliation?

I'd structure it this way:

### Cashier

Can see their own cash activity and submit a closing count.

### Manager

Reviews and confirms the branch reconciliation.

### Owner

Can see all branches and all discrepancies.

So:

```text
Cashier
   ↓
Submit closing
   ↓
Manager
   ↓
Review / confirm
   ↓
Owner
   ↓
Global visibility
```

We can later allow the Owner to perform reconciliation directly.

---

# 7. Cash handover

Your original business process says:

> Cash reaches the owner after work closes at 5.

We should model that rather than just assuming the money disappears.

For example:

```text
Cash Reconciliation

Expected Cash: ₦1,800,000
Actual Cash:   ₦1,800,000

Cash Handover:
Amount:        ₦1,800,000
Received by:   Owner
Time:          5:14 PM

Status: HANDED OVER
```

Now there's an actual record showing the handover.

---

# 8. What if the money isn't handed over immediately?

The system should support:

```text
PENDING_HANDOVER
HANDED_OVER
```

Example:

```text
Ikeja Closing — 30 Sep

Cash: ₦1,800,000
Status: Pending Handover
```

Owner later confirms:

```text
Received:
₦1,800,000

Received by:
Owner

Time:
5:21 PM
```

This gives us a chain:

**Sales → Payments → Cash Reconciliation → Handover**

---

# 9. Bank transfers

We need to be careful here.

The cashier saying:

> "Customer transferred ₦500,000"

is not necessarily proof that the business received it.

For the MVP, the cashier can record the transfer, but the system should distinguish:

```text
TRANSFER_REPORTED
```

from whatever verification process the business eventually adopts.

For example:

```text
Payment

Method: Bank Transfer
Amount: ₦500,000
Reference: TXN-827361
Status: Reported
```

A manager/authorized user can later verify it.

We shouldn't pretend the system itself knows the bank received the money unless we eventually integrate with the bank/payment provider.

---

# 10. Refunds

Refunds must also affect payment records.

Suppose:

```text
Original sale: ₦300,000
Refund:         ₦50,000
```

The system should preserve:

```text
Original Payment
₦300,000

Refund
-₦50,000

Net
₦250,000
```

It should **not edit the original payment from ₦300,000 to ₦250,000**.

That historical distinction is important.

---

# 11. Cash discrepancy investigation

Suppose:

```text
Expected: ₦1,800,000
Actual:   ₦1,770,000
Difference: -₦30,000
```

The manager can record:

```text
Investigation

Difference: ₦30,000

Explanation:
[ Customer refund was incorrectly omitted from closing record ]

Action:
[ Adjustment / Further investigation ]

Notes:
...
```

The system preserves the discrepancy.

It doesn't erase it because someone provided an explanation.

That means the owner can later see:

> There was a ₦30,000 discrepancy, and management recorded an explanation.

---

# 12. Owner's daily money view

This becomes a very useful dashboard section:

```text
TODAY — ALL BRANCHES

Sales                    ₦8,450,000

Cash Expected            ₦3,200,000
Cash Received            ₦3,170,000
Cash Difference            -₦30,000

Transfers Reported       ₦5,250,000

Pending Reconciliation            1
Pending Cash Handover             2
Payment Issues                     3
```

The owner doesn't need to inspect every invoice just to know whether something unusual happened.

---

# 13. Important database concept

We're effectively separating:

```text
Sale
   │
   └── Payment(s)
          │
          ├── Cash
          ├── Bank Transfer
          └── Other
```

Then:

```text
Payment(s)
   ↓
Daily Reconciliation
   ↓
Cash Handover
```

This separation will make the system much more reliable.

---

# 14. What we're NOT doing

We're **not** building a full accounting system yet.

We're not initially trying to handle:

* General ledger
* Balance sheets
* Tax accounting
* Payroll
* Bank API integrations
* Full bookkeeping

Those can come later.

We're solving the immediate business problem:

> **What was sold, what was paid, what should be there, what actually arrived, and is anything abnormal?**

---

## Current architecture

We're now at:

```text
AUTHENTICATION
      ↓
BRANCHES
      ↓
PRODUCTS / INVENTORY
      ↓
SALES / INVOICES
      ↓
PAYMENTS
      ↓
RECONCILIATION
      ↓
AUDIT LOG
```
