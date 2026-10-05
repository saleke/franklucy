# Component 23 — Cash Sessions & End-of-Day Reconciliation

## Objective

Provide a simple, reliable way to answer:

> **How much money should this cashier have collected, how much did they actually declare, and is there a difference?**

The system must connect:

```text
Cashier session
      ↓
Sales/payments recorded during session
      ↓
Expected amounts
      ↓
Cashier declares actual amounts
      ↓
System calculates variance
      ↓
Manager/Owner reviews
```

This is an operational control system.

It is **not** a full accounting system.

---

# 1. Why Reconcile Sessions Instead of "Today's Sales"

A branch can have:

* multiple cashiers
* different cashier shifts
* a cashier leaving before the branch closes
* another cashier taking over
* cash sales and bank transfers
* different payment methods

Therefore this is unreliable:

```text
Today's branch sales = cashier's cash
```

Instead, every cashier works within a **Cash Session**.

Example:

```text
Main Branch

John
Session: 08:00–14:00

Mary
Session: 14:00–21:00
```

Each session has its own expected and declared amounts.

---

# 2. Cash Session Lifecycle

Keep the lifecycle very small:

```text
OPEN
  ↓
CLOSED
```

That's it.

Do not create:

```text
PENDING
APPROVED
REVIEWED
DISPUTED
SETTLED
```

for the MVP.

A session being closed does not mean there was no discrepancy.

A closed session can contain:

```text
Expected cash:  ₦120,000
Declared cash:  ₦119,500
Variance:       -₦500
```

The variance remains part of the record.

Management can investigate it separately.

---

# 3. Cash Session Model

Add:

```prisma
model CashSession {
  id              String            @id @default(cuid())
  referenceNumber String            @unique

  branchId        String
  cashierId       String

  status          CashSessionStatus @default(OPEN)

  openingCash     Decimal           @db.Decimal(12, 2)

  expectedCash    Decimal?          @db.Decimal(12, 2)
  declaredCash    Decimal?          @db.Decimal(12, 2)
  cashVariance    Decimal?          @db.Decimal(12, 2)

  expectedTransfer Decimal?         @db.Decimal(12, 2)
  declaredTransfer Decimal?         @db.Decimal(12, 2)
  transferVariance Decimal?         @db.Decimal(12, 2)

  openedAt        DateTime          @default(now())
  closedAt        DateTime?

  closedBy        String?

  notes           String?

  branch          Branch            @relation(
    fields: [branchId],
    references: [id]
  )

  cashier         Employee          @relation(
    fields: [cashierId],
    references: [id]
  )

  payments        Payment[]

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([branchId, status])
  @@index([cashierId, openedAt])
}

enum CashSessionStatus {
  OPEN
  CLOSED
}
```

The exact field names can be adjusted during implementation, but the concepts should remain.

---

# 4. Payment Must Belong to a Session

A payment made by a cashier during an open session should reference that session.

Add:

```prisma
cashSessionId String?

cashSession CashSession? @relation(
  fields: [cashSessionId],
  references: [id]
)
```

to `Payment`.

For completed sales, the payment should normally have a cash session when the payment was taken by a cashier.

This gives us:

```text
Sale
 ↓
Payment
 ↓
Cash Session
 ↓
Cashier
 ↓
Branch
```

That is the traceability we need.

---

# 5. Important Cash Payment Semantics

We need to distinguish:

> **Sale amount**

from:

> **Cash physically handed over by the customer**

Example:

```text
Sale total:       ₦29,200
Customer gives:   ₦30,000
Change:              ₦800
```

The business collected:

```text
₦29,200
```

not ₦30,000.

Therefore `Payment.amount` should represent the amount applied to the sale:

```text
Payment.amount = ₦29,200
```

For cash payments, we should additionally record:

```text
cashReceived = ₦30,000
changeGiven  = ₦800
```

This should be part of the payment model.

For example:

```prisma
cashReceived Decimal? @db.Decimal(12, 2)
changeGiven  Decimal? @db.Decimal(12, 2)
```

These fields are only relevant to cash payments.

The reconciliation uses the **net sale payment**, not the customer's original tender.

---

# 6. Opening Cash

When a cashier opens a session, they declare the opening cash.

Example:

```text
Opening cash:
₦20,000
```

This is normally the starting cash/float already in the drawer.

The system records it.

It is not a sale.

It is not revenue.

It is simply the starting physical cash balance for the session.

---

# 7. Expected Cash

At closing, expected cash is calculated by the server.

