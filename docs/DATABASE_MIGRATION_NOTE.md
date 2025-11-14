# Database Migration Notes

## Manual Schema Fix - November 14, 2025

### Issue
Migration `002_add_strategy_to_orders.sql` was incorrectly skipped because it attempts to add columns to multiple tables (`signals` and `orders`). When the `signals.strategy_id` column already existed from a previous run, the entire migration was marked as skipped, leaving the `orders` table without the required `strategy_id` and `risk_passed` columns.

### Fix Applied
Manually added missing columns to `orders` table:

```sql
ALTER TABLE orders ADD COLUMN strategy_id TEXT REFERENCES strategies(id);
ALTER TABLE orders ADD COLUMN risk_passed BOOLEAN DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_orders_strategy ON orders(strategy_id);
```

### Root Cause
The migration runner in `src/database/index.ts` (lines 88-100) executes all SQL statements in a migration file with a single `db.exec()` call. If ANY statement fails with a "duplicate column" error, the entire migration is marked as skipped.

### Recommendation
Future migrations should:
1. Add only one table's columns per migration file
2. OR use individual `db.exec()` calls with try-catch for each ALTER TABLE statement
3. OR improve the migration runner to handle partial migrations better

### Impact
- Affected tables: `orders`
- Added columns: `strategy_id`, `risk_passed`
- Affected features: Order List page, strategy tracking in orders
