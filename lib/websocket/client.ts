import {
  MESSAGE_TYPES,
  SUBSCRIPTION_TYPES,
  WEBSOCKET_CONFIG
} from '@/constants/websocket';
import type {
  CoinbaseWebSocketEvent,
  CoinbaseWebSocketMessage,
  OrderBookData,
  PriceUpdateCallback,
  SubscriptionMessage,
  WebSocketError,
  WebSocketErrorCode
} from '@/types/websocket';
import { WebSocketErrorCode as ErrorCode } from '@/types/websocket';

import { logger } from './logger';
import {
  calculateMidPrice,
  createOrderBookSnapshot,
  processOrderBookUpdates
} from './order-book-utils';

export interface WebSocketClientEvents {
  'state-change': (state: WebSocketClientState) => void;
  'order-book-update': (productId: string, orderBook: OrderBookData) => void;
  'price-update': (productId: string, price: number) => void;
  error: (error: WebSocketError) => void;
}

export interface WebSocketClientState {
  isConnected: boolean;
  isConnecting: boolean;
  error: WebSocketError | null;
}

// Simple event emitter implementation for browser compatibility

class SimpleEventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }

  off(event: string, listener: Function): this {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          logger.error('Error in event listener', error as Error, { event });
        }
      });
      return true;
    }
    return false;
  }
}

