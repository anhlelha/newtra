# Cryptocurrency Trading Bot

Ứng dụng trading cryptocurrency tự động kết nối với Binance để thực hiện giao dịch dựa trên tín hiệu từ TradingView.

## Tính năng

### Backend
- **Kết nối Binance API**: Tự động đặt lệnh mua/bán cryptocurrency trên Binance
- **TradingView Webhook**: Nhận và xử lý alert từ TradingView theo thời gian thực
- **Quản lý rủi ro**: Position sizing, stop loss tự động, giới hạn exposure
- **Order Management**: Hỗ trợ Market Order, Limit Order, Stop Loss
- **Logging & Monitoring**: Ghi log chi tiết, health check endpoints
- **Security**: Authentication, rate limiting, secure credentials management

### Frontend Dashboard
- **Dark Cyber Terminal UI**: Professional trading terminal với dark theme
- **Real-time Updates**: Auto-refresh data mỗi 5 giây
- **Interactive Charts**: Performance charts với Recharts
- **Animated Components**: Smooth animations với Framer Motion
- **Responsive Design**: Tối ưu cho desktop và mobile

## Kiến trúc

```
┌─────────────┐
│ TradingView │
└──────┬──────┘
       │ Webhook
       ▼
┌──────────────────────────────┐
│    Express.js Backend API    │
│   ┌──────────────────────┐   │
│   │   Trading Engine     │   │  ┌──────────────┐
│   │  - Signal Processor  │───┼──►   Binance    │
│   │  - Order Manager     │   │  │     API      │
│   │  - Risk Manager      │   │  └──────────────┘
│   └──────────┬───────────┘   │
│              ▼               │
│      ┌──────────────┐        │
│      │ SQLite DB    │        │
│      └──────────────┘        │
└──────────────┬───────────────┘
               │ REST API
               ▼
┌──────────────────────────────┐
│  React Dashboard (Frontend)  │
│  - Real-time monitoring      │
│  - Position management       │
│  - Trading controls          │
└──────────────────────────────┘
```

Xem chi tiết: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Yêu cầu

- Node.js 18+
- npm 9+
- Binance Account với API credentials
- TradingView Account (cho alerts)
- AWS EC2 instance (cho production)

## Cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd crypto-trading-bot
```

### 2. Cài đặt Backend dependencies

```bash
npm install
```

### 3. Cài đặt Frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Cấu hình môi trường

**Backend:**

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```bash
# Binance API
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_secret
BINANCE_TESTNET=true  # Set false cho production

# TradingView
TRADINGVIEW_WEBHOOK_SECRET=your_random_secret

# Admin API
ADMIN_API_KEY=your_admin_api_key

# Trading Config
TRADING_ENABLED=true
DEFAULT_POSITION_SIZE_PERCENT=2
MAX_POSITION_SIZE_PERCENT=5
MAX_DAILY_LOSS=1000
```

**Frontend:**

```bash
cd frontend
cp .env.example .env
```

Chỉnh sửa `frontend/.env`:

```bash
VITE_API_URL=/api
VITE_ADMIN_API_KEY=your_admin_api_key  # Same as backend ADMIN_API_KEY
```

### 5. Khởi tạo database

```bash
npm run migrate
```

### 6. Build Backend TypeScript

```bash
npm run build
```

### 7. Chạy ứng dụng

**Development Mode:**

Terminal 1 - Backend:
```bash
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`
Backend API tại `http://localhost:3000`

**Production:**

Backend:
```bash
npm start
# Hoặc với PM2:
pm2 start ecosystem.config.js
```

Frontend (build và serve):
```bash
cd frontend
npm run build
# Serve dist/ folder với Nginx hoặc static hosting
```

## Sử dụng

### 1. Cấu hình TradingView Alert

Trong TradingView, tạo alert với webhook:

**URL:** `https://your-domain.com/webhook/tradingview`

**Headers:**
```
X-Webhook-Secret: your_webhook_secret
```

**Message (JSON):**
```json
{
  "action": "buy",
  "symbol": "BTCUSDT",
  "orderType": "market",
  "quantity": 0.01,
  "stopLoss": 49000
}
```

**Actions:**
- `buy`: Mở position LONG
- `sell`: Mở position SHORT
- `close`: Đóng position hiện tại

**Order Types:**
- `market`: Market order (thực hiện ngay)
- `limit`: Limit order (cần có `price`)

### 2. API Endpoints

#### Health Check (Public)
```bash
GET /api/health
```

#### Get Status (Protected)
```bash
GET /api/status
Headers: Authorization: Bearer your_admin_api_key
```

#### Get Positions
```bash
GET /api/positions?status=OPEN
Headers: Authorization: Bearer your_admin_api_key
```

#### Get Orders
```bash
GET /api/orders?symbol=BTCUSDT&limit=100
Headers: Authorization: Bearer your_admin_api_key
```

#### Cancel Order
```bash
POST /api/orders/cancel/:orderId
Headers: Authorization: Bearer your_admin_api_key
```

#### Get Balance
```bash
GET /api/balance?asset=USDT
Headers: Authorization: Bearer your_admin_api_key
```

#### Update Config
```bash
POST /api/config
Headers: Authorization: Bearer your_admin_api_key
Body: {
  "trading.enabled": false,
  "trading.maxPositionSizePercent": 3
}
```

### 3. Ví dụ Test Webhook