The basic formula is:

```text
Expected Cash
=
Opening Cash
+ Cash Sales
- Cash Refunds
```

For example:

```text
Opening cash       ₦20,000
Cash sales        +₦120,000
Cash refunds       -₦5,000
---------------------------
Expected cash     ₦135,000
```

The cashier does not enter this number.

The server calculates it from authoritative records.

---

# 8. Expected Bank Transfer

Bank transfers are not physical cash.

Therefore they should be reconciled separately.

Example:

```text
Expected bank transfers:
₦65,400
```

At closing, the cashier can declare:

```text
Bank transfers:
₦65,400
```

The system calculates:

```text
Transfer variance:
₦0
```

A bank transfer reference entered during a sale is evidence recorded by the cashier.

It is **not automatically proof that the bank actually received the money**.

Actual bank verification is a separate future capability.

---

# 9. Other Payment Methods

For the MVP, `OTHER` should remain available because the business may have payment methods that do not fit the initial categories.

However, do not build a complicated payment-method management system yet.

For reconciliation, we can show:

```text
Cash
Bank Transfer
Other
```

and calculate expected totals from recorded payments.

If the business later uses another important method consistently, we can introduce it explicitly.

---

# 10. Closing a Session

The cashier selects:

```text
Close Session
```

The system calculates:

```text
Expected Cash
Expected Bank Transfer
```

Then asks the cashier to count/declare:

```text
Actual Cash:
[ ₦119,500 ]

Actual Bank Transfer:
[ ₦65,400 ]
```

The system calculates:

```text
Cash variance:
-₦500

Transfer variance:
₦0
```

The cashier should not enter the variance.

---

# 11. Variance Is Evidence, Not an Accusation

If:

```text
Expected cash:  ₦120,000
Declared cash:  ₦119,500
Variance:       -₦500
```

the system records:

> Cash variance: -₦500

It must not automatically say:

> Cash stolen: ₦500

There may be many explanations:

* counting error
* change error
* transaction recording mistake
* refund issue
* cash handling issue
* genuine missing cash

The system records the discrepancy.

Management investigates when necessary.

---

# 12. Closing Must Be Atomic

Closing a session is an important operation.

The server must:

1. Authenticate user.
2. Verify the session belongs to the cashier.
3. Verify the session is `OPEN`.
4. Recalculate expected amounts from the database.
5. Validate declared amounts.
6. Calculate variances.
7. Save the closing values.
8. Mark session `CLOSED`.
9. Create an audit event.
10. Commit the transaction.

If anything fails, the session remains open.

---

# 13. No Client-Supplied Expected Amounts

The client might send:

```json
{
  "expectedCash": "100000",
  "declaredCash": "100000"
}
```

The server must ignore the claimed expected value.

The server calculates it.

The only values the cashier should provide are things such as:

```text
declaredCash
declaredTransfer
notes
```

This is another application of our core principle:

> The backend is the source of truth.

---

# 14. One Open Session Per Cashier

A cashier should not be able to have:

```text
Session A: OPEN
Session B: OPEN
```

at the same time.

Enforce:

> One open cash session per cashier.

This should be enforced at the database/application level, not just through the UI.

If the cashier attempts to open another session:

> You already have an open cash session.

---

# 15. Branch Rules

A cashier's session belongs to a branch.

The server determines the branch from the cashier's authorized context.

The client cannot create:

```text
Cash session:
Cashier = John
Branch = Ikeja
```

if John is currently authorized to operate only at Main Branch.

For managers/owners who can operate across branches, the selected branch must still be one they are authorized to access.

---

# 16. Session Reference

Generate a server-side reference:

```text
CS-MAIN-00001
CS-MAIN-00002
CS-IKEJA-00003
```

This gives management something easy to identify when discussing a discrepancy.

---

# 17. Starting a Session

Create:

```ts
openCashSession(...)
```

The server:

```text
1. Authenticate
2. Check sales/payment permission
3. Determine branch
4. Verify cashier has no open session
5. Validate opening cash
6. Generate reference
7. Create session
8. Audit event
```

Opening cash must be:

```text
>= 0
```

---

# 18. Closing a Session

Create:

```ts
closeCashSession(...)
```

Input should be approximately:

```ts
type CloseCashSessionInput = {
  sessionId: string;
  declaredCash: string;
  declaredTransfer: string;
  notes?: string;
};
```

The server calculates everything else.

---

# 19. Cash Refunds

Refunds must eventually affect reconciliation.

Example:

