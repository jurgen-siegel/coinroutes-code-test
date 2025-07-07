import {
  Bar,
  DatafeedConfiguration,
  HistoryCallback,
  IExternalDatafeed,
  LibrarySymbolInfo,
  OnReadyCallback,
  PeriodParams,
  ResolutionString,
  ResolveCallback,
  SearchSymbolsCallback,
  SubscribeBarsCallback
} from './charting_library';

// ==================== TYPES ====================

/**
 * WebSocket provider interface for real-time data
 */
interface WebSocketProvider {
  onPriceUpdate: (callback: PriceUpdateCallback) => void;
  offPriceUpdate: (callback: PriceUpdateCallback) => void;
  subscribeToProduct: (symbol: string) => void;
  unsubscribeFromProduct: (symbol: string) => void;
}

/**
 * Price update callback type
 */
type PriceUpdateCallback = (symbol: string, price: number) => void;

/**
 * Trading symbol information
 */
interface TradingSymbol {
  readonly symbol: string;
  readonly name: string;
  readonly description: string;
}

/**
 * Subscription handler for chart updates
 */
interface SubscriptionHandler {
  readonly id: string;
  readonly callback: SubscribeBarsCallback;
  readonly symbol: string;
  readonly resolution: ResolutionString;
}

/**
 * Active subscription item
 */
interface SubscriptionItem {
  readonly subscriberUID: string;
  readonly resolution: ResolutionString;
  lastBar?: Bar;
  readonly handlers: SubscriptionHandler[];
}

/**
 * Coinbase API candle data format
 */
type CoinbaseCandleData = [number, number, number, number, number, number];

// ==================== CONSTANTS ====================

/**
 * Time intervals in seconds for different resolutions
 */
const RESOLUTION_INTERVALS = {
  '1': 60,
  '5': 300,
  '15': 900
} as const;

/**
 * Default resolution fallback
 */
const DEFAULT_RESOLUTION_INTERVAL = 60;

/**
 * Coinbase API configuration
 */
const COINBASE_CONFIG = {
  BASE_URL: 'https://api.exchange.coinbase.com',
  EXCHANGE_NAME: 'Coinbase',
  EXCHANGE_DESCRIPTION: 'Coinbase Advanced Trade',
  PRICE_SCALE: 100,
  MIN_MOVE: 1,
  VOLUME_PRECISION: 2
} as const;

/**
 * Chart configuration
 */
const CHART_CONFIG = {
  SESSION: '24x7',
  TIMEZONE: 'Etc/UTC',
  SYMBOL_TYPE: 'crypto',
  DATA_STATUS: 'streaming',
  FORMAT: 'price'
} as const;

// ==================== CONFIGURATION ====================

/**
 * Datafeed configuration for TradingView
 */
const configurationData: DatafeedConfiguration = {
  supported_resolutions: ['1', '5', '15'] as ResolutionString[],
  exchanges: [
    {
      value: COINBASE_CONFIG.EXCHANGE_NAME,
      name: COINBASE_CONFIG.EXCHANGE_NAME,
      desc: COINBASE_CONFIG.EXCHANGE_DESCRIPTION
    }
  ],
  symbols_types: [
    {
      name: CHART_CONFIG.SYMBOL_TYPE,
      value: CHART_CONFIG.SYMBOL_TYPE
    }
  ]
};

/**
 * Available trading symbols matching the navbar selector
 */
const AVAILABLE_SYMBOLS: readonly TradingSymbol[] = [
  { symbol: 'BTC-USD', name: 'Bitcoin', description: 'Bitcoin to USD' },
  { symbol: 'ETH-USD', name: 'Ethereum', description: 'Ethereum to USD' },
  { symbol: 'LTC-USD', name: 'Litecoin', description: 'Litecoin to USD' },
  {
    symbol: 'BCH-USD',
    name: 'Bitcoin Cash',
    description: 'Bitcoin Cash to USD'
  }
] as const;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Converts TradingView resolution to Coinbase granularity in seconds
 * @param resolution - TradingView resolution string
 * @returns Granularity in seconds
 */
function getIntervalInSeconds(resolution: ResolutionString): number {
  return (
    RESOLUTION_INTERVALS[resolution as keyof typeof RESOLUTION_INTERVALS] ??
    DEFAULT_RESOLUTION_INTERVAL
  );
}

