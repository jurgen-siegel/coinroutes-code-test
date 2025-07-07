'use client';

import * as React from 'react';
import Link from 'next/link';

import { Aggregation } from '@/components/dashboard/aggregation';
import { ConnectionStatus } from '@/components/dashboard/connection-status';
import { CryptoPairSelector } from '@/components/dashboard/crypto-pair-select';
import { PriceDisplay } from '@/components/dashboard/price-display';
import { Logo } from '@/components/ui/logo';
import { DashboardMobileMenu } from '@/components/ui/mobile-menu';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Routes } from '@/constants/routes';

export function Navbar(): React.JSX.Element {
  return (
    <section className="sticky inset-x-0 top-0 z-40 border-b bg-background py-4">
      <nav className="px-6">
        {/* Mobile Layout - Full width mobile menu */}
        <div className="md:hidden">
          <DashboardMobileMenu />
        </div>

        {/* Desktop Layout - Logo/nav on left, status/theme on right */}
        <div className="hidden items-center justify-between md:flex">
          <div className="flex items-center gap-x-9">
            <Link
              href={Routes.Root}
              className="flex items-center gap-2"
            >
              <Logo />
            </Link>
            <CryptoPairSelector />
            <Aggregation />
            <PriceDisplay />
          </div>

          <div className="flex items-center gap-4">
            <ConnectionStatus />
            <ThemeToggle className="rounded-xl border-none shadow-none" />
          </div>
        </div>
      </nav>
    </section>
  );
}
