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

interface OrderBookEntry {
  price: string;
  size: string;
  exchange?: string;
}

interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdated: Date | null;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  orderBooks: Record<string, OrderBookData>;
}

interface WebSocketContextType extends WebSocketState {
  subscribeToProduct: (productId: string) => void;
  unsubscribeFromProduct: (productId: string) => void;
  onPriceUpdate: (callback: (symbol: string, price: number) => void) => void;
  offPriceUpdate: (callback: (symbol: string, price: number) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    orderBooks: {}
  });

  const wsRef = useRef<WebSocket | null>(null);
  const subscribedProducts = useRef<Set<string>>(new Set());
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const providerId = useRef(`ws-provider-${Date.now()}`);
  const priceUpdateCallbacks = useRef<
    Set<(symbol: string, price: number) => void>
  >(new Set());

  const onPriceUpdate = useCallback(
    (callback: (symbol: string, price: number) => void) => {
      priceUpdateCallbacks.current.add(callback);
    },
    []
  );

  const offPriceUpdate = useCallback(
    (callback: (symbol: string, price: number) => void) => {
      priceUpdateCallbacks.current.delete(callback);
    },
    []
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket('wss://advanced-trade-ws.coinbase.com');
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false
        }));
        reconnectAttempts.current = 0;

        // Resubscribe to all products
        if (subscribedProducts.current.size > 0) {
          const subscribeMessage = {
            type: 'subscribe',
            product_ids: Array.from(subscribedProducts.current),
            channel: 'level2'
          };

          ws.send(JSON.stringify(subscribeMessage));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.channel === 'l2_data' && data.events) {
            data.events.forEach((event: any) => {
              const productId = event.product_id;

              if (!productId || !subscribedProducts.current.has(productId)) {
                return;
              }

              if (event.type === 'snapshot') {
                const bids = event.updates
                  .filter((update: any) => update.side === 'bid')
                  .map((update: any) => ({
                    price: update.price_level,
                    size: update.new_quantity,
                    exchange: update.exchange || 'Coinbase'
                  }))
                  .sort(
                    (a: OrderBookEntry, b: OrderBookEntry) =>
                      parseFloat(b.price) - parseFloat(a.price)
                  )
                  .slice(0, 10);

                const asks = event.updates
                  .filter((update: any) => update.side === 'offer')
                  .map((update: any) => ({
                    price: update.price_level,
                    size: update.new_quantity,
                    exchange: update.exchange || 'Coinbase'
                  }))
                  .sort(
                    (a: OrderBookEntry, b: OrderBookEntry) =>
                      parseFloat(a.price) - parseFloat(b.price)
                  )
                  .slice(0, 10);

                setState((prev) => ({
                  ...prev,
                  orderBooks: {
                    ...prev.orderBooks,
                    [productId]: { bids, asks, lastUpdated: new Date() }
                  }
                }));

                // Notify price update callbacks
                if (bids.length > 0 && asks.length > 0) {
                  const bestBid = parseFloat(bids[0].price);
                  const bestAsk = parseFloat(asks[0].price);
                  const midPrice = (bestBid + bestAsk) / 2;

                  priceUpdateCallbacks.current.forEach((callback) => {
                    callback(productId, midPrice);
                  });
                }
              } else if (event.type === 'update') {
                setState((prev) => {
                  const currentOrderBook = prev.orderBooks[productId];
                  if (!currentOrderBook) {
                    return prev;
                  }

                  const newBids = [...currentOrderBook.bids];
                  const newAsks = [...currentOrderBook.asks];

                  event.updates.forEach((update: any) => {
                    const entry = {
                      price: update.price_level,
                      size: update.new_quantity,
                      exchange: update.exchange || 'Coinbase'
                    };

                    if (update.side === 'bid') {
                      const existingIndex = newBids.findIndex(
                        (bid) => bid.price === entry.price
                      );
                      if (parseFloat(entry.size) === 0) {
                        if (existingIndex !== -1) {
                          newBids.splice(existingIndex, 1);
                        }
                      } else {
                        if (existingIndex !== -1) {
                          newBids[existingIndex] = entry;
                        } else {
                          newBids.push(entry);
                        }
                      }
                    } else if (update.side === 'offer') {
                      const existingIndex = newAsks.findIndex(
                        (ask) => ask.price === entry.price
                      );
                      if (parseFloat(entry.size) === 0) {
                        if (existingIndex !== -1) {
                          newAsks.splice(existingIndex, 1);
                        }
                      } else {
                        if (existingIndex !== -1) {
                          newAsks[existingIndex] = entry;
                        } else {
                          newAsks.push(entry);
                        }
                      }
                    }
                  });

                  newBids.sort(
                    (a, b) => parseFloat(b.price) - parseFloat(a.price)
                  );
                  newAsks.sort(
                    (a, b) => parseFloat(a.price) - parseFloat(b.price)
                  );

                  const updatedOrderBook = {
                    bids: newBids.slice(0, 10),
                    asks: newAsks.slice(0, 10),
                    lastUpdated: new Date()
                  };

                  // Notify price update callbacks for updates too
                  if (
                    updatedOrderBook.bids.length > 0 &&
                    updatedOrderBook.asks.length > 0
                  ) {
                    const bestBid = parseFloat(updatedOrderBook.bids[0].price);
                    const bestAsk = parseFloat(updatedOrderBook.asks[0].price);
                    const midPrice = (bestBid + bestAsk) / 2;

                    priceUpdateCallbacks.current.forEach((callback) => {
                      callback(productId, midPrice);
                    });
                  }

                  return {
                    ...prev,
                    orderBooks: {
                      ...prev.orderBooks,
                      [productId]: updatedOrderBook
                    }
                  };
                });
              }
            });
          }
        } catch (error) {
          // Error parsing WebSocket message
        }
      };

      ws.onerror = (error) => {
        setState((prev) => ({ ...prev, error: 'WebSocket connection error' }));
      };

      ws.onclose = (event) => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }));
        wsRef.current = null;

        // Attempt to reconnect if not a normal closure
        if (
          event.code !== 1000 &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setState((prev) => ({
            ...prev,
            error: 'Max reconnection attempts reached'
          }));
        }
      };
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Failed to create connection: ${error.message}`,
        isConnecting: false
      }));
    }
  }, []);

  const subscribeToProduct = useCallback((productId: string) => {
    if (subscribedProducts.current.has(productId)) {
      return;
    }

    subscribedProducts.current.add(productId);

    // Initialize empty orderbook
    setState((prev) => ({
      ...prev,
      orderBooks: {
        ...prev.orderBooks,
        [productId]: { bids: [], asks: [], lastUpdated: null }
      }
    }));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'subscribe',
        product_ids: [productId],
        channel: 'level2'
      };

      wsRef.current.send(JSON.stringify(subscribeMessage));
    }
  }, []);

  const unsubscribeFromProduct = useCallback((productId: string) => {
    if (!subscribedProducts.current.has(productId)) {
      return;
    }

    subscribedProducts.current.delete(productId);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const unsubscribeMessage = {
        type: 'unsubscribe',
        product_ids: [productId],
        channel: 'level2'
      };

      wsRef.current.send(JSON.stringify(unsubscribeMessage));
    }

    // Remove orderbook data
    setState((prev) => {
      const newOrderBooks = { ...prev.orderBooks };
      delete newOrderBooks[productId];
      return { ...prev, orderBooks: newOrderBooks };
    });
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Normal closure');
      }
    };
  }, [connect]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
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

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

export function useOrderBook(productId: string) {
  const {
    orderBooks,
    isConnected,
    isConnecting,
    error,
    subscribeToProduct,
    unsubscribeFromProduct
  } = useWebSocket();

  useEffect(() => {
    subscribeToProduct(productId);
    return () => unsubscribeFromProduct(productId);
  }, [productId, subscribeToProduct, unsubscribeFromProduct]);

  const orderBook = orderBooks[productId] || {
    bids: [],
    asks: [],
    lastUpdated: null
  };

  const getQuoteCurrency = useCallback((productId: string) => {
    return productId.split('-')[1];
  }, []);

  const formatPrice = useCallback(
    (price: string) => {
      const num = parseFloat(price);
      const quoteCurrency = getQuoteCurrency(productId);

      if (quoteCurrency === 'USD') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(num);
      } else {
        return `${num.toFixed(2)} ${quoteCurrency}`;
      }
    },
    [productId, getQuoteCurrency]
  );

  const formatSize = useCallback((size: string) => {
    const num = parseFloat(size);
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 8
    }).format(num);
  }, []);

  const calculateTotal = useCallback(
    (price: string, size: string) => {
      const total = parseFloat(price) * parseFloat(size);
      const quoteCurrency = getQuoteCurrency(productId);

      if (quoteCurrency === 'USD') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(total);
      } else {
        return `${total.toFixed(2)} ${quoteCurrency}`;
      }
    },
    [productId, getQuoteCurrency]
  );

  return {
    orderBook,
    isConnected,
    isConnecting,
    error,
    formatPrice,
    formatSize,
    calculateTotal
  };
}
