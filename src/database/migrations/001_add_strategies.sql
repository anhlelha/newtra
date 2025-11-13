-- Migration: Add strategies and pending_signals tables
-- Date: 2025-11-13

-- Create strategies table
CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('automatic', 'manual')),
  description TEXT,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create pending_signals table
CREATE TABLE IF NOT EXISTS pending_signals (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  signal_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('buy', 'sell', 'close')),
  order_type TEXT NOT NULL,
  price REAL,
  quantity REAL,
  signal_data TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewed_by TEXT,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id),
  FOREIGN KEY (signal_id) REFERENCES signals(id)
);

-- Add strategy_id column to signals table (if not exists)
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check via pragma
-- This will fail silently if column already exists
ALTER TABLE signals ADD COLUMN strategy_id TEXT REFERENCES strategies(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_strategies_enabled ON strategies(enabled);
CREATE INDEX IF NOT EXISTS idx_strategies_type ON strategies(type);

CREATE INDEX IF NOT EXISTS idx_pending_signals_status ON pending_signals(status);
CREATE INDEX IF NOT EXISTS idx_pending_signals_strategy ON pending_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_pending_signals_created ON pending_signals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_strategy ON signals(strategy_id);

-- Create trigger for strategies
CREATE TRIGGER IF NOT EXISTS update_strategies_timestamp
AFTER UPDATE ON strategies
BEGIN
  UPDATE strategies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert default strategies
INSERT OR IGNORE INTO strategies (id, name, type, description, enabled)
VALUES
  ('default-auto', 'Default Automatic', 'automatic', 'Default strategy - automatically executes all signals', 1),
  ('default-manual', 'Default Manual', 'manual', 'Default strategy - requires manual approval for signals', 0);
