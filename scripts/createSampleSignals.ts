import { v4 as uuidv4 } from 'uuid';
import databaseService from '../src/database';

const MANUAL_STRATEGY_ID = '48d75abf-9e4c-44cd-84d2-0e7339d6b9c2';

const sampleSignals = [
  {
    signal_id: `signal_${Date.now()}_1`,
    symbol: 'BTCUSDT',
    action: 'buy',
    orderType: 'market',
    price: 95420.50,
    quantity: 0.001,
    stopLoss: 94500,
    message: 'Strong bullish momentum on 15m chart',
  },
  {
    signal_id: `signal_${Date.now()}_2`,
    symbol: 'ETHUSDT',
    action: 'sell',
    orderType: 'limit',
    price: 3520.75,
    quantity: 0.05,
    stopLoss: 3580,
    message: 'Resistance level reached, expecting reversal',
  },
  {
    signal_id: `signal_${Date.now()}_3`,
    symbol: 'BNBUSDT',
    action: 'buy',
    orderType: 'market',
    price: 635.20,
    quantity: 0.5,
    message: 'Breakout confirmed on daily chart',
  },
];

async function createSamples() {
  try {
    const db = databaseService.getDatabase();

    // Disable foreign keys temporarily
    db.exec('PRAGMA foreign_keys = OFF;');

    const stmt = db.prepare(`
      INSERT INTO pending_signals (
        id, strategy_id, signal_id, symbol, action, order_type,
        price, quantity, signal_data, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const signal of sampleSignals) {
      const id = uuidv4();
      const now = new Date().toISOString();

      stmt.run(
        id,
        MANUAL_STRATEGY_ID,
        signal.signal_id,
        signal.symbol,
        signal.action,
        signal.orderType,
        signal.price,
        signal.quantity,
        JSON.stringify(signal),
        'pending',
        now
      );

      console.log(`✓ Created pending signal: ${signal.symbol} ${signal.action.toUpperCase()}`);
    }

    // Re-enable foreign keys
    db.exec('PRAGMA foreign_keys = ON;');

    console.log('\n✅ Successfully created 3 sample pending signals');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating samples:', error);
    process.exit(1);
  }
}

createSamples();
