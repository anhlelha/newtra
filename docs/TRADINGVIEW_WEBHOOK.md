# TradingView Webhook Integration

This document explains how to send trading signals from TradingView to the trading bot using webhooks.

## Webhook Endpoint

**URL:** `http://your-server:3000/webhook/tradingview`
**Method:** `POST`
**Content-Type:** `application/json`

## Required Headers

```
x-webhook-secret: your-secret-key
```

The webhook secret must match the one configured in your `.env` file:
```env
WEBHOOK_SECRET=your-secret-key
```

## Payload Format

### Basic Payload Structure

```json
{
  "action": "buy",
  "symbol": "BTCUSDT",
  "strategy": "My Strategy Name",
  "orderType": "market",
  "price": 95000,
  "quantity": 0.001,
  "stopLoss": 94000,
  "message": "Bullish breakout confirmed"
}
```

## Field Descriptions

### Required Fields

| Field | Type | Description | Allowed Values |
|-------|------|-------------|----------------|
| `action` | string | Trading action to perform | `buy`, `sell`, `close` |
| `symbol` | string | Trading pair symbol | Any valid Binance symbol (e.g., `BTCUSDT`, `ETHUSDT`) |

### Optional Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `strategy` | string | Strategy name for routing to automatic/manual flow | `"Default Automatic"` |
| `orderType` | string | Order type | `market` (can be `market` or `limit`) |
| `price` | number | Limit order price (required for limit orders) | `null` |
| `quantity` | number | Order quantity (if not provided, calculated based on risk settings) | Calculated |
| `stopLoss` | number | Stop loss price | `null` |
| `message` | string | Optional message for logging/display | `null` |

## Strategy Routing

The `strategy` field determines how the signal is processed:

### 1. **Automatic Strategy** (immediate execution)
```json
{
  "action": "buy",
  "symbol": "BTCUSDT",
  "strategy": "Default Automatic",
  "orderType": "market"
}
```
- Signal is executed immediately
- No manual approval required
- Order placed on Binance automatically

### 2. **Manual Strategy** (requires approval)
```json
{
  "action": "buy",
  "symbol": "BTCUSDT",
  "strategy": "Manual ETH Swing",
  "orderType": "limit",
  "price": 3500
}
```
- Signal is saved to pending signals queue
- Appears in the **Pending Signals** page
- Requires manual approval before execution

### 3. **No Strategy Specified** (defaults to automatic)
```json
{
  "action": "buy",
  "symbol": "BTCUSDT",
  "orderType": "market"
}
```
- Uses the first enabled automatic strategy
- Falls back to immediate execution if no strategy found

## Example TradingView Alert Messages

### Example 1: Market Buy with Strategy
```json
{
  "action": "buy",
  "symbol": "{{ticker}}",
  "strategy": "BTC Scalping",
  "orderType": "market",
  "quantity": 0.01,
  "message": "MA crossover on 15m chart"
}
```

### Example 2: Limit Sell Order
```json
{
  "action": "sell",
  "symbol": "{{ticker}}",
  "strategy": "ETH Swing Trading",
  "orderType": "limit",
  "price": {{close}},
  "quantity": 0.5,
  "stopLoss": {{close}} * 1.02,
  "message": "Resistance reached, taking profit"
}
```

### Example 3: Close Position
```json
{
  "action": "close",
  "symbol": "{{ticker}}",
  "strategy": "Quick Exit",
  "message": "Stop loss triggered"
}
```

### Example 4: Market Order with Auto-calculated Quantity
```json
{
  "action": "buy",
  "symbol": "SOLUSDT",
  "orderType": "market",
  "message": "Volume spike detected"
}
```
*Note: Quantity will be calculated based on risk management settings*

## TradingView Placeholder Variables

TradingView provides placeholder variables you can use in alert messages:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{ticker}}` | Symbol name | `BTCUSDT` |
| `{{close}}` | Close price | `95420.50` |
| `{{open}}` | Open price | `95000.00` |
| `{{high}}` | High price | `95500.00` |
| `{{low}}` | Low price | `94800.00` |
| `{{volume}}` | Volume | `1234567` |

## Setting Up TradingView Alert

1. **Create an Alert in TradingView**
   - Click the alarm clock icon
   - Set your condition (e.g., price crosses MA)
   - Name your alert

2. **Configure Webhook URL**
   - In the "Notifications" tab
   - Check "Webhook URL"
   - Enter: `http://your-server:3000/webhook/tradingview`

3. **Set Alert Message (JSON format)**
   ```json
   {
     "action": "{{strategy.order.action}}",
     "symbol": "{{ticker}}",
     "strategy": "My Strategy Name",
     "orderType": "market",
     "price": {{close}},
     "message": "Alert triggered at {{timenow}}"
   }
   ```

4. **Add Webhook Secret**
   - You need to configure the webhook secret in your request headers
   - This can be done through a proxy or by using TradingView Pro+ features

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Signal received and pending manual approval",
  "signalId": "6a7a4090-da81-4099-9e83-0f93f38fe236",
  "strategyType": "manual",
  "requiresApproval": true
}
```

### Error Response (400/500)
```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Price is required for limit orders"
  }
}
```

## Testing with curl

### Test with Automatic Strategy
```bash
curl -X POST http://localhost:3000/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-secret-key" \
  -d '{
    "action": "buy",
    "symbol": "BTCUSDT",
    "strategy": "Default Automatic",
    "orderType": "market",
    "price": 95000,
    "quantity": 0.001,
    "message": "Test signal"
  }'
```

### Test with Manual Strategy
```bash
curl -X POST http://localhost:3000/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-secret-key" \
  -d '{
    "action": "buy",
    "symbol": "ETHUSDT",
    "strategy": "Manual ETH Swing",
    "orderType": "limit",
    "price": 3500,
    "quantity": 0.5,
    "stopLoss": 3450,
    "message": "Manual review required"
  }'
```

## Strategy Management

Before using a strategy name in the webhook payload:

1. Go to **Strategy Management** page
2. Create a new strategy with your desired name
3. Set type to:
   - **Automatic** - for immediate execution
   - **Manual** - for approval workflow
4. Enable the strategy
5. Use the exact strategy name in your TradingView alerts

## Security Notes

1. **Always use HTTPS in production** to protect your webhook secret
2. **Keep your webhook secret private** - don't share it publicly
3. **Use strong, random webhook secrets** - generate them securely
4. **Monitor your webhook logs** - check for unauthorized access attempts
5. **Set up IP whitelisting** if possible to restrict access to TradingView IPs

## Troubleshooting

### Signal Not Appearing in Dashboard
- Check that the strategy name matches exactly (case-sensitive)
- Verify the strategy is enabled in Strategy Management
- Check server logs for errors

### Order Not Executing
- For automatic strategies: Check risk management limits
- For manual strategies: Signal must be approved in Pending Signals page
- Verify Binance API credentials are correct
- Check account has sufficient balance

### Webhook Authentication Failed
- Verify `x-webhook-secret` header matches `.env` configuration
- Check that the header is being sent correctly
- Review server logs for authentication errors

## Additional Resources

- [TradingView Webhooks Documentation](https://www.tradingview.com/support/solutions/43000529348-i-want-to-know-more-about-webhooks/)
- [Strategy Management Guide](./STRATEGY_MANAGEMENT.md)
- [Risk Management Configuration](./RISK_MANAGEMENT.md)
