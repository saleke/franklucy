Good. **Component 18B is locked.**

## Component 18C — Tests for the Sale Workflow

Now we prove the backend actually enforces the rules we designed. We should test the **business workflow**, not just individual functions.

### 1. Test layers

For `completeSale()` we'll use three levels:

```text
Unit tests
    ↓
Business logic

Integration tests
    ↓
completeSale() + PostgreSQL

E2E tests
    ↓
Cashier UI → server → database
```

For this component, focus on **unit + integration tests**. The E2E cashier journey comes after the UI is built.

---

# 2. The most important test: normal sale

Given:

```text
Branch: Main
Product: Heineken
Price: ₦18,500
Stock: 20
Quantity: 2
```

Complete sale.

Expected:

```text
Sale created
Total = ₦37,000
Payment created
Inventory decreases by 2
Audit event created
Invoice number generated
```

The test should verify the database, not merely the returned object.

```ts
it("completes a valid sale atomically", async () => {
  const result = await completeSale(input, context);

  expect(result.total).toBe("37000");

  const sale = await getSale(result.saleId);

  expect(sale.status).toBe("COMPLETED");
  expect(sale.total.toString()).toBe("37000");

  const payment = await getPaymentForSale(result.saleId);

  expect(payment).toBeDefined();

  const stock = await getAvailableStock(
    db,
    branchId,
    [heineken.id]
  );

  expect(stock[heineken.id]).toBe(18);

  const audit = await findAuditForEntity(
    "SALE",
    result.saleId
  );

  expect(audit?.action).toBe("SALE_CREATED");
});
```

---

# 3. Fake price attack

This is one of the most important security tests.

The client attempts:

```ts
{
  productId: heineken.id,
  quantity: 2,
  unitPrice: "1"
}
```

The server should completely ignore the fake price.

Expected:

```text
Actual price = ₦18,500
Total = ₦37,000
```

Test:

```ts
it("does not trust client supplied price", async () => {
  const input = {
    ...validInput,

    items: [
      {
        productId: heineken.id,
        quantity: 2,

        // malicious client value
        unitPrice: "1",
      },
    ],
  };

  const result = await completeSale(
    input,
    context
  );

  expect(result.total).toBe("37000");
});
```

In reality, `unitPrice` shouldn't even exist in the accepted input type.

So TypeScript catches this during development, while the server remains authoritative at runtime.

---

# 4. Fake total attack

Client attempts:

```json
{
  "total": "1"
}
```

The server doesn't accept `total`.

Expected:

```text
Actual total = ₦37,000
```

This test proves:

> The browser is a presentation layer, not the accounting authority.

---

# 5. Insufficient stock

Given:

```text
Available: 3
Requested: 5
```

Expected:

```text
INSUFFICIENT_STOCK
```

And critically:

```text
Sale does not exist
Payment does not exist
Stock doesn't change
Audit event doesn't claim a completed sale
```

Test:

```ts
it("rejects sale when stock is insufficient", async () => {
  await expect(
    completeSale(
      {
        ...validInput,
        items: [
          {
            productId: heineken.id,
            quantity: 5,
          },
        ],
      },
      context
    )
  ).rejects.toMatchObject({
    code: "INSUFFICIENT_STOCK",
  });
});
```

Then verify the database remained unchanged.

---

# 6. Inactive product

If:

```text
Product.status = INACTIVE
```

the cashier shouldn't be able to sell it.

```ts
it("rejects inactive products", async () => {
  await expect(
    completeSale(
      inactiveProductInput,
      context
    )
  ).rejects.toMatchObject({
    code: "PRODUCT_NOT_AVAILABLE",
  });
});
```

---

# 7. Wrong branch

Suppose:

```text
Cashier → Main Branch
Product → Ikeja Branch
```

The cashier attempts to sell it.

The backend must reject the operation.

```ts
it("rejects products unavailable at cashier branch", async () => {
  await expect(
    completeSale(
      ikejaProductInput,
      mainCashierContext
    )
  ).rejects.toMatchObject({
    code: "PRODUCT_NOT_AVAILABLE",
  });
});
```

This is another reason not to trust browser-selected branch data.

---

# 8. Unauthorized employee

A stockkeeper shouldn't automatically gain:

```text
sales.create
```

just because they can access the application.

```ts
it("rejects users without sales.create", async () => {
  await expect(
    completeSale(
      validInput,
      stockkeeperContext
    )
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
```

---

# 9. Transaction rollback

This test is particularly important.

Force an error after:

```text
Sale creation
```

but before:

```text
Payment
Inventory
Audit
```

Then verify **nothing remains**.

```ts
it("rolls back the entire sale on failure", async () => {
  await expect(
    completeSaleWithInjectedFailure(...)
  ).rejects.toThrow();

  expect(await countSales()).toBe(0);
  expect(await countPayments()).toBe(0);
  expect(await countSaleMovements()).toBe(0);
  expect(await countSaleAudits()).toBe(0);
});
```

This proves the transaction is genuinely atomic.

