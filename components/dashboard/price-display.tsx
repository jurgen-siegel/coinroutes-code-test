'use client';

import { useMemo } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useAggregation } from '@/hooks/use-aggregation';
import { useProductSelection } from '@/hooks/use-crypto-pair-selection';
import { useOrderBook } from '@/hooks/use-websocket-provider';

export function PriceDisplay() {
  const { selectedProduct } = useProductSelection();
  const { aggregateOrderBookData } = useAggregation();
  const { orderBook, formatPrice, isConnected } = useOrderBook(selectedProduct);

  /**
   * Aggregate order book data based on current price increment setting
   */
  const aggregatedOrderBook = useMemo(() => {
    return {
      bids: aggregateOrderBookData(orderBook.bids, true),
      asks: aggregateOrderBookData(orderBook.asks, false),
      lastUpdated: orderBook.lastUpdated
    };
  }, [orderBook, aggregateOrderBookData]);

  const priceData = useMemo(() => {
    if (
      !aggregatedOrderBook ||
      aggregatedOrderBook.bids.length === 0 ||
      aggregatedOrderBook.asks.length === 0
    ) {
      return null;
    }

    // Best bid is the highest bid price (first in sorted array)
    const bestBidPrice = aggregatedOrderBook.bids[0]?.price;
    // Best ask is the lowest ask price (first in sorted array)
    const bestAskPrice = aggregatedOrderBook.asks[0]?.price;

    if (!bestBidPrice || !bestAskPrice) {
      return null;
    }

    const bestBid = parseFloat(bestBidPrice);
    const bestAsk = parseFloat(bestAskPrice);
    const midPrice = (bestBid + bestAsk) / 2;

    return {
      bestBid: formatPrice(bestBidPrice),
      bestAsk: formatPrice(bestAskPrice),
      midPrice: formatPrice(midPrice.toString())
    };
  }, [aggregatedOrderBook, formatPrice]);

  if (!isConnected || !priceData) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex flex-col items-center">
          <Skeleton className="mb-1 h-3 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex flex-col items-center">
          <Skeleton className="mb-1 h-3 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex flex-col items-center">
          <Skeleton className="mb-1 h-3 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground">Best Bid</span>
        <span className="font-mono font-medium text-green-600">
          {priceData.bestBid}
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground">Mid Price</span>
        <span className="font-mono font-medium">{priceData.midPrice}</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground">Best Ask</span>
        <span className="font-mono font-medium text-red-600">
          {priceData.bestAsk}
        </span>
      </div>
    </div>
  );
}
