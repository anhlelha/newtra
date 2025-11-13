# Crypto Trading Bot - Setup Guide

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Binance API credentials (for testnet or mainnet)

## Initial Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd newtra
```

### 2. Install dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Configure environment variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` and configure:

- `BINANCE_API_KEY`: Your Binance API key
- `BINANCE_API_SECRET`: Your Binance API secret
- `BINANCE_TESTNET`: Set to `true` for testnet, `false` for mainnet
- `ADMIN_API_KEY`: Generate a secure random string for API authentication
- `TRADINGVIEW_WEBHOOK_SECRET`: Generate a secure random string for webhook authentication

### 4. Database Setup

**The database is automatically initialized when you start the application for the first time.**

When you run the backend server:
1. Database schema will be created automatically from `src/database/schema.sql`
2. Migrations will run automatically from `src/database/migrations/` directory
3. Default strategies will be created:
   - "Default Automatic" (enabled)
   - "Default Manual" (disabled)

**No manual migration is required!** The app handles everything automatically.

#### Manual Migration (Optional)

If you need to run migrations manually:

```bash
npm run migrate
```

### 5. Start the application

#### Development Mode

Start backend (with auto-reload):
```bash
npm run dev
```

Start frontend (in a separate terminal):
```bash
cd frontend
npm run dev
```

#### Production Mode

Build and start:
```bash
# Build backend
npm run build

# Build frontend
cd frontend
npm run build
cd ..

# Start production server
npm start
```

## Database Migrations

### How it works

- Migrations are located in `src/database/migrations/`
- Migration files are named with pattern: `001_description.sql`, `002_description.sql`, etc.
- Migrations run automatically in order when the application starts
- If a migration has already been applied (e.g., table already exists), it will be skipped
- **You don't need to do anything manually!**

### When you pull new code with database changes

Simply restart the application:

```bash
# Stop the running server (Ctrl+C)
# Start it again
npm run dev
```

The new migrations will be detected and applied automatically.

### Adding new migrations

1. Create a new migration file in `src/database/migrations/`
2. Name it with next number: `002_your_description.sql`
3. Write your SQL changes
4. Commit and push
5. When others pull your code, migrations will run automatically on their next server start

## Strategy Management System

### Strategy Types

1. **Automatic Strategy**
   - Signals from TradingView are executed immediately
   - Orders are placed on Binance without manual approval

2. **Manual Strategy**
   - Signals from TradingView require manual review
   - User must approve/reject each signal before execution
   - Pending signals can be reviewed in the "Pending Signals" page

### Using Strategies with TradingView Alerts

Add the `strategy` field to your TradingView webhook payload:

```json
{
  "action": "buy",
  "symbol": "BTCUSDT",
  "strategy": "Scalping Strategy",
  "orderType": "market",
  "price": 50000,
  "quantity": 0.001
}
```

If no strategy is specified, signals will use "Default Automatic" strategy.

## API Endpoints

### Admin API (requires Authorization header with ADMIN_API_KEY)

**Strategies:**
- `GET /api/strategies` - List all strategies
- `POST /api/strategies` - Create new strategy
- `PUT /api/strategies/:id` - Update strategy
- `DELETE /api/strategies/:id` - Delete strategy
- `POST /api/strategies/:id/toggle` - Enable/disable strategy

**Pending Signals:**
- `GET /api/pending-signals` - List pending signals
- `GET /api/pending-signals/count` - Get pending count
- `POST /api/pending-signals/:id/approve` - Approve and execute signal
- `POST /api/pending-signals/:id/reject` - Reject signal

**Other:**
- `GET /api/status` - Get bot status
- `GET /api/balance/:asset` - Get balance for specific asset
- `GET /api/positions` - Get open positions
- `GET /api/orders` - Get order history
- `GET /api/signals` - Get signal history

### Webhook API

- `POST /webhook/tradingview` - Receive TradingView signals

## Frontend Dashboard

Access the dashboard at: `http://localhost:5173` (development)

Features:
- Real-time trading statistics
- Position monitoring
- Order history
- TradingView signal history
- Strategy management (create, edit, delete strategies)
- Pending signals review (approve/reject manual strategy signals)

## Troubleshooting

### Database Issues

If you encounter database issues:

1. Stop the server
2. Delete the database file: `rm data/database.sqlite*`
3. Restart the server - database will be recreated with all migrations

### Migration Not Running

If migrations don't run automatically:

1. Check logs for error messages
2. Try manual migration: `npm run migrate`
3. Check that `src/database/migrations/` directory exists
4. Verify migration files have `.sql` extension

## Support

For issues or questions, please open an issue on GitHub.
