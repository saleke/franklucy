Good. This is the component that turns the system from a collection of CRUD screens into a **traceable business-control system**.

# Component 8 — Audit Log & Activity Monitoring

The core rule:

> **Important actions must leave evidence of who did them, what happened, when it happened, and what was affected.**

We should distinguish two related things:

* **Audit Log** → permanent record of significant system/business events.
* **Activity Monitoring** → the Owner/Manager's usable view of those events and abnormal activity.

---

## 1. What should be audited?

Not every button click.

We care about meaningful business events.

Examples:

```text
SALE_CREATED
SALE_VOIDED
SALE_CORRECTED

PAYMENT_RECORDED
REFUND_ISSUED
CASH_RECONCILED
CASH_HANDOVER

PRICE_CHANGED
DISCOUNT_APPROVED

STOCK_RECEIVED
STOCK_TRANSFERRED
STOCK_TRANSFER_RECEIVED
STOCK_ADJUSTED
DAMAGED_RECORDED
EXPIRED_RECORDED

EMPLOYEE_CREATED
EMPLOYEE_TRANSFERRED
EMPLOYEE_DEACTIVATED

ATTENDANCE_CORRECTED

USER_CREATED
ROLE_CHANGED
PERMISSION_CHANGED
```

---

# 2. What an audit record contains

Conceptually:

```text
Audit Log
├── Action
├── User
├── Branch
├── Date/Time
├── Entity
├── Entity ID
├── Description
├── Previous Value
├── New Value
└── Reason / Reference
```

For example:

```text
PRICE_CHANGED

User:
Sarah Manager

Branch:
Ikeja

Product:
Heineken

Previous Price:
₦35,000

New Price:
₦38,000

Reason:
Supplier price increase

Time:
09:42 AM
```

---

# 3. Don't store only "John changed something"

We need enough context to investigate.

Bad:

```text
John updated invoice.
```

Useful:

```text
John Doe
Cashier
Ikeja Branch

Invoice: IKE-000124

Action:
Correction Requested

Changed:
Heineken quantity

Original:
5 crates

Requested:
3 crates

Reason:
Entered wrong quantity

Time:
10:42 AM
```

That's the difference between an audit log and a generic activity feed.

---

# 4. Audit records should be immutable

This is critical.

An employee shouldn't be able to:

```text
Create audit record
↓
Edit audit record
↓
Delete audit record
```

Instead:

```text
Business action
      ↓
Audit event
      ↓
Permanent record
```

Even administrators shouldn't casually edit or delete audit events.

If we ever need to correct something, we create **another event** explaining the correction.

---

# 5. Activity screen

The Owner can have:

```text
ACTIVITY

Today
────────────────────────────

10:42 AM
John Doe
Correction requested
Invoice IKE-000124
Heineken: 5 → 3 crates

10:31 AM
Sarah
Price changed
Heineken
₦35,000 → ₦38,000

10:12 AM
Peter
Stock received
30 crates Heineken

09:54 AM
Mary
Clocked in
8:12 AM — Late
```

This is much more useful than dumping raw database logs onto the screen.

---

# 6. Filters

The Owner should be able to filter activity by:

```text
Branch
Employee
Action
Date
Product
Invoice
Severity
```

For example:

> Show me everything John did at Ikeja today.

Or:

> Show all stock adjustments this month.

Or:

> Show all invoice voids across all branches.

That becomes extremely useful when investigating discrepancies.

---

# 7. Abnormal activity

We can build a simple **alert/event system** on top of the audit log.

For example:

```text
⚠ Cash discrepancy
₦30,000
Ikeja

⚠ Large discount
₦75,000
Invoice IKE-00142

⚠ Multiple invoice voids
5 voids
John Doe
Today

⚠ Stock discrepancy
2 crates
Main → Ikeja

⚠ Attendance correction
John Doe
8:00 AM requested instead of 8:32 AM
```

These aren't accusations.

They're simply:

> **Events that may deserve attention.**

---

# 8. Immediate vs normal activity

The Owner specifically wants abnormal activity **immediately**, so not everything needs the same notification behavior.

We can categorize events:

### Normal