```bash
curl -X POST https://your-domain.com/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your_webhook_secret" \
  -d '{
    "action": "buy",
    "symbol": "BTCUSDT",
    "orderType": "market"
  }'
```

## Deployment lên AWS EC2

Xem hướng dẫn chi tiết: [docs/AWS_DEPLOYMENT_GUIDE.md](docs/AWS_DEPLOYMENT_GUIDE.md)

**Tóm tắt:**

1. Tạo EC2 instance (Ubuntu 22.04, t3.small)
2. Cài đặt Node.js, Nginx, PM2
3. Clone repository và cài đặt dependencies
4. Cấu hình environment variables
5. Setup SSL với Let's Encrypt
6. Start với PM2

```bash
# Trên EC2
cd /opt/trading-bot
npm ci --production
npm run build
npm run migrate
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Cấu trúc thư mục

```
crypto-trading-bot/
├── docs/                    # Tài liệu
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── AWS_DEPLOYMENT_GUIDE.md
├── src/                    # Backend source
│   ├── api/                # API routes & controllers
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   └── schemas/
│   ├── config/             # Configuration
│   ├── database/           # Database schema & migrations
│   ├── services/           # Business logic
│   │   ├── binance/
│   │   ├── OrderManager.ts
│   │   ├── RiskManager.ts
│   │   └── SignalProcessor.ts
│   ├── utils/              # Utilities
│   ├── server.ts           # Express server setup
│   └── index.ts            # Entry point
├── frontend/               # React dashboard
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── lib/           # API client
│   │   ├── types/         # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── dist/              # Built frontend
│   └── package.json
├── dist/                   # Compiled backend JavaScript
├── logs/                   # Application logs
├── data/                   # SQLite database
├── .env                    # Backend environment variables
├── ecosystem.config.js     # PM2 configuration
├── package.json            # Backend dependencies
└── tsconfig.json
```

## Scripts

### Backend
```bash
npm run dev           # Development mode với hot reload
npm run build         # Build TypeScript → JavaScript
npm start             # Chạy production build
npm test              # Chạy tests
npm run lint          # Lint code
npm run format        # Format code với Prettier
npm run migrate       # Chạy database migrations
```

### Frontend
```bash
cd frontend
npm run dev           # Development server (port 5173)
npm run build         # Build for production
npm run preview       # Preview production build
```

## Quản lý rủi ro

Ứng dụng tích hợp các chức năng quản lý rủi ro:

- **Position Size Limit**: Tối đa 5% balance mỗi lệnh
- **Total Exposure Limit**: Tối đa 50% total balance
- **Daily Loss Limit**: Dừng trading khi đạt giới hạn loss
- **Stop Loss**: Tự động đặt stop loss cho mỗi position
- **Duplicate Prevention**: Không cho phép signal trùng trong 30s

Cấu hình trong `.env`:
```bash
DEFAULT_POSITION_SIZE_PERCENT=2      # 2% per trade
MAX_POSITION_SIZE_PERCENT=5          # Max 5% per trade
MAX_TOTAL_EXPOSURE_PERCENT=50        # Max 50% total
MAX_DAILY_LOSS=1000                  # Stop at -$1000/day
ENABLE_STOP_LOSS=true
DEFAULT_STOP_LOSS_PERCENT=2          # 2% stop loss
```

## Monitoring

### Logs

```bash
# Application logs
tail -f logs/app.log

# Error logs
tail -f logs/error.log

# PM2 logs
pm2 logs trading-bot
```

### Database

```bash
sqlite3 data/database.sqlite

# Xem orders gần đây
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

# Xem open positions
SELECT * FROM positions WHERE status = 'OPEN';

# Xem today's PnL
SELECT SUM(realized_pnl) FROM positions
WHERE DATE(closed_at) = DATE('now');
```

## Troubleshooting

### Application không start

```bash
# Check logs
pm2 logs trading-bot --err

# Check environment variables
cat .env

# Rebuild
npm run build
pm2 restart trading-bot
```

### Webhook không nhận được

```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Test webhook locally
curl -X POST http://localhost:3000/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your_secret" \
  -d '{"action":"buy","symbol":"BTCUSDT","orderType":"market"}'
```

### Binance API errors

```bash
# Check API key permissions on Binance
# Check IP restrictions
# Check rate limits

# Test connectivity
curl https://api.binance.com/api/v3/ping
```

## Bảo mật

- **API Credentials**: Lưu trong `.env`, không commit vào git
- **Webhook Secret**: Sử dụng random string mạnh
- **Admin API Key**: Sử dụng random string mạnh
- **HTTPS**: Bắt buộc cho production
- **Rate Limiting**: Giới hạn requests để tránh abuse
- **IP Whitelist**: Cấu hình trên Binance API settings

## Tài liệu

- [Product Requirements (PRD)](docs/PRD.md)
- [Technical Architecture](docs/ARCHITECTURE.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [AWS Deployment Guide](docs/AWS_DEPLOYMENT_GUIDE.md)
- [Frontend README](frontend/README.md)

## Support

Nếu gặp vấn đề:

1. Check logs: `pm2 logs trading-bot`
2. Check health: `curl http://localhost:3000/api/health`
3. Review documentation trong folder `docs/`

## License

MIT License

---

**Cảnh báo**: Trading cryptocurrency có rủi ro cao. Sử dụng ứng dụng này hoàn toàn tự chịu trách nhiệm. Luôn test kỹ trên testnet trước khi sử dụng với tiền thật.
