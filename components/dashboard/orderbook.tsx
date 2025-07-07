'use client';

import { useCallback, useMemo } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  ASK_COLOR,
  BID_COLOR,
  MAX_DISPLAYED_ORDERS
} from '@/constants/order-book';
import { useAggregation } from '@/hooks/use-aggregation';
import { useProductSelection } from '@/hooks/use-crypto-pair-selection';
import { useOrderBook } from '@/hooks/use-websocket-provider';
import { OrderBookEntry, OrderBookTableProps } from '@/types/order-book';

/**
 * Loading skeleton row component
 */
const LoadingRow = () => (
  <TableRow>
    <TableCell className="px-4 text-xs">
      <Skeleton className="h-4 w-full" />
    </TableCell>
    <TableCell className="px-4 text-xs">
      <Skeleton className="h-4 w-full" />
    </TableCell>
    <TableCell className="px-4 text-xs">
      <Skeleton className="h-4 w-full" />
    </TableCell>
  </TableRow>
);

/**
 * Empty order row component
 */
const EmptyOrderRow = () => (
  <TableRow>
    <TableCell className="truncate px-4 text-xs text-muted-foreground">
      --
    </TableCell>
    <TableCell className="truncate px-4 text-right text-xs text-muted-foreground">
      --
    </TableCell>
    <TableCell className="truncate px-4 text-right text-xs text-muted-foreground">
      --
    </TableCell>
  </TableRow>
);

/**
 * Individual order row component
 */
const OrderRow = ({
  order,
  isBid,
  maxSize,
  formatPrice,
  formatSize,
  calculateTotal
}: {
  order: OrderBookEntry;
  isBid: boolean;
  maxSize: number;
  formatPrice: (price: string) => string;
  formatSize: (size: string) => string;
  calculateTotal: (price: string, size: string) => string;
}) => {
  const volumeStyle = useMemo(() => {
    const numericSize = parseFloat(order.size.toString());
    const relativeSize = maxSize > 0 ? (numericSize / maxSize) * 100 : 0;
    const color = isBid ? BID_COLOR : ASK_COLOR;
    const direction = isBid ? 'to left' : 'to right';

    return {
      background: `linear-gradient(${direction}, ${color} ${relativeSize}%, transparent ${relativeSize}%)`
    };
  }, [order.size, maxSize, isBid]);

  const priceClassName = isBid
    ? 'font-medium text-green-600 dark:text-green-400 px-4 text-xs relative z-10 truncate'
    : 'font-medium text-red-600 dark:text-red-400 px-4 text-xs relative z-10 truncate';

  return (
    <TableRow
      key={`${isBid ? 'bid' : 'ask'}-${order.price}`}
      style={volumeStyle}
      className="relative"
    >
      <TableCell className={priceClassName}>
        {formatPrice(order.price)}
      </TableCell>
      <TableCell className="relative z-10 truncate px-4 text-right font-mono text-xs">
        {formatSize(order.size)}
      </TableCell>
      <TableCell className="relative z-10 truncate px-4 text-right text-xs">
        {calculateTotal(order.price, order.size)}
      </TableCell>
    </TableRow>
  );
};

/**
 * Reusable order book table component
 */
const OrderBookTable = ({
  orders,
  isBid,
  isConnecting,
  isConnected,
  baseCurrency,
  maxSize,
  formatPrice,
  formatSize,
  calculateTotal
}: OrderBookTableProps) => {
  const renderRows = useCallback(() => {
    if (isConnecting || !isConnected) {
      return Array.from({ length: MAX_DISPLAYED_ORDERS }, (_, index) => (
        <LoadingRow key={`loading-${isBid ? 'bid' : 'ask'}-${index}`} />
      ));
    }

    return Array.from({ length: MAX_DISPLAYED_ORDERS }, (_, index) => {
      const order = orders[index];

      if (order) {
        return (
          <OrderRow
            key={`${isBid ? 'bid' : 'ask'}-${order.price}-${index}`}
            order={order}
            isBid={isBid}
            maxSize={maxSize}
            formatPrice={formatPrice}
            formatSize={formatSize}
            calculateTotal={calculateTotal}
          />
        );
      }

      return <EmptyOrderRow key={`empty-${isBid ? 'bid' : 'ask'}-${index}`} />;
    });
  }, [
    orders,
    isBid,
    isConnecting,
    isConnected,
    maxSize,
    formatPrice,
    formatSize,
    calculateTotal
  ]);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full overflow-y-auto overflow-x-hidden">
        <Table className="w-full table-fixed">
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-[30%] px-4 text-xs">Price</TableHead>
              <TableHead className="w-[35%] px-4 text-right text-xs">
                Size ({baseCurrency})
              </TableHead>
              <TableHead className="w-[35%] px-4 text-right text-xs">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>
    </div>
  );
};

/**
 * Main OrderBook component
 */
export function OrderBook() {
  const { selectedProduct } = useProductSelection();
  const { aggregateOrderBookData } = useAggregation();
  const {
    orderBook,
    isConnected,
    isConnecting,
    error,
    formatPrice,
    formatSize,
    calculateTotal
  } = useOrderBook(selectedProduct);

  /**
   * Extract base currency from product ID
   */
  const baseCurrency = useMemo(() => {
    return selectedProduct.split('-')[0];
  }, [selectedProduct]);

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

  /**
   * Calculate maximum volume for relative bar sizing using aggregated data
   */
  const maxSize = useMemo(() => {
    const maxBidSize =
      aggregatedOrderBook.bids.length > 0
        ? Math.max(
            ...aggregatedOrderBook.bids.map((bid) =>
              parseFloat(bid.size.toString())
            )
          )
        : 0;
    const maxAskSize =
      aggregatedOrderBook.asks.length > 0
        ? Math.max(
            ...aggregatedOrderBook.asks.map((ask) =>
              parseFloat(ask.size.toString())
            )
          )
        : 0;

    return Math.max(maxBidSize, maxAskSize, 0);
  }, [aggregatedOrderBook.bids, aggregatedOrderBook.asks]);

  // Handle error state
  if (error) {
    return (
      <div className="flex size-full items-center justify-center p-4">
        <Alert
          variant="destructive"
          className="max-w-md"
        >
          <AlertDescription>
            Failed to load order book data. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col">
      <div className="min-h-0 flex-1">
        <div className="h-full overflow-hidden">
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full"
          >
            {/* Buy Orders (Bids) */}
            <ResizablePanel
              defaultSize={50}
              className="flex h-full flex-col"
            >
              <OrderBookTable
                orders={aggregatedOrderBook.bids}
                isBid={true}
                isConnecting={isConnecting}
                isConnected={isConnected}
                baseCurrency={baseCurrency}
                maxSize={maxSize}
                formatPrice={formatPrice}
                formatSize={formatSize}
                calculateTotal={calculateTotal}
              />
            </ResizablePanel>

            <ResizableHandle className="w-px bg-border transition-colors hover:bg-border/80" />

            {/* Sell Orders (Asks) */}
            <ResizablePanel
              defaultSize={50}
              className="flex h-full flex-col"
            >
              <OrderBookTable
                orders={aggregatedOrderBook.asks}
                isBid={false}
                isConnecting={isConnecting}
                isConnected={isConnected}
                baseCurrency={baseCurrency}
                maxSize={maxSize}
                formatPrice={formatPrice}
                formatSize={formatSize}
                calculateTotal={calculateTotal}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
