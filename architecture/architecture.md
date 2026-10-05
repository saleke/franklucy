Good. We start with **Component 1: Authentication, Users & Roles**.

This component looks simple, but it is actually one of the most important parts of the system because **every sale, stock movement, correction, attendance record, and approval needs a trustworthy identity behind it**.

# 1. What we're trying to achieve

When an employee performs an action, the system must be able to answer:

> **Who did this, from which branch, and when?**

For example:

```text
Sale #INV-1042

Created by:        John Doe
Role:              Cashier
Branch:            Ikeja
Created at:        29 Sep 2026, 14:32
```

And when someone changes something:

```text
Price override

Requested by:      John Doe
Approved by:       Sarah
Branch:            Ikeja
Reason:            Bulk customer discount
Time:              14:35
```

That identity chain becomes the foundation of your audit system.

---

# 2. Don't confuse User with Employee

This is an important database decision.

We should have a distinction between:

### Employee

The person who works for the business.

```text
Employee
- name
- phone
- employment status
- branch
- role
```

### User account

The credentials that allow that employee to access the application.

```text
User
- employee
- email/username
- password/authentication data
- account status
```

Why separate them?

Because an employee can leave.

You don't want to delete all their historical records.

Instead:

```text
Employee
John Doe
Status: INACTIVE

User account
Disabled
```

But his historical records remain:

```text
Sales:
John created 1,284 transactions

Attendance:
John worked 11 months

Audit:
John performed 1,531 actions
```

That is critical.

**Never delete historical business evidence simply because an employee leaves.**

---

# 3. Roles

For the first version, I'd use four roles.

```text
OWNER
MANAGER
CASHIER
STOCKKEEPER
```

But don't hard-code the assumption that every branch has every role.

A small branch might have:

```text
Manager
   +
Cashier
```

while a larger branch might have:

```text
Manager
   +
Cashier × 3
   +
Stockkeeper × 2
```

---

# 4. What each role sees

Here's our initial permission model.

| Capability               |    Owner   |     Manager     |   Cashier  | Stockkeeper |
| ------------------------ | :--------: | :-------------: | :--------: | :---------: |
| View dashboard           |      ✅     |        ✅        |   Limited  |   Limited   |
| Create sales             |      ✅     |        ✅        |      ✅     |      ❌      |
| View sales               |     All    |      Branch     | Own/branch |      ❌      |
| Create invoice           |      ✅     |        ✅        |      ✅     |      ❌      |
| Modify completed sale    | Controlled | Request/approve |   Request  |      ❌      |
| Change prices            |      ✅     |    Controlled   |      ❌     |      ❌      |
| Apply discount           |      ✅     |     Approve     |   Request  |      ❌      |
| Receive stock            |      ✅     |        ✅        |      ❌     |      ✅      |
| Transfer stock           |      ✅     |        ✅        |      ❌     |      ✅      |
| Record damaged stock     |      ✅     |        ✅        |   Request  |      ✅      |
| Record expired stock     |      ✅     |        ✅        |   Request  |      ✅      |
| Approve stock adjustment |      ✅     |        ✅        |      ❌     |      ❌      |
| Attendance               |     All    |      Branch     |     Own    |     Own     |
| Employee management      |      ✅     |      Branch     |      ❌     |      ❌      |
| View audit log           |      ✅     |      Branch     |      ❌     |      ❌      |
| Manage branches          |      ✅     |        ❌        |      ❌     |      ❌      |
| Manage system settings   |      ✅     |        ❌        |      ❌     |      ❌      |

But here's an important distinction:

**Permissions and roles are not the same thing.**

We should eventually model permissions underneath roles.

For example:

```text
Role
  ↓
Permissions

MANAGER
  ├── sales.view
  ├── sales.create
  ├── inventory.view
  ├── inventory.adjust.request
  ├── employees.view
  └── reports.view
```

That gives us flexibility later.

---

# 5. Branch access

This is another critical rule.

Suppose John works at:

```text
Ikeja Branch
```

He shouldn't be able to log in and suddenly see:

```text
Ikeja
Yaba
Surulere
Lekki
```

His account should have a branch context.

```text
John
Role: Cashier
Branch: Ikeja
```

When John logs in:

```text
┌────────────────────────────┐
│ Good morning, John         │
│ Ikeja Branch               │
└────────────────────────────┘
```

Every transaction he creates automatically belongs to Ikeja.

He shouldn't have to select:

> Branch: Ikeja ▼

That introduces unnecessary risk.

---

# 6. What about managers?

Managers may have access to one branch or potentially several.

So rather than permanently assuming:

```text
User → one branch
```

I'd model:

```text
User
  ↓
Branch Access
  ↓
One or more branches
```

Example:

```text
Sarah
Role: Manager

Access:
✓ Ikeja
✓ Yaba
```

But the system should still have an **active branch context**.

```text
Sarah is currently viewing:

[Ikeja Branch ▼]
```

If she switches to Yaba:

```text
[Yaba Branch ▼]
```

the system clearly shows that context.

This prevents the classic mistake of thinking you're editing Branch A while you're actually viewing Branch B.

---

# 7. The owner is different

The owner needs a consolidated view.

Instead of:

```text
Current branch: Ikeja
```

they can see:

