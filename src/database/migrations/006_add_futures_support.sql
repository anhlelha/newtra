-- Add futures trading support to strategies
ALTER TABLE strategies ADD COLUMN trading_type TEXT NOT NULL DEFAULT 'SPOT' CHECK(trading_type IN ('SPOT', 'FUTURE'));
ALTER TABLE strategies ADD COLUMN leverage INTEGER NOT NULL DEFAULT 5;

-- Add trading_type to orders table
ALTER TABLE orders ADD COLUMN trading_type TEXT NOT NULL DEFAULT 'SPOT' CHECK(trading_type IN ('SPOT', 'FUTURE'));

-- Add futures support to positions table
ALTER TABLE positions ADD COLUMN trading_type TEXT NOT NULL DEFAULT 'SPOT' CHECK(trading_type IN ('SPOT', 'FUTURE'));
ALTER TABLE positions ADD COLUMN leverage INTEGER DEFAULT NULL;
ALTER TABLE positions ADD COLUMN liquidation_price REAL DEFAULT NULL;

-- Update positions side constraint to support SHORT
-- SQLite doesn't support ALTER COLUMN, so we need to check this at application level
-- The side column already exists and will accept both LONG and SHORT values
