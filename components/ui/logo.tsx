import * as React from 'react';
import Image from 'next/image';

import { AppInfo } from '@/constants/app-info';
import { cn } from '@/lib/utils';

// The logo size below is 28px x 28px but in a 36px x 36px container.
// Because of the 8px difference the components <Sidebar /> and <Mobilesheet /> have a pl-0.5 (4px left padding) class applied.
// When you update the logo make sure to eventually adjust the pl-0.5 class in those two components.

export type LogoProps = React.HTMLAttributes<HTMLDivElement> & {
  hideSymbol?: boolean;
  hideWordmark?: boolean;
};

export function Logo({
  hideSymbol,
  hideWordmark,
  className,
  ...other
}: LogoProps): React.JSX.Element {
  return (
    <div
      className={cn('flex items-center space-x-2', className)}
      {...other}
    >
      {!hideSymbol && (
        <div className="flex size-9 items-center justify-center p-1">
          <div className="flex size-7 items-center justify-center rounded-md border overflow-hidden">
            <Image
              src="/favicon-32x32.png"
              alt={`${AppInfo.APP_NAME} Logo`}
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
        </div>
      )}
      {!hideWordmark && <span className="font-bold">{AppInfo.APP_NAME}</span>}
    </div>
  );
}