```text
Sale completed
Customer created
Stock received
Employee clocked in
```

These go into the activity feed.

### Attention

```text
Discount requested
Attendance correction
Stock adjustment
Invoice correction
```

These appear in the activity feed and alerts.

### Critical

```text
Large cash discrepancy
Unauthorized action attempt
Major stock discrepancy
Repeated failed sensitive actions
```

These can generate an immediate notification later.

---

# 9. Don't build complicated notifications yet

For MVP, I would start with:

```text
Dashboard alerts
+
Activity feed
```

Then we can add:

```text
Email
SMS
WhatsApp
Push notifications
```

if the owner actually needs them.

We shouldn't spend time building a notification infrastructure before we know which alerts matter.

---

# 10. Audit trail example

Imagine John tries to change the price.

The server rejects it:

```text
John
Cashier
Ikeja

Attempted:
Change Heineken price

From:
₦38,000

To:
₦30,000

Result:
DENIED

Reason:
Insufficient permission
```

Should that be audited?

**Yes.**

Because an unsuccessful sensitive action can itself be relevant.

We don't need to record every normal failed form validation, but attempts to perform restricted business actions should be logged.

---

# 11. Connecting events together

This is where the architecture becomes powerful.

Imagine the Owner sees:

> ₦50,000 cash discrepancy.

They can investigate:

```text
Cash discrepancy
      ↓
Daily reconciliation
      ↓
Payments
      ↓
Invoices
      ↓
Refunds
      ↓
Voids
      ↓
Corrections
      ↓
Employee activity
```

Similarly:

> 3 crates of Heineken are missing.

They can trace:

```text
Stock discrepancy
      ↓
Stock count
      ↓
Inventory movements
      ↓
Sales
      ↓
Transfers
      ↓
Damaged / expired records
      ↓
Employees who performed those actions
```

That's exactly what we want.

---

# 12. Audit log is not a replacement for business records

This distinction is important.

We shouldn't make the audit log responsible for the actual state of the business.

For example:

```text
Sale table
→ actual sale

Inventory movement table
→ actual stock movement

Payment table
→ actual payment

Audit log
→ evidence that these events/actions happened
```

The audit log complements the business data.

It doesn't become a giant miscellaneous table containing everything.

---

# 13. Security architecture

This also reinforces something we established in Component 1:

**The backend creates audit events.**

Not the browser.

We should never trust:

```text
POST /audit-log
{
   "user": "John",
   "action": "PRICE_CHANGED"
}
```

from the client.

Instead:

```text
Authenticated request
        ↓
Server identifies John
        ↓
Server checks permission
        ↓
Server performs action
        ↓
Server creates audit event
```

That way an employee cannot simply tell the system:

> "I am the owner."

---

# 14. Owner's Activity Dashboard

Eventually the Owner's main dashboard could have:

```text
TODAY

Sales              ₦8.4M
Cash Difference    -₦30K
Low Stock             6
Pending Transfers     2

────────────────────────────

ATTENTION REQUIRED

⚠ ₦30K cash discrepancy
⚠ 2 crates missing from transfer
⚠ 3 invoice voids by John
⚠ 1 attendance correction
⚠ Large discount requested
```

And below:

```text
RECENT ACTIVITY

10:42 John — Invoice correction requested
10:31 Sarah — Heineken price changed
10:12 Peter — Stock received
09:54 Mary — Clocked in late
```

That's much closer to what the owner actually needs.

---

# Component 8 is now defined

Our control chain is becoming:

```text
                   BUSINESS EVENT
                         │
                         ↓
                ┌─────────────────┐
                │ Server validates │
                │     action       │
                └────────┬────────┘
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
       Business Record         Audit Event
              │                     │
              ↓                     ↓
       Current Business       Activity / Alerts
           State                    │
                                    ↓
                              Owner Visibility
```

So far we have:

```text
1. Authentication & Users       ✅
2. Branch Management            ✅
3. Products & Inventory         ✅
4. Sales & Invoicing            ✅
5. Payments & Reconciliation    ✅
6. Stock Receiving & Transfers  ✅
7. Attendance                   ✅
8. Audit & Activity             ✅
```
