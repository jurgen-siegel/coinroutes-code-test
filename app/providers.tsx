'use client';

import * as React from 'react';
import { ThemeProvider } from 'next-themes';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { TooltipProvider } from '@/components/ui/tooltip';
import { AggregationProvider } from '@/hooks/use-aggregation';
import { ProductSelectionProvider } from '@/hooks/use-crypto-pair-selection';
import { WebSocketProvider } from '@/hooks/use-websocket-provider';

export function Providers({
  children
}: React.PropsWithChildren): React.JSX.Element {
  return (
    <NuqsAdapter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <WebSocketProvider>
            <ProductSelectionProvider>
              <AggregationProvider>{children}</AggregationProvider>
            </ProductSelectionProvider>
          </WebSocketProvider>
        </TooltipProvider>
      </ThemeProvider>
    </NuqsAdapter>
  );
}
