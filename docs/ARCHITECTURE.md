# Technical Architecture Document
# Cryptocurrency Trading Bot

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────┐
│  TradingView    │
│   Alerts        │
└────────┬────────┘
         │ HTTPS Webhook
         ▼
┌─────────────────────────────────────────────┐
│           AWS EC2 Instance                  │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │      Express.js Application           │ │
│  │                                        │ │
│  │  ┌──────────────┐  ┌───────────────┐ │ │
│  │  │   Webhook    │  │  Admin API    │ │ │
│  │  │   Handler    │  │   Endpoints   │ │ │
│  │  └──────┬───────┘  └───────────────┘ │ │
│  │         │                             │ │
│  │  ┌──────▼─────────────────────────┐  │ │
│  │  │    Trading Engine             │  │ │
│  │  │  - Signal Processor           │  │ │
│  │  │  - Order Manager              │  │ │
│  │  │  - Risk Manager               │  │ │
│  │  │  - Position Tracker           │  │ │
│  │  └──────┬─────────────────────────┘  │ │
│  │         │                             │ │
│  │  ┌──────▼─────────────────────────┐  │ │
│  │  │    Binance API Client         │  │ │
│  │  │  - Order Execution            │  │ │
│  │  │  - Market Data                │  │ │
│  │  │  - Account Info               │  │ │
│  │  └──────┬─────────────────────────┘  │ │
│  │         │                             │ │
│  │  ┌──────▼─────────┐  ┌─────────────┐ │ │
│  │  │  SQLite DB     │  │   Logger    │ │ │
│  │  │  - Orders      │  │  (Winston)  │ │ │
│  │  │  - Positions   │  └─────────────┘ │ │
│  │  │  - Config      │                  │ │
│  │  └────────────────┘                  │ │
│  └───────────────────────────────────────┘ │
└────────────┬────────────────────────────────┘
             │ REST API
             ▼
    ┌────────────────┐
    │ Binance API    │
    │ api.binance.com│
    └────────────────┘
```

### 1.2 Technology Stack

**Backend:**
- Runtime: Node.js 18.x LTS
- Language: TypeScript 5.x
- Framework: Express.js 4.x
- Database: SQLite 3 (production có thể dùng PostgreSQL)

**Key Libraries:**
- `binance-api-node` - Binance API client
- `express` - Web framework
- `winston` - Logging
- `helmet` - Security headers
- `express-rate-limit` - Rate limiting
- `dotenv` - Environment configuration
- `better-sqlite3` - SQLite driver
- `zod` - Schema validation
- `axios` - HTTP client

**Infrastructure:**
- Platform: AWS EC2 (t3.small hoặc t3.micro)
- OS: Ubuntu 22.04 LTS
- Process Manager: PM2
- Reverse Proxy: Nginx
- SSL: Let's Encrypt (Certbot)

## 2. Component Architecture

### 2.1 API Layer

#### 2.1.1 Webhook Handler
**Responsibility:** Nhận và xử lý alerts từ TradingView

**Endpoints:**
```
POST /webhook/tradingview
Headers:
  - Content-Type: application/json
  - X-Webhook-Secret: <secret-token>

Body:
{
  "action": "buy" | "sell" | "close",
  "symbol": "BTCUSDT",
  "orderType": "market" | "limit",
  "price": 50000,
  "quantity": 0.01,
  "stopLoss": 49000,
  "message": "Strategy signal"
}
```

**Flow:**
1. Validate webhook secret
2. Parse and validate payload (Zod schema)
3. Send to Trading Engine
4. Return 200 OK immediately (async processing)

#### 2.1.2 Admin API
**Responsibility:** Quản lý và monitoring

**Endpoints:**
```
GET  /api/health             - Health check
GET  /api/status             - System status
GET  /api/positions          - Open positions
GET  /api/orders             - Order history
POST /api/orders/cancel/:id  - Cancel order
GET  /api/balance            - Account balance
POST /api/config             - Update config
```

**Authentication:** Bearer token trong header

### 2.2 Trading Engine

#### 2.2.1 Signal Processor
```typescript
interface TradingSignal {
  action: 'buy' | 'sell' | 'close';
  symbol: string;
  orderType: 'market' | 'limit';
  price?: number;
  quantity?: number;
  stopLoss?: number;
  timestamp: number;
}

class SignalProcessor {
  async processSignal(signal: TradingSignal): Promise<void>
  validateSignal(signal: TradingSignal): boolean
  preventDuplicates(signal: TradingSignal): boolean
}
```

**Logic:**
- Validate signal format
- Check duplicate trong 30s
- Verify symbol exists on Binance
- Pass to Order Manager

#### 2.2.2 Order Manager
```typescript
interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS_LIMIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
}

class OrderManager {
  async executeOrder(request: OrderRequest): Promise<Order>
  async cancelOrder(orderId: string): Promise<void>
  async getOrderStatus(orderId: string): Promise<OrderStatus>
  calculateQuantity(signal: TradingSignal, balance: number): number
}
```

**Responsibilities:**
- Calculate order quantity
- Execute orders via Binance API
- Handle order responses
- Update database
- Error handling & retry logic

#### 2.2.3 Risk Manager
```typescript
interface RiskConfig {
  maxPositionSizePercent: number;    // Max 5% per trade
  maxTotalExposurePercent: number;    // Max 50% total
  maxDailyLoss: number;               // Max 10% daily loss
  enableStopLoss: boolean;
  stopLossPercent: number;            // Default 2%
}

class RiskManager {
  checkRiskLimits(order: OrderRequest): RiskCheckResult
  calculatePositionSize(signal: TradingSignal): number
  shouldAllowTrade(symbol: string): boolean
  getCurrentExposure(): number
}
```

**Checks:**
- Position size limits
- Total exposure
- Daily loss limits
- Sufficient balance
- Trading hours (optional)

#### 2.2.4 Position Tracker
```typescript
interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  currentPrice: number;
  unrealizedPnL: number;
  stopLossPrice?: number;
  stopLossOrderId?: string;
  openedAt: Date;
  status: 'OPEN' | 'CLOSED';
}

class PositionTracker {
  async openPosition(order: Order): Promise<Position>
  async closePosition(positionId: string): Promise<void>
  async updatePositions(): Promise<void>
  getOpenPositions(): Position[]
  setStopLoss(positionId: string, price: number): Promise<void>
}
```

### 2.3 Binance API Client

```typescript
class BinanceClient {
  // Market Data
  async getPrice(symbol: string): Promise<number>
  async getSymbolInfo(symbol: string): Promise<SymbolInfo>
  async get24hrStats(symbol: string): Promise<Stats24hr>

  // Account
  async getAccountInfo(): Promise<AccountInfo>
  async getBalance(asset: string): Promise<Balance>

  // Orders
  async createMarketOrder(params: MarketOrderParams): Promise<Order>
  async createLimitOrder(params: LimitOrderParams): Promise<Order>
  async createStopLossOrder(params: StopLossParams): Promise<Order>
  async cancelOrder(symbol: string, orderId: string): Promise<void>
  async getOrder(symbol: string, orderId: string): Promise<Order>
  async getOpenOrders(symbol?: string): Promise<Order[]>

  // Error Handling
  private handleBinanceError(error: any): never
  private retryWithBackoff<T>(fn: () => Promise<T>): Promise<T>
}
```

**Features:**
- Automatic retry với exponential backoff
- Rate limit handling
- Error mapping
- Request/response logging

### 2.4 Database Schema

#### SQLite Tables

```sql
-- Orders
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  binance_order_id TEXT UNIQUE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL,
  stop_price REAL,
  status TEXT NOT NULL,
  filled_quantity REAL DEFAULT 0,
  avg_fill_price REAL,
  commission REAL,
  signal_data TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Positions
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price REAL NOT NULL,
  quantity REAL NOT NULL,
  stop_loss_price REAL,
  stop_loss_order_id TEXT,
  entry_order_id TEXT,
  exit_order_id TEXT,
  realized_pnl REAL DEFAULT 0,
  status TEXT DEFAULT 'OPEN',
  opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  FOREIGN KEY (entry_order_id) REFERENCES orders(id)
);

-- Trading Signals (audit log)
CREATE TABLE signals (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  symbol TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  order_id TEXT,
  error_message TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Configuration
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_signals_processed ON signals(processed);
```

### 2.5 Configuration Management

```typescript
interface AppConfig {
  // Server
  port: number;
  nodeEnv: 'development' | 'production' | 'test';

  // Binance
  binance: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
  };

  // TradingView
  tradingView: {
    webhookSecret: string;
  };

  // Trading
  trading: {
    enabled: boolean;
    defaultPositionSizePercent: number;
    maxPositionSizePercent: number;
    maxTotalExposurePercent: number;
    maxDailyLoss: number;
    enableStopLoss: boolean;
    defaultStopLossPercent: number;
    preventDuplicatesWindowMs: number;
  };

  // Security
  security: {
    adminApiKey: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };

  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file: string;
  };
}
```

**Environment Variables (.env):**
```bash
# Server
NODE_ENV=production
PORT=3000

# Binance
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
BINANCE_TESTNET=false

# TradingView
TRADINGVIEW_WEBHOOK_SECRET=your_webhook_secret

