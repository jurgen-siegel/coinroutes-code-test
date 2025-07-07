'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { Aggregation } from '@/components/dashboard/aggregation';
import { ConnectionStatus } from '@/components/dashboard/connection-status';
import { CryptoPairSelector } from '@/components/dashboard/crypto-pair-select';
import { PriceDisplay } from '@/components/dashboard/price-display';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Routes } from '@/constants/routes';
import { cn } from '@/lib/utils';

export function DashboardMobileMenu({
  className,
  ...other
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  const [open, setOpen] = React.useState<boolean>(false);
  const [windowWidth, setWindowWidth] = React.useState<number>(0);

  // Computed values
  const isDesktop = windowWidth >= 768;
  const shouldCloseMenu = open && isDesktop;
  const needsBodyScrollLock = open;

  // useEffect to handle all mobile menu logic
  React.useEffect(() => {
    const updateWindowWidth = () => {
      setWindowWidth(window.innerWidth);
    };

    // Initialize window width
    if (windowWidth === 0) {
      updateWindowWidth();
    }

    // Set up media query listener
    const mediaQueryList = window.matchMedia('(min-width: 768px)');
    mediaQueryList.addEventListener('change', updateWindowWidth);

    // Close menu if switching to desktop
    if (shouldCloseMenu) {
      setOpen(false);
    }

    // Manage body scroll
    if (needsBodyScrollLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup
    return () => {
      mediaQueryList.removeEventListener('change', updateWindowWidth);
      document.body.style.overflow = '';
    };
  }, [windowWidth, shouldCloseMenu, needsBodyScrollLock]);

  const handleToggleMobileMenu = (): void => {
    setOpen((open) => !open);
  };

  return (
    <div className="relative md:hidden">
      <div
        className={cn('flex items-center justify-between', className)}
        {...other}
      >
        <Link href={Routes.Root}>
          <Logo />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={open}
          aria-label="Toggle Mobile Menu"
          onClick={handleToggleMobileMenu}
          className="flex aspect-square h-fit select-none flex-col items-center justify-center rounded-full"
        >
          <motion.div
            className="w-5 origin-center border-t-2 border-primary"
            initial={{ translateY: '-3px' }}
            animate={
              open
                ? { rotate: '45deg', translateY: '1px' }
                : { translateY: '-3px', rotate: '0deg' }
            }
            transition={{ bounce: 0, duration: 0.1 }}
          />
          <motion.div
            className="w-5 origin-center border-t-2 border-primary"
            transition={{ bounce: 0, duration: 0.1 }}
            initial={{ translateY: '3px' }}
            animate={
              open
                ? { rotate: '-45deg', translateY: '-1px' }
                : { translateY: '3px', rotate: '0deg', scaleX: 1 }
            }
          />
        </Button>
      </div>
      {open && <DashboardMobileMenuContent />}
    </div>
  );
}

function DashboardMobileMenuContent(): React.JSX.Element {
  return (
    <div className="fixed inset-x-0 bottom-0 top-[69px] z-50 overflow-y-auto bg-background animate-in fade-in-0">
      <div className="flex size-full flex-col items-start space-y-6 p-4">
        {/* Trading Pair Selection */}
        <div className="w-full space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Trading Pair
          </h3>
          <CryptoPairSelector />
        </div>

        {/* Price Display */}
        <div className="w-full space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Price</h3>
          <PriceDisplay />
        </div>

        {/* Aggregation */}
        <div className="w-full space-y-2">
          <Aggregation />
        </div>

        {/* Connection Status */}
        <div className="w-full space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Connection
          </h3>
          <ConnectionStatus />
        </div>

        {/* Theme Toggle */}
        <div className="flex w-full items-center justify-between border-t border-border/40 pt-4">
          <span className="text-sm font-medium">Theme</span>
          <ThemeToggle className="rounded-xl border-none shadow-none" />
        </div>
      </div>
    </div>
  );
}
