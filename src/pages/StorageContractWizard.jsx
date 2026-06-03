import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, FileText, CheckCircle2, AlertCircle, Download, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { validateContractForPDF, generateStorageContractPDF, validateContractForPDF as validatePDF } from '@/components/storageContract/StorageContractPDFGenerator';
import { LEGAL_TEXT, validateLegalTextCompleteness } from '@/lib/storageContractLegalText';

const STEPS = [
  'Customer & Boat',
  'Storage Details',
  'Pricing',
  'Condition & Insurance',
  'Special Agreements',
  'Legal Review',
  'Generate PDF',
];

const LANG_OPTIONS = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'hr', label: 'Hrvatski' },
  { value: 'sl', label: 'Slovenščina' },
];

export default function StorageContractWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [contractId, setContractId] = useState(null);
  const [generatedContract, setGeneratedContract] = useState(null);

  const [form, setForm] = useState({
    // Step 1
    customer_id: '',
    boat_id: '',
    location_id: '',
    language: 'de',
    // Step 2
    storage_type: 'outdoor',
    storage_start_date: '',
    storage_end_date: '',
    storage_period_label: '',
    boat_length_m: '',
    boat_location_on_site: '',
    trailer_present: false,
    trailer_type: '',
    trailer_plate: '',
    trailer_dimensions: '',
    transport_included: false,
    transport_pickup_address: '',
    transport_distance_km: '',
    // Step 3
    price_storage_net: '',
    price_transport_net: '',
    price_services_net: '',
    price_total_net: '',
    vat_rate: 25,
    price_vat: '',
    price_total_gross: '',
    payment_terms: '',
    payment_due_date: '',
    // Step 4
    boat_condition_notes: '',
    existing_damage_notes: '',
    insurance_provider: '',
    insurance_policy_number: '',
    insurance_valid_until: '',
    insurance_coverage_amount: '',
    // Step 5
    special_agreements: '',
    signed_place: '',
    // Step 7
    signed_by_customer: '',
    signed_by_provider: '',
    signed_date: '',
  });

  // Service items for pricing table
  const [serviceItems, setServiceItems] = useState([
    { id: 1, title: '', quantity: 1, unit: 'pau', unit_price: '', total_price: '', category: 'STORAGE' },
  ]);

  // Data fetching
  const { data: customers } = useQuery({ queryKey: ['Customers'], queryFn: () => base44.entities.Customer.list() });
  const { data: boats } = useQuery({ queryKey: ['Boats'], queryFn: () => base44.entities.Boat.list() });
  const { data: locations } = useQuery({ queryKey: ['Locations'], queryFn: () => base44.entities.Location.list() });

  const selectedCustomer = customers?.find(c => c.id === form.customer_id);
  const customerBoats = boats?.filter(b => b.customer_id === form.customer_id) || [];
  const selectedBoat = boats?.find(b => b.id === form.boat_id);
  const selectedLocation = locations?.find(l => l.id === form.location_id);

  // Auto-fill boat length when boat selected
  useEffect(() => {
    if (selectedBoat?.length_m && !form.boat_length_m) {
      setForm(f => ({ ...f, boat_length_m: selectedBoat.length_m }));
    }
  }, [selectedBoat]);

  // Auto-calculate totals
  useEffect(() => {
    const totalNet = serviceItems.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);
    const vat = totalNet * ((parseFloat(form.vat_rate) || 25) / 100);
    const gross = totalNet + vat;
    setForm(f => ({
      ...f,
      price_total_net: totalNet.toFixed(2),
      price_vat: vat.toFixed(2),
      price_total_gross: gross.toFixed(2),
    }));
  }, [serviceItems, form.vat_rate]);

  const updateItem = (idx, field, value) => {
    setServiceItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Auto-calc total
      if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? value : updated[idx].quantity;
        const p = field === 'unit_price' ? value : updated[idx].unit_price;
        updated[idx].total_price = (parseFloat(q) || 0) * (parseFloat(p) || 0);
      }
      return updated;
    });
  };

  const addItem = () => {
    setServiceItems(prev => [...prev, { id: Date.now(), title: '', quantity: 1, unit: 'pau', unit_price: '', total_price: '', category: 'SERVICE' }]);
  };

  const removeItem = (idx) => {
    setServiceItems(prev => prev.filter((_, i) => i !== idx));
  };

  const T = LEGAL_TEXT[form.language];
  const missingLegal = validateLegalTextCompleteness(form.language);

  const handleNext = () => {
    if (step === 1) {
      if (!form.customer_id) { toast.error('Please select a customer'); return; }
      if (!form.boat_id) { toast.error('Please select a boat'); return; }
    }
    if (step === 2) {
      if (!form.storage_type) { toast.error('Storage type is required'); return; }
      if (!form.storage_start_date || !form.storage_end_date) { toast.error('Storage dates are required'); return; }
    }
    setStep(s => s + 1);
  };

  const handleSaveAndGenerate = async (isDraft) => {
    setIsSaving(true);
    try {
      // Generate contract number
      const existing = await base44.entities.StorageContract.list('-created_date', 200);
      const year = new Date().getFullYear();
      const nums = existing.map(c => c.contract_number)
        .filter(n => n && n.startsWith(`SC-${year}-`))
        .map(n => parseInt(n.split('-')[2]) || 0);
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      const contractNumber = `SC-${year}-${String(nextNum).padStart(4, '0')}`;

      const payload = {
        contract_number: contractNumber,
        customer_id: form.customer_id,
        boat_id: form.boat_id,
        location_id: form.location_id || undefined,
        language: form.language,
        status: isDraft ? 'Draft' : 'Ready',
        storage_type: form.storage_type,
        storage_start_date: form.storage_start_date,
        storage_end_date: form.storage_end_date,
        storage_period_label: form.storage_period_label,
        boat_length_m: parseFloat(form.boat_length_m) || undefined,
        boat_location_on_site: form.boat_location_on_site,
        trailer_present: form.trailer_present,
        trailer_type: form.trailer_type,
        trailer_plate: form.trailer_plate,
        trailer_dimensions: form.trailer_dimensions,
        transport_included: form.transport_included,
        transport_pickup_address: form.transport_pickup_address,
        transport_distance_km: parseFloat(form.transport_distance_km) || undefined,
        price_total_net: parseFloat(form.price_total_net) || 0,
        price_vat: parseFloat(form.price_vat) || 0,
        price_total_gross: parseFloat(form.price_total_gross) || 0,
        vat_rate: parseFloat(form.vat_rate) || 25,
        payment_terms: form.payment_terms,
        payment_due_date: form.payment_due_date || undefined,
        boat_condition_notes: form.boat_condition_notes,
        existing_damage_notes: form.existing_damage_notes,
        insurance_provider: form.insurance_provider,
        insurance_policy_number: form.insurance_policy_number,
        insurance_valid_until: form.insurance_valid_until || undefined,
        insurance_coverage_amount: parseFloat(form.insurance_coverage_amount) || undefined,
        special_agreements: form.special_agreements,
        signed_place: form.signed_place,
        signed_by_customer: form.signed_by_customer,
        signed_by_provider: form.signed_by_provider,
        signed_date: form.signed_date || undefined,
        pdf_generated_at: new Date().toISOString(),
      };

      let contract;
      if (contractId) {
        contract = await base44.entities.StorageContract.update(contractId, payload);
        contract = { ...payload, id: contractId };
      } else {
        contract = await base44.entities.StorageContract.create(payload);
        setContractId(contract.id);
      }

      // Create service items
      const itemsPayload = serviceItems
        .filter(i => i.title && i.title.trim())
        .map((item, idx) => ({
          contract_id: contract.id,
          sequence_order: idx,
          title: item.title,
          quantity: parseFloat(item.quantity) || 1,
          unit: item.unit,
          unit_price: parseFloat(item.unit_price) || 0,
          total_price: parseFloat(item.total_price) || 0,
          category: item.category,
        }));

      if (itemsPayload.length > 0) {
        await base44.entities.StorageContractServiceItem.bulkCreate(itemsPayload);
      }

      setGeneratedContract({ contract: { ...payload, id: contract.id }, items: itemsPayload });

      // Generate and download PDF
      const { valid, errors } = validateContractForPDF({ ...payload, id: contract.id }, itemsPayload, isDraft);
      if (!valid && !isDraft) {
        toast.error('PDF validation failed: ' + errors.join('; '));
        setIsSaving(false);
        return;
      }

      const doc = generateStorageContractPDF(
        { ...payload, id: contract.id },
        selectedCustomer,
        selectedBoat,
        selectedLocation,
        itemsPayload,
        isDraft
      );
      const filename = `${contractNumber}_${form.language}${isDraft ? '_DRAFT' : ''}.pdf`;
      doc.save(filename);

      toast.success(isDraft ? 'Draft PDF downloaded!' : 'Contract PDF generated and saved!');
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <FileText className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Storage Contract Wizard</h1>
        </div>
        <p className="text-slate-500">Generate a complete, legally binding storage contract in {LANG_OPTIONS.find(l => l.value === form.language)?.label || form.language}.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-6">
        {STEPS.map((title, idx) => (
          <React.Fragment key={idx}>
            <div className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              step === idx + 1 ? 'bg-blue-600 text-white' :
              step > idx + 1 ? 'bg-green-500 text-white' :
              'bg-slate-100 text-slate-500'
            }`}>
              {step > idx + 1 ? <CheckCircle2 className="w-3 h-3" /> : <span>{idx + 1}</span>}
              <span className="hidden sm:inline">{title}</span>
            </div>
            {idx < STEPS.length - 1 && <div className="h-0.5 w-3 bg-slate-200 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Step {step}: {STEPS[step - 1]}</span>
            <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANG_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6">
          {/* ── STEP 1: Customer & Boat ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-1 block">Customer *</label>
                <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v, boat_id: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                  <SelectContent>
                    {customers?.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {[c.first_name, c.last_name].filter(Boolean).join(' ')}{c.company_name ? ` (${c.company_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCustomer && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700 space-y-0.5">
                    <div>{selectedCustomer.email}</div>
                    <div>{selectedCustomer.phone}</div>
                    {selectedCustomer.billing_address && <div>{selectedCustomer.billing_address}, {selectedCustomer.billing_city}</div>}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Boat *</label>
                <Select value={form.boat_id} onValueChange={v => setForm(f => ({ ...f, boat_id: v }))} disabled={!form.customer_id}>
                  <SelectTrigger><SelectValue placeholder={form.customer_id ? "Select boat..." : "Select customer first"} /></SelectTrigger>
                  <SelectContent>
                    {customerBoats.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.vessel_name || `${b.manufacturer} ${b.model}`} ({b.length_m}m)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBoat && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700 space-y-0.5">
                    <div>{selectedBoat.vessel_type} — {selectedBoat.manufacturer} {selectedBoat.model} {selectedBoat.year}</div>
                    <div>{selectedBoat.length_m}m LOA | {selectedBoat.engine_type}</div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Storage Location</label>
                <Select value={form.location_id} onValueChange={v => setForm(f => ({ ...f, location_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select location..." /></SelectTrigger>
                  <SelectContent>
                    {locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Contract Language</label>
                <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANG_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">The full contract PDF will be generated in this language.</p>
              </div>
            </div>
          )}

          {/* ── STEP 2: Storage Details ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Storage Type *</label>
                  <Select value={form.storage_type} onValueChange={v => setForm(f => ({ ...f, storage_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outdoor">Outdoor (uncovered)</SelectItem>
                      <SelectItem value="indoor">Indoor / Hall</SelectItem>
                      <SelectItem value="indoor_roof">Indoor with Roof Cover</SelectItem>
                      <SelectItem value="tent">Tent / Covered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Boat Length (m)</label>
                  <Input type="number" step="0.1" value={form.boat_length_m} onChange={e => setForm(f => ({ ...f, boat_length_m: e.target.value }))} placeholder="e.g. 8.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Start Date *</label>
                  <Input type="date" value={form.storage_start_date} onChange={e => setForm(f => ({ ...f, storage_start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">End Date *</label>
                  <Input type="date" value={form.storage_end_date} onChange={e => setForm(f => ({ ...f, storage_end_date: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Period Label</label>
                <Input value={form.storage_period_label} onChange={e => setForm(f => ({ ...f, storage_period_label: e.target.value }))} placeholder="e.g. Winter 2026/2027" />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Position on Site</label>
                <Input value={form.boat_location_on_site} onChange={e => setForm(f => ({ ...f, boat_location_on_site: e.target.value }))} placeholder="e.g. Row B, Position 14" />
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox checked={form.trailer_present} onCheckedChange={c => setForm(f => ({ ...f, trailer_present: !!c }))} />
                  <label className="text-sm font-medium cursor-pointer">Customer has own trailer</label>
                </div>
                {form.trailer_present && (
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div><label className="text-xs mb-1 block">Trailer Type/Make</label><Input value={form.trailer_type} onChange={e => setForm(f => ({ ...f, trailer_type: e.target.value }))} /></div>
                    <div><label className="text-xs mb-1 block">License Plate</label><Input value={form.trailer_plate} onChange={e => setForm(f => ({ ...f, trailer_plate: e.target.value }))} /></div>
                    <div><label className="text-xs mb-1 block">Dimensions (LxW)</label><Input value={form.trailer_dimensions} onChange={e => setForm(f => ({ ...f, trailer_dimensions: e.target.value }))} /></div>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox checked={form.transport_included} onCheckedChange={c => setForm(f => ({ ...f, transport_included: !!c }))} />
                  <label className="text-sm font-medium cursor-pointer">Transport service included</label>
                </div>
                {form.transport_included && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div><label className="text-xs mb-1 block">Pickup Address</label><Input value={form.transport_pickup_address} onChange={e => setForm(f => ({ ...f, transport_pickup_address: e.target.value }))} /></div>
                    <div><label className="text-xs mb-1 block">Distance (km one-way)</label><Input type="number" value={form.transport_distance_km} onChange={e => setForm(f => ({ ...f, transport_distance_km: e.target.value }))} /></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3: Pricing ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Service Items</p>
                <Button size="sm" variant="outline" onClick={addItem}>+ Add Item</Button>
              </div>

              <div className="space-y-2">
                {serviceItems.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-3 border rounded-lg">
                    <div className="col-span-4">
                      <Input placeholder="Service description" value={item.title} onChange={e => updateItem(idx, 'title', e.target.value)} className="text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Select value={item.unit} onValueChange={v => updateItem(idx, 'unit', v)}>
                        <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pau">pau</SelectItem>
                          <SelectItem value="h">h</SelectItem>
                          <SelectItem value="kom">kom</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="sez">sez</SelectItem>
                          <SelectItem value="mj">mj</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input type="number" placeholder="Unit price" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} className="text-sm" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" placeholder="Total" value={item.total_price} onChange={e => updateItem(idx, 'total_price', e.target.value)} className="text-sm bg-slate-50" />
                    </div>
                    <div className="col-span-1">
                      <Select value={item.category} onValueChange={v => updateItem(idx, 'category', v)}>
                        <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STORAGE">Storage</SelectItem>
                          <SelectItem value="TRANSPORT">Transport</SelectItem>
                          <SelectItem value="SERVICE">Service</SelectItem>
                          <SelectItem value="OPTION">Option</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      {serviceItems.length > 1 && (
                        <Button size="sm" variant="ghost" className="text-red-500 h-9 px-2" onClick={() => removeItem(idx)}>✕</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium w-24">VAT Rate (%)</label>
                  <Input type="number" value={form.vat_rate} onChange={e => setForm(f => ({ ...f, vat_rate: e.target.value }))} className="w-24" />
                </div>
                <div className="bg-slate-800 text-white p-4 rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between"><span className="opacity-70">Net Total:</span><span>€ {parseFloat(form.price_total_net || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="opacity-70">VAT ({form.vat_rate}%):</span><span>€ {parseFloat(form.price_vat || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2 text-emerald-400"><span>Gross Total:</span><span>€ {parseFloat(form.price_total_gross || 0).toFixed(2)}</span></div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Payment Terms</label>
                <Textarea value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} rows={3} placeholder="e.g. Payment due within 14 days of invoice" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Due Date</label>
                <Input type="date" value={form.payment_due_date} onChange={e => setForm(f => ({ ...f, payment_due_date: e.target.value }))} className="w-48" />
              </div>
            </div>
          )}

          {/* ── STEP 4: Condition & Insurance ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Boat Condition at Handover</label>
                <Textarea value={form.boat_condition_notes} onChange={e => setForm(f => ({ ...f, boat_condition_notes: e.target.value }))} rows={3} placeholder="General condition, cleanliness, visible state..." />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Pre-existing Damage</label>
                <Textarea value={form.existing_damage_notes} onChange={e => setForm(f => ({ ...f, existing_damage_notes: e.target.value }))} rows={3} placeholder="Document all known damage before storage..." />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-3">Insurance Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs mb-1 block">Insurance Provider</label><Input value={form.insurance_provider} onChange={e => setForm(f => ({ ...f, insurance_provider: e.target.value }))} /></div>
                  <div><label className="text-xs mb-1 block">Policy Number</label><Input value={form.insurance_policy_number} onChange={e => setForm(f => ({ ...f, insurance_policy_number: e.target.value }))} /></div>
                  <div><label className="text-xs mb-1 block">Valid Until</label><Input type="date" value={form.insurance_valid_until} onChange={e => setForm(f => ({ ...f, insurance_valid_until: e.target.value }))} /></div>
                  <div><label className="text-xs mb-1 block">Coverage Amount (€)</label><Input type="number" value={form.insurance_coverage_amount} onChange={e => setForm(f => ({ ...f, insurance_coverage_amount: e.target.value }))} /></div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Special Agreements ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Special Agreements</label>
                <Textarea value={form.special_agreements} onChange={e => setForm(f => ({ ...f, special_agreements: e.target.value }))} rows={5} placeholder="Any special agreements, individual clauses or notes..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Place of Signing</label>
                  <Input value={form.signed_place} onChange={e => setForm(f => ({ ...f, signed_place: e.target.value }))} placeholder="e.g. Novigrad" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date</label>
                  <Input type="date" value={form.signed_date} onChange={e => setForm(f => ({ ...f, signed_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer Signer Name</label>
                  <Input value={form.signed_by_customer} onChange={e => setForm(f => ({ ...f, signed_by_customer: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Provider Employee Name</label>
                  <Input value={form.signed_by_provider} onChange={e => setForm(f => ({ ...f, signed_by_provider: e.target.value }))} placeholder="Full name" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 6: Legal Review ── */}
          {step === 6 && (
            <div className="space-y-4">
              {missingLegal.length > 0 ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>PDF generation blocked.</strong> Missing legal text for language "{form.language}": {missingLegal.join(', ')}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-green-300 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    All {LANG_OPTIONS.find(l => l.value === form.language)?.label} legal clauses are present. Contract is ready for PDF generation.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {T && Object.entries(T.sectionTitles).filter(([key]) => ['customerObligations', 'providerObligations', 'liabilityInsurance', 'access', 'pickupRelease', 'termination', 'dataProtection', 'finalProvisions'].includes(key)).map(([key, title]) => (
                  <div key={key} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5">
                      <span className="text-sm font-medium text-slate-700">{title}</span>
                      <Badge variant="outline" className="text-green-600 border-green-300">✓ Included</Badge>
                    </div>
                    <div className="px-4 py-3 text-xs text-slate-500 max-h-24 overflow-y-auto whitespace-pre-line leading-relaxed">
                      {T[key]?.substring(0, 300)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 7: Generate PDF ── */}
          {step === 7 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Customer</p><p className="font-medium">{selectedCustomer ? [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ') : '–'}</p></div>
                <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Boat</p><p className="font-medium">{selectedBoat?.vessel_name || `${selectedBoat?.manufacturer || ''} ${selectedBoat?.model || ''}`}</p></div>
                <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Storage Period</p><p className="font-medium">{form.storage_start_date} → {form.storage_end_date}</p></div>
                <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Total (gross)</p><p className="font-bold text-emerald-600">€ {parseFloat(form.price_total_gross || 0).toFixed(2)}</p></div>
                <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Language</p><p className="font-medium">{LANG_OPTIONS.find(l => l.value === form.language)?.label}</p></div>
                <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Legal Sections</p><p className="font-medium text-green-600">16 sections ✓</p></div>
              </div>

              {missingLegal.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Cannot generate final PDF — missing legal text: {missingLegal.join(', ')}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center">
                  <Eye className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-medium mb-1">Draft PDF</p>
                  <p className="text-xs text-slate-500 mb-3">Download with DRAFT watermark for review</p>
                  <Button variant="outline" className="w-full" onClick={() => handleSaveAndGenerate(true)} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                    Download Draft
                  </Button>
                </div>
                <div className={`p-4 border-2 rounded-lg text-center ${missingLegal.length > 0 ? 'border-red-200 bg-red-50' : 'border-blue-300 bg-blue-50'}`}>
                  <FileText className={`w-8 h-8 mx-auto mb-2 ${missingLegal.length > 0 ? 'text-red-300' : 'text-blue-500'}`} />
                  <p className="text-sm font-medium mb-1">Final Contract PDF</p>
                  <p className="text-xs text-slate-500 mb-3">Complete contract, ready for signature</p>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleSaveAndGenerate(false)}
                    disabled={isSaving || missingLegal.length > 0}
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                    Generate Final PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-slate-50 border-t flex justify-between p-4">
          <Button variant="outline" onClick={() => step === 1 ? navigate(-1) : setStep(s => s - 1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          {step < STEPS.length && (
            <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}