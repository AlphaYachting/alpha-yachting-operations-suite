import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

const WORK_CATEGORIES = [
  'Motor / Antrieb', 'Elektrik / Elektronik', 'Rumpf / Gelcoat',
  'Osmose / Unterwasserschiff', 'Antifouling', 'Rigg / Segel',
  'Winterlager / Konservierung', 'Kranung / Transport', 'Anhänger'
];

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <div className="bg-slate-800 text-white text-sm font-semibold px-3 py-1.5 rounded">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}

export default function RepairOrderForm({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val });

  const toggleCategory = (cat) => {
    const cur = data.work_categories || [];
    set('work_categories', cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat]);
  };

  const setPosition = (idx, key, val) => {
    const positions = [...(data.positions || [])];
    positions[idx] = { ...positions[idx], [key]: val };
    set('positions', positions);
  };
  const addPosition = () => set('positions', [...(data.positions || []), { description: '', quantity: '', price: '' }]);
  const removePosition = (idx) => set('positions', (data.positions || []).filter((_, i) => i !== idx));

  return (
    <div className="space-y-6">
      <Section title="1 · Auftraggeber (Kunde)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name / Firma" value={data.customer_name} onChange={(v) => set('customer_name', v)} />
          <Field label="Kunden-Nr." value={data.customer_number} onChange={(v) => set('customer_number', v)} />
          <Field label="Adresse" value={data.customer_address} onChange={(v) => set('customer_address', v)} />
          <Field label="Telefon" value={data.customer_phone} onChange={(v) => set('customer_phone', v)} />
          <Field label="E-Mail" value={data.customer_email} onChange={(v) => set('customer_email', v)} />
        </div>
      </Section>

      <Section title="2 · Boot / Yacht">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Bootstyp / Modell" value={data.boat_type_model} onChange={(v) => set('boat_type_model', v)} />
          <Field label="Bootsname" value={data.boat_name} onChange={(v) => set('boat_name', v)} />
          <Field label="Baujahr" value={data.boat_year} onChange={(v) => set('boat_year', v)} />
          <Field label="Amtl. Kennzeichen" value={data.boat_registration} onChange={(v) => set('boat_registration', v)} />
          <Field label="Rumpf-/HIN-Nr." value={data.boat_hin} onChange={(v) => set('boat_hin', v)} />
          <Field label="Länge (m)" type="number" value={data.boat_length_m} onChange={(v) => set('boat_length_m', parseFloat(v) || '')} />
          <Field label="Standort" value={data.boat_location} onChange={(v) => set('boat_location', v)} />
          <Field label="Motor (Hersteller / Typ)" value={data.engine_make_type} onChange={(v) => set('engine_make_type', v)} />
          <Field label="Leistung (kW/PS)" value={data.engine_power} onChange={(v) => set('engine_power', v)} />
          <Field label="Betriebsstd." value={data.engine_hours} onChange={(v) => set('engine_hours', v)} />
        </div>
      </Section>

      <Section title="4 · Gewünschte Arbeiten">
        <div className="grid grid-cols-3 gap-2">
          {WORK_CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={(data.work_categories || []).includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
              {cat}
            </label>
          ))}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Beschreibung des Mangels / der gewünschten Arbeiten</Label>
          <Textarea value={data.work_description ?? ''} onChange={(e) => set('work_description', e.target.value)} rows={3} />
        </div>
      </Section>

      <Section title="5 · Positionen">
        <div className="space-y-2">
          {(data.positions || []).map((p, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <span className="text-sm text-slate-400 pt-2 w-5">{idx + 1}</span>
              <Input placeholder="Beschreibung" value={p.description ?? ''} onChange={(e) => setPosition(idx, 'description', e.target.value)} className="flex-1 h-9" />
              <Input placeholder="Menge/Std." value={p.quantity ?? ''} onChange={(e) => setPosition(idx, 'quantity', e.target.value)} className="w-24 h-9" />
              <Input placeholder="€" type="number" value={p.price ?? ''} onChange={(e) => setPosition(idx, 'price', parseFloat(e.target.value) || '')} className="w-24 h-9" />
              <Button variant="ghost" size="icon" onClick={() => removePosition(idx)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addPosition}><Plus className="h-4 w-4 mr-1" /> Position hinzufügen</Button>
        </div>
      </Section>

      <Section title="6 · Kosten & Konditionen">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Stundensatz (€, netto)" type="number" value={data.hourly_rate} onChange={(v) => set('hourly_rate', parseFloat(v) || '')} />
          <Field label="Kostenobergrenze (€)" type="number" value={data.cost_cap} onChange={(v) => set('cost_cap', parseFloat(v) || '')} />
          <Field label="Voraussichtl. Fertigstellung" value={data.expected_completion} onChange={(v) => set('expected_completion', v)} />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={!!data.cost_estimate_wanted} onCheckedChange={(c) => set('cost_estimate_wanted', !!c)} /> Kostenvoranschlag gewünscht
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={!!data.test_drive_wanted} onCheckedChange={(c) => set('test_drive_wanted', !!c)} /> Probefahrt
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={!!data.dispose_old_parts} onCheckedChange={(c) => set('dispose_old_parts', !!c)} /> Altteile entsorgen
          </label>
        </div>
      </Section>
    </div>
  );
}