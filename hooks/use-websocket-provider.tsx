'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { WebSocketClient } from '@/lib/websocket/client';
import { logger } from '@/lib/websocket/logger';
import {
  calculateTotal,
  formatPrice,
  formatSize,
  getQuoteCurrency
} from '@/lib/websocket/order-book-utils';
import type {
  OrderBookData,
  PriceUpdateCallback,
  WebSocketContextType,
  WebSocketError,
  WebSocketState
} from '@/types/websocket';

// WebSocket context for managing real-time data connections
const WebSocketContext = createContext<WebSocketContextType | null>(null);

// WebSocket provider component that manages connection state and subscriptions
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    orderBooks: {}
  });

  const clientRef = useRef<WebSocketClient | null>(null);
  const isInitializedRef = useRef(false);
  const pendingOperationsRef = useRef<(() => void)[]>([]);

  // Initialize WebSocket client
  useEffect(() => {
    const client = new WebSocketClient();
    clientRef.current = client;

    // Set up event handlers
    const handleStateChange = (clientState: WebSocketState) => {
      setState((prev) => ({
        ...prev,
        isConnected: clientState.isConnected,
        isConnecting: clientState.isConnecting,
        error: clientState.error
      }));
    };

    const handleOrderBookUpdate = (
      productId: string,
      orderBook: OrderBookData
    ) => {
      setState((prev) => ({
        ...prev,
        orderBooks: {
          ...prev.orderBooks,
          [productId]: orderBook
        }
      }));
    };

    const handleError = (error: WebSocketError) => {
      logger.error('WebSocket error received', undefined, { error });
    };

    // Register event handlers
    client.on('state-change', handleStateChange);
    client.on('order-book-update', handleOrderBookUpdate);
    client.on('error', handleError);

    // Connect to WebSocket
    client.connect();

    // Mark as initialized and execute pending operations
    isInitializedRef.current = true;
    const operations = pendingOperationsRef.current;
    pendingOperationsRef.current = [];
    operations.forEach((operation) => operation());

    // Cleanup on unmount
    return () => {
      client.off('state-change', handleStateChange);
      client.off('order-book-update', handleOrderBookUpdate);
      client.off('error', handleError);
      client.disconnect();
      isInitializedRef.current = false;
    };
  }, []);

  // Helper function to execute operations when client is ready
  const executeWhenReady = useCallback((operation: () => void) => {
    if (isInitializedRef.current && clientRef.current) {
      operation();
    } else {
      pendingOperationsRef.current.push(operation);
    }
  }, []);

  // Subscribe to product updates
  const subscribeToProduct = useCallback(
    (productId: string) => {
      executeWhenReady(() => {
        if (clientRef.current) {
          clientRef.current.subscribeToProduct(productId);
        }
      });
    },
    [executeWhenReady]
  );

  // Unsubscribe from product updates
  const unsubscribeFromProduct = useCallback(
    (productId: string) => {
      executeWhenReady(() => {
        if (clientRef.current) {
          clientRef.current.unsubscribeFromProduct(productId);
        }
      });
    },
    [executeWhenReady]
  );

  // Register price update callback
  const onPriceUpdate = useCallback(
    (callback: PriceUpdateCallback) => {
      executeWhenReady(() => {
        if (clientRef.current) {
          clientRef.current.addPriceUpdateCallback(callback);
        }
      });
    },
    [executeWhenReady]
  );

  // Remove price update callback
  const offPriceUpdate = useCallback(
    (callback: PriceUpdateCallback) => {
      executeWhenReady(() => {
        if (clientRef.current) {
          clientRef.current.removePriceUpdateCallback(callback);
        }
      });
    },
    [executeWhenReady]
  );

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<WebSocketContextType>(
    () => ({
      ...state,
      subscribeToProduct,
      unsubscribeFromProduct,
      onPriceUpdate,
      offPriceUpdate
    }),
    [
      state,
      subscribeToProduct,
      unsubscribeFromProduct,
      onPriceUpdate,
      offPriceUpdate
    ]
  );

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook to access WebSocket context
// @throws Error if used outside of WebSocketProvider
export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }

  return context;
}

// Interface for order book hook return value
export interface UseOrderBookReturn {
  orderBook: OrderBookData;
  isConnected: boolean;
  isConnecting: boolean;
  error: WebSocketError | null;
  formatPrice: (price: string) => string;
  formatSize: (size: string) => string;
  calculateTotal: (price: string, size: string) => string;
}

// Hook for managing order book subscriptions and formatting
// @param productId - Product ID to subscribe to (e.g., 'BTC-USD')
// @returns Order book data and formatting utilities
export function useOrderBook(productId: string): UseOrderBookReturn {
  const {
    orderBooks,
    isConnected,
    isConnecting,
    error,
    subscribeToProduct,
    unsubscribeFromProduct
  } = useWebSocket();

  // Manage subscription lifecycle
  useEffect(() => {
    if (!productId) {
      logger.warn('Product ID is required for order book subscription');
      return;
    }

    logger.debug('Subscribing to order book', { productId });
    subscribeToProduct(productId);

    return () => {
      logger.debug('Unsubscribing from order book', { productId });
      unsubscribeFromProduct(productId);
    };
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get order book data or default empty state
  const orderBook = useMemo<OrderBookData>(() => {
    return (
      orderBooks[productId] || {
        bids: [],
        asks: [],
        lastUpdated: null
      }
    );
  }, [orderBooks, productId]);

  // Memoize quote currency for formatting
  const quoteCurrency = useMemo(() => getQuoteCurrency(productId), [productId]);

  // Memoize formatting functions
  const formatPriceForProduct = useCallback(
    (price: string) => formatPrice(price, quoteCurrency),
    [quoteCurrency]
  );

  const formatSizeForProduct = useCallback(
    (size: string) => formatSize(size),
    []
  );

  const calculateTotalForProduct = useCallback(
    (price: string, size: string) => calculateTotal(price, size, quoteCurrency),
    [quoteCurrency]
  );

  return {
    orderBook,
    isConnected,
    isConnecting,
    error,
    formatPrice: formatPriceForProduct,
    formatSize: formatSizeForProduct,
    calculateTotal: calculateTotalForProduct
  };
}
