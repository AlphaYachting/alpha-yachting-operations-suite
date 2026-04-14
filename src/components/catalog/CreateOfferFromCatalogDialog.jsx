import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function CreateOfferFromCatalogDialog({ open, onOpenChange, selectedItems, getMfgName, onOfferCreated }) {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [boatId, setBoatId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      base44.entities.Customer.list('-created_date', 200),
      base44.entities.Boat.list(),
    ]).then(([c, b]) => { setCustomers(c); setBoats(b); });
    setTitle(''); setCustomerId(''); setBoatId(''); setCustomerSearch('');
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredCustomers = customers.filter(c => {
    const name = (c.company_name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
    return name.includes(customerSearch.toLowerCase());
  });

  const selectedCustomer = customers.find(c => c.id === customerId);
  const selectedCustomerName = selectedCustomer
    ? (selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim())
    : null;

  const availableBoats = boats.filter(b => b.customer_id === customerId);

  const handleCreate = async () => {
    if (!customerId) { toast.error('Please select a customer'); return; }
    if (!title.trim()) { toast.error('Please enter a title'); return; }

    setSaving(true);
    try {
      // Generate offer number
      const allOffers = await base44.entities.Offer.list('-created_date', 200);
      const existingNumbers = allOffers
        .map(o => o.offer_number)
        .filter(n => n && /^OFF-\d{4}-/.test(n))
        .map(n => parseInt(n.split('-')[2]) || 0);
      const year = new Date().getFullYear();
      const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      const offerNumber = `OFF-${year}-${String(maxNum + 1).padStart(4, '0')}`;

      // Create the offer
      const newOffer = await base44.entities.Offer.create({
        customer_id: customerId,
        boat_id: boatId || undefined,
        title: title.trim(),
        offer_number: offerNumber,
        status: 'Draft',
        language: 'German',
        vat_rate: 0,
      });

      // Bulk-create OfferTask line items from selected catalog items
      const lineItems = Object.values(selectedItems).map(({ item, qty }, idx) => ({
        offer_id: newOffer.id,
        sequence_order: idx,
        title: item.product_name,
        description: `${getMfgName(item.manufacturer_id)} | ${item.product_code}${item.external_category_code ? ` | ${item.external_category_code}` : ''}`,
        item_type: 'Material',
        unit_type: 'Piece',
        quantity: qty,
        unit_price: item.net_price ?? 0,
        total_amount: qty * (item.net_price ?? 0),
        is_optional: false,
        meta_json: {
          catalog_item_id: item.id,
          manufacturer_id: item.manufacturer_id,
          manufacturer_name: getMfgName(item.manufacturer_id),
          product_code: item.product_code,
          tax_rate: item.tax_rate,
          unit_net_price: item.net_price,
          unit_gross_price: item.gross_price,
          unit_purchase_price: item.purchase_price,
          currency: item.currency || 'EUR',
          imported_from_catalog: true,
          source_import_id: item.source_import_id,
        },
      }));

      await base44.entities.OfferTask.bulkCreate(lineItems);

      toast.success(`Offer ${offerNumber} created with ${lineItems.length} product(s)`);
      onOpenChange(false);
      if (onOfferCreated) onOfferCreated(newOffer.id);
      navigate(createPageUrl('OfferDetail') + `?id=${newOffer.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create offer');
    } finally {
      setSaving(false);
    }
  };

  const count = Object.keys(selectedItems).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-violet-600" />
            Create New Offer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 text-sm text-violet-700">
            <strong>{count}</strong> product{count !== 1 ? 's' : ''} will be added as line items
          </div>

          {/* Customer selector */}
          <div className="space-y-2" ref={dropdownRef}>
            <Label>Customer <span className="text-red-500">*</span></Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setCustomerDropdownOpen(v => !v); setCustomerSearch(''); }}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              >
                <span className={selectedCustomerName ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedCustomerName || 'Select customer...'}
                </span>
                <svg className="h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {customerDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      autoFocus
                      className="flex h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                      placeholder="Search customer..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {filteredCustomers.length === 0
                      ? <div className="py-6 text-center text-sm text-muted-foreground">No customer found.</div>
                      : filteredCustomers.map(c => (
                        <div
                          key={c.id}
                          className={`flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${customerId === c.id ? 'bg-accent' : ''}`}
                          onClick={() => { setCustomerId(c.id); setBoatId(''); setCustomerDropdownOpen(false); }}
                        >
                          {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Offer title */}
          <div className="space-y-2">
            <Label>Offer Title <span className="text-red-500">*</span></Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Victron Equipment Supply"
            />
          </div>

          {/* Boat (optional, filtered by customer) */}
          {availableBoats.length > 0 && (
            <div className="space-y-2">
              <Label>Boat <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Select value={boatId} onValueChange={setBoatId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select boat..." />
                </SelectTrigger>
                <SelectContent>
                  {availableBoats.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.vessel_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              onClick={handleCreate}
              disabled={saving || !customerId || !title.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {saving ? 'Creating...' : 'Create & Open Offer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}