'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { useProductSelection } from '@/hooks/use-crypto-pair-selection';
import { cn } from '@/lib/utils';

const TRADING_PAIRS = [
  { id: 'BTC-USD', name: 'BTC/USD', description: 'Bitcoin' },
  { id: 'ETH-USD', name: 'ETH/USD', description: 'Ethereum' },
  { id: 'LTC-USD', name: 'LTC/USD', description: 'Litecoin' },
  { id: 'BCH-USD', name: 'BCH/USD', description: 'Bitcoin Cash' }
] as const;

export function CryptoPairSelector() {
  const { selectedProduct, setSelectedProduct, isLoading } =
    useProductSelection();
  const [open, setOpen] = useState(false);

  const selectedPair = useMemo(
    () => TRADING_PAIRS.find((pair) => pair.id === selectedProduct),
    [selectedProduct]
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[160px] justify-between"
          disabled={isLoading}
        >
          {selectedPair ? selectedPair.name : 'Select pair'}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-0">
        <Command>
          <CommandInput placeholder="Search pairs..." />
          <CommandList>
            <CommandEmpty>No pairs found.</CommandEmpty>
            <CommandGroup>
              {TRADING_PAIRS.map((pair) => (
                <CommandItem
                  key={pair.id}
                  value={pair.id}
                  onSelect={(currentValue) => {
                    setSelectedProduct(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      selectedProduct === pair.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{pair.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {pair.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
