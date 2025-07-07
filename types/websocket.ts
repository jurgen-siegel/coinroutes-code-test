export interface OrderBookEntry {
  price: string;
  size: string;
  exchange: string;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdated: Date | null;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: WebSocketError | null;
  orderBooks: Record<string, OrderBookData>;
}

export interface WebSocketContextType extends WebSocketState {
  subscribeToProduct: (productId: string) => void;
  unsubscribeFromProduct: (productId: string) => void;
  onPriceUpdate: (callback: PriceUpdateCallback) => void;
  offPriceUpdate: (callback: PriceUpdateCallback) => void;
}

export type PriceUpdateCallback = (symbol: string, price: number) => void;

export interface WebSocketError {
  code: WebSocketErrorCode;
  message: string;
  timestamp: Date;
}

export enum WebSocketErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  PARSING_ERROR = 'PARSING_ERROR',
  MAX_RECONNECT_ATTEMPTS = 'MAX_RECONNECT_ATTEMPTS',
  SUBSCRIPTION_ERROR = 'SUBSCRIPTION_ERROR'
}

export interface CoinbaseWebSocketMessage {
  channel: string;
  events?: CoinbaseWebSocketEvent[];
}

export interface CoinbaseWebSocketEvent {
  product_id: string;
  type: 'snapshot' | 'update';
  updates: CoinbaseOrderBookUpdate[];
}

export interface CoinbaseOrderBookUpdate {
  side: 'bid' | 'offer';
  price_level: string;
  new_quantity: string;
  exchange?: string;
}

export interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  product_ids: string[];
  channel: string;
}
