import { z } from 'zod';

export const tradingViewSignalSchema = z.object({
  action: z.enum(['buy', 'sell', 'close'], {
    required_error: 'Action is required',
    invalid_type_error: 'Action must be buy, sell, or close',
  }),
  symbol: z.string().min(1, 'Symbol is required').toUpperCase(),
  strategy: z.string().optional(), // Strategy name for routing to automatic/manual flow
  orderType: z.enum(['market', 'limit']).default('market'),
  price: z.number().positive('Price must be positive').optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  stopLoss: z.number().positive('Stop loss must be positive').optional(),
  message: z.string().optional(),
});

export type TradingViewSignal = z.infer<typeof tradingViewSignalSchema>;

// Validate webhook secret header
export const webhookHeaderSchema = z.object({
  'x-webhook-secret': z.string().min(1, 'Webhook secret is required'),
});

export type WebhookHeader = z.infer<typeof webhookHeaderSchema>;