```text
Cash sale:
₦10,000

Cash refund:
₦2,000
```

The expected cash effect is:

```text
+₦10,000
-₦2,000
= ₦8,000
```

The refund must therefore be linked to the appropriate cash session/payment records.

This is one reason the reconciliation component should be implemented **after** the sales/payment/returns foundations rather than as an isolated page.

---

# 20. Session and Sale Restrictions

An important business rule:

A cashier should not be able to complete a new cash sale without an open cash session.

For example:

```text
Cashier logs in
     ↓
No open session
     ↓
Open Cash Session
     ↓
Start selling
```

For bank transfer payments, the same session should still be used because we want to know which cashier recorded the transaction.

The session is about **cashier activity**, not merely physical cash.

---

# 21. What Happens When the Cashier Leaves?

A cashier can close their session.

Example:

```text
John
08:00 → 14:00
CLOSED

Mary
14:00 → 21:00
OPEN
```

Mary's session is separate.

This makes it possible to determine exactly which cashier's activity produced a discrepancy.

---

# 22. Cash Handover

Do not build a complicated cash-transfer module yet.

For the MVP:

* closing cashier declares actual cash
* next cashier declares their opening cash

If the business physically hands the same cash from one cashier to another, the numbers should correspond.

Example:

```text
John closes:
₦135,000

Mary opens:
₦135,000
```

If:

```text
John closes:
₦135,000

Mary opens:
₦130,000
```

there is a difference worth investigating.

A formal cash-handover workflow can be added later if the business actually needs it.

---

# 23. Owner/Manager View

The owner needs a simple reconciliation workspace.

## `/reconciliation`

Show:

| Session    | Branch | Cashier | Expected Cash | Declared Cash | Variance | Status |
| ---------- | ------ | ------- | ------------: | ------------: | -------: | ------ |
| CS-MAIN-21 | Main   | John    |      ₦135,000 |      ₦135,000 |       ₦0 | Closed |
| CS-MAIN-22 | Main   | Mary    |       ₦98,500 |       ₦97,800 |    -₦700 | Closed |

The important thing is not the table itself.

The important thing is that management can quickly identify:

* sessions closed normally
* sessions with cash variance
* sessions with transfer variance
* sessions still open

---

# 24. Attention Panel

The Today dashboard can later surface:

```text
Cash Attention

1 open cashier session
1 session with cash variance
Cash variance today: -₦700
```

This gives the owner the immediate visibility they originally asked for.

Do not turn it into a giant analytics dashboard.

---

# 25. Session Detail

A session detail page should show:

```text
CS-MAIN-00021

Main Branch
Cashier: John

Opened:
08:02 AM

Closed:
02:15 PM
```

### Sales summary

```text
Sales:
42

Sales value:
₦185,400
```

### Payment summary

```text
Cash:
₦120,000

Bank Transfer:
₦65,400
```

### Cash reconciliation

```text
Opening cash:
₦20,000

Cash sales:
₦120,000

Cash refunds:
₦5,000

Expected:
₦135,000

Declared:
₦134,500

Variance:
-₦500
```

### Transfer reconciliation

```text
Expected:
₦65,400

Declared:
₦65,400

Variance:
₦0
```

Then:

```text
Notes:
Cash count was short by ₦500.
```

---

# 26. What Counts Toward a Session?

A payment belongs to a session when the payment is created.

This means we do not try to reconstruct cashier ownership from timestamps later.

The relationship is explicit:

```text
Payment.cashSessionId
```

That is much more reliable.

---

# 27. Payment/Sale Relationship

The system should maintain:

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

This allows queries such as:

> Show me every payment recorded by John during session CS-MAIN-00021.

And:

> Why is John's session ₦500 short?

The system can drill down into the underlying transactions.

---

# 28. No Manual Editing of Reconciliation Results

After a session is closed:

Do not allow someone to edit:

```text
expectedCash
declaredCash
cashVariance
```

directly.

If the cashier entered the wrong amount, the correction must be an explicit correction action with a reason and audit trail.

Do not silently rewrite historical reconciliation.

---

# 29. Audit Events

Add:

```text
CASH_SESSION_OPENED
CASH_SESSION_CLOSED
CASH_SESSION_CORRECTED
```

`CASH_SESSION_CLOSED` should capture:

* session
* cashier
* branch
* expected cash
* declared cash
* variance
* expected transfer
* declared transfer
* variance
* timestamp

A variance should therefore be visible both in the reconciliation record and the audit trail.

---

# 30. Permissions

Keep this small.

