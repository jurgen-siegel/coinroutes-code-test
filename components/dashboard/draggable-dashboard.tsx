'use client';

import { useEffect, useRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';
import { createSwapy } from 'swapy';

import { TradingViewChart, TradingViewChartRef } from './chart';
import { OrderBook } from './orderbook';
import { OrderBookChart } from './price-chart';

export function DraggableDashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const swapyRef = useRef<unknown>(null);
  const chartRef = useRef<TradingViewChartRef>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Computed values
  const isDesktop = windowWidth >= 1024;
  const needsBodyScrollLock = isDesktop;
  const needsSwapyInit =
    !isInitialized && containerRef.current && !swapyRef.current;

  // useEffect to handle all dashboard logic
  useEffect(() => {
    const updateWindowWidth = () => {
      setWindowWidth(window.innerWidth);
    };

    const initializeSwapy = () => {
      if (!containerRef.current || swapyRef.current) return;

      swapyRef.current = createSwapy(containerRef.current, {
        animation: 'dynamic'
      });

      // Handle drag events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (swapyRef.current as any).onSwapStart?.(() => {
        setIsDragging(true);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (swapyRef.current as any).onSwap((_event: unknown) => {
        // Widget swap handled
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (swapyRef.current as any).onSwapEnd((_event: unknown) => {
        setIsDragging(false);

        // Refresh chart theme and resize after drag operation
        requestAnimationFrame(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (swapyRef.current as any)?.update();

          // Fix chart theme and sizing after DOM manipulation
          setTimeout(() => {
            if (chartRef.current) {
              chartRef.current.refreshTheme();
              chartRef.current.resize();
            }
          }, 200);
        });
      });

      setIsInitialized(true);
    };

    // Initialize window width
    if (windowWidth === 0) {
      updateWindowWidth();
    }

    // Set up resize listener
    window.addEventListener('resize', updateWindowWidth);

    // Manage body scroll lock
    if (needsBodyScrollLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    // Initialize Swapy with small delay for DOM readiness
    if (needsSwapyInit) {
      const timer = setTimeout(() => {
        initializeSwapy();
      }, 100);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateWindowWidth);
        document.body.style.overflow = 'auto';
      };
    }

    // Cleanup function
    return () => {
      window.removeEventListener('resize', updateWindowWidth);
      document.body.style.overflow = 'auto';
      if (swapyRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (swapyRef.current as any).destroy?.();
        swapyRef.current = null;
      }
      setIsInitialized(false);
    };
  }, [windowWidth, needsBodyScrollLock, needsSwapyInit]);

  return (
    <div
      ref={containerRef}
      className="dashboard-container grid grid-cols-1 grid-rows-[1.5fr_1fr_1fr] gap-4 p-4 lg:grid-cols-2 lg:grid-rows-2 lg:overflow-hidden"
      style={{
        height: isDesktop ? 'calc(100vh - 5rem)' : 'auto',
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    >
      <div
        data-swapy-slot="chart-slot"
        className="flex flex-col"
      >
        <div
          data-swapy-item="chart-item"
          className="flex h-full min-h-[300px] flex-col lg:min-h-0"
          style={{
            willChange: 'transform',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            perspective: '1000px'
          }}
        >
          <div className="flex h-full flex-col rounded-lg bg-white shadow-lg dark:bg-black">
            <div
              data-swapy-handle
              className="flex shrink-0 cursor-move select-none items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-black dark:hover:bg-gray-900"
            >
              <h2 className="text-sm font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300">
                Trading Chart
              </h2>
              <GripHorizontal className="size-4 text-gray-400 dark:text-gray-500" />
            </div>
            <div
              className="flex-1 overflow-hidden"
              style={{
                pointerEvents: isDragging ? 'none' : 'auto'
              }}
            >
              <TradingViewChart ref={chartRef} />
            </div>
          </div>
        </div>
      </div>

      <div
        data-swapy-slot="orderbook-slot"
        className="flex flex-col"
      >
        <div
          data-swapy-item="orderbook-item"
          className="flex h-full min-h-[300px] flex-col lg:min-h-0"
          style={{
            willChange: 'transform',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            perspective: '1000px'
          }}
        >
          <div className="flex h-full flex-col rounded-lg bg-white shadow-lg dark:bg-black">
            <div
              data-swapy-handle
              className="flex shrink-0 cursor-move select-none items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-black dark:hover:bg-gray-900"
            >
              <h2 className="text-sm font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300">
                Order Book
              </h2>
              <GripHorizontal className="size-4 text-gray-400 dark:text-gray-500" />
            </div>
            <div
              className="flex-1 overflow-hidden"
              style={{
                pointerEvents: isDragging ? 'none' : 'auto'
              }}
            >
              <OrderBook />
            </div>
          </div>
        </div>
      </div>

      <div
        data-swapy-slot="price-chart-slot"
        className="flex flex-col lg:col-span-2"
      >
        <div
          data-swapy-item="price-chart-item"
          className="flex h-full min-h-[300px] flex-col lg:min-h-0"
          style={{
            willChange: 'transform',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            perspective: '1000px'
          }}
        >
          <div className="flex h-full flex-col rounded-lg bg-white shadow-lg dark:bg-black">
            <div
              data-swapy-handle
              className="flex shrink-0 cursor-move select-none items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-black dark:hover:bg-gray-900"
            >
              <h2 className="text-sm font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300">
                Price Chart
              </h2>
              <GripHorizontal className="size-4 text-gray-400 dark:text-gray-500" />
            </div>
            <div
              className="flex-1 overflow-hidden"
              style={{
                pointerEvents: isDragging ? 'none' : 'auto'
              }}
            >
              <OrderBookChart />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
