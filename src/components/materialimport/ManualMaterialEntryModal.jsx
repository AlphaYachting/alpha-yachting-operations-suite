import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ManualMaterialEntryModal({ customers = [], entry = null, preselectedCustomerId = null, onClose, onSaved }) {
  const isEdit = !!entry;
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(() => {
    if (entry) return customers.find(c => c.id === entry.customer_id) || { id: entry.customer_id, last_name: entry.customer_id };
    if (preselectedCustomerId) return customers.find(c => c.id === preselectedCustomerId) || null;
    return null;
  });
  const [form, setForm] = useState({
    supplier_name: entry?.supplier_name || '',
    document_number: entry?.document_number || '',
    document_date: entry?.document_date || '',
    item_title: entry?.item_title || '',
    item_description: entry?.item_description || '',
    quantity: entry?.quantity != null ? String(entry.quantity) : '',
    unit: entry?.unit || '',
    unit_purchase_price: entry?.unit_purchase_price != null ? String(entry.unit_purchase_price) : '',
    total_purchase_price: entry?.total_purchase_price != null ? String(entry.total_purchase_price) : '',
    notes: entry?.notes || '',
  });


  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    if (!q || selectedCustomer) return false;
    return `${c.first_name || ''} ${c.last_name} ${c.company_name || ''}`.toLowerCase().includes(q);
  }).slice(0, 6);

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!selectedCustomer) return toast.error('Please select a customer');
    if (!form.item_title) return toast.error('Item title is required');
    setSaving(true);
    const payload = {
      customer_id: selectedCustomer.id,
      source_type: isEdit ? entry.source_type : 'manual',
      supplier_name: form.supplier_name,
      document_number: form.document_number,
      document_date: form.document_date || null,
      item_title: form.item_title,
      item_description: form.item_description,
      quantity: form.quantity !== '' ? Number(form.quantity) : null,
      unit: form.unit,
      unit_purchase_price: form.unit_purchase_price !== '' ? Number(form.unit_purchase_price) : null,
      total_purchase_price: form.total_purchase_price !== '' ? Number(form.total_purchase_price) : null,
      notes: form.notes,
    };
    if (isEdit) {
      await base44.entities.CustomerMaterialEntry.update(entry.id, payload);
    } else {
      await base44.entities.CustomerMaterialEntry.create(payload);
    }
    setSaving(false);
    toast.success(isEdit ? 'Eintrag aktualisiert' : 'Eintrag gespeichert');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{isEdit ? 'Eintrag bearbeiten' : 'Manual Material Entry'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Customer */}
          <div className="space-y-2">
            <Label>Customer *</Label>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <span className="flex-1 text-sm font-medium text-green-800">
                  {selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name}`.trim()}
                </span>
                <button onClick={() => setSelectedCustomer(null)} className="text-green-600 hover:text-green-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search customer…"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
                {filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 divide-y divide-slate-100">
                    {filteredCustomers.map(c => (
                      <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}>
                        {c.company_name || `${c.first_name || ''} ${c.last_name}`.trim()} — {c.email}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Supplier info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Input value={form.supplier_name} onChange={e => update('supplier_name', e.target.value)} placeholder="Supplier name" />
            </div>
            <div className="space-y-1">
              <Label>Document No.</Label>
              <Input value={form.document_number} onChange={e => update('document_number', e.target.value)} placeholder="Invoice / DN #" />
            </div>
            <div className="space-y-1">
              <Label>Document Date</Label>
              <Input type="date" value={form.document_date} onChange={e => update('document_date', e.target.value)} />
            </div>
          </div>

          {/* Item */}
          <div className="space-y-1">
            <Label>Item Title *</Label>
            <Input value={form.item_title} onChange={e => update('item_title', e.target.value)} placeholder="Item name" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={2} value={form.item_description} onChange={e => update('item_description', e.target.value)} placeholder="Additional details" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Qty</Label>
              <Input type="number" value={form.quantity} onChange={e => update('quantity', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={e => update('unit', e.target.value)} placeholder="pcs" />
            </div>
            <div className="space-y-1">
              <Label>Unit Price</Label>
              <Input type="number" value={form.unit_purchase_price} onChange={e => update('unit_purchase_price', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Total</Label>
              <Input type="number" value={form.total_purchase_price} onChange={e => update('total_purchase_price', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Internal notes" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
           {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
           {isEdit ? 'Speichern' : 'Save Entry'}
          </Button>
        </div>
      </div>
    </div>
  );
}