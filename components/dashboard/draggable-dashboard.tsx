'use client';

import { useEffect, useRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';
import {
  createSwapy,
  type SwapEndEvent,
  type SwapStartEvent,
  type Swapy
} from 'swapy';

import { TradingViewChart, TradingViewChartRef } from './chart';
import { OrderBook } from './orderbook';
import { OrderBookChart } from './price-chart';

export function DraggableDashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const swapyRef = useRef<Swapy | null>(null);
  const chartRef = useRef<TradingViewChartRef>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

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

      try {
        swapyRef.current = createSwapy(containerRef.current, {
          animation: 'dynamic',
          enabled: true,
          swapMode: 'hover',
          dragOnHold: false,
          autoScrollOnDrag: true,
          dragAxis: 'both',
          manualSwap: false
        });

        // Handle drag start with proper typing
        swapyRef.current.onSwapStart((event: SwapStartEvent) => {
          setIsDragging(true);
          setDraggedItem(event.draggingItem);
        });

        // Handle swap with full event data
        swapyRef.current.onSwap(() => {
          // Widget swap handled
        });

        // Handle drag end with proper typing
        swapyRef.current.onSwapEnd((event: SwapEndEvent) => {
          setIsDragging(false);
          setDraggedItem(null);

          // Only refresh chart if layout actually changed
          if (event.hasChanged) {
            // Refresh chart theme and resize after drag operation
            requestAnimationFrame(() => {
              swapyRef.current?.update();

              // Fix chart theme and sizing after DOM manipulation
              setTimeout(() => {
                if (chartRef.current) {
                  chartRef.current.refreshTheme();
                  chartRef.current.resize();
                }
              }, 200);
            });
          }
        });

        // Optional?: Handle before swap for validation
        swapyRef.current.onBeforeSwap(() => {
          // can add logic here to prevent certain swaps
          return true; // Allow all swaps
        });

        setIsInitialized(true);
      } catch (error) {
        setIsInitialized(false);
        console.error('failed to init swapy', error);
      }
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
        try {
          swapyRef.current.destroy();
          swapyRef.current = null;
        } catch (error) {
          console.error('failed to remove swapy', error);
        }
      }
      setIsInitialized(false);
    };
  }, [windowWidth, needsBodyScrollLock, needsSwapyInit]);

  // Helper function to get drag status for specific widget
  const getWidgetDragStatus = (itemId: string) => ({
    isDragging: isDragging && draggedItem === itemId,
    isBeingDraggedOver: isDragging && draggedItem !== itemId
  });

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
      <DraggableWidget
        slotId="chart-slot"
        itemId="chart-item"
        title="Trading Chart"
        dragStatus={getWidgetDragStatus('chart-item')}
      >
        <TradingViewChart ref={chartRef} />
      </DraggableWidget>

      <DraggableWidget
        slotId="orderbook-slot"
        itemId="orderbook-item"
        title="Order Book"
        dragStatus={getWidgetDragStatus('orderbook-item')}
      >
        <OrderBook />
      </DraggableWidget>

      <DraggableWidget
        slotId="price-chart-slot"
        itemId="price-chart-item"
        title="Price Chart"
        dragStatus={getWidgetDragStatus('price-chart-item')}
        className="lg:col-span-2"
      >
        <OrderBookChart />
      </DraggableWidget>
    </div>
  );
}

// Extracted reusable widget component
interface DraggableWidgetProps {
  slotId: string;
  itemId: string;
  title: string;
  children: React.ReactNode;
  dragStatus: {
    isDragging: boolean;
    isBeingDraggedOver: boolean;
  };
  className?: string;
}

function DraggableWidget({
  slotId,
  itemId,
  title,
  children,
  dragStatus,
  className = ''
}: DraggableWidgetProps) {
  return (
    <div
      data-swapy-slot={slotId}
      className={`flex flex-col ${className}`}
    >
      <div
        data-swapy-item={itemId}
        className="flex h-full min-h-[300px] flex-col lg:min-h-0"
        style={{
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
          opacity: dragStatus.isDragging ? 0.8 : 1,
          transition: dragStatus.isDragging ? 'none' : 'opacity 0.2s ease'
        }}
      >
        <div className="flex h-full flex-col rounded-lg bg-white shadow-lg dark:bg-black">
          <div
            data-swapy-handle
            className="flex shrink-0 cursor-move select-none items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-black dark:hover:bg-gray-900"
          >
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300">
              {title}
            </h2>
            <GripHorizontal className="size-4 text-gray-400 dark:text-gray-500" />
          </div>
          <div
            className="flex-1 overflow-hidden"
            style={{
              pointerEvents: dragStatus.isDragging ? 'none' : 'auto'
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
