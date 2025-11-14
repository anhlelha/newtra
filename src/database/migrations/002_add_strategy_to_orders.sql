-- Add strategy_id to signals table
ALTER TABLE signals ADD COLUMN strategy_id TEXT REFERENCES strategies(id);

-- Add strategy_id and risk_passed to orders table
ALTER TABLE orders ADD COLUMN strategy_id TEXT REFERENCES strategies(id);
ALTER TABLE orders ADD COLUMN risk_passed BOOLEAN DEFAULT 1;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_strategy ON orders(strategy_id);
CREATE INDEX IF NOT EXISTS idx_signals_strategy ON signals(strategy_id);
