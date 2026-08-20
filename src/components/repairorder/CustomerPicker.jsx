import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, UserPlus, ChevronDown, Check } from 'lucide-react';

export default function CustomerPicker({ customerId, customerName, onSelect, onClear }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    base44.entities.Customer.list('-created_date', 1000).then(setCustomers).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = (c) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return displayName(c).toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  }).slice(0, 50);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setSearch(''); }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
      >
        <span className={customerId ? 'text-foreground' : 'text-muted-foreground'}>
          {customerId ? (customerName || 'Bestehender Kunde') : 'Bestehenden Kunden wählen (optional)'}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              className="flex h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Kunde suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Kein Kunde gefunden.</div>
            ) : filtered.map((c) => (
              <div
                key={c.id}
                className={`flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${customerId === c.id ? 'bg-accent' : ''}`}
                onClick={() => { onSelect(c); setOpen(false); }}
              >
                <span>{displayName(c)}</span>
                {customerId === c.id && <Check className="h-4 w-4 text-blue-600" />}
              </div>
            ))}
          </div>
          <div
            className="flex cursor-pointer items-center gap-2 border-t px-3 py-2 text-sm text-blue-600 hover:bg-accent"
            onClick={() => { onClear(); setOpen(false); }}
          >
            <UserPlus className="h-4 w-4" /> Neuer Kunde (Daten manuell / per KI erfassen)
          </div>
        </div>
      )}
    </div>
  );
}