Let's continue.

# Component 7 — Attendance & Employee Time

The business currently has a simple weakness:

> An employee can arrive late, write an earlier time in the attendance book, and there's no reliable way to prove otherwise.

So the system should make the **timestamp come from the system**, not from the employee.

---

## 1. Basic attendance flow

An employee logs into the system and sees:

```text
Good morning, John

Branch: Ikeja
Today: 30 Sep 2026

Scheduled Start
8:00 AM

[ CLOCK IN ]
```

When they press **Clock In**, the server records the actual time.

```text
John Doe
Clocked in: 8:17 AM
```

The employee doesn't enter:

> "I arrived at 7:55."

The system determines the timestamp.

---

# 2. Attendance record

Each attendance record should contain something like:

```text id="c4pp7s"
Attendance
├── Employee
├── Branch
├── Clock-in time
├── Clock-out time
├── Status
├── Source
└── Correction history
```

Example:

```text id="2at1lk"
John Doe
Branch: Ikeja

Clock In: 8:17 AM
Clock Out: 5:06 PM

Status: Late
```

---

# 3. Work schedule

We need to define the expected working hours.

For example:

```text id="yrdyav"
Ikeja Branch

Monday–Saturday
Start: 8:00 AM
End: 5:00 PM
```

We can eventually support different schedules for different employees.

For example:

```text id="z1v3j7"
John
8:00 AM – 5:00 PM

Peter
9:00 AM – 6:00 PM
```

But we shouldn't overcomplicate the first version.

---

# 4. Late detection

If the employee clocks in:

```text id="01o4fb"
7:55 AM
```

→ **On Time**

If:

```text id="j4ihv5"
8:00 AM
```

→ **On Time**

If:

```text id="i8un52"
8:17 AM
```

→ **Late**

The system calculates this automatically.

We can also have a configurable grace period.

Example:

```text id="z7w3xk"
Start: 8:00 AM
Grace period: 10 minutes
```

Then:

```text
8:07 → On Time
8:11 → Late
```

The Owner/Admin controls the policy.

---

# 5. Clock-out

At the end of the workday:

```text id="c6ol5k"
You've worked today since 8:17 AM.

[ CLOCK OUT ]
```

When clicked:

```text id="6ryqbt"
Clock Out:
5:06 PM
```

Again, timestamp comes from the server.

---

# 6. What if someone forgets to clock in?

We shouldn't let employees simply edit their attendance.

Instead:

**Request Attendance Correction**

```text id="xg5b7v"
Attendance Correction

Date:
30 Sep

Current record:
No clock-in

Requested clock-in:
8:05 AM

Reason:
Forgot to clock in

[ Submit Request ]
```

The manager can review it.

```text id="m0r5aj"
Attendance Correction

Employee: John Doe
Date: 30 Sep
Requested: 8:05 AM

Reason:
Forgot to clock in

[ Reject ] [ Approve ]
```

If approved, the system preserves the fact that it was a **manager-approved correction**.

---

# 7. We should never overwrite the original timestamp

Suppose John actually clocked in:

```text
8:32 AM
```

and later claims:

> "I was actually there at 8:00."

A manager can approve a correction if there's a legitimate reason, but the audit trail should preserve:

```text id="d4x0pv"
Original system timestamp:
8:32 AM

Corrected timestamp:
8:00 AM

Corrected by:
Manager Sarah

Reason:
System outage during arrival

Approved:
9:14 AM
```

So there's still evidence that the record was changed.

---

# 8. Attendance status

We can keep statuses simple:

```text id="7ur1ua"
PRESENT
LATE
ABSENT
EARLY_LEAVE
INCOMPLETE
```

For example:

```text
John       PRESENT
Peter      LATE
Mary       ABSENT
Sarah      EARLY_LEAVE
David      INCOMPLETE
```

---

# 9. Branch context

Attendance must be tied to the employee's assigned branch.

If John is assigned to Ikeja:

```text id="jz4h9k"
John
Branch: Ikeja
Clock In: 8:17 AM
```

After his administrative transfer to Surulere:

```text id="3z2df5"
John
Branch: Surulere
Clock In: 7:58 AM
```

His old attendance remains under Ikeja.

This connects directly to our **employee branch assignment history**.

---

# 10. Preventing obvious abuse

There's another problem:

> What if an employee gives their login to a friend who clocks them in?

We shouldn't pretend a normal web login completely solves this.

For the MVP, we can use individual accounts and record:

* User
* Timestamp
* Branch
* Session/device information where appropriate

Later, depending on how serious the attendance problem becomes, we could add stronger controls such as:

* PIN/device authentication
* Branch-specific device
* Geolocation/geofencing
* Photo verification
* Biometric integration

But **I would not build all of that initially**.

Start with reliable timestamps and individual accounts.

---

# 11. Manager attendance dashboard

A manager should see something like:

```text id="0h7i1r"
IKEJA — TODAY

Employee       Clock In     Status

John Doe       7:58 AM      ✓ On Time
Mary James     8:12 AM      ⚠ Late
Peter Smith    —             ✕ Absent
David Cole     8:03 AM      ✓ On Time
```

Clicking an employee shows their history.

---

# 12. Owner's attendance report

The owner can see:

```text id="u3fttr"
SEPTEMBER ATTENDANCE

Employee       Present   Late   Absent

John Doe         24       3       0
Mary James       22       7       1
Peter Smith      25       1       0
```

This is informational and can later support management decisions.

We're **not building payroll into this component**.

---

# 13. Attendance + payroll later

You mentioned that the manager currently checks the attendance book at the end of the month before employees are paid.

Our system should make that possible without implementing payroll.

At month-end:

```text id="i6l1a4"
John Doe — September

Present: 24
Late:     3
Absent:   0
Early Leave: 1
Corrections: 2
```

The manager can review it.

Later, if the business wants payroll:

```text
Attendance
     ↓
Payroll
     ↓
Salary
```

But we keep payroll out of the MVP.

---

# 14. Attendance anomalies

The system can also notify management about unusual activity.

For example:

```text id="n1h1v7"
⚠ John clocked in 42 minutes late

⚠ Mary has 4 attendance corrections this month

⚠ Peter has no clock-in today

⚠ Attendance correction approved by Manager
```

Again, these are **alerts**, not accusations.

---

# 15. The complete attendance flow

```text id="0hufuy"
Employee
   ↓
Login
   ↓
System identifies employee + branch
   ↓
Clock In
   ↓
Server records timestamp
   ↓
System determines On Time / Late
   ↓
Employee works
   ↓
Clock Out
   ↓
Server records timestamp
   ↓
Manager / Owner can review
```

And exceptions follow:

```text id="m1qf8h"
Missing / Incorrect Attendance
          ↓
Correction Request
          ↓
Manager Review
          ↓
Approve / Reject
          ↓
Audit Log
```

---

# Where we are now

We've covered the major operational components:

```text
1. Authentication & Users       ✅
2. Branch Management            ✅
3. Products & Inventory         ✅
4. Sales & Invoicing             ✅
5. Payments & Reconciliation     ✅
6. Stock Receiving & Transfers   ✅
7. Attendance                    ✅
```
