export interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

export interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  filters: any[];
}

export interface Balance {
  asset: string;
  free: string;
  locked: string;
}

export interface AccountInfo {
  balances: Balance[];
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
}

export interface MarketOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
}

export interface LimitOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
}

export interface StopLossParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  stopPrice: number;
}

export interface Order {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  quantity: number;
  price?: number;
  status: string;
  executedQty: number;
  cummulativeQuoteQty: number;
  fills?: OrderFill[];
  transactTime?: number;
}

export interface OrderFill {
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string;
}

export interface TickerPrice {
  symbol: string;
  price: string;
}

export interface Stats24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

// Futures Trading Types
export interface FuturesMarketOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
}

export interface FuturesAccountInfo {
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  assets: FuturesAsset[];
  positions: FuturesPosition[];
}

export interface FuturesAsset {
  asset: string;
  walletBalance: string;
  unrealizedProfit: string;
  marginBalance: string;
  availableBalance: string;
  crossWalletBalance: string;
  crossUnrealizedPnL: string;
  maxWithdrawAmount: string;
}

export interface FuturesPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
}

export interface FuturesBalance {
  asset: string;
  balance: string;
  availableBalance: string;
}