---

# 10. Duplicate submission

Same idempotency key:

```text
abc-123
```

Request 1:

```text
SUCCESS
INV-MAIN-000482
```

Request 2:

```text
same key
```

Expected:

```text
same sale
same invoice
no second sale
no second payment
no second stock deduction
```

```ts
it("does not duplicate an idempotent sale", async () => {
  const first = await completeSale(
    input,
    {
      ...context,
      idempotencyKey: "abc-123",
    }
  );

  const second = await completeSale(
    input,
    {
      ...context,
      idempotencyKey: "abc-123",
    }
  );

  expect(second.saleId).toBe(first.saleId);
  expect(second.invoiceNumber)
    .toBe(first.invoiceNumber);

  expect(await countSales()).toBe(1);
});
```

---

# 11. Concurrent sales

This is the test we specifically identified as important.

Initial stock:

```text
5
```

Two requests simultaneously attempt:

```text
Sale A → 5
Sale B → 5
```

Expected:

```text
One succeeds
One fails with INSUFFICIENT_STOCK
```

Not:

```text
Both succeed
```

The test should actually execute both promises concurrently:

```ts
const [a, b] = await Promise.allSettled([
  completeSale(inputForFive, contextA),
  completeSale(inputForFive, contextB),
]);
```

Then assert:

```text
successful sales = 1
failed sales = 1
remaining stock = 0
```

This test is important enough that I would consider it part of the definition of done.

---

# 12. Invoice number concurrency

Similarly:

```text
Cashier A → sale
Cashier B → sale
Cashier C → sale
```

All at approximately the same time.

We must never get:

```text
INV-MAIN-000482
INV-MAIN-000482
INV-MAIN-000482
```

Instead:

```text
INV-MAIN-000482
INV-MAIN-000483
INV-MAIN-000484
```

The database unique constraint is the final safety net.

---

# 13. Payment tests

Test:

### Exact cash

```text
Sale = ₦20,000
Received = ₦20,000
Change = ₦0
```

### Cash with change

```text
Sale = ₦20,000
Received = ₦25,000
Change = ₦5,000
```

### Bank transfer

```text
Method = BANK_TRANSFER
Reference required
```

and the system should make clear:

```text
Reference recorded
≠
Bank transfer verified
```

### Invalid payment

For example:

```text
Sale = ₦20,000
Received = ₦15,000
```

Whether this is rejected or treated as partial payment depends on the payment policy we lock down.

---

# 14. Property-style invariants

Beyond individual examples, we want permanent rules.

For every completed sale:

```text
quantity > 0
```

```text
unitPrice >= 0
```

```text
lineTotal = quantity × unitPrice - discount
```

```text
subtotal = Σ lineTotal
```

```text
total = subtotal - discount
```

And:

```text
every sale
    ↓
has cashier
has branch
has timestamp
has at least one item
has payment state
has inventory effect
has audit event
```

Those are **business invariants**.

They are more important than any particular UI implementation.

---

# 15. Suggested test structure

I'd organize it like:

```text
src/
  modules/
    sales/
      sale.service.ts
      sale.service.test.ts
      sale.validation.ts
      sale.validation.test.ts
      sale.errors.ts
      sale.number.ts
      sale.number.test.ts
```

And integration tests:

```text
tests/
  integration/
    sales/
      complete-sale.test.ts
      sale-concurrency.test.ts
      sale-idempotency.test.ts
```

Then E2E later:

```text
tests/
  e2e/
    sales/
      cashier-completes-sale.spec.ts
      cashier-cannot-change-price.spec.ts
      insufficient-stock.spec.ts
```

---

# 16. Test the business, not Prisma

Don't write hundreds of tests like:

```ts
expect(prisma.sale.create).toHaveBeenCalled()
```

That's testing implementation details.

We care about:

> When a cashier completes a sale, is the business state correct?

So test:

```text
Input
 ↓
Business operation
 ↓
Database state
```

That gives us confidence even if we later change repository implementation.

---

# 17. Component 18C definition of done

Before moving forward:

* [ ] Valid sale succeeds
* [ ] Server price cannot be manipulated
* [ ] Server total cannot be manipulated
* [ ] Inactive products rejected
* [ ] Wrong-branch products rejected
* [ ] Insufficient stock rejected
* [ ] Unauthorized users rejected
* [ ] Transaction rollback tested
* [ ] Duplicate submission tested
* [ ] Concurrent stock consumption tested
* [ ] Concurrent invoice generation tested
* [ ] Payment scenarios tested
* [ ] Inventory movement verified
* [ ] Audit event verified
* [ ] Historical price verified

Once these pass, we have something much more valuable than a pretty POS screen:

**we have a sale engine that can be trusted.**

### Next: Component 18D

We'll build the actual **New Sale interface** around this contract:

**desktop POS workspace → mobile cashier workflow → customer selector → product search → cart → payment → completion → error/loading/empty states**, while keeping the UI fast enough for someone who may process dozens of customers during a busy period.
