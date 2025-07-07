export const WEBSOCKET_CONFIG = {
  URL: 'wss://advanced-trade-ws.coinbase.com',
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_BASE_DELAY: 1000,
  MAX_RECONNECT_DELAY: 30000,
  CHANNEL: 'level2',
  ORDER_BOOK_DEPTH: 10,
  NORMAL_CLOSURE_CODE: 1000
} as const;

export const WEBSOCKET_EVENTS = {
  OPEN: 'open',
  MESSAGE: 'message',
  ERROR: 'error',
  CLOSE: 'close'
} as const;

export const SUBSCRIPTION_TYPES = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe'
} as const;

export const ORDER_BOOK_SIDES = {
  BID: 'bid',
  OFFER: 'offer'
} as const;

export const MESSAGE_TYPES = {
  SNAPSHOT: 'snapshot',
  UPDATE: 'update'
} as const;