export class WebSocketClient extends SimpleEventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private subscribedProducts = new Set<string>();
  private subscriptionCounts = new Map<string, number>();
  private orderBooks = new Map<string, OrderBookData>();
  private priceUpdateCallbacks = new Set<PriceUpdateCallback>();

  private state: WebSocketClientState = {
    isConnected: false,
    isConnecting: false,
    error: null
  };

  constructor() {
    super();
  }

  // Connect to WebSocket server

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.debug('WebSocket already connected');
      return;
    }

    this.updateState({ isConnecting: true, error: null });
    logger.info('Connecting to WebSocket', { url: WEBSOCKET_CONFIG.URL });

    try {
      this.ws = new WebSocket(WEBSOCKET_CONFIG.URL);
      this.setupWebSocketHandlers();
    } catch (error) {
      this.handleError(
        ErrorCode.CONNECTION_FAILED,
        `Failed to create WebSocket connection: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  // Disconnect from WebSocket server
  disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.close(WEBSOCKET_CONFIG.NORMAL_CLOSURE_CODE, 'Normal closure');
      this.ws = null;
    }

    this.updateState({ isConnected: false, isConnecting: false });
    logger.info('WebSocket disconnected');
  }

  // Subscribe to product updates

  subscribeToProduct(productId: string): void {
    const currentCount = this.subscriptionCounts.get(productId) || 0;
    this.subscriptionCounts.set(productId, currentCount + 1);

    logger.debug('Subscribe to product', {
      productId,
      previousCount: currentCount,
      newCount: currentCount + 1
    });

    if (currentCount === 0) {
      this.subscribedProducts.add(productId);
      this.initializeOrderBook(productId);
      this.sendSubscriptionMessage(SUBSCRIPTION_TYPES.SUBSCRIBE, [productId]);
    }
  }

  // Unsubscribe from product updates

  unsubscribeFromProduct(productId: string): void {
    const currentCount = this.subscriptionCounts.get(productId) || 0;

    if (currentCount <= 0) {
      logger.warn(
        'Attempted to unsubscribe from product with no active subscriptions',
        { productId }
      );
      return;
    }

    const newCount = currentCount - 1;
    this.subscriptionCounts.set(productId, newCount);

    logger.debug('Unsubscribe from product', {
      productId,
      previousCount: currentCount,
      newCount
    });

    if (newCount === 0) {
      this.subscribedProducts.delete(productId);
      this.orderBooks.delete(productId);
      this.subscriptionCounts.delete(productId);
      this.sendSubscriptionMessage(SUBSCRIPTION_TYPES.UNSUBSCRIBE, [productId]);
    }
  }

  // Add price update callback

  addPriceUpdateCallback(callback: PriceUpdateCallback): void {
    this.priceUpdateCallbacks.add(callback);
  }

  // Remove price update callback

  removePriceUpdateCallback(callback: PriceUpdateCallback): void {
    this.priceUpdateCallbacks.delete(callback);
  }

  // Get current order book for a product

  getOrderBook(productId: string): OrderBookData | null {
    return this.orderBooks.get(productId) || null;
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketClientState {
    return { ...this.state };
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onerror = this.handleWebSocketError.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
  }

  private handleOpen(): void {
    logger.info('WebSocket connection established');
    this.updateState({ isConnected: true, isConnecting: false });
    this.reconnectAttempts = 0;

    // Resubscribe to all products
    if (this.subscribedProducts.size > 0) {
      this.sendSubscriptionMessage(
        SUBSCRIPTION_TYPES.SUBSCRIBE,
        Array.from(this.subscribedProducts)
      );
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as CoinbaseWebSocketMessage;

      if (data.channel === 'l2_data' && data.events) {
        this.processOrderBookEvents(data.events);
      }
    } catch (error) {
      this.handleError(
        ErrorCode.PARSING_ERROR,
        'Failed to parse WebSocket message',
        error as Error
      );
    }
  }

  private handleWebSocketError(_event: Event): void {
    this.handleError(
      ErrorCode.CONNECTION_FAILED,
      'WebSocket connection error',
      new Error('WebSocket error event')
    );
  }

  private handleClose(event: CloseEvent): void {
    logger.info('WebSocket connection closed', {
      code: event.code,
      reason: event.reason
    });
    this.updateState({ isConnected: false, isConnecting: false });
    this.ws = null;

    // Attempt to reconnect if not a normal closure
    if (
      event.code !== WEBSOCKET_CONFIG.NORMAL_CLOSURE_CODE &&
      this.reconnectAttempts < WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS
    ) {
      this.scheduleReconnection();
    } else if (
      this.reconnectAttempts >= WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS
    ) {
      this.handleError(
        ErrorCode.MAX_RECONNECT_ATTEMPTS,
        'Maximum reconnection attempts reached'
      );
    }
  }

  private scheduleReconnection(): void {
    const delay = Math.min(
      WEBSOCKET_CONFIG.RECONNECT_BASE_DELAY *
        Math.pow(2, this.reconnectAttempts),
      WEBSOCKET_CONFIG.MAX_RECONNECT_DELAY
    );

    logger.info('Scheduling reconnection', {
      attempt: this.reconnectAttempts + 1,
      delay
    });

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private processOrderBookEvents(events: CoinbaseWebSocketEvent[]): void {
    events.forEach((event) => {
      const { product_id: productId, type, updates } = event;

      if (!productId || !this.subscribedProducts.has(productId)) {
        return;
      }

      if (type === MESSAGE_TYPES.SNAPSHOT) {
        this.handleOrderBookSnapshot(productId, updates);
      } else if (type === MESSAGE_TYPES.UPDATE) {
        this.handleOrderBookUpdate(productId, updates);
      }
    });
  }

  private handleOrderBookSnapshot(
    productId: string,
    updates: CoinbaseWebSocketEvent['updates']
  ): void {
    const snapshot = createOrderBookSnapshot(updates);
    const orderBook: OrderBookData = {
      ...snapshot,
      lastUpdated: new Date()
    };

    this.orderBooks.set(productId, orderBook);
    this.emit('order-book-update', productId, orderBook);
    this.notifyPriceUpdate(productId, orderBook);
  }

  private handleOrderBookUpdate(
    productId: string,
    updates: CoinbaseWebSocketEvent['updates']
  ): void {
    const currentOrderBook = this.orderBooks.get(productId);
    if (!currentOrderBook) {
      logger.warn('Received update for unknown product', { productId });
      return;
    }

    const newBids = processOrderBookUpdates(
      currentOrderBook.bids,
      updates,
      'bid'
    );
    const newAsks = processOrderBookUpdates(
      currentOrderBook.asks,
      updates,
      'offer'
    );

    const updatedOrderBook: OrderBookData = {
      bids: newBids,
      asks: newAsks,
      lastUpdated: new Date()
    };

    this.orderBooks.set(productId, updatedOrderBook);
    this.emit('order-book-update', productId, updatedOrderBook);
    this.notifyPriceUpdate(productId, updatedOrderBook);
  }

  private notifyPriceUpdate(productId: string, orderBook: OrderBookData): void {
    const midPrice = calculateMidPrice(orderBook);
    if (midPrice !== null) {
      this.emit('price-update', productId, midPrice);
      this.priceUpdateCallbacks.forEach((callback) => {
        callback(productId, midPrice);
      });
    }
  }

  private sendSubscriptionMessage(type: string, productIds: string[]): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send subscription message: WebSocket not connected');
      return;
    }

    const message: SubscriptionMessage = {
      type: type as 'subscribe' | 'unsubscribe',
      product_ids: productIds,
      channel: WEBSOCKET_CONFIG.CHANNEL
    };

    logger.debug('Sending subscription message', { type, productIds });
    this.ws.send(JSON.stringify(message));
  }

  private initializeOrderBook(productId: string): void {
    const emptyOrderBook: OrderBookData = {
      bids: [],
      asks: [],
      lastUpdated: null
    };

    this.orderBooks.set(productId, emptyOrderBook);
  }

  private updateState(updates: Partial<WebSocketClientState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('state-change', this.state);
  }

  private handleError(
    code: WebSocketErrorCode,
    message: string,
    originalError?: Error
  ): void {
    const error: WebSocketError = {
      code,
      message,
      timestamp: new Date()
    };

    logger.error('WebSocket error', originalError, { code, message });
    this.updateState({ error, isConnecting: false });
    this.emit('error', error);
  }
}
