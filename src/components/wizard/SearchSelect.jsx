import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SearchSelect({
  placeholder = 'Search...',
  items = [],
  onSelect = () => {},
  displayFn = (item) => item.name,
  searchFn = (item, query) => item.name?.toLowerCase().includes(query.toLowerCase()),
  isLoading = false,
  noItemsMessage = 'No items found',
  selectedValue = null
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return items.slice(0, 50);
    return items.filter(item => searchFn(item, debouncedQuery)).slice(0, 50);
  }, [debouncedQuery, items, searchFn]);

  const selectedItem = useMemo(() => {
    return items.find(item => item.id === selectedValue);
  }, [selectedValue, items]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isLoading}
        >
          <span className="truncate">
            {selectedItem ? displayFn(selectedItem) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0" 
        align="start" 
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <div className="p-2 border-b">
          <Input
            placeholder={`${placeholder}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
            disabled={isLoading}
            autoFocus
          />
        </div>
        <Command>
          {isLoading ? (
            <div className="p-4 text-sm text-slate-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <CommandEmpty>{noItemsMessage}</CommandEmpty>
          ) : (
            <CommandGroup>
              {filtered.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={(currentValue) => {
                    onSelect(currentValue === selectedValue ? null : currentValue, item);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedValue === item.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="flex-1 truncate">{displayFn(item)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}