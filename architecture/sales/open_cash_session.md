Yes. We’ll do **23.1 first: Payment + CashSession data model**, before touching the UI or reconciliation screens.

The goal is to make the money relationships correct now so later calculations are straightforward.

### 23.1 — Payment and Cash Session Foundation

**1. Change `Payment` so its meaning is unambiguous**

I recommend:

```prisma
model Payment {
  id              String        @id @default(cuid())
  saleId          String
  amount          Decimal       @db.Decimal(12, 2)
  method          PaymentMethod
  status          PaymentStatus @default(COMPLETED)

  cashReceived    Decimal?      @db.Decimal(12, 2)
  changeGiven     Decimal?      @db.Decimal(12, 2)

  reference       String?

  receivedBy      String
  cashSessionId   String?

  sale            Sale          @relation(fields: [saleId], references: [id])
  cashSession     CashSession?  @relation(
    fields: [cashSessionId],
    references: [id]
  )

  createdAt       DateTime      @default(now())

  @@index([saleId])
  @@index([cashSessionId])
  @@index([receivedBy])
}
```

The meanings are now strict:

* `amount` = amount applied to the sale.
* `cashReceived` = physical cash handed over, only for cash.
* `changeGiven` = cash returned to customer, only for cash.
* `cashSessionId` = session in which the payment was recorded.
* `reference` = transfer/reference information where applicable.

Example:

```text
Sale total       ₦29,200
Cash received    ₦30,000
Change            ₦800

Payment.amount   ₦29,200
cashReceived     ₦30,000
changeGiven      ₦800
```

This prevents the reconciliation system from confusing **money tendered** with **money belonging to the sale**.

---

### 2. Add `CashSession`

```prisma
model CashSession {
  id               String            @id @default(cuid())
  referenceNumber  String            @unique

  branchId         String
  cashierId        String

  status           CashSessionStatus @default(OPEN)

  openingCash      Decimal           @db.Decimal(12, 2)

  expectedCash     Decimal?          @db.Decimal(12, 2)
  declaredCash     Decimal?          @db.Decimal(12, 2)
  cashVariance     Decimal?          @db.Decimal(12, 2)

  expectedTransfer Decimal?          @db.Decimal(12, 2)
  declaredTransfer Decimal?          @db.Decimal(12, 2)
  transferVariance Decimal?          @db.Decimal(12, 2)

  openedAt         DateTime          @default(now())
  closedAt         DateTime?
  closedBy         String?

  notes            String?

  branch           Branch            @relation(
    fields: [branchId],
    references: [id]
  )

  cashier          Employee          @relation(
    fields: [cashierId],
    references: [id]
  )

  payments         Payment[]

  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@index([branchId, status])
  @@index([cashierId, openedAt])
}

enum CashSessionStatus {
  OPEN
  CLOSED
}
```

### 3. Add the required relations

`Branch` gets:

```prisma
cashSessions CashSession[]
```

`Employee` gets:

```prisma
cashSessions CashSession[]
```

`Payment` gets:

```prisma
cashSessionId String?

cashSession CashSession? @relation(
  fields: [cashSessionId],
  references: [id]
)
```

---

### 4. Important business rules

These should live in the server workflow, not just Prisma:

**Opening**

```text
openingCash >= 0
cashier is active
cashier has branch access
cashier has no existing OPEN session
```

**Cash payment**

```text
method = CASH
→ cashReceived is required
→ cashReceived >= amount
→ changeGiven = cashReceived - amount
```

**Non-cash payment**

```text
method != CASH
→ cashReceived = null
→ changeGiven = null
```

**Closing**

```text
session must be OPEN
declaredCash >= 0
declaredTransfer >= 0
```

Expected values are **always calculated server-side**.

---

### 5. One thing I would change from the earlier spec

I would **not store `expectedCash`, `expectedTransfer`, and the variance as permanently authoritative business data until closing**.

At close, we calculate them from the underlying payments, then store the closing snapshot.

That gives us both:

* the original transaction evidence
* the exact reconciliation result that was produced when the session was closed

So after closure:

```text
Payment history
      ↓
recalculation
      ↓
closing snapshot
```

If we later discover a payment correction, we don't silently rewrite the old reconciliation.

---

### 6. One important implementation issue

PostgreSQL/Prisma needs to prevent two simultaneous open sessions for the same cashier.

A normal Prisma `@unique` cannot express:

> unique only where status = OPEN

So we'll handle this with a **PostgreSQL partial unique index** in the migration:

```sql
CREATE UNIQUE INDEX "one_open_cash_session_per_cashier"
ON "CashSession" ("cashierId")
WHERE "status" = 'OPEN';
```

That's a small piece of database-specific logic worth having. It protects us against race conditions that application code alone could miss.