# Trading Config
TRADING_ENABLED=true
DEFAULT_POSITION_SIZE_PERCENT=2
MAX_POSITION_SIZE_PERCENT=5
MAX_TOTAL_EXPOSURE_PERCENT=50
MAX_DAILY_LOSS=1000
ENABLE_STOP_LOSS=true
DEFAULT_STOP_LOSS_PERCENT=2

# Security
ADMIN_API_KEY=your_admin_api_key
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/trading-bot/app.log
```

## 3. Security Architecture

### 3.1 Authentication & Authorization

**Webhook Security:**
- Secret token trong header `X-Webhook-Secret`
- Optional: IP whitelist cho TradingView IPs

**Admin API Security:**
- Bearer token authentication
- Rate limiting: 100 requests/minute per IP
- HTTPS only

### 3.2 Secrets Management

- API keys trong environment variables
- Không commit .env file vào git
- AWS Systems Manager Parameter Store (optional)
- Rotate keys định kỳ

### 3.3 Network Security

**Firewall Rules:**
```
Inbound:
- Port 443 (HTTPS): Allow from 0.0.0.0/0
- Port 22 (SSH): Allow from admin IPs only

Outbound:
- Port 443: Allow to api.binance.com
- All other: Deny
```

**Nginx Configuration:**
- SSL/TLS 1.2+
- HSTS headers
- Rate limiting
- Request size limits

### 3.4 Application Security

- Input validation (Zod schemas)
- SQL injection prevention (parameterized queries)
- XSS protection (Helmet.js)
- CORS configuration
- Request signing cho Binance API

## 4. Error Handling & Resilience

### 4.1 Error Categories

```typescript
enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BINANCE_API_ERROR = 'BINANCE_API_ERROR',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  RISK_LIMIT_EXCEEDED = 'RISK_LIMIT_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

class TradingError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}
```

### 4.2 Retry Strategy

**Binance API Calls:**
- Max 3 retries
- Exponential backoff: 1s, 2s, 4s
- Retry on: network errors, 5xx errors, rate limits
- No retry on: 4xx errors (except 429)

**TradingView Webhook:**
- No retry (TradingView handles retry)
- Return 200 OK immediately
- Process async

### 4.3 Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure! > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = new Date();
    if (this.failures >= 5) {
      this.state = 'OPEN';
    }
  }
}
```

### 4.4 Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Stop accepting new requests
  server.close();

  // Cancel all pending orders
  await orderManager.cancelAllPendingOrders();

  // Close database connections
  await database.close();

  // Exit
  process.exit(0);
});
```

## 5. Logging & Monitoring

### 5.1 Log Structure

```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: {
    module?: string;
    function?: string;
    orderId?: string;
    symbol?: string;
    [key: string]: any;
  };
  error?: {
    message: string;
    stack: string;
    type: string;
  };
}
```

**Example:**
```json
{
  "timestamp": "2025-11-12T10:30:45.123Z",
  "level": "info",
  "message": "Order executed successfully",
  "context": {
    "module": "OrderManager",
    "function": "executeOrder",
    "orderId": "12345",
    "symbol": "BTCUSDT",
    "side": "BUY",
    "quantity": 0.01,
    "price": 50000
  }
}
```

### 5.2 Log Levels

- **DEBUG:** Detailed info for debugging
- **INFO:** Normal operations (orders, signals)
- **WARN:** Recoverable errors, rate limits
- **ERROR:** Failures requiring attention

### 5.3 Metrics to Track

**System Metrics:**
- CPU usage
- Memory usage
- Disk usage
- Network I/O

**Application Metrics:**
- Requests per minute
- Response time
- Error rate
- Active connections

**Trading Metrics:**
- Orders executed (total, success, failed)
- Average execution time
- Position count
- Total PnL
- Win rate

### 5.4 Health Checks

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    binance: boolean;
    disk: boolean;
    memory: boolean;
  };
}

GET /api/health -> HealthStatus
```

## 6. Deployment Architecture

### 6.1 AWS EC2 Setup

**Instance Specification:**
- Type: t3.small (2 vCPU, 2GB RAM)
- OS: Ubuntu 22.04 LTS
- Storage: 20GB gp3 SSD
- Region: ap-southeast-1 (Singapore) - low latency to Binance

**Security Group:**
```
Inbound Rules:
- Type: HTTPS, Protocol: TCP, Port: 443, Source: 0.0.0.0/0
- Type: SSH, Protocol: TCP, Port: 22, Source: Your_IP/32

Outbound Rules:
- All traffic allowed
```

### 6.2 Software Stack