| Role        | Open Own Session | Close Own Session | View Reconciliation |
| ----------- | ---------------: | ----------------: | ------------------: |
| Owner       |                ✓ |                 ✓ |                   ✓ |
| Manager     |                ✓ |                 ✓ |                   ✓ |
| Cashier     |                ✓ |                 ✓ |                   — |
| Stockkeeper |                — |                 — |                   — |

Management can view sessions across authorized branches.

A cashier should normally only operate their own session.

---

# 31. Important Security Rule

Do not allow a cashier to submit:

```text
cashierId = anotherEmployee
```

The authenticated user determines the cashier.

Likewise:

```text
branchId
```

comes from authorized context.

The client cannot impersonate another cashier or operate a different branch by modifying request data.

---

# 32. Payment Corrections and Reconciliation

This component exposes an important rule for the rest of the application:

> Once a payment has contributed to a closed cash session, it cannot simply be edited.

If a sale/payment is later voided or refunded, the system should create the appropriate reversal/refund record.

It should not rewrite the original payment.

That preserves the financial history.

---

# 33. End-of-Day Does Not Mean One Session Per Day

Do not call the database entity `DailyCash`.

A session may last:

```text
08:00 → 14:00
```

or:

```text
08:00 → 20:00
```

or another period.

The business may eventually operate shifts.

`CashSession` therefore represents the cashier's actual period of responsibility.

Daily reports can aggregate sessions later.

---

# 34. Tests

## Opening

Test:

* cashier can open a session
* opening cash can be zero
* negative opening cash rejected
* second open session rejected
* unauthorized branch rejected

## Sales integration

Verify payments made during a session are associated with that session.

Verify a cashier cannot complete a sale without an open session where the payment requires session tracking.

## Closing

Test:

```text
Opening: 20,000
Cash sales: 100,000
Refunds: 5,000

Expected = 115,000
```

Then:

```text
Declared = 115,000
Variance = 0
```

And:

```text
Declared = 114,500
Variance = -500
```

## Transfer payments

Verify expected bank-transfer amount is calculated correctly.

## Security

Verify:

* cashier cannot close another cashier's session
* cashier cannot alter another session
* cashier cannot change expected totals
* cashier cannot change branch
* unauthorized manager cannot view another branch

## Concurrency

Two requests attempting to close the same session must not produce two successful closures.

## Idempotency

Retrying the close request with the same idempotency key must not create duplicate closing/audit records.

---

# 35. What We Are Deliberately Not Building

Do not add:

* full accounting
* general ledger
* bank reconciliation
* expense management
* payroll
* tax accounting
* profit/loss accounting
* cash forecasting
* cash denomination tracking
* automated theft detection
* disciplinary workflows
* complex shift scheduling
* cash pickup logistics
* bank API integration

Those are separate systems.

The objective here is simply:

> **Make every cashier's collected money traceable and reconcilable.**

---

# 36. Definition of Done

Cash reconciliation is complete when:

1. A cashier can open a cash session.
2. Opening cash is recorded.
3. Sales/payment transactions are associated with the session.
4. The server calculates expected cash.
5. The server calculates expected transfer amounts.
6. A cashier can declare actual amounts.
7. The server calculates variances.
8. The cashier cannot manipulate expected values.
9. A session can only be closed once.
10. Closed sessions are historically preserved.
11. Management can view closed sessions.
12. Variances are clearly visible.
13. The audit log records opening and closing.
14. Refunds are correctly reflected in expected cash.
15. Duplicate submissions cannot duplicate reconciliation records.
16. Branch and cashier permissions are enforced server-side.

---

# 37. Implementation Order

Implement in this order:

```text
23.1  Refine Payment model for cash-session attribution
23.2  Add CashSession model
23.3  Implement openCashSession()
23.4  Connect completed payments to sessions
23.5  Implement closeCashSession()
23.6  Add reconciliation calculations/tests
23.7  Add session/reconciliation history
23.8  Add session detail
23.9  Add Today dashboard cash attention
```

Do not build a separate accounting module around this.

---

# Result

After Component 23, the business has a traceable money chain:

```text
CUSTOMER
   ↓
SALE
   ↓
PAYMENT
   ↓
CASH SESSION
   ↓
CASHIER
   ↓
BRANCH
   ↓
RECONCILIATION
   ↓
VARIANCE
```

And the owner can move from:

> “The cash is short.”

to:

> “Which cashier session was short, by how much, during what period, and which transactions made up that session?”

That is the actual control the business needs.
