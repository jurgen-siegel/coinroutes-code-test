'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

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
    color: 'hsl(142, 76%, 36%)'
  },
  bestAsk: {
    label: 'Best Ask',
    color: 'hsl(0, 84%, 60%)'
  },
  spread: {
    label: 'Spread',
    color: 'hsl(var(--chart-3))'
  }
} satisfies ChartConfig;

const CARD_CONFIGS = {
  bid: {
    label: 'Best Bid',
    color: 'green',
    borderColor: 'border-green-200 dark:border-green-800/30',
    bgColor:
      'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
    textColor: 'text-green-700 dark:text-green-300',
    valueColor: 'text-green-600 dark:text-green-400',
    mutedColor: 'text-green-600/70 dark:text-green-400/70',
    dotColor: 'bg-green-500',
    animate: true
  },
  spread: {
    label: 'Spread',
    color: 'blue',
    borderColor: 'border-blue-200 dark:border-blue-800/30',
    bgColor:
      'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
    textColor: 'text-blue-700 dark:text-blue-300',
    valueColor: 'text-blue-600 dark:text-blue-400',
    mutedColor: 'text-blue-600/70 dark:text-blue-400/70',
    dotColor: 'bg-blue-500',
    animate: false
  },
  ask: {
    label: 'Best Ask',
    color: 'red',
    borderColor: 'border-red-200 dark:border-red-800/30',
    bgColor:
      'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20',
    textColor: 'text-red-700 dark:text-red-300',
    valueColor: 'text-red-600 dark:text-red-400',
    mutedColor: 'text-red-600/70 dark:text-red-400/70',
    dotColor: 'bg-red-500',
    animate: true
  }
} as const;

const MAX_DATA_POINTS = 200;
const INITIAL_Y_RANGE: [number, number] = [0, 100];

// Helper functions
const formatPrice = (price: number) =>
  price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const formatVolume = (size: number, price: number) => {
  const volume = size * price;
  return `Vol: ${size} ($${formatPrice(volume)})`;
};

const formatPercentage = (value: number) => `${value.toFixed(3)}%`;

interface PriceCardProps {
  type: keyof typeof CARD_CONFIGS;
  value: string;
  subtitle?: string;
}

function PriceCard({ type, value, subtitle }: PriceCardProps) {
  const config = CARD_CONFIGS[type];

  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-2 sm:p-3 ${config.borderColor} ${config.bgColor}`}
    >
      <div className="mb-1 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
        <div
          className={`size-1 rounded-full sm:size-1.5 ${config.dotColor} ${config.animate ? 'animate-pulse' : ''}`}
        />
        <span
          className={`text-[10px] font-medium sm:text-xs ${config.textColor}`}
        >
          {config.label}
        </span>
      </div>
      <div className="space-y-0.5">
        <div
          className={`text-sm font-bold tabular-nums sm:text-lg ${config.valueColor}`}
        >
          ${value}
        </div>
        {subtitle && (
          <div
            className={`hidden text-[10px] font-medium sm:block ${config.mutedColor}`}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

export function OrderBookChart() {
  const { selectedProduct } = useProductSelection();
  const { aggregateOrderBookData } = useAggregation();
  const [priceHistory, setPriceHistory] = useState<PriceDataPoint[]>([]);
  const [stableYRange, setStableYRange] =
    useState<[number, number]>(INITIAL_Y_RANGE);

  const { orderBook, isConnected, isConnecting, error } =
    useOrderBook(selectedProduct);

  const aggregatedOrderBook = useMemo(
    () => ({
      bids: aggregateOrderBookData(orderBook.bids, true),
      asks: aggregateOrderBookData(orderBook.asks, false),
      lastUpdated: orderBook.lastUpdated
    }),
    [orderBook, aggregateOrderBookData]
  );

  const formatTime = useCallback(
    (timestamp: number) =>
      new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
    []
  );

  // Price calculations
  const bestBidPrice = parseFloat(aggregatedOrderBook.bids[0]?.price || '0');
  const bestAskPrice = parseFloat(aggregatedOrderBook.asks[0]?.price || '0');
  const bestBidSize = parseFloat(aggregatedOrderBook.bids[0]?.size || '0');
  const bestAskSize = parseFloat(aggregatedOrderBook.asks[0]?.size || '0');
  const spread = bestAskPrice - bestBidPrice;
  const spreadPercentage = (spread / bestBidPrice) * 100;

  // Update price history
  useEffect(() => {
    if (!orderBook.bids.length || !orderBook.asks.length || !isConnected)
      return;

    const rawBestBid = parseFloat(orderBook.bids[0]?.price || '0');
    const rawBestAsk = parseFloat(orderBook.asks[0]?.price || '0');
    const timestamp = Date.now();

    const newDataPoint: PriceDataPoint = {
      timestamp,
      time: formatTime(timestamp),
      bestBid: rawBestBid,
      bestAsk: rawBestAsk,
      spread: rawBestAsk - rawBestBid
    };

    setPriceHistory((prev) => [...prev, newDataPoint].slice(-MAX_DATA_POINTS));
  }, [orderBook, isConnected, formatTime]);

  // Update Y-axis range
  useEffect(() => {
    if (priceHistory.length < 10) return;

    const recentPrices = priceHistory.slice(-50);
    const allPrices = recentPrices.flatMap((point) => [
      point.bestBid,
      point.bestAsk
    ]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const [currentMin, currentMax] = stableYRange;

    const threshold = (currentMax - currentMin) * 0.1;
    const needsUpdate =
      minPrice < currentMin + threshold ||
      maxPrice > currentMax - threshold ||
      currentMax === 100;

    if (needsUpdate) {
      const range = maxPrice - minPrice;
      const padding = Math.max(range * 0.01, 0.5);
      setStableYRange([Math.max(0, minPrice - padding), maxPrice + padding]);
    }
  }, [priceHistory, stableYRange]);

  // Reset on product change
  useEffect(() => {
    setPriceHistory([]);
    setStableYRange(INITIAL_Y_RANGE);
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
      {/* Price Summary Cards */}
      <div className="mb-2 sm:mb-4">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          <PriceCard
            type="bid"
            value={formatPrice(bestBidPrice)}
            subtitle={formatVolume(bestBidSize, bestBidPrice)}
          />
          <PriceCard
            type="spread"
            value={formatPrice(spread)}
            subtitle={formatPercentage(spreadPercentage)}
          />
          <PriceCard
            type="ask"
            value={formatPrice(bestAskPrice)}
            subtitle={formatVolume(bestAskSize, bestAskPrice)}
          />
        </div>
      </div>

      {/* Chart */}
      <div className="min-h-[250px] flex-1 sm:min-h-0">
        <ChartContainer
          config={chartConfig}
          className="size-full"
        >
          <AreaChart
            data={priceHistory}
            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={stableYRange}
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
                    const color = name === 'Best Bid' ? '#16a34a' : '#dc2626';
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
            <Area
              dataKey="bestBid"
              type="step"
              fill="transparent"
              stroke="var(--color-bestBid)"
              strokeWidth={2}
              name="Best Bid"
              isAnimationActive={false}
            />
            <Area
              dataKey="bestAsk"
              type="step"
              fill="transparent"
              stroke="var(--color-bestAsk)"
              strokeWidth={2}
              name="Best Ask"
              isAnimationActive={false}
            />
          </AreaChart>
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