```
┌─────────────────────────────────┐
│   Nginx (Reverse Proxy + SSL)  │
│         Port 80/443             │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   PM2 Process Manager           │
│   - Auto restart                │
│   - Cluster mode (2 instances)  │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   Node.js Application           │
│   - Express server              │
│   - Port 3000                   │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│   SQLite Database               │
│   /var/lib/trading-bot/db.sqlite│
└─────────────────────────────────┘
```

### 6.3 Directory Structure

```
/opt/trading-bot/
├── src/                    # Source code
├── dist/                   # Compiled JS
├── node_modules/
├── logs/
│   ├── app.log
│   ├── error.log
│   └── pm2.log
├── data/
│   └── database.sqlite
├── .env                    # Environment config
├── package.json
├── tsconfig.json
└── ecosystem.config.js     # PM2 config
```

### 6.4 Process Management (PM2)

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'trading-bot',
    script: './dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

### 6.5 Nginx Configuration

**/etc/nginx/sites-available/trading-bot:**
```nginx
upstream trading_bot {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=webhook:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    location /webhook/ {
        limit_req zone=webhook burst=20;
        proxy_pass http://trading_bot;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /api/ {
        limit_req zone=api burst=20;
        proxy_pass http://trading_bot;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 7. Data Flow Diagrams

### 7.1 Trading Signal Flow

```
TradingView Alert
       │
       ▼
POST /webhook/tradingview
       │
       ▼
Validate Secret ──[FAIL]──> Return 401
       │[PASS]
       ▼
Parse & Validate Payload ──[FAIL]──> Return 400
       │[PASS]
       ▼
Save to signals table
       │
       ▼
Return 200 OK
       │
       ▼ (async)
Check Duplicates ──[DUPLICATE]──> Skip
       │[NEW]
       ▼
Risk Manager Check ──[FAIL]──> Log error
       │[PASS]
       ▼
Calculate Quantity
       │
       ▼
Execute Order on Binance ──[FAIL]──> Log & Alert
       │[SUCCESS]
       ▼
Save to orders table
       │
       ▼
Update/Create Position
       │
       ▼
Set Stop Loss (if enabled)
       │
       ▼
Log Success
```

### 7.2 Order Execution Flow

```
Order Request
       │
       ▼
Validate Symbol ──[INVALID]──> Throw Error
       │[VALID]
       ▼
Get Account Balance ──[API ERROR]──> Retry/Fail
       │
       ▼
Check Sufficient Balance ──[INSUFFICIENT]──> Throw Error
       │[SUFFICIENT]
       ▼
Calculate Final Quantity
       │
       ▼
Create Binance Order ──[NETWORK ERROR]──> Retry
       │                └─[RETRY FAIL]──> Throw Error
       │[SUCCESS]
       ▼
Parse Response
       │
       ▼
Save to Database
       │
       ▼
Return Order Object
```

## 8. Performance Optimization

### 8.1 Caching Strategy

**Market Data Cache:**
- Price data: 5 second TTL
- Symbol info: 1 hour TTL
- Account balance: 10 second TTL

**Implementation:**
```typescript
class CacheManager {
  private cache = new Map<string, CacheEntry>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }
}
```

### 8.2 Database Optimization

- Use indexes on frequently queried columns
- Batch inserts where possible
- WAL mode for SQLite
- Regular VACUUM for SQLite

```typescript
// Enable WAL mode
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
```

### 8.3 API Call Optimization

- Batch requests where Binance API supports
- Use WebSocket for real-time price updates (future enhancement)
- Implement request deduplication

## 9. Scalability Considerations

### 9.1 Horizontal Scaling

**Current:** Single EC2 instance
**Future:** Multiple instances behind load balancer

**Requirements for multi-instance:**
- Shared database (PostgreSQL on RDS)
- Redis for shared cache/session
- Message queue (SQS) for signal processing
- Distributed locks for order execution

### 9.2 Vertical Scaling

Easy to upgrade EC2 instance:
- t3.micro → t3.small → t3.medium
- Adjust PM2 instance count based on CPU cores

## 10. Disaster Recovery

### 10.1 Backup Strategy

**Database Backup:**
```bash
# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-db.sh
```

**Script:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 /var/lib/trading-bot/database.sqlite ".backup /backups/db_$DATE.sqlite"
# Upload to S3
aws s3 cp /backups/db_$DATE.sqlite s3://your-backup-bucket/
# Keep only last 30 days locally
find /backups -name "db_*.sqlite" -mtime +30 -delete
```

### 10.2 Recovery Procedures

**Application Crash:**
- PM2 auto-restart
- Alert if restart fails 3 times

**EC2 Instance Failure:**
- Restore from AMI snapshot
- Restore database from S3 backup
- Update DNS to new instance

**Database Corruption:**
- Stop application
- Restore from latest backup
- Replay missed transactions (if possible)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Author:** Technical Team
