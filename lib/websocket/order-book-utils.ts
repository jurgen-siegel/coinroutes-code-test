import { ORDER_BOOK_SIDES, WEBSOCKET_CONFIG } from '@/constants/websocket';
import { DEFAULT_LOCALE } from '@/lib/i18n/locale';
import type {
  CoinbaseOrderBookUpdate,
  OrderBookData,
  OrderBookEntry
} from '@/types/websocket';

// Sorts order book entries by price
// @param entries - Array of order book entries
// @param side - Order book side ('bid' or 'offer')
// @returns Sorted array of entries

export function sortOrderBookEntries(
  entries: OrderBookEntry[],
  side: 'bid' | 'offer'
): OrderBookEntry[] {
  return entries.sort((a, b) => {
    const priceA = parseFloat(a.price);
    const priceB = parseFloat(b.price);

    // Bids: highest price first, Asks: lowest price first
    return side === ORDER_BOOK_SIDES.BID ? priceB - priceA : priceA - priceB;
  });
}

// Processes order book updates and returns new order book entries
// @param currentEntries - Current order book entries
// @param updates - Array of order book updates
// @param side - Order book side
// @returns Updated order book entries

export function processOrderBookUpdates(
  currentEntries: OrderBookEntry[],
  updates: CoinbaseOrderBookUpdate[],
  side: 'bid' | 'offer'
): OrderBookEntry[] {
  const newEntries = [...currentEntries];

  updates
    .filter((update) => update.side === side)
    .forEach((update) => {
      const entry: OrderBookEntry = {
        price: update.price_level,
        size: update.new_quantity,
        exchange: update.exchange || 'Coinbase'
      };

      const existingIndex = newEntries.findIndex(
        (existing) => existing.price === entry.price
      );

      if (parseFloat(entry.size) === 0) {
        // Remove entry if size is 0
        if (existingIndex !== -1) {
          newEntries.splice(existingIndex, 1);
        }
      } else {
        // Update existing entry or add new one
        if (existingIndex !== -1) {
          newEntries[existingIndex] = entry;
        } else {
          newEntries.push(entry);
        }
      }
    });

  return sortOrderBookEntries(newEntries, side).slice(
    0,
    WEBSOCKET_CONFIG.ORDER_BOOK_DEPTH
  );
}

// Creates order book snapshot from initial data
// @param updates - Array of order book updates
// @returns Order book data with bids and asks

export function createOrderBookSnapshot(
  updates: CoinbaseOrderBookUpdate[]
): Pick<OrderBookData, 'bids' | 'asks'> {
  const bids = updates
    .filter((update) => update.side === ORDER_BOOK_SIDES.BID)
    .map((update) => ({
      price: update.price_level,
      size: update.new_quantity,
      exchange: update.exchange || 'Coinbase'
    }));

  const asks = updates
    .filter((update) => update.side === ORDER_BOOK_SIDES.OFFER)
    .map((update) => ({
      price: update.price_level,
      size: update.new_quantity,
      exchange: update.exchange || 'Coinbase'
    }));

  return {
    bids: sortOrderBookEntries(bids, ORDER_BOOK_SIDES.BID).slice(
      0,
      WEBSOCKET_CONFIG.ORDER_BOOK_DEPTH
    ),
    asks: sortOrderBookEntries(asks, ORDER_BOOK_SIDES.OFFER).slice(
      0,
      WEBSOCKET_CONFIG.ORDER_BOOK_DEPTH
    )
  };
}

// Calculates mid price from order book
// @param orderBook - Order book data
// @returns Mid price or null if unable to calculate

export function calculateMidPrice(orderBook: OrderBookData): number | null {
  if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
    return null;
  }

  const bestBid = parseFloat(orderBook.bids[0].price);
  const bestAsk = parseFloat(orderBook.asks[0].price);

  return (bestBid + bestAsk) / 2;
}

// Extracts quote currency from product ID
// @param productId - Product ID (e.g., 'BTC-USD')
// @returns Quote currency

export function getQuoteCurrency(productId: string): string {
  const parts = productId.split('-');
  return parts[1] || 'USD';
}

// Formats price value for display
// @param price - Price as string
// @param quoteCurrency - Quote currency
// @returns Formatted price string

export function formatPrice(price: string, quoteCurrency: string): string {
  const num = parseFloat(price);

  if (quoteCurrency === 'USD') {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }

  return `${num.toFixed(2)} ${quoteCurrency}`;
}

// Formats size value for display
// @param size - Size as string
// @returns Formatted size string

export function formatSize(size: string): string {
  const num = parseFloat(size);
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8
  }).format(num);
}

// Calculates and formats total value
// @param price - Price as string
// @param size - Size as string
// @param quoteCurrency - Quote currency
// @returns Formatted total string

export function calculateTotal(
  price: string,
  size: string,
  quoteCurrency: string
): string {
  const total = parseFloat(price) * parseFloat(size);

  if (quoteCurrency === 'USD') {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(total);
  }

  return `${total.toFixed(2)} ${quoteCurrency}`;
}