```text
ALL BRANCHES
```

and drill down when necessary.

```text
Owner
 ↓
All Branches
 ├── Ikeja
 ├── Yaba
 └── Surulere
```

But even the owner should have a clear context.

For example:

```text
┌─────────────────────────────┐
│ Viewing: ALL BRANCHES    ▼  │
└─────────────────────────────┘
```

Then:

```text
Viewing: Ikeja
```

when they drill down.

---

# 8. Login UX

Don't overcomplicate this.

For the first version:

```text
┌──────────────────────────────┐
│                              │
│          BranchFlow          │
│                              │
│ Username / Email              │
│ [________________________]   │
│                              │
│ Password                     │
│ [________________________]   │
│                              │
│        [ SIGN IN ]           │
│                              │
│ Forgot password?             │
└──────────────────────────────┘
```

After authentication:

```text
Authentication
      ↓
Identify user
      ↓
Load role
      ↓
Load branch permissions
      ↓
Load appropriate dashboard
```

The cashier shouldn't even see links to features they're not allowed to use.

**Don't merely hide buttons and rely on that for security.**

The backend must enforce permissions too.

---

# 9. The security rule

This is extremely important for you as the developer.

Never trust:

```text
role = "OWNER"
```

coming from the frontend.

A malicious user can manipulate frontend requests.

Instead:

```text
Browser
   ↓
"Create sale"
   ↓
Server
   ↓
Who is this user?
   ↓
What role do they have?
   ↓
What branch are they allowed to access?
   ↓
Are they allowed to perform this action?
   ↓
YES → continue
NO  → reject
```

The backend is the authority.

---

# 10. What happens when an employee leaves?

We do **not** delete them.

We deactivate them.

```text
Employee:
John Doe

Status:
INACTIVE

Reason:
Employment ended

Date:
29 Sep 2026
```

Their login stops working immediately.

But:

```text
Invoice #1024
Created by John

Stock adjustment #55
Created by John

Attendance
John — September

Audit log
John — 1,531 actions
```

remain intact.

This is essential for accountability.

---

# 11. What happens if someone forgets their password?

Don't make the owner manually reset passwords by editing the database.

Use a proper password recovery mechanism.

For the MVP:

```text
Forgot password
       ↓
Email/verified recovery method
       ↓
Reset password
```

If the business environment makes email inconvenient, we can later design an appropriate administrator-assisted recovery flow.

But **never store plaintext passwords**.

---

# 12. Don't use one shared account

This is a hard rule.

Don't do:

```text
Username: cashier
Password: 123456
```

for everybody.

If five employees use the same account:

```text
Sale #1004
Created by: cashier
```

you've learned nothing.

Instead:

```text
Sale #1004
Created by: John
```

and:

```text
Sale #1005
Created by: Sarah
```

Now your audit system means something.

---

# 13. Database model — conceptual version

We're not writing Prisma yet.

First understand the relationships:

```text
                    ┌──────────────┐
                    │   Employee   │
                    └──────┬───────┘
                           │
                           │
                    ┌──────▼───────┐
                    │     User     │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │     Role     │
                    └──────────────┘

Employee
   │
   └────── Branch Assignment ────── Branch
```

And eventually:

```text
User
 │
 ├── Sales
 ├── Payments
 ├── Attendance
 ├── Stock movements
 ├── Approvals
 └── Audit logs
```

Every important business action points back to a user.

---

# 14. Cost consideration

This component shouldn't be expensive.

We don't need:

* custom authentication infrastructure
* dedicated authentication servers
* biometric hardware
* SMS OTP for every login
* complicated identity management

For the MVP:

**email/username + password + secure sessions** is enough.

Later, if the business needs stronger authentication, we can add things like:

* PIN for POS operations
* 2FA for managers/owners
* device restrictions
* biometric attendance

But don't make the cashier enter a password every 30 seconds either.

That's terrible UX.

We can eventually design:

```text
Login once
      ↓
Cashier session
      ↓
Fast POS operations
```

while still requiring stronger authentication for sensitive operations.

---

# 15. One UX decision I strongly recommend

For normal sales:

**Don't ask for confirmation unnecessarily.**

Bad:

```text
Are you sure you want to add Heineken?
YES / NO

Are you sure you want quantity 3?
YES / NO

Are you sure you want to continue?
YES / NO

Are you sure you want payment?
YES / NO
```

That makes employees hate the system.

Instead, confirmation should appear at **meaningful risk boundaries**.

For example:

```text
Normal sale
→ One clear "Complete Sale"

Sensitive action
→ Confirmation + reason
```

Such as:

> "This will void a ₦214,500 invoice. Continue?"

That's good UX **and** good control.

---

# 16. Our first architectural decision is therefore

### Identity model

```text
Business
│
├── Branches
│
├── Employees
│
│    └── User accounts
│
└── Roles / Permissions
```

With these rules:

**Rule 1:** Every employee gets an individual account.

**Rule 2:** Employees are never deleted from historical records.

**Rule 3:** Access is role-based.

**Rule 4:** Branch access is explicit.

**Rule 5:** The server enforces permissions.

**Rule 6:** Every important business action records the authenticated user.

**Rule 7:** Sensitive actions require additional authorization rather than unrestricted editing.

---
