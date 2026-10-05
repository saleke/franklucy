Next is **Component 18 — New Sale + Complete Sale Transaction**.

This is the most important implementation slice because it proves the core business loop:

**cashier → invoice → payment → stock reduction → audit trail**

### Component 18 plan

1. **New Sale screen**

   * Walk-in customer by default
   * Customer search/selection
   * Product search
   * Quantity
   * Current branch price
   * Cart/summary
   * Payment method
   * Complete Sale

2. **Backend sale workflow**

   ```text
   authenticate
      ↓
   check sales.create
      ↓
   check branch access
      ↓
   validate request
      ↓
   fetch products/prices from DB
      ↓
   calculate totals on server
      ↓
   check stock
      ↓
   create sale
      ↓
   create sale items
      ↓
   create payment
      ↓
   create inventory movements
      ↓
   create audit log
      ↓
   commit
   ```

3. **Prevent the important attacks/mistakes**

   * Cashier cannot submit their own price.
   * Cashier cannot choose another branch.
   * Cashier cannot submit fake totals.
   * Cashier cannot sell more than available stock.
   * Browser cannot change the user's role.
   * Duplicate submission cannot create two sales.
   * Completed invoices cannot simply be edited.

4. **Invoice**
   Example:

   ```text
   INV-MAIN-000001
   ```

   It records:

   * cashier
   * branch
   * customer
   * products
   * quantities
   * actual prices
   * discount
   * total
   * payment
   * timestamp

5. **Inventory effect**

   If:

   ```text
   Heineken
   Opening stock: 100 crates
   ```

   and cashier sells:

   ```text
   5 crates
   ```

   the system creates:

   ```text
   SALE
   quantity = -5
   ```

   resulting in:

   ```text
   95 crates
   ```

   We don't manually update a `stockQuantity` field.

6. **Audit effect**

   The same transaction records something like:

   ```text
   SALE_CREATED
   User: Cashier John
   Branch: Main
   Invoice: INV-MAIN-000001
   Time: ...
   ```

7. **Testing**

   We'll test the actual business rules, including:

   ```text
   valid sale                  → succeeds
   insufficient stock          → fails
   unauthorized branch         → fails
   unauthorized price          → fails
   fake total                  → ignored/recalculated
   duplicate submission        → one sale
   DB failure halfway          → everything rolls back
   ```

### The implementation order

I recommend we **actually build it in this order**, rather than designing ten more components first:

```text
Component 17
Authentication + seed
        ↓
18A
New Sale database/service
        ↓
18B
Complete Sale transaction
        ↓
18C
New Sale UI
        ↓
18D
Invoice/detail screen
        ↓
18E
Tests
        ↓
19
Stock receiving + inventory workspace
```

So the immediate next thing is **18A: implement the Sale business model and server-side `completeSale()` workflow**. That gives us the foundation before we spend time polishing the POS screen.
