import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, ChevronDown, Check, Loader2 } from 'lucide-react';

export default function StorageOfferPicker({ customerId, selectedOfferId, onApply }) {
  const [open, setOpen] = useState(false);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!customerId) { setOffers([]); return; }
    setLoading(true);
    base44.entities.Offer.filter({ customer_id: customerId }, '-created_date', 50)
      .then(setOffers)
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!customerId) return null;

  const selected = offers.find((o) => o.id === selectedOfferId);

  const handleSelect = async (offer) => {
    setOpen(false);
    setApplying(true);
    try {
      const tasks = await base44.entities.OfferTask.filter({ offer_id: offer.id }, 'sequence_order');
      onApply(offer, tasks);
    } catch (_e) {
      onApply(offer, []);
    }
    setApplying(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {applying ? 'Übernehme Angebotsdaten…' : selected ? `${selected.offer_number || ''} · ${selected.title}` : 'Bestehendes Angebot übernehmen (optional)'}
        </span>
        {applying ? <Loader2 className="h-4 w-4 animate-spin opacity-50" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="max-h-52 overflow-y-auto p-1">
            {loading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Lade Angebote…</div>
            ) : offers.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Keine Angebote für diesen Kunden.</div>
            ) : offers.map((o) => (
              <div
                key={o.id}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${selectedOfferId === o.id ? 'bg-accent' : ''}`}
                onClick={() => handleSelect(o)}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{o.offer_number ? `${o.offer_number} · ` : ''}{o.title}</span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0 text-xs text-slate-500">
                  {o.total_amount != null && `${o.total_amount} €`}
                  {selectedOfferId === o.id && <Check className="h-4 w-4 text-blue-600" />}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}