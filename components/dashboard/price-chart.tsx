'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Line, LineChart, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useAggregation } from '@/hooks/use-aggregation';
import { useProductSelection } from '@/hooks/use-crypto-pair-selection';
import { useOrderBook } from '@/hooks/use-websocket-provider';

interface PriceDataPoint {
  timestamp: number;
  time: string;
  bestBid: number;
  bestAsk: number;
  spread: number;
}

const chartConfig = {
  bestBid: {
    label: 'Best Bid',
    color: 'hsl(142, 76%, 36%)' // Green color
  },
  bestAsk: {
    label: 'Best Ask',
    color: 'hsl(0, 84%, 60%)' // Red color
  },
  spread: {
    label: 'Spread',
    color: 'hsl(var(--chart-3))'
  }
} satisfies ChartConfig;

export function OrderBookChart() {
  const { selectedProduct } = useProductSelection();
  const { aggregateOrderBookData } = useAggregation();
  const [priceHistory, setPriceHistory] = useState<PriceDataPoint[]>([]);
  const maxDataPoints = 200; // Keep last 200 data points

  const { orderBook, isConnected, isConnecting, error } =
    useOrderBook(selectedProduct);

  /**
   * Aggregate order book data for summary cards (to match order book view)
   */
  const aggregatedOrderBook = useMemo(() => {
    return {
      bids: aggregateOrderBookData(orderBook.bids, true),
      asks: aggregateOrderBookData(orderBook.asks, false),
      lastUpdated: orderBook.lastUpdated
    };
  }, [orderBook, aggregateOrderBookData]);

  // Format timestamp for display
  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Update price history when orderbook changes (using raw data for accurate price tracking)
  useEffect(() => {
    if (!orderBook.bids.length || !orderBook.asks.length || !isConnected) {
      return;
    }

    const bestBid = parseFloat(orderBook.bids[0]?.price || '0');
    const bestAsk = parseFloat(orderBook.asks[0]?.price || '0');
    const spread = bestAsk - bestBid;
    const timestamp = Date.now();

    const newDataPoint: PriceDataPoint = {
      timestamp,
      time: formatTime(timestamp),
      bestBid,
      bestAsk,
      spread
    };

    setPriceHistory((prev) => {
      const newHistory = [...prev, newDataPoint];
      // Keep only the last maxDataPoints
      return newHistory.slice(-maxDataPoints);
    });
  }, [orderBook, isConnected, formatTime]);

  // Clear history when product changes
  useEffect(() => {
    setPriceHistory([]);
  }, [selectedProduct]);

  if (isConnecting || !isConnected) {
    return (
      <div className="flex size-full flex-col p-6">
        <div className="mb-4">
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex size-full items-center justify-center p-6">
        <div className="text-center">
          <div className="mb-2 text-red-500">Connection Error</div>
          <div className="text-sm text-muted-foreground">{String(error)}</div>
        </div>
      </div>
    );
  }

  if (priceHistory.length === 0) {
    return (
      <div className="flex size-full items-center justify-center p-6">
        <div className="text-center">
          <div className="mb-2 text-muted-foreground">
            Loading price data...
          </div>
          <div className="text-sm text-muted-foreground">
            Waiting for orderbook updates
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col p-3 sm:p-6">
      {/* Price Summary - using aggregated data to match order book view */}
      <div className="mb-2 sm:mb-4">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {/* Best Bid Card */}
          <div className="relative overflow-hidden rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-2 dark:border-green-800/30 dark:from-green-950/20 dark:to-emerald-950/20 sm:p-3">
            <div className="mb-1 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
              <div className="size-1 animate-pulse rounded-full bg-green-500 sm:size-1.5" />
              <span className="text-[10px] font-medium text-green-700 dark:text-green-300 sm:text-xs">
                Best Bid
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400 sm:text-lg">
                $
                {parseFloat(
                  aggregatedOrderBook.bids[0]?.price || '0'
                ).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <div className="hidden text-[10px] font-medium text-green-600/70 dark:text-green-400/70 sm:block">
                Vol: {parseFloat(aggregatedOrderBook.bids[0]?.size || '0')} ($
                {(
                  parseFloat(aggregatedOrderBook.bids[0]?.size || '0') *
                  parseFloat(aggregatedOrderBook.bids[0]?.price || '0')
                ).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
                )
              </div>
            </div>
          </div>

          {/* Spread Card */}
          <div className="relative overflow-hidden rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-2 dark:border-blue-800/30 dark:from-blue-950/20 dark:to-indigo-950/20 sm:p-3">
            <div className="mb-1 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
              <div className="size-1 rounded-full bg-blue-500 sm:size-1.5" />
              <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 sm:text-xs">
                Spread
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400 sm:text-lg">
                $
                {(
                  parseFloat(aggregatedOrderBook.asks[0]?.price || '0') -
                  parseFloat(aggregatedOrderBook.bids[0]?.price || '0')
                ).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <div className="hidden text-[10px] font-medium text-blue-600/70 dark:text-blue-400/70 sm:block">
                {(
                  ((parseFloat(aggregatedOrderBook.asks[0]?.price || '0') -
                    parseFloat(aggregatedOrderBook.bids[0]?.price || '0')) /
                    parseFloat(aggregatedOrderBook.bids[0]?.price || '1')) *
                  100
                ).toFixed(3)}
                %
              </div>
            </div>
          </div>

          {/* Best Ask Card */}
          <div className="relative overflow-hidden rounded-lg border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-2 dark:border-red-800/30 dark:from-red-950/20 dark:to-rose-950/20 sm:p-3">
            <div className="mb-1 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
              <div className="size-1 animate-pulse rounded-full bg-red-500 sm:size-1.5" />
              <span className="text-[10px] font-medium text-red-700 dark:text-red-300 sm:text-xs">
                Best Ask
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400 sm:text-lg">
                $
                {parseFloat(
                  aggregatedOrderBook.asks[0]?.price || '0'
                ).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <div className="hidden text-[10px] font-medium text-red-600/70 dark:text-red-400/70 sm:block">
                Vol: {parseFloat(aggregatedOrderBook.asks[0]?.size || '0')} ($
                {(
                  parseFloat(aggregatedOrderBook.asks[0]?.size || '0') *
                  parseFloat(aggregatedOrderBook.asks[0]?.price || '0')
                ).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
                )
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="min-h-[250px] flex-1 sm:min-h-0">
        <ChartContainer
          config={chartConfig}
          className="size-full"
        >
          <LineChart
            data={priceHistory}
            margin={{
              top: 10,
              right: 10,
              left: 10,
              bottom: 10
            }}
          >
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['dataMin - 0.1', 'dataMax + 0.1']}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => `Time: ${value}`}
                  formatter={(value, name) => {
                    const price = `$${Number(value).toFixed(2)}`;
                    const color = name === 'Best Bid' ? '#16a34a' : '#dc2626'; // green for bid, red for ask
                    return [
                      <span
                        key={name}
                        style={{ color }}
                      >
                        {price}
                      </span>,
                      <span
                        key={`${name}-label`}
                        style={{ color, marginLeft: '4px' }}
                      >
                        {name}
                      </span>
                    ];
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="bestBid"
              stroke="var(--color-bestBid)"
              strokeWidth={2}
              dot={false}
              name="Best Bid"
            />
            <Line
              type="monotone"
              dataKey="bestAsk"
              stroke="var(--color-bestAsk)"
              strokeWidth={2}
              dot={false}
              name="Best Ask"
            />
          </LineChart>
        </ChartContainer>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-4 sm:mt-4 sm:gap-6">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="size-2 rounded-full bg-green-500 sm:size-3" />
          <span className="text-xs sm:text-sm">Best Bid</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="size-2 rounded-full bg-red-500 sm:size-3" />
          <span className="text-xs sm:text-sm">Best Ask</span>
        </div>
      </div>
    </div>
  );
}