/**
 * Validates if a symbol is supported
 * @param symbol - Symbol to validate
 * @returns True if symbol is supported
 */
function isValidSymbol(symbol: string): boolean {
  return AVAILABLE_SYMBOLS.some((s) => s.symbol === symbol);
}

/**
 * Converts Coinbase candle data to TradingView bar format
 * @param candle - Coinbase candle data array
 * @returns TradingView bar object
 */
function convertCandleToBar(candle: CoinbaseCandleData): Bar {
  const [timestamp, low, high, open, close, volume] = candle;

  return {
    time: timestamp * 1000, // Convert seconds to milliseconds
    low,
    high,
    open,
    close,
    volume
  };
}

/**
 * Creates or updates a bar from price data
 * @param price - Current price
 * @param time - Bar timestamp
 * @param lastBar - Previous bar for updates
 * @returns New or updated bar
 */
function createBarFromPrice(price: number, time: number, lastBar?: Bar): Bar {
  if (lastBar) {
    return {
      time: lastBar.time,
      open: lastBar.open,
      high: Math.max(lastBar.high, price),
      low: Math.min(lastBar.low, price),
      close: price,
      volume: (lastBar.volume || 0) + 1
    };
  }

  return {
    time,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 1
  };
}

/**
 * Builds Coinbase API URL for historical data
 * @param symbol - Trading symbol
 * @param granularity - Time granularity in seconds
 * @param from - Start timestamp
 * @param to - End timestamp
 * @returns API URL string
 */
function buildCoinbaseUrl(
  symbol: string,
  granularity: number,
  from: number,
  to: number
): string {
  const startDate = new Date(from * 1000).toISOString();
  const endDate = new Date(to * 1000).toISOString();

  return `${COINBASE_CONFIG.BASE_URL}/products/${symbol}/candles?start=${startDate}&end=${endDate}&granularity=${granularity}`;
}

// ==================== API FUNCTIONS ====================

/**
 * Fetches historical data from Coinbase REST API
 * @param symbol - Trading symbol (e.g., 'BTC-USD')
 * @param resolution - Chart resolution
 * @param from - Start timestamp in seconds
 * @param to - End timestamp in seconds
 * @returns Promise resolving to array of bars
 * @throws Error if API request fails or data is invalid
 */
async function getHistoricalData(
  symbol: string,
  resolution: ResolutionString,
  from: number,
  to: number
): Promise<Bar[]> {
  if (!isValidSymbol(symbol)) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }

  if (from >= to) {
    throw new Error('Invalid time range: start time must be before end time');
  }

  try {
    const granularity = getIntervalInSeconds(resolution);
    const url = buildCoinbaseUrl(symbol, granularity, from, to);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Coinbase API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        'Invalid response format from Coinbase API: expected array'
      );
    }

    // Convert and validate candle data
    const bars: Bar[] = data
      .filter(
        (candle): candle is CoinbaseCandleData =>
          Array.isArray(candle) &&
          candle.length === 6 &&
          candle.every((val) => typeof val === 'number')
      )
      .map(convertCandleToBar);

    // Sort by time in ascending order
    bars.sort((a, b) => a.time - b.time);

    return bars;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching historical data:', errorMessage);

    // Return empty array for graceful degradation
    return [];
  }
}

// ==================== MAIN DATAFEED CLASS ====================

/**
 * Enterprise-grade Coinbase datafeed implementation for TradingView
 * Provides real-time and historical cryptocurrency data from Coinbase Exchange
 */
export class CoinbaseDatafeed implements IExternalDatafeed {
  private readonly webSocketProvider: WebSocketProvider | null;
  private readonly priceUpdateCallback: PriceUpdateCallback;
  private readonly lastBarsCache = new Map<string, Bar>();
  private readonly channelToSubscription = new Map<string, SubscriptionItem>();

  /**
   * Creates a new Coinbase datafeed instance
   * @param webSocketProvider - WebSocket provider for real-time updates (optional)
   */
  constructor(webSocketProvider: WebSocketProvider | null = null) {
    this.webSocketProvider = webSocketProvider;
    this.priceUpdateCallback = this.handlePriceUpdate.bind(this);

    this.initializeWebSocketProvider();
  }

