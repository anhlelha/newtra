# Product Requirements Document (PRD)
# Ứng Dụng Trading Cryptocurrency Tự Động

## 1. Tổng Quan Sản Phẩm

### 1.1 Mục Đích
Xây dựng ứng dụng trading cryptocurrency tự động kết nối với Binance để thực hiện giao dịch dựa trên tín hiệu từ TradingView.

### 1.2 Mục Tiêu
- Tự động hóa việc đặt lệnh mua/bán cryptocurrency trên Binance
- Nhận và xử lý alert từ TradingView theo thời gian thực
- Đảm bảo độ tin cậy và bảo mật cao cho giao dịch tài chính
- Dễ dàng deploy và scale trên AWS EC2

### 1.3 Phạm Vi
**In Scope:**
- Kết nối Binance API (Spot Trading)
- Webhook endpoint nhận alert từ TradingView
- Quản lý lệnh: Market Order, Limit Order, Stop Loss
- Logging và monitoring
- Quản lý rủi ro cơ bản (position sizing, max loss)
- API bảo mật với authentication

**Out of Scope (Phase 1):**
- Futures/Margin trading
- Web UI dashboard (có thể thêm phase 2)
- Backtesting engine
- Multiple exchange support

## 2. Yêu Cầu Chức Năng

### 2.1 Binance Integration
**FR-1.1: Kết nối Binance API**
- Hỗ trợ API Key và Secret authentication
- Kiểm tra kết nối và quyền truy cập
- Retry logic cho network failures

**FR-1.2: Đặt Lệnh (Order Management)**
- Market Order: Mua/bán tức thì theo giá thị trường
- Limit Order: Đặt lệnh với giá chỉ định
- Stop Loss Order: Tự động cắt lỗ
- Lấy thông tin balance, open orders, order history

**FR-1.3: Market Data**
- Lấy giá hiện tại của các cặp coin
- Lấy thông tin ticker, 24h stats
- Validate symbol trước khi trade

### 2.2 TradingView Integration
**FR-2.1: Webhook Endpoint**
- REST API endpoint nhận POST request từ TradingView
- Xác thực request (webhook secret/token)
- Parse và validate payload

**FR-2.2: Alert Format**
Hỗ trợ định dạng alert:
```json
{
  "action": "buy|sell|close",
  "symbol": "BTCUSDT",
  "orderType": "market|limit",
  "price": 50000,  // optional, for limit orders
  "quantity": 0.01,  // optional
  "stopLoss": 49000,  // optional
  "message": "Entry long signal"
}
```

### 2.3 Trading Logic
**FR-3.1: Order Execution**
- Nhận signal từ TradingView
- Validate signal (symbol exists, sufficient balance)
- Tính toán quantity dựa trên:
  - Fixed quantity (nếu được chỉ định)
  - Position sizing (% account balance)
  - Risk management rules
- Thực hiện order trên Binance
- Log kết quả

**FR-3.2: Risk Management**
- Max position size per trade (% of balance)
- Max total exposure (% of total balance)
- Stop loss tự động
- Prevent duplicate orders trong timeframe ngắn

**FR-3.3: Position Management**
- Tracking open positions
- Tự động đặt stop loss khi mở position
- Close position theo signal hoặc stop loss

### 2.4 Configuration Management
**FR-4.1: Environment Configuration**
- Binance API credentials
- TradingView webhook secret
- Trading parameters (position size, max loss, etc.)
- Logging level

**FR-4.2: Trading Rules**
- Configurable per symbol
- Min/max trade size
- Allowed trading hours
- Enable/disable trading

## 3. Yêu Cầu Phi Chức Năng

### 3.1 Performance
- Response time webhook < 500ms
- Order execution latency < 2s
- Hỗ trợ tối thiểu 100 requests/phút

### 3.2 Reliability
- Uptime 99.5%
- Graceful error handling
- Auto-restart on crash
- Data persistence cho orders và positions

### 3.3 Security
- API credentials trong environment variables
- HTTPS cho webhook endpoint
- Authentication cho admin endpoints
- Rate limiting để tránh abuse
- Webhook signature verification

### 3.4 Monitoring & Logging
- Structured logging (JSON format)
- Log levels: ERROR, WARN, INFO, DEBUG
- Alert khi có lỗi critical
- Metrics: orders executed, success rate, PnL

### 3.5 Scalability
- Stateless design để dễ scale horizontal
- Database cho persistent data
- Queue system cho async processing (optional)

## 4. User Stories

### 4.1 Trader
```
AS A trader
I WANT TO send trading signals from TradingView
SO THAT the system automatically executes trades on Binance
```

**Acceptance Criteria:**
- TradingView alert trigger webhook
- System validate và execute order
- Trader nhận notification về kết quả

### 4.2 System Administrator
```
AS AN administrator
I WANT TO monitor system health and trading activity
SO THAT I can ensure the system operates correctly
```

**Acceptance Criteria:**
- Logs cho tất cả activities
- Error alerts
- Health check endpoint

## 5. Technical Constraints

### 5.1 Platform
- Deploy trên AWS EC2 (Ubuntu/Amazon Linux)
- Node.js runtime
- SQLite hoặc PostgreSQL cho database

### 5.2 External APIs
- Binance API rate limits: 1200 requests/minute
- TradingView webhook delivery: best effort

### 5.3 Cost Constraints
- Optimize cho EC2 t3.micro/t3.small instance
- Minimize API calls để tránh rate limits

## 6. Dependencies

### 6.1 External Services
- Binance API (https://api.binance.com)
- TradingView Alert system

### 6.2 Infrastructure
- AWS EC2 instance
- Domain/SSL certificate (Let's Encrypt)
- Optional: AWS RDS, CloudWatch

## 7. Success Metrics

### 7.1 Technical Metrics
- Order execution success rate > 99%
- System uptime > 99.5%
- Average order latency < 2s

### 7.2 Business Metrics
- Number of successful trades
- Total trading volume
- System reliability (crashes, errors)

## 8. Timeline & Milestones

**Phase 1 - MVP (Week 1-2):**
- Setup project structure
- Binance API integration
- TradingView webhook
- Basic order execution
- Market orders only

**Phase 2 - Advanced Features (Week 3):**
- Limit orders & stop loss
- Risk management
- Position tracking
- Configuration management

**Phase 3 - Deployment (Week 4):**
- AWS EC2 setup
- SSL/Domain configuration
- Monitoring & alerts
- Documentation

## 9. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Binance API downtime | High | Low | Implement retry logic, fallback mode |
| TradingView webhook fails | High | Medium | Request validation, manual trigger option |
| Network issues on EC2 | Medium | Low | Auto-restart, health monitoring |
| Security breach | Critical | Low | Secure credentials, rate limiting, audit logs |
| Rate limit exceeded | Medium | Medium | Request throttling, caching |

## 10. Future Enhancements (Post-MVP)

- Web dashboard cho monitoring
- Backtesting engine
- Multiple exchange support (Bybit, OKX)
- Advanced order types (OCO, Trailing Stop)
- Telegram/Discord notifications
- Strategy builder UI
- Multi-account support
- Portfolio management

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Owner:** Development Team
