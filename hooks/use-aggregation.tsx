'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react';

interface OrderBookEntry {
  price: string;
  size: string;
  exchange?: string;
}

interface AggregationContextType {
  priceIncrement: number;
  setPriceIncrement: (increment: number) => void;
  aggregateOrderBookData: (
    orders: OrderBookEntry[],
    isBid: boolean
  ) => OrderBookEntry[];
}

const AggregationContext = createContext<AggregationContextType | null>(null);

export function AggregationProvider({ children }: { children: ReactNode }) {
  const [priceIncrement, setPriceIncrementState] = useState<number>(0);

  const setPriceIncrement = useCallback((increment: number) => {
    setPriceIncrementState(increment);
  }, []);

  const aggregateOrderBookData = useCallback(
    (orders: OrderBookEntry[], isBid: boolean) => {
      if (priceIncrement <= 0 || orders.length === 0) {
        return orders;
      }

      // Calculate the reference price for converting base currency increment to quote currency
      const referencePrice = parseFloat(orders[0]?.price || '0');
      if (referencePrice <= 0) {
        return orders;
      }

      // Convert increment from base currency to quote currency (USD)
      const actualIncrement = priceIncrement * referencePrice;

      // Group orders by aggregated price levels
      const aggregatedMap = new Map<
        number,
        { totalSize: number; exchanges: Set<string> }
      >();

      orders.forEach((order) => {
        const price = parseFloat(order.price);

        // Calculate the aggregated price level using the actual USD increment
        let aggregatedPrice: number;
        if (isBid) {
          // For bids (buy orders), round DOWN to the nearest increment
          aggregatedPrice =
            Math.floor(price / actualIncrement) * actualIncrement;
        } else {
          // For asks (sell orders), round UP to the nearest increment
          aggregatedPrice =
            Math.ceil(price / actualIncrement) * actualIncrement;
        }

        // Round to avoid floating point precision issues
        aggregatedPrice =
          Math.round(aggregatedPrice / actualIncrement) * actualIncrement;

        const size = parseFloat(order.size);

        if (aggregatedMap.has(aggregatedPrice)) {
          const existing = aggregatedMap.get(aggregatedPrice)!;
          existing.totalSize += size;
          if (order.exchange) {
            existing.exchanges.add(order.exchange);
          }
        } else {
          const exchanges = new Set<string>();
          if (order.exchange) {
            exchanges.add(order.exchange);
          }
          aggregatedMap.set(aggregatedPrice, {
            totalSize: size,
            exchanges
          });
        }
      });

      // Convert back to OrderBookEntry format
      const aggregatedOrders: OrderBookEntry[] = Array.from(
        aggregatedMap.entries()
      ).map(([aggregatedPrice, data]) => ({
        price: aggregatedPrice.toString(),
        size: data.totalSize.toString(),
        exchange:
          data.exchanges.size === 1
            ? Array.from(data.exchanges)[0]
            : `${data.exchanges.size} exchanges`
      }));

      // Sort appropriately (bids descending, asks ascending)
      aggregatedOrders.sort((a, b) => {
        const priceA = parseFloat(a.price);
        const priceB = parseFloat(b.price);
        return isBid ? priceB - priceA : priceA - priceB;
      });

      return aggregatedOrders.slice(0, 10); // Keep top 10 levels
    },
    [priceIncrement]
  );

  const contextValue = useMemo(
    () => ({
      priceIncrement,
      setPriceIncrement,
      aggregateOrderBookData
    }),
    [priceIncrement, setPriceIncrement, aggregateOrderBookData]
  );

  return (
    <AggregationContext.Provider value={contextValue}>
      {children}
    </AggregationContext.Provider>
  );
}

export function useAggregation() {
  const context = useContext(AggregationContext);
  if (!context) {
    throw new Error(
      'useAggregation must be used within an AggregationProvider'
    );
  }
  return context;
}
