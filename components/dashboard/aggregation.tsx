'use client';

import * as React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useAggregation } from '@/hooks/use-aggregation';

const PRICE_INCREMENTS = [
  { label: '--', value: 0 },
  { label: '0.0005', value: 0.0005 },
  { label: '0.001', value: 0.001 },
  { label: '0.0025', value: 0.0025 },
  { label: '0.005', value: 0.005 }
];

export function Aggregation(): React.JSX.Element {
  const { priceIncrement, setPriceIncrement } = useAggregation();

  const handleIncrementChange = React.useCallback(
    (value: string) => {
      const increment = parseFloat(value);
      setPriceIncrement(increment);
    },
    [setPriceIncrement]
  );

  const getCurrentIncrementLabel = React.useCallback(() => {
    const currentIncrement = PRICE_INCREMENTS.find(
      (increment) => increment.value === priceIncrement
    );
    return currentIncrement?.label || priceIncrement.toString();
  }, [priceIncrement]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        <span className="text-sm text-muted-foreground">Aggregate</span>
      </div>
      <Select
        value={priceIncrement.toString()}
        onValueChange={handleIncrementChange}
      >
        <SelectTrigger className="h-8 w-20 text-xs">
          <SelectValue>{getCurrentIncrementLabel()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRICE_INCREMENTS.map((increment) => (
            <SelectItem
              key={increment.value}
              value={increment.value.toString()}
              className="text-xs"
            >
              {increment.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
