-- Add error tracking columns to pending_signals table
ALTER TABLE pending_signals ADD COLUMN error_message TEXT;
ALTER TABLE pending_signals ADD COLUMN order_id TEXT REFERENCES orders(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_signals_order ON pending_signals(order_id);
