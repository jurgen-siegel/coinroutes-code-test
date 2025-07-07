'use client';

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

interface StepDataPoint {
  price: number;
  priceLabel: string;
  bidVolume: number;
  askVolume: number;
  cumulativeBidVolume: number;
  cumulativeAskVolume: number;
}

interface OrderBookEntry {
  price: string;
  size: string;
}

interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdated: Date | null;
}

interface DepthChartProps {
  orderBook: OrderBook;
  isConnected: boolean;
}

const chartConfig = {
  cumulativeBidVolume: {
    label: 'Bids',
    color: 'hsl(142, 76%, 36%)' // Green color
  },
  cumulativeAskVolume: {
    label: 'Asks',
    color: 'hsl(0, 84%, 60%)' // Red color
  }
} satisfies ChartConfig;

export function DepthChart({ orderBook, isConnected }: DepthChartProps) {
  // Transform order book data into step chart format
  const stepData = useMemo((): StepDataPoint[] => {
    if (!orderBook.bids.length || !orderBook.asks.length || !isConnected) {
      return [];
    }

    // Take top 15 bids and asks for step visualization
    const topBids = orderBook.bids.slice(0, 15);
    const topAsks = orderBook.asks.slice(0, 15);

    // Calculate cumulative volumes for bids (descending price order)
    let cumulativeBidVolume = 0;
    const bidData = topBids.map((bid) => {
      const price = parseFloat(bid.price);
      const volume = parseFloat(bid.size);
      cumulativeBidVolume += volume;

      return {
        price,
        priceLabel: `$${price.toFixed(2)}`,
        bidVolume: volume,
        askVolume: 0,
        cumulativeBidVolume,
        cumulativeAskVolume: 0
      };
    });

    // Calculate cumulative volumes for asks (ascending price order)
    let cumulativeAskVolume = 0;
    const askData = topAsks.map((ask) => {
      const price = parseFloat(ask.price);
      const volume = parseFloat(ask.size);
      cumulativeAskVolume += volume;

      return {
        price,
        priceLabel: `$${price.toFixed(2)}`,
        bidVolume: 0,
        askVolume: volume,
        cumulativeBidVolume: 0,
        cumulativeAskVolume
      };
    });

    // Combine and sort by price (ascending for proper chart display)
    const combinedData = [...bidData, ...askData];
    combinedData.sort((a, b) => a.price - b.price);

    return combinedData;
  }, [orderBook, isConnected]);

  if (stepData.length === 0) {
    return (
      <div className="flex size-full flex-col">
        {/* Chart Skeleton */}
        <div className="min-h-0 flex-1 p-5">
          <Skeleton className="size-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col">
      {/* Step Chart */}
      <div className="min-h-0 flex-1">
        <ChartContainer
          config={chartConfig}
          className="size-full"
          height={200}
        >
          <AreaChart
            data={stepData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="priceLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value.toFixed(2)}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => `Price: ${value}`}
                  formatter={(value, name) => {
                    const color =
                      name === 'Bids'
                        ? 'hsl(142, 76%, 36%)'
                        : 'hsl(0, 84%, 60%)';
                    return [
                      <span
                        key={name}
                        style={{ color }}
                      >
                        {`${Number(value).toFixed(4)} BTC`}
                      </span>,
                      <span
                        key={`${name}-label`}
                        style={{ color }}
                      >
                        {name}
                      </span>
                    ];
                  }}
                />
              }
            />
            <Area
              type="step"
              dataKey="cumulativeBidVolume"
              stroke="var(--color-cumulativeBidVolume)"
              fill="var(--color-cumulativeBidVolume)"
              fillOpacity={0.3}
              strokeWidth={2}
              name="Bids"
              connectNulls={false}
            />
            <Area
              type="step"
              dataKey="cumulativeAskVolume"
              stroke="var(--color-cumulativeAskVolume)"
              fill="var(--color-cumulativeAskVolume)"
              fillOpacity={0.3}
              strokeWidth={2}
              name="Asks"
              connectNulls={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}
