-- Trading Bot Database Schema

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  binance_order_id TEXT UNIQUE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
  type TEXT NOT NULL CHECK(type IN ('MARKET', 'LIMIT', 'STOP_LOSS', 'STOP_LOSS_LIMIT')),
  quantity REAL NOT NULL,
  price REAL,
  stop_price REAL,
  status TEXT NOT NULL CHECK(status IN ('NEW', 'FILLED', 'PARTIALLY_FILLED', 'CANCELED', 'REJECTED', 'EXPIRED')),
  filled_quantity REAL DEFAULT 0,
  avg_fill_price REAL,
  commission REAL DEFAULT 0,
  commission_asset TEXT,
  signal_data TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('LONG', 'SHORT')),
  entry_price REAL NOT NULL,
  quantity REAL NOT NULL,
  stop_loss_price REAL,
  stop_loss_order_id TEXT,
  entry_order_id TEXT NOT NULL,
  exit_order_id TEXT,
  realized_pnl REAL DEFAULT 0,
  status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
  opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  FOREIGN KEY (entry_order_id) REFERENCES orders(id),
  FOREIGN KEY (exit_order_id) REFERENCES orders(id),
  FOREIGN KEY (stop_loss_order_id) REFERENCES orders(id)
);

-- Trading signals audit log
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK(action IN ('buy', 'sell', 'close')),
  symbol TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed BOOLEAN DEFAULT 0,
  order_id TEXT,
  error_message TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Strategies table (added via migration)
CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('automatic', 'manual')),
  description TEXT,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pending signals for manual review (added via migration)
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

-- Configuration table
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_binance_id ON orders(binance_order_id);

CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_opened ON positions(opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_strategies_enabled ON strategies(enabled);
CREATE INDEX IF NOT EXISTS idx_strategies_type ON strategies(type);

CREATE INDEX IF NOT EXISTS idx_pending_signals_status ON pending_signals(status);
CREATE INDEX IF NOT EXISTS idx_pending_signals_strategy ON pending_signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_pending_signals_created ON pending_signals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_processed ON signals(processed);
CREATE INDEX IF NOT EXISTS idx_signals_received ON signals(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_orders_timestamp
AFTER UPDATE ON orders
BEGIN
  UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_strategies_timestamp
AFTER UPDATE ON strategies
BEGIN
  UPDATE strategies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_config_timestamp
AFTER UPDATE ON config
BEGIN
  UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;
