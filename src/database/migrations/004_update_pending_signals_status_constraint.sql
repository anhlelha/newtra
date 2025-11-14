-- Update status CHECK constraint to include 'failed'
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- Step 1: Create new table with updated constraint
CREATE TABLE pending_signals_new (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  signal_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('buy', 'sell', 'close')),
  order_type TEXT NOT NULL,
  price REAL,
  quantity REAL,
  signal_data TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'failed')) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewed_by TEXT,
  error_message TEXT,
  order_id TEXT REFERENCES orders(id),
  FOREIGN KEY (strategy_id) REFERENCES strategies(id),
  FOREIGN KEY (signal_id) REFERENCES signals(id)
);

-- Step 2: Copy data from old table (only records with valid foreign keys)
INSERT INTO pending_signals_new
SELECT ps.* FROM pending_signals ps
INNER JOIN strategies s ON ps.strategy_id = s.id
INNER JOIN signals si ON ps.signal_id = si.id;

-- Step 3: Drop old table
DROP TABLE pending_signals;

-- Step 4: Rename new table
ALTER TABLE pending_signals_new RENAME TO pending_signals;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_pending_signals_strategy ON pending_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_pending_signals_order ON pending_signals(order_id);