  /**
   * Initializes WebSocket provider for real-time data
   * @private
   */
  private initializeWebSocketProvider(): void {
    if (this.webSocketProvider?.onPriceUpdate) {
      this.webSocketProvider.onPriceUpdate(this.priceUpdateCallback);
    }
  }

  /**
   * Handles price updates from WebSocket
   * @private
   */
  private handlePriceUpdate(symbol: string, price: number): void {
    if (typeof price !== 'number' || price <= 0) {
      console.warn(`Invalid price update for ${symbol}: ${price}`);
      return;
    }

    this.updatePrice(symbol, price);
  }

  /**
   * Provides datafeed configuration to TradingView
   * @param callback - Configuration callback
   */
  onReady(callback: OnReadyCallback): void {
    setTimeout(() => callback(configurationData), 0);
  }

  /**
   * Searches for symbols based on user input
   * @param userInput - User search input
   * @param exchange - Exchange filter
   * @param symbolType - Symbol type filter
   * @param callback - Search results callback
   */
  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    callback: SearchSymbolsCallback
  ): void {
    const normalizedInput = userInput.toLowerCase().trim();

    if (!normalizedInput) {
      setTimeout(() => callback([]), 0);
      return;
    }

    const symbols = AVAILABLE_SYMBOLS.filter((symbol) => {
      const matchesInput =
        symbol.symbol.toLowerCase().includes(normalizedInput) ||
        symbol.name.toLowerCase().includes(normalizedInput);
      const matchesExchange =
        !exchange || exchange === COINBASE_CONFIG.EXCHANGE_NAME;
      const matchesType =
        !symbolType || symbolType === CHART_CONFIG.SYMBOL_TYPE;

      return matchesInput && matchesExchange && matchesType;
    }).map((symbol) => ({
      symbol: symbol.symbol,
      full_name: symbol.symbol,
      description: symbol.description,
      exchange: COINBASE_CONFIG.EXCHANGE_NAME,
      ticker: symbol.symbol,
      type: CHART_CONFIG.SYMBOL_TYPE
    }));

    setTimeout(() => callback(symbols), 0);
  }

  /**
   * Resolves symbol information for chart display
   * @param symbolName - Symbol to resolve
   * @param callback - Success callback
   * @param errorCallback - Error callback
   */
  resolveSymbol(
    symbolName: string,
    callback: ResolveCallback,
    errorCallback: (reason: string) => void
  ): void {
    const symbolInfo = AVAILABLE_SYMBOLS.find((s) => s.symbol === symbolName);

    if (!symbolInfo) {
      setTimeout(() => errorCallback(`Symbol not found: ${symbolName}`), 0);
      return;
    }

    const librarySymbolInfo: LibrarySymbolInfo = {
      ticker: symbolInfo.symbol,
      name: symbolInfo.name,
      description: symbolInfo.description,
      type: CHART_CONFIG.SYMBOL_TYPE,
      session: CHART_CONFIG.SESSION,
      timezone: CHART_CONFIG.TIMEZONE,
      exchange: COINBASE_CONFIG.EXCHANGE_NAME,
      minmov: COINBASE_CONFIG.MIN_MOVE,
      pricescale: COINBASE_CONFIG.PRICE_SCALE,
      has_intraday: true,
      has_weekly_and_monthly: false,
      supported_resolutions: configurationData.supported_resolutions!,
      volume_precision: COINBASE_CONFIG.VOLUME_PRECISION,
      data_status: CHART_CONFIG.DATA_STATUS,
      listed_exchange: COINBASE_CONFIG.EXCHANGE_NAME,
      format: CHART_CONFIG.FORMAT
    };

    setTimeout(() => callback(librarySymbolInfo), 0);
  }

  /**
   * Fetches historical bars for chart display
   * @param symbolInfo - Symbol information
   * @param resolution - Chart resolution
   * @param periodParams - Time period parameters
   * @param callback - Success callback
   * @param errorCallback - Error callback
   */
  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    callback: HistoryCallback,
    errorCallback: (error: string) => void
  ): void {
    const { from, to, firstDataRequest } = periodParams;
    const symbol = symbolInfo.ticker!;

    getHistoricalData(symbol, resolution, from, to)
      .then((bars) => {
        if (firstDataRequest && bars.length > 0) {
          this.lastBarsCache.set(symbol, bars[bars.length - 1]);
        }

        callback(bars, { noData: bars.length === 0 });
      })
      .catch((error) => {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('getBars error:', errorMessage);
        errorCallback(errorMessage);
      });
  }

  /**
   * Subscribes to real-time bar updates
   * @param symbolInfo - Symbol information
   * @param resolution - Chart resolution
   * @param callback - Update callback
   * @param subscriberUID - Unique subscriber identifier
   * @param resetCacheNeededCallback - Cache reset callback (optional)
   */
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    callback: SubscribeBarsCallback,
    subscriberUID: string,
    resetCacheNeededCallback?: () => void
  ): void {
    const symbol = symbolInfo.ticker!;

    const handler: SubscriptionHandler = {
      id: subscriberUID,
      callback,
      symbol,
      resolution
    };

    let subscriptionItem = this.channelToSubscription.get(symbol);

    if (subscriptionItem) {
      subscriptionItem.handlers.push(handler);
      return;
    }

    subscriptionItem = {
      subscriberUID,
      resolution,
      lastBar: this.lastBarsCache.get(symbol),
      handlers: [handler]
    };

    this.channelToSubscription.set(symbol, subscriptionItem);

    // Subscribe to WebSocket updates
    if (this.webSocketProvider?.subscribeToProduct) {
      this.webSocketProvider.subscribeToProduct(symbol);
    }
  }

  /**
   * Unsubscribes from real-time bar updates
   * @param subscriberUID - Subscriber identifier to remove
   */
  unsubscribeBars(subscriberUID: string): void {
    for (const [
      symbol,
      subscriptionItem
    ] of this.channelToSubscription.entries()) {
      const handlerIndex = subscriptionItem.handlers.findIndex(
        (handler) => handler.id === subscriberUID
      );

      if (handlerIndex !== -1) {
        subscriptionItem.handlers.splice(handlerIndex, 1);

        if (subscriptionItem.handlers.length === 0) {
          // Unsubscribe from WebSocket when no handlers remain
          if (this.webSocketProvider?.unsubscribeFromProduct) {
            this.webSocketProvider.unsubscribeFromProduct(symbol);
          }
          this.channelToSubscription.delete(symbol);
        }
        break;
      }
    }
  }

  /**
   * Updates chart with real-time price data
   * @param symbol - Trading symbol
   * @param price - Current price
   * @private
   */
  private updatePrice(symbol: string, price: number): void {
    const subscriptionItem = this.channelToSubscription.get(symbol);
    if (!subscriptionItem) return;

    const now = Date.now();
    const intervalMs = getIntervalInSeconds(subscriptionItem.resolution) * 1000;
    const barTime = Math.floor(now / intervalMs) * intervalMs;

    let bar: Bar;
    const lastBar = subscriptionItem.lastBar;

    if (lastBar && barTime <= lastBar.time) {
      // Update existing bar
      bar = createBarFromPrice(price, lastBar.time, lastBar);
    } else {
      // Create new bar
      bar = createBarFromPrice(price, barTime);
    }

    subscriptionItem.lastBar = bar;
    this.lastBarsCache.set(symbol, bar);

    // Notify all handlers
    subscriptionItem.handlers.forEach((handler) => {
      try {
        handler.callback(bar);
      } catch (error) {
        console.error(`Error in subscription handler for ${symbol}:`, error);
      }
    });
  }

  /**
   * Cleans up resources and unregisters from WebSocket updates
   */
  cleanup(): void {
    if (this.webSocketProvider?.offPriceUpdate) {
      this.webSocketProvider.offPriceUpdate(this.priceUpdateCallback);
    }

    this.channelToSubscription.clear();
    this.lastBarsCache.clear();
  }
}

// ==================== FACTORY FUNCTION ====================

/**
 * Creates a new Coinbase datafeed instance
 * @param webSocketProvider - WebSocket provider for real-time data (optional)
 * @returns Configured CoinbaseDatafeed instance
 */
export function createCoinbaseDatafeed(
  webSocketProvider?: WebSocketProvider
): CoinbaseDatafeed {
  return new CoinbaseDatafeed(webSocketProvider || null);
}
