import React, { useState, useEffect } from 'react';
import { useWizard } from './WizardContext';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, FileText, CheckCircle2, AlertCircle, Download, Loader2, Eye, Calculator, Package, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { validateContractForPDF, generateStorageContractPDF } from '@/components/storageContract/StorageContractPDFGenerator';
import { LEGAL_TEXT, validateLegalTextCompleteness } from '@/lib/storageContractLegalText';
import { calculateOffer } from '@/components/utils/pricingEngine';

const SUB_STEPS = [
  'Lagerdetails',
  'Konfigurator',
  'Preisvorschau',
  'Zustand & Versicherung',
  'Sondervereinbarungen',
  'Rechtsprüfung',
  'PDF generieren',
];

const LANG_OPTIONS = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'hr', label: 'Hrvatski' },
  { value: 'sl', label: 'Slovenščina' },
];

export function StorageContractFullFlow() {
  const { wizardData, setStep: setMainStep } = useWizard();
  const [subStep, setSubStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [calculation, setCalculation] = useState(null);

  // ── Resolve wizard context ──
  const getCustomerId = () => {
    if (wizardData.source === 'customer') return wizardData.sourceData?.customer?.id || null;
    if (wizardData.source === 'lead') return wizardData.sourceData?.lead?.customer_id || null;
    return null;
  };
  const getBoatId = () => {
    if (typeof wizardData.vessel?.existing === 'string') return wizardData.vessel.existing;
    return wizardData.vessel?.existing?.id || null;
  };
  const getLocationId = () => {
    if (typeof wizardData.location?.existing === 'string') return wizardData.location.existing;
    return wizardData.location?.existing?.id || null;
  };

  const { data: customers } = useQuery({ queryKey: ['Customers'], queryFn: () => base44.entities.Customer.list() });
  const { data: boats } = useQuery({ queryKey: ['Boats'], queryFn: () => base44.entities.Boat.list() });
  const { data: locations } = useQuery({ queryKey: ['Locations'], queryFn: () => base44.entities.Location.list() });
  const { data: rateCards } = useQuery({ queryKey: ['ActiveRateCard'], queryFn: () => base44.entities.RateCard.filter({ is_active: true }) });
  const activeRateCard = rateCards?.[0];
  const { data: rateCardItems } = useQuery({
    queryKey: ['RateCardItems', activeRateCard?.id],
    queryFn: () => base44.entities.RateCardItem.filter({ rate_card_id: activeRateCard?.id }),
    enabled: !!activeRateCard?.id
  });
  const { data: modules } = useQuery({ queryKey: ['ProductModule'], queryFn: () => base44.entities.ProductModule.filter({ is_active: true }) });
  const { data: allModuleComponents } = useQuery({ queryKey: ['ModuleComponent_All'], queryFn: () => base44.entities.ModuleComponent.list() });

  const customerId = getCustomerId();
  const boatId = getBoatId();
  const locationId = getLocationId();
  const selectedCustomer = customers?.find(c => c.id === customerId);
  const selectedBoat = boats?.find(b => b.id === boatId);
  const selectedLocation = locations?.find(l => l.id === locationId);

  // ── Contract form ──
  const [form, setForm] = useState({
    language: 'de',
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
    vat_rate: 25,
    payment_terms: '',
    payment_due_date: '',
    boat_condition_notes: '',
    existing_damage_notes: '',
    insurance_provider: '',
    insurance_policy_number: '',
    insurance_valid_until: '',
    insurance_coverage_amount: '',
    special_agreements: '',
    signed_place: '',
    signed_by_customer: '',
    signed_by_provider: '',
    signed_date: '',
  });

  // ── Konfigurator state ──
  const [konfig, setKonfig] = useState({
    boat_length: 0,
    trailer_present: false,
    transport_needed: false,
    pickup_address: '',
    distance_km: 0,
    storage_needed: true,
    storage_period: '6_months',
    roof_option: false,
    selected_modules: [],
    selected_options: [],
  });
  const [konfigSubStep, setKonfigSubStep] = useState(1); // sub-steps within configurator: 1=Boat, 2=Transport, 3=Storage, 4=Modules, 5=Options

  // ── Service items (from calculation) ──
  const [serviceItems, setServiceItems] = useState([]);
  const [totals, setTotals] = useState({ net: 0, vat: 0, gross: 0 });

  // Auto-fill from wizard boat
  useEffect(() => {
    if (selectedBoat?.length_m) {
      setForm(f => ({ ...f, boat_length_m: f.boat_length_m || selectedBoat.length_m }));
      setKonfig(k => ({ ...k, boat_length: k.boat_length || selectedBoat.length_m }));
    }
  }, [selectedBoat]);

  // Auto-fill customer name for signing
  useEffect(() => {
    if (selectedCustomer && !form.signed_by_customer) {
      const name = [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ');
      setForm(f => ({ ...f, signed_by_customer: name }));
    }
  }, [selectedCustomer]);

  // Recalc totals whenever serviceItems change
  useEffect(() => {
    const net = serviceItems.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
    const vat = net * ((parseFloat(form.vat_rate) || 25) / 100);
    setTotals({ net: net.toFixed(2), vat: vat.toFixed(2), gross: (net + vat).toFixed(2) });
  }, [serviceItems, form.vat_rate]);

  const availableOptions = rateCardItems?.filter(i => i.category === 'OPTION' && i.is_active !== false) || [];

  // ── Navigation ──
  const handleBack = () => {
    if (subStep === 1) {
      setMainStep(5);
    } else if (subStep === 2) {
      // In configurator
      if (konfigSubStep > 1) {
        setKonfigSubStep(s => s - 1);
      } else {
        setSubStep(1);
      }
    } else {
      setSubStep(s => s - 1);
    }
  };

  const handleNext = () => {
    if (subStep === 1) {
      if (!form.storage_type) { toast.error('Lagertyp ist erforderlich'); return; }
      if (!form.storage_start_date || !form.storage_end_date) { toast.error('Lagerdaten sind erforderlich'); return; }
      setSubStep(2);
      setKonfigSubStep(1);
      return;
    }

    if (subStep === 2) {
      // Configurator sub-steps 1–4: just advance
      if (konfigSubStep < 5) {
        if (konfigSubStep === 1 && konfig.boat_length <= 0) {
          toast.error('Bitte eine gültige Bootslänge eingeben');
          return;
        }
        setKonfigSubStep(s => s + 1);
        return;
      }
      // konfigSubStep === 5 (Optionen) → Calculate & go to Preisvorschau
      if (konfigSubStep === 5) {
        if (!rateCardItems || rateCardItems.length === 0) {
          toast.error('Preisliste nicht geladen – bitte kurz warten und nochmal versuchen.');
          return;
        }
        try {
          const extendedParams = { ...konfig };
          for (const selectedMod of konfig.selected_modules) {
            const components = allModuleComponents?.filter(c => c.module_id === selectedMod.module_id) || [];
            for (const comp of components) {
              if (comp.pricing_mode === 'ADD_AS_LINE_ITEM') {
                extendedParams.selected_options = [
                  ...(extendedParams.selected_options || []),
                  { code: comp.rate_card_item_code, quantity: comp.qty_value }
                ];
              }
            }
          }
          const res = calculateOffer(extendedParams, rateCardItems, activeRateCard?.vat_rate || 25);
          setCalculation(res);

          const items = res.lineItems.map((li, idx) => ({
            id: idx + 1,
            title: li.title,
            quantity: li.quantity,
            unit: li.unit,
            unit_price: li.unit_price,
            total_price: typeof li.total_price === 'number' ? li.total_price.toFixed(2) : String(li.total_price),
            category: li.category === 'STORAGE' || li.category === 'ROOF_RULE' ? 'STORAGE'
              : li.category === 'TRANSPORT' ? 'TRANSPORT' : 'SERVICE',
          }));
          setServiceItems(items);

          if (konfig.transport_needed) {
            setForm(f => ({
              ...f,
              transport_included: true,
              transport_pickup_address: konfig.pickup_address || f.transport_pickup_address,
              transport_distance_km: konfig.distance_km || f.transport_distance_km,
            }));
          }

          setSubStep(3);
        } catch (err) {
          toast.error('Kalkulation fehlgeschlagen: ' + err.message);
        }
        return;
      }
    }

    setSubStep(s => s + 1);
  };

  const updateItem = (idx, field, value) => {
    setServiceItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? value : updated[idx].quantity;
        const p = field === 'unit_price' ? value : updated[idx].unit_price;
        updated[idx].total_price = ((parseFloat(q) || 0) * (parseFloat(p) || 0)).toFixed(2);
      }
      return updated;
    });
  };

  const T = LEGAL_TEXT[form.language];
  const missingLegal = validateLegalTextCompleteness(form.language);

  // ── PDF Generation ──
  const handleGeneratePDF = async (isDraft) => {
    setIsSaving(true);
    try {
      const existing = await base44.entities.StorageContract.list('-created_date', 200);
      const year = new Date().getFullYear();
      const nums = existing.map(c => c.contract_number)
        .filter(n => n && n.startsWith(`SC-${year}-`))
        .map(n => parseInt(n.split('-')[2]) || 0);
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      const contractNumber = `SC-${year}-${String(nextNum).padStart(4, '0')}`;

      const payload = {
        contract_number: contractNumber,
        customer_id: customerId,
        boat_id: boatId,
        location_id: locationId || undefined,
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
        price_storage_net: parseFloat(serviceItems.filter(i => i.category === 'STORAGE').reduce((s, i) => s + parseFloat(i.total_price || 0), 0)) || undefined,
        price_transport_net: parseFloat(serviceItems.filter(i => i.category === 'TRANSPORT').reduce((s, i) => s + parseFloat(i.total_price || 0), 0)) || undefined,
        price_services_net: parseFloat(serviceItems.filter(i => i.category === 'SERVICE').reduce((s, i) => s + parseFloat(i.total_price || 0), 0)) || undefined,
        price_total_net: parseFloat(totals.net),
        price_vat: parseFloat(totals.vat),
        price_total_gross: parseFloat(totals.gross),
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

      const contract = await base44.entities.StorageContract.create(payload);

      const itemsPayload = serviceItems
        .filter(i => i.title?.trim())
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

      const { valid, errors } = validateContractForPDF({ ...payload, id: contract.id }, itemsPayload, isDraft);
      if (!valid && !isDraft) {
        toast.error('PDF Validierung fehlgeschlagen: ' + errors.join('; '));
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

      const filename = `${contractNumber}_${form.language}${isDraft ? '_ENTWURF' : ''}.pdf`;
      doc.save(filename);
      toast.success(isDraft ? 'Entwurf-PDF heruntergeladen!' : `Vertrag ${contractNumber} erstellt!`);
    } catch (err) {
      toast.error('Fehler: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Progress header ──
  const totalSubSteps = SUB_STEPS.length;

  return (
    <div className="space-y-4">
      {/* Sub-step progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {SUB_STEPS.map((title, idx) => {
          const stepNum = idx + 1;
          const isActive = subStep === stepNum;
          const isDone = subStep > stepNum;
          return (
            <div key={idx} className="flex items-center gap-1 shrink-0">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' :
                isDone ? 'bg-green-500 text-white' :
                'bg-slate-200 text-slate-600'
              }`}>
                {isDone ? '✓' : stepNum}
              </div>
              <span className="text-xs text-slate-600 whitespace-nowrap hidden sm:inline">{title}</span>
              {idx < totalSubSteps - 1 && <div className="h-0.5 w-3 bg-slate-200 mx-1" />}
            </div>
          );
        })}
      </div>

      {/* Context banner */}
      {(selectedCustomer || selectedBoat) && (
        <div className="flex gap-2 flex-wrap">
          {selectedCustomer && (
            <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
              👤 {[selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')}
            </Badge>
          )}
          {selectedBoat && (
            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
              ⛵ {selectedBoat.vessel_name || `${selectedBoat.manufacturer} ${selectedBoat.model}`} ({selectedBoat.length_m}m)
            </Badge>
          )}
          {selectedLocation && (
            <Badge variant="outline" className="text-slate-600 border-slate-300">
              📍 {selectedLocation.name}
            </Badge>
          )}
        </div>
      )}

      {/* Language selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Vertragssprache:</span>
        <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANG_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ══════════════════════════════════════════════════════
          SUB-STEP 1: Lagerdetails (Vertragsfelder)
      ══════════════════════════════════════════════════════ */}
      {subStep === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Grunddaten für den Lagervertrag. Preis wird im nächsten Schritt über den Konfigurator berechnet.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Lagertyp *</label>
              <Select value={form.storage_type} onValueChange={v => setForm(f => ({ ...f, storage_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outdoor">Outdoor (ungedeckt)</SelectItem>
                  <SelectItem value="indoor">Indoor / Halle</SelectItem>
                  <SelectItem value="indoor_roof">Indoor mit Dachschutz</SelectItem>
                  <SelectItem value="tent">Zelt / überdacht</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Bootslänge (m)</label>
              <Input type="number" step="0.1" value={form.boat_length_m} onChange={e => setForm(f => ({ ...f, boat_length_m: e.target.value }))} placeholder="z.B. 8.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Startdatum *</label>
              <Input type="date" value={form.storage_start_date} onChange={e => setForm(f => ({ ...f, storage_start_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Enddatum *</label>
              <Input type="date" value={form.storage_end_date} onChange={e => setForm(f => ({ ...f, storage_end_date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Saisonbezeichnung</label>
              <Input value={form.storage_period_label} onChange={e => setForm(f => ({ ...f, storage_period_label: e.target.value }))} placeholder="z.B. Winter 2026/2027" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Standplatz</label>
              <Input value={form.boat_location_on_site} onChange={e => setForm(f => ({ ...f, boat_location_on_site: e.target.value }))} placeholder="z.B. Reihe B, Platz 14" />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox checked={form.trailer_present} onCheckedChange={c => setForm(f => ({ ...f, trailer_present: !!c }))} />
              <label className="text-sm font-medium cursor-pointer">Kunde hat eigenen Trailer</label>
            </div>
            {form.trailer_present && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div><label className="text-xs mb-1 block">Typ/Marke</label><Input value={form.trailer_type} onChange={e => setForm(f => ({ ...f, trailer_type: e.target.value }))} /></div>
                <div><label className="text-xs mb-1 block">Kennzeichen</label><Input value={form.trailer_plate} onChange={e => setForm(f => ({ ...f, trailer_plate: e.target.value }))} /></div>
                <div><label className="text-xs mb-1 block">Maße</label><Input value={form.trailer_dimensions} onChange={e => setForm(f => ({ ...f, trailer_dimensions: e.target.value }))} /></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-STEP 2: Konfigurator (Pricing Engine)
      ══════════════════════════════════════════════════════ */}
      {subStep === 2 && (
        <div className="space-y-4">
          {/* Konfigurator sub-step progress */}
          <div className="flex items-center gap-1 bg-slate-50 p-2 rounded-lg">
            <Calculator className="h-4 w-4 text-emerald-600 mr-1 flex-shrink-0" />
            <span className="text-xs font-medium text-emerald-700 mr-2">Preiskonfigurator:</span>
            {['Boot', 'Transport', 'Lager', 'Module', 'Optionen'].map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium ${
                  konfigSubStep === i + 1 ? 'bg-emerald-600 text-white' :
                  konfigSubStep > i + 1 ? 'bg-green-500 text-white' :
                  'bg-slate-200 text-slate-600'
                }`}>{konfigSubStep > i + 1 ? '✓' : i + 1}</div>
                <span className="text-xs text-slate-500 hidden sm:inline">{t}</span>
                {i < 4 && <div className="h-0.5 w-3 bg-slate-200 mx-0.5" />}
              </div>
            ))}
          </div>

          {/* Konfigurator Sub-Step 1: Bootsdaten */}
          {konfigSubStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Bootslänge (Meter) *</label>
                <Input
                  type="number" step="0.1" placeholder="z.B. 8.5"
                  value={konfig.boat_length || ''}
                  onChange={e => setKonfig(k => ({ ...k, boat_length: parseFloat(e.target.value) || 0 }))}
                />
                {selectedBoat?.length_m > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">⛵ Vom Boot vorausgefüllt ({selectedBoat.length_m}m)</p>
                )}
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Checkbox
                  checked={konfig.trailer_present}
                  onCheckedChange={c => setKonfig(k => ({ ...k, trailer_present: !!c }))}
                />
                <label className="text-sm font-medium cursor-pointer">Kunde hat eigenen Trailer</label>
              </div>
            </div>
          )}

          {/* Konfigurator Sub-Step 2: Transport */}
          {konfigSubStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50">
                <div className="flex items-center gap-3">
                  <MapPin className="text-blue-500 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-sm">Transport benötigt?</h3>
                    <p className="text-xs text-slate-500">Wir holen das Boot beim Kunden ab.</p>
                  </div>
                </div>
                <Checkbox
                  checked={konfig.transport_needed}
                  onCheckedChange={c => setKonfig(k => ({ ...k, transport_needed: !!c, distance_km: c ? k.distance_km : 0 }))}
                  className="h-6 w-6"
                />
              </div>
              {konfig.transport_needed && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Abholadresse / Marina</label>
                    <Input value={konfig.pickup_address} onChange={e => setKonfig(k => ({ ...k, pickup_address: e.target.value }))} placeholder="z.B. Marina Veruda" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Entfernung (einfach, km)</label>
                    <Input type="number" value={konfig.distance_km || ''} onChange={e => setKonfig(k => ({ ...k, distance_km: parseFloat(e.target.value) || 0 }))} placeholder="z.B. 25" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Konfigurator Sub-Step 3: Lagerkonfiguration */}
          {konfigSubStep === 3 && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-emerald-50 border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="text-emerald-600 h-4 w-4" />
                  <span className="font-medium text-sm">Lagerdienst (Pflichtleistung)</span>
                </div>
                <p className="text-xs text-slate-500">Lagerung ist die Basisleistung und immer enthalten.</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Lagerzeitraum</label>
                <Select value={konfig.storage_period} onValueChange={v => setKonfig(k => ({ ...k, storage_period: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Täglich</SelectItem>
                    <SelectItem value="month">Monatlich</SelectItem>
                    <SelectItem value="6_months">6 Monate (Saison)</SelectItem>
                    <SelectItem value="year">Ganzes Jahr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h3 className="font-medium text-sm">Indoor / Dachüberdacht</h3>
                  <p className="text-xs text-slate-500">Wendet Aufschlag aus der Preisliste an</p>
                </div>
                <Checkbox checked={konfig.roof_option} onCheckedChange={c => setKonfig(k => ({ ...k, roof_option: !!c }))} />
              </div>
            </div>
          )}

          {/* Konfigurator Sub-Step 4: Module */}
          {konfigSubStep === 4 && (
            <div className="space-y-4">
              {(!modules || modules.length === 0) && (
                <p className="text-slate-500 text-sm py-4 text-center">Keine Servicemodule konfiguriert. Schritt überspringen.</p>
              )}
              {['TECH', 'CARE', 'PREMIUM'].map(group => {
                const groupModules = modules?.filter(m => m.module_group === group).sort((a, b) => a.display_order - b.display_order) || [];
                if (groupModules.length === 0) return null;
                const groupName = { TECH: 'Technischer Service', CARE: 'Pflege & Wert', PREMIUM: 'Premium Upgrades' }[group];
                const isRadio = group === 'TECH' || group === 'CARE';
                return (
                  <div key={group}>
                    <h3 className="font-semibold mb-2 text-sm">{groupName}</h3>
                    <div className="space-y-2">
                      {isRadio && (
                        <div className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                          onClick={() => setKonfig(k => ({ ...k, selected_modules: k.selected_modules.filter(m => modules?.find(mod => mod.id === m.module_id)?.module_group !== group) }))}>
                          <div className="flex items-center gap-3">
                            <input type="radio" readOnly checked={!konfig.selected_modules.some(m => modules?.find(mod => mod.id === m.module_id)?.module_group === group)} />
                            <span className="text-sm">Keins – {groupName} überspringen</span>
                          </div>
                        </div>
                      )}
                      {groupModules.map(module => {
                        const isSelected = konfig.selected_modules.some(m => m.module_id === module.id);
                        return (
                          <div key={module.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-slate-50'}`}
                            onClick={() => {
                              if (isRadio) {
                                setKonfig(k => ({ ...k, selected_modules: [...k.selected_modules.filter(m => modules?.find(mod => mod.id === m.module_id)?.module_group !== group), { module_id: module.id, module }] }));
                              } else {
                                setKonfig(k => ({ ...k, selected_modules: isSelected ? k.selected_modules.filter(m => m.module_id !== module.id) : [...k.selected_modules, { module_id: module.id, module }] }));
                              }
                            }}>
                            <div className="flex items-start gap-3">
                              <input type={isRadio ? 'radio' : 'checkbox'} checked={isSelected} readOnly className="mt-0.5" />
                              <div>
                                <div className="font-medium text-sm">{module.name}</div>
                                <p className="text-xs text-slate-500">{module.description_short}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Konfigurator Sub-Step 5: Optionen → automatisch im handleNext verrechnet */}
          {konfigSubStep === 5 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Zusatzleistungen</p>
              {availableOptions.length === 0 && (
                <p className="text-slate-500 text-sm">Keine zusätzlichen Optionen konfiguriert.</p>
              )}
              {availableOptions.map(opt => {
                const isSelected = konfig.selected_options.some(o => o.code === opt.code);
                return (
                  <div key={opt.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                    <div>
                      <span className="font-medium text-sm">{opt.title}</span>
                      <p className="text-xs text-slate-500">€{opt.price} / {opt.unit}</p>
                    </div>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={c => setKonfig(k => ({
                        ...k,
                        selected_options: c
                          ? [...k.selected_options, { code: opt.code, quantity: 1 }]
                          : k.selected_options.filter(o => o.code !== opt.code)
                      }))}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-STEP 3: Preisvorschau (aus Konfigurator)
      ══════════════════════════════════════════════════════ */}
      {subStep === 3 && calculation && (
        <div className="space-y-4">
          <Alert className="border-emerald-300 bg-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-700">
              Preise wurden aus dem Konfigurator übernommen. Du kannst sie unten noch anpassen.
            </AlertDescription>
          </Alert>

          {/* Editierbare Positionen */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Vertragsleistungen</p>
              <Button size="sm" variant="outline" onClick={() => setServiceItems(prev => [...prev, { id: Date.now(), title: '', quantity: 1, unit: 'pau', unit_price: '', total_price: '', category: 'SERVICE' }])}>
                + Position hinzufügen
              </Button>
            </div>
            {serviceItems.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2 border rounded-lg">
                <div className="col-span-4">
                  <Input placeholder="Beschreibung" value={item.title} onChange={e => updateItem(idx, 'title', e.target.value)} className="text-sm" />
                </div>
                <div className="col-span-1">
                  <Input type="number" placeholder="Menge" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="text-sm" />
                </div>
                <div className="col-span-1">
                  <Select value={item.unit} onValueChange={v => updateItem(idx, 'unit', v)}>
                    <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pau">pau</SelectItem>
                      <SelectItem value="h">h</SelectItem>
                      <SelectItem value="kom">kom</SelectItem>
                      <SelectItem value="sez">sez</SelectItem>
                      <SelectItem value="mj">mj</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input type="number" placeholder="Stückpreis" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} className="text-sm" />
                </div>
                <div className="col-span-2">
                  <Input type="number" placeholder="Gesamt" value={item.total_price} onChange={e => updateItem(idx, 'total_price', e.target.value)} className="text-sm bg-slate-50" />
                </div>
                <div className="col-span-1">
                  <Select value={item.category} onValueChange={v => updateItem(idx, 'category', v)}>
                    <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STORAGE">Lager</SelectItem>
                      <SelectItem value="TRANSPORT">Transport</SelectItem>
                      <SelectItem value="SERVICE">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  {serviceItems.length > 1 && (
                    <Button size="sm" variant="ghost" className="text-red-500 h-9 px-2" onClick={() => setServiceItems(prev => prev.filter((_, i) => i !== idx))}>✕</Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium w-28">MwSt. Rate (%)</label>
            <Input type="number" value={form.vat_rate} onChange={e => setForm(f => ({ ...f, vat_rate: e.target.value }))} className="w-24" />
          </div>

          <div className="bg-slate-800 text-white p-4 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between"><span className="opacity-70">Netto:</span><span>€ {totals.net}</span></div>
            <div className="flex justify-between"><span className="opacity-70">MwSt. ({form.vat_rate}%):</span><span>€ {totals.vat}</span></div>
            <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2 text-emerald-400"><span>Brutto Gesamt:</span><span>€ {totals.gross}</span></div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Zahlungsbedingungen</label>
            <Textarea value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} rows={2} placeholder="z.B. Zahlung fällig innerhalb 14 Tagen nach Rechnungsstellung" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Zahlungsfrist</label>
            <Input type="date" value={form.payment_due_date} onChange={e => setForm(f => ({ ...f, payment_due_date: e.target.value }))} className="w-48" />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-STEP 4: Zustand & Versicherung
      ══════════════════════════════════════════════════════ */}
      {subStep === 4 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Zustand des Bootes bei Übergabe</label>
            <Textarea value={form.boat_condition_notes} onChange={e => setForm(f => ({ ...f, boat_condition_notes: e.target.value }))} rows={3} placeholder="Allgemeiner Zustand, sichtbarer Zustand..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Vorhandene Schäden (vor Einlagerung)</label>
            <Textarea value={form.existing_damage_notes} onChange={e => setForm(f => ({ ...f, existing_damage_notes: e.target.value }))} rows={3} placeholder="Bekannte Schäden dokumentieren..." />
          </div>
          <div className="border-t pt-3">
            <p className="text-sm font-semibold mb-3">Versicherungsangaben</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs mb-1 block">Versicherungsgesellschaft</label><Input value={form.insurance_provider} onChange={e => setForm(f => ({ ...f, insurance_provider: e.target.value }))} /></div>
              <div><label className="text-xs mb-1 block">Polizzennummer</label><Input value={form.insurance_policy_number} onChange={e => setForm(f => ({ ...f, insurance_policy_number: e.target.value }))} /></div>
              <div><label className="text-xs mb-1 block">Gültig bis</label><Input type="date" value={form.insurance_valid_until} onChange={e => setForm(f => ({ ...f, insurance_valid_until: e.target.value }))} /></div>
              <div><label className="text-xs mb-1 block">Versicherungssumme (€)</label><Input type="number" value={form.insurance_coverage_amount} onChange={e => setForm(f => ({ ...f, insurance_coverage_amount: e.target.value }))} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-STEP 5: Sondervereinbarungen
      ══════════════════════════════════════════════════════ */}
      {subStep === 5 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Sondervereinbarungen</label>
            <Textarea value={form.special_agreements} onChange={e => setForm(f => ({ ...f, special_agreements: e.target.value }))} rows={4} placeholder="Individuelle Klauseln oder besondere Anmerkungen..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Unterschriftsort</label><Input value={form.signed_place} onChange={e => setForm(f => ({ ...f, signed_place: e.target.value }))} placeholder="z.B. Novigrad" /></div>
            <div><label className="text-sm font-medium mb-1 block">Datum</label><Input type="date" value={form.signed_date} onChange={e => setForm(f => ({ ...f, signed_date: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Kundenname (Unterzeichner)</label><Input value={form.signed_by_customer} onChange={e => setForm(f => ({ ...f, signed_by_customer: e.target.value }))} placeholder="Vor- und Nachname" /></div>
            <div><label className="text-sm font-medium mb-1 block">Mitarbeiter (Unterzeichner)</label><Input value={form.signed_by_provider} onChange={e => setForm(f => ({ ...f, signed_by_provider: e.target.value }))} placeholder="Vor- und Nachname" /></div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-STEP 6: Rechtsprüfung
      ══════════════════════════════════════════════════════ */}
      {subStep === 6 && (
        <div className="space-y-3">
          {missingLegal.length > 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription><strong>PDF-Generierung blockiert.</strong> Fehlende Rechtstexte für "{form.language}": {missingLegal.join(', ')}</AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-green-300 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">Alle {LANG_OPTIONS.find(l => l.value === form.language)?.label} Rechtsklauseln vorhanden — Vertrag vollständig.</AlertDescription>
            </Alert>
          )}
          {T && Object.entries(T.sectionTitles)
            .filter(([key]) => ['customerObligations', 'providerObligations', 'liabilityInsurance', 'access', 'pickupRelease', 'termination', 'dataProtection', 'finalProvisions'].includes(key))
            .map(([key, title]) => (
              <div key={key} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-xs font-medium text-slate-700">{title}</span>
                  <Badge variant="outline" className="text-green-600 border-green-300 text-xs">✓ Enthalten</Badge>
                </div>
                <div className="px-3 py-2 text-xs text-slate-500 max-h-20 overflow-y-auto whitespace-pre-line leading-relaxed">
                  {T[key]?.substring(0, 250)}...
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-STEP 7: PDF generieren
      ══════════════════════════════════════════════════════ */}
      {subStep === 7 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Kunde</p><p className="font-medium">{selectedCustomer ? [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ') : '–'}</p></div>
            <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Boot</p><p className="font-medium">{selectedBoat?.vessel_name || `${selectedBoat?.manufacturer || ''} ${selectedBoat?.model || ''}`}</p></div>
            <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Lagerzeitraum</p><p className="font-medium">{form.storage_start_date} → {form.storage_end_date}</p></div>
            <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Gesamt (brutto)</p><p className="font-bold text-emerald-600">€ {totals.gross}</p></div>
            <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Sprache</p><p className="font-medium">{LANG_OPTIONS.find(l => l.value === form.language)?.label}</p></div>
            <div className="p-3 bg-slate-50 rounded border"><p className="text-xs text-slate-500">Positionen</p><p className="font-medium text-green-600">{serviceItems.filter(i => i.title?.trim()).length} Positionen ✓</p></div>
          </div>

          {missingLegal.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Keine finale PDF möglich — fehlende Rechtstexte: {missingLegal.join(', ')}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center">
              <Eye className="w-7 h-7 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-medium mb-1">Entwurf PDF</p>
              <p className="text-xs text-slate-500 mb-3">Mit ENTWURF-Wasserzeichen</p>
              <Button variant="outline" className="w-full" onClick={() => handleGeneratePDF(true)} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Entwurf herunterladen
              </Button>
            </div>
            <div className={`p-4 border-2 rounded-lg text-center ${missingLegal.length > 0 ? 'border-red-200 bg-red-50' : 'border-blue-300 bg-blue-50'}`}>
              <FileText className={`w-7 h-7 mx-auto mb-2 ${missingLegal.length > 0 ? 'text-red-300' : 'text-blue-500'}`} />
              <p className="text-sm font-medium mb-1">Finaler Vertrag PDF</p>
              <p className="text-xs text-slate-500 mb-3">Bereit zur Unterschrift</p>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleGeneratePDF(false)} disabled={isSaving || missingLegal.length > 0}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Finalen Vertrag generieren
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
        </Button>
        {subStep < SUB_STEPS.length && (
          <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
            {subStep === 2 && konfigSubStep === 5 ? (
              <><Calculator className="w-4 h-4 mr-2" />Preis berechnen</>
            ) : subStep === 2 && konfigSubStep < 5 ? (
              <>Weiter <ArrowRight className="w-4 h-4 ml-2" /></>
            ) : (
              <>Weiter <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}