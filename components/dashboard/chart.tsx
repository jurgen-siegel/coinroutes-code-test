'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import { useTheme } from 'next-themes';

import { useProductSelection } from '../../hooks/use-crypto-pair-selection';
import { useWebSocket } from '../../hooks/use-websocket-provider';
import {
  AvailableSaveloadVersions,
  ChartingLibraryFeatureset,
  ChartingLibraryWidgetOptions,
  IChartingLibraryWidget,
  ResolutionString,
  ThemeName,
  widget
} from './tradingview/charting_library';
import { createCoinbaseDatafeed } from './tradingview/datafeed';

// Extend window interface to include TradingView types
declare global {
  interface Window {
    Datafeeds: {
      UDFCompatibleDatafeed: new (url: string) => any;
    };
  }
}

interface ChartContainerProps {
  symbol?: string;
  interval?: ResolutionString;
  containerId?: string;
  libraryPath?: string;
  chartsStorageUrl?: string;
  chartsStorageApiVersion?: AvailableSaveloadVersions;
  clientId?: string;
  userId?: string;
  fullscreen?: boolean;
  autosize?: boolean;
  studiesOverrides?: Record<string, string>;
}

export interface TradingViewChartRef {
  refreshTheme: () => void;
  resize: () => void;
}

const defaultStudiesOverrides = {};

export const TradingViewChart = forwardRef<
  TradingViewChartRef,
  Omit<ChartContainerProps, 'symbol'>
>(
  (
    {
      interval = '1' as ResolutionString,
      containerId = 'tv_chart_container',
      libraryPath = '/charting_library/',
      chartsStorageUrl = 'https://saveload.tradingview.com',
      chartsStorageApiVersion = '1.1' as AvailableSaveloadVersions,
      clientId = 'tradingview.com',
      userId = 'public_user',
      fullscreen = false,
      autosize = true,
      studiesOverrides = defaultStudiesOverrides
    }: Omit<ChartContainerProps, 'symbol'>,
    ref
  ) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartingLibraryWidget | null>(null);
    const componentIdRef = useRef(`chart-${Date.now()}`);
    const webSocketProvider = useWebSocket();
    const { selectedProduct } = useProductSelection();
    const { theme, resolvedTheme } = useTheme();
    const [isChartReady, setIsChartReady] = useState(false);
    const datafeedRef = useRef<ReturnType<
      typeof createCoinbaseDatafeed
    > | null>(null);
    const isInitializedRef = useRef(false);
    const currentSymbolRef = useRef<string>(selectedProduct);
    const currentThemeRef = useRef<string>(resolvedTheme || 'light');

    // Determine the chart theme based on the current theme
    const chartTheme = useMemo(() => {
      return resolvedTheme === 'dark' ? 'dark' : 'light';
    }, [resolvedTheme]);

    // Expose methods to parent components
    useImperativeHandle(
      ref,
      () => ({
        refreshTheme: () => {
          if (
            isChartReady &&
            chartRef.current &&
            typeof chartRef.current.changeTheme === 'function'
          ) {
            console.log('Refreshing chart theme to:', chartTheme);
            chartRef.current.changeTheme(chartTheme as ThemeName);
            currentThemeRef.current = chartTheme;
          }
        },
        resize: () => {
          if (isChartReady && chartRef.current) {
            console.log('Resizing chart after DOM manipulation');
            // Small delay to ensure DOM is settled
            setTimeout(() => {
              // TradingView widgets automatically resize with autosize: true
              // We can trigger a window resize event to force the chart to recalculate
              window.dispatchEvent(new Event('resize'));
            }, 100);
          }
        }
      }),
      [isChartReady, chartTheme]
    );

    // Initialize chart only once
    useEffect(() => {
      // Prevent multiple initializations
      if (isInitializedRef.current || !chartContainerRef.current) {
        return;
      }

      isInitializedRef.current = true;

      const initChart = async () => {
        try {
          // Create datafeed once
          if (!datafeedRef.current) {
            datafeedRef.current = createCoinbaseDatafeed(webSocketProvider);
          }

          const widgetOptions: ChartingLibraryWidgetOptions = {
            symbol: selectedProduct,
            datafeed: datafeedRef.current,
            interval: interval,
            container: containerId,
            library_path: libraryPath,
            locale: 'en' as any,
            disabled_features: [
              'use_localstorage_for_settings',
              'save_chart_properties_to_local_storage',
              'chart_property_page_style',
              'chart_property_page_background'
            ] as ChartingLibraryFeatureset[],
            enabled_features: [
              'study_templates'
            ] as ChartingLibraryFeatureset[],
            charts_storage_url: chartsStorageUrl,
            charts_storage_api_version: chartsStorageApiVersion,
            client_id: clientId,
            user_id: userId,
            fullscreen: fullscreen,
            autosize: autosize,
            studies_overrides: studiesOverrides,
            theme: chartTheme as ThemeName,
            // Force the interval more explicitly
            time_frames: [
              { text: '1m', resolution: '1' as ResolutionString },
              { text: '5m', resolution: '5' as ResolutionString },
              { text: '15m', resolution: '15' as ResolutionString },
              { text: '1h', resolution: '60' as ResolutionString },
              { text: '4h', resolution: '240' as ResolutionString },
              { text: '1d', resolution: '1D' as ResolutionString }
            ]
          };

          const tvWidget = new widget(widgetOptions);
          chartRef.current = tvWidget;

          // Wait for the chart to be ready
          tvWidget.onChartReady(() => {
            // Initialize the current symbol reference
            currentSymbolRef.current = selectedProduct;
            currentThemeRef.current = chartTheme;

            // Explicitly set the interval to ensure 1m is used
            tvWidget.chart().setResolution(interval, () => {
              console.log(`Chart resolution set to ${interval}`);
            });

            setIsChartReady(true);
          });
        } catch (error) {
          console.error('Failed to initialize chart:', error);
          isInitializedRef.current = false; // Allow retry on error
        }
      };

      initChart();

      // Cleanup only when component unmounts
      return () => {
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }

        if (datafeedRef.current && 'cleanup' in datafeedRef.current) {
          datafeedRef.current.cleanup();
          datafeedRef.current = null;
        }

        setIsChartReady(false);
        isInitializedRef.current = false;
      };
    }, []); // Empty dependency array - truly run only once

    // Effect to handle symbol changes from navbar
    useEffect(() => {
      if (
        !isChartReady ||
        !chartRef.current ||
        currentSymbolRef.current === selectedProduct
      ) {
        return;
      }

      // Use TradingView's setSymbol method to change symbol without re-initializing
      chartRef.current.setSymbol(selectedProduct, interval, () => {
        currentSymbolRef.current = selectedProduct;
      });
    }, [selectedProduct, isChartReady]);

    // Effect to handle theme changes
    useEffect(() => {
      if (
        !isChartReady ||
        !chartRef.current ||
        currentThemeRef.current === chartTheme
      ) {
        return;
      }

      // Use TradingView's changeTheme method to update the theme
      if (typeof chartRef.current.changeTheme === 'function') {
        chartRef.current.changeTheme(chartTheme as ThemeName);
        currentThemeRef.current = chartTheme;
      }
    }, [chartTheme, isChartReady]);

    return (
      <div
        id={containerId}
        ref={chartContainerRef}
        className="size-full"
      />
    );
  }
);

TradingViewChart.displayName = 'TradingViewChart';