---

### 7. Then `completeSale()` changes slightly

The existing workflow becomes:

```text
authenticate
    ↓
permission
    ↓
determine branch
    ↓
find active CashSession
    ↓
validate sale
    ↓
load authoritative prices/stock
    ↓
calculate totals
    ↓
create Sale
    ↓
create SaleItems
    ↓
create Payment linked to CashSession
    ↓
create inventory movements
    ↓
audit
    ↓
commit
```

For a cashier, **no open session = no new payment/sale**.

That gives us a clean guarantee:

> Every cashier transaction belongs to a specific operational session.

---

### 8. Before moving on

There is one dependency we should resolve in the actual implementation:

**Returns/refunds must produce a traceable cash effect.**

Otherwise this calculation:

```text
Opening cash
+ cash received
- cash refunds
= expected cash
```

cannot be reliable.

So we don't need to build the entire returns system right now, but its eventual refund record must be capable of being associated with the relevant cash session.

That is the correct foundation for **23.2 — `openCashSession()`**.



# 23.2 — Open Cash Session

## Objective

Allow an authorized cashier to start a working session at a branch by declaring the physical cash available at the beginning of the session.

The operation must establish:

```text
Cashier
   ↓
Branch
   ↓
Cash Session
   ↓
Opening Cash
```

After the session is opened, the cashier can record sales/payments against it.

---

## 1. Server Contract

Create:

```ts
type OpenCashSessionInput = {
  openingCash: string;
  branchId?: string;
};
```

`branchId` should **not normally come from the client**.

For a cashier assigned to one branch, the server determines it automatically.

For a manager/owner who can operate across branches, the selected branch can be accepted only after server-side authorization.

The server must never trust:

```text
cashierId
employeeId
userId
```

from the request.

These come from the authenticated user.

---

## 2. Workflow

Create:

```ts
openCashSession(input, context)
```

The authoritative workflow is:

```text
1. Authenticate user
2. Resolve employee
3. Require permission
4. Resolve authorized branch
5. Validate opening cash
6. Check employee status
7. Check branch status
8. Check for existing open session
9. Generate session reference
10. Create CashSession
11. Create audit event
12. Commit transaction
13. Return session
```

Everything happens server-side.

---

## 3. Permission

Add:

```text
cash.session.open
```

Initial access:

| Role        | Permission |
| ----------- | ---------- |
| Owner       | ✓          |
| Manager     | ✓          |
| Cashier     | ✓          |
| Stockkeeper | —          |

However, permission alone is not enough.

The employee must also be:

```text
ACTIVE
```

and authorized to operate at the selected branch.

---

## 4. Opening Cash Validation

The opening cash must be a valid non-negative monetary value.

Valid:

```text
0
5000
20000
125000.50
```

Invalid:

```text
-500
abc
null
undefined
```

Use the existing money/Decimal conventions.

Do not parse money using JavaScript floating-point arithmetic.

---

## 5. Branch Resolution

For a normal cashier:

```text
Authenticated User
       ↓
Employee
       ↓
Active Branch Assignment
       ↓
Branch
```

The client should not be able to change this by sending another branch ID.

For example, this must be rejected:

```json id="d3s9ve"
{
  "branchId": "MAIN-BRANCH",
  "openingCash": "20000"
}
```

if the authenticated cashier is assigned to another branch.

---

## 6. Existing Open Session

Before creating a session, check whether the cashier already has an open session.

If one exists, return a business error such as:

```text
CASH_SESSION_ALREADY_OPEN
```

Response should tell the UI that an existing session must be closed before another can be started.

Do not create a second session.

---

## 7. Database Protection

Application validation is not enough.

Two requests could theoretically arrive simultaneously:

```text
Request A → check no open session
Request B → check no open session
Request A → create
Request B → create
```

The PostgreSQL partial unique index prevents this:

```sql
CREATE UNIQUE INDEX "one_open_cash_session_per_cashier"
ON "CashSession" ("cashierId")
WHERE "status" = 'OPEN';
```

The service should catch the resulting constraint error and convert it into:

```text
CASH_SESSION_ALREADY_OPEN
```

rather than exposing a database error to the user.

---

## 8. Session Reference

Generate the reference on the server.

Example:

```text
CS-MAIN-00001
CS-MAIN-00002
CS-IKEJA-00001
```

The reference must be unique.

Do not allow the client to supply it.

The final database uniqueness constraint is the safety net.

---

## 9. Transaction

Opening a session should use a database transaction:

```ts
await prisma.$transaction(async (tx) => {
  // validate/create session
  // create audit event
});
```

The important rule is:

> A successfully created session must have its audit record created with it.

If audit creation fails, the session creation should roll back.

---

## 10. Audit Event

Create:

```text
CASH_SESSION_OPENED
```

Record:

```text
user
employee
branch
cash session
opening cash
timestamp
```

Example description:

```text
Cash session CS-MAIN-00021 opened with opening cash of ₦20,000.
```

The audit record is evidence of what happened.

---

## 11. Service Shape

Conceptually:

```ts
async function openCashSession(
  input: OpenCashSessionInput,
  context: AuthContext
) {
  // authentication
  // authorization
  // branch resolution
  // validation
  // transaction
}
```

Keep this in:

```text
src/modules/reconciliation/
```

For example:

```text
src/modules/reconciliation/
  cash-session.service.ts
  cash-session.validation.ts
  cash-session.errors.ts
```

Do not create unnecessary abstractions yet.

---

## 12. Error Codes

Use domain errors rather than generic messages.

At minimum:

```text
EMPLOYEE_NOT_FOUND
EMPLOYEE_INACTIVE
BRANCH_NOT_FOUND
BRANCH_INACTIVE
BRANCH_ACCESS_DENIED
CASH_SESSION_ALREADY_OPEN
INVALID_OPENING_CASH
PERMISSION_DENIED
```

The UI can translate these into useful messages.

For example:

```text
CASH_SESSION_ALREADY_OPEN
```

becomes:

> You already have an open cash session. Close it before starting another.

---

## 13. Successful Response

Return enough information for the UI to immediately enter the active-session state.

For example:

```ts
type CashSessionResult = {
  id: string;
  referenceNumber: string;
  branchId: string;
  cashierId: string;
  status: "OPEN";
  openingCash: string;
  openedAt: Date;
};
```

Do not return unnecessary database fields.

---

## 14. UI Flow

The cashier should encounter this when they have no active session:

```text
┌──────────────────────────────────────┐
│ Start Cash Session                   │
│                                      │
│ Main Branch                          │
│                                      │
│ Opening cash                         │
│ ┌──────────────────────────────────┐ │
│ │ ₦ 20,000                         │ │
│ └──────────────────────────────────┘ │
│                                      │
│ This is the cash currently available │
│ before you begin taking sales.       │
│                                      │
│             [ Start Session ]        │
└──────────────────────────────────────┘
```

For a single-branch cashier, don't make them select the branch.

Show it as context:

> Main Branch

rather than as an unnecessary input.

---

## 15. Successful State

After creation:

```text
Cash Session Open
CS-MAIN-00021

Opening cash
₦20,000

Opened
10:04 AM

[Start Sale]
```

The cashier should then be able to proceed directly to the POS.

---

## 16. Failure Handling

If the request fails because of a network error:

> Couldn't start the cash session. Please try again.

The operation should be safe to retry.

If the first request actually succeeded but the response was lost, the second request should encounter:

```text
CASH_SESSION_ALREADY_OPEN
```

The UI should then retrieve/display the existing open session rather than creating another one.

This is another reason the operation must be state-safe.

---

## 17. Tests

### Authorization

Test:

* cashier can open own session
* stockkeeper cannot
* inactive employee cannot
* unauthorized branch rejected

### Validation

Test:

* zero opening cash accepted
* positive opening cash accepted
* negative amount rejected
* malformed amount rejected

### Existing session

Test:

```text
Open session A
Attempt session B
→ rejected
```

### Database concurrency

Run two simultaneous open requests.

Expected:

```text
Request A → success
Request B → CASH_SESSION_ALREADY_OPEN
```

Never:

```text
Request A → success
Request B → success
```

### Transaction

If audit creation fails:

```text
CashSession → not created
```

### Security

Attempt to send another employee's ID or another branch ID.

Expected:

```text
→ rejected
```

---

## 18. Definition of Done

`openCashSession()` is complete when:

* authenticated users are required
* permissions are enforced server-side
* employee status is checked
* branch access is checked
* opening cash is validated using Decimal-safe money handling
* cashier identity comes from authentication
* branch identity is server-authorized
* only one open session can exist per cashier
* session reference is server-generated
* session and audit creation are atomic
* useful domain errors are returned
* successful creation returns the active session
* concurrent requests cannot create duplicate open sessions
* tests cover the above cases

---

## 19. Result

After this step, the cashier journey becomes:

```text
Login
  ↓
No active session?
  ↓
Start Cash Session
  ↓
Declare opening cash
  ↓
Server validates
  ↓
CashSession OPEN
  ↓
Start selling
```

The next step is **23.3 — connect completed payments to the active cash session**.

That is where `completeSale()` will begin enforcing:

```text
Cashier
  ↓
Active Cash Session
  ↓
Payment
  ↓
Sale
```

Without that connection, reconciliation would only be a report built on assumptions. With it, the reconciliation becomes based on explicit transaction history.
