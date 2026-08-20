import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STORAGE_SERVICES } from './einlagerungsvertragPdf';

const INTERVALS = ['Täglich', 'Wöchentlich', 'Monatlich', 'Jährlich', 'Winterlagerung / Saisonlagerung', 'Sonstiges'];
const BILLING_TYPES = ['Pro Tag', 'Pro Woche', 'Pro Monat', 'Pro Jahr / Saison', 'Pauschalpreis'];
const ROOF_OPTIONS = ['Ja', 'Nein', 'Nach Verfügbarkeit'];
const PHOTO_OPTIONS = ['Wurden erstellt', 'Werden noch erstellt', 'Nicht erstellt'];

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

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Auswählen…" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function StorageOrderForm({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val });

  const toggleService = (svc) => {
    const cur = data.storage_services || [];
    set('storage_services', cur.includes(svc) ? cur.filter((s) => s !== svc) : [...cur, svc]);
  };

  return (
    <div className="space-y-6">
      <Section title="1 · Kundendaten">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name / Firma" value={data.customer_name} onChange={(v) => set('customer_name', v)} />
          <Field label="Kunden-Nr." value={data.customer_number} onChange={(v) => set('customer_number', v)} />
          <Field label="Adresse (Straße, PLZ, Ort, Land)" value={data.customer_address} onChange={(v) => set('customer_address', v)} />
          <Field label="Telefon" value={data.customer_phone} onChange={(v) => set('customer_phone', v)} />
          <Field label="E-Mail" value={data.customer_email} onChange={(v) => set('customer_email', v)} />
          <Field label="OIB / Steuernr. / VAT-ID" value={data.customer_tax_id} onChange={(v) => set('customer_tax_id', v)} />
        </div>
      </Section>

      <Section title="2 · Angaben zum Boot">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Bootstyp / Hersteller / Modell" value={data.boat_type_model} onChange={(v) => set('boat_type_model', v)} />
          <Field label="Bootsname" value={data.boat_name} onChange={(v) => set('boat_name', v)} />
          <Field label="Kennzeichen / Registrierung" value={data.boat_registration} onChange={(v) => set('boat_registration', v)} />
          <Field label="Länge (m)" type="number" value={data.boat_length_m} onChange={(v) => set('boat_length_m', parseFloat(v) || '')} />
          <Field label="Breite (m)" type="number" value={data.boat_beam_m} onChange={(v) => set('boat_beam_m', parseFloat(v) || '')} />
          <Field label="Tiefgang (m)" type="number" value={data.boat_draft_m} onChange={(v) => set('boat_draft_m', parseFloat(v) || '')} />
          <Field label="Motor / Antrieb" value={data.engine_make_type} onChange={(v) => set('engine_make_type', v)} />
          <Field label="Leistung (kW/PS)" value={data.engine_power} onChange={(v) => set('engine_power', v)} />
          <Field label="Wert des Bootes" value={data.boat_value} onChange={(v) => set('boat_value', v)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Besondere Hinweise zum Boot</Label>
          <Textarea value={data.boat_notes ?? ''} onChange={(e) => set('boat_notes', e.target.value)} rows={2} />
        </div>
      </Section>

      <Section title="3 · Trailer / Transportmittel">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={!!data.trailer_on_arrival} onCheckedChange={(c) => set('trailer_on_arrival', !!c)} /> Eigener Trailer vorhanden
        </label>
        {data.trailer_on_arrival && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trailertyp / Hersteller" value={data.trailer_type} onChange={(v) => set('trailer_type', v)} />
            <Field label="Kennzeichen" value={data.trailer_registration} onChange={(v) => set('trailer_registration', v)} />
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-slate-500">Zustand / Hinweise zum Trailer</Label>
              <Textarea value={data.trailer_condition_notes ?? ''} onChange={(e) => set('trailer_condition_notes', e.target.value)} rows={2} />
            </div>
          </div>
        )}
      </Section>

      <Section title="4 · Art und Dauer der Einlagerung">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Gewünschte Einlagerung" value={data.storage_interval} onChange={(v) => set('storage_interval', v)} options={INTERVALS} />
          {data.storage_interval === 'Sonstiges' && (
            <Field label="Sonstiges (Beschreibung)" value={data.storage_interval_other} onChange={(v) => set('storage_interval_other', v)} />
          )}
          <Field label="Beginn der Einlagerung" type="date" value={data.storage_start_date} onChange={(v) => set('storage_start_date', v)} />
          <Field label="Voraussichtliches Ende" type="date" value={data.storage_end_date} onChange={(v) => set('storage_end_date', v)} />
          <SelectField label="Lagerung unter Dach" value={data.storage_under_roof} onChange={(v) => set('storage_under_roof', v)} options={ROOF_OPTIONS} />
          <Field label="Lagerort / Standort" value={data.storage_location} onChange={(v) => set('storage_location', v)} />
        </div>
      </Section>

      <Section title="5 · Preise und Zahlungsbedingungen">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Preis für die Einlagerung (EUR)" type="number" value={data.storage_price} onChange={(v) => set('storage_price', parseFloat(v) || '')} />
          <SelectField label="Abrechnungsart" value={data.storage_billing_type} onChange={(v) => set('storage_billing_type', v)} options={BILLING_TYPES} />
          <Field label="Sonstige Kosten / Nebenkosten" value={data.storage_extra_costs} onChange={(v) => set('storage_extra_costs', v)} />
        </div>
      </Section>

      <Section title="6 · Zusatzleistungen / Serviceaufträge">
        <div className="grid grid-cols-2 gap-2">
          {STORAGE_SERVICES.map((svc) => (
            <label key={svc} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={(data.storage_services || []).includes(svc)} onCheckedChange={() => toggleService(svc)} />
              {svc}
            </label>
          ))}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Weitere Aufträge / freie Liste</Label>
          <Textarea value={data.storage_services_notes ?? ''} onChange={(e) => set('storage_services_notes', e.target.value)} rows={2} />
        </div>
      </Section>

      <Section title="7 · Zustand des Bootes bei Übernahme">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={data.boat_condition_ok === true} onCheckedChange={(c) => set('boat_condition_ok', c ? true : false)} /> Ohne erkennbare äußere Schäden
        </label>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Sichtbare Schäden / Mängel</Label>
          <Textarea
            value={data.boat_condition_damages ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...data, boat_condition_damages: v, ...(v ? { boat_condition_ok: false } : {}) });
            }}
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Fotos / Übergabeprotokoll" value={data.photos_status} onChange={(v) => set('photos_status', v)} options={PHOTO_OPTIONS} />
        </div>
      </Section>

      <Section title="8 · Versicherung">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={data.boat_insured === true} onCheckedChange={(c) => set('boat_insured', c ? true : false)} /> Das Boot ist versichert
        </label>
        {data.boat_insured && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Versicherungsgesellschaft" value={data.insurance_company} onChange={(v) => set('insurance_company', v)} />
            <Field label="Polizzennummer / Vertragsnummer" value={data.insurance_policy_number} onChange={(v) => set('insurance_policy_number', v)} />
          </div>
        )}
      </Section>

      <Section title="9 · Besondere Vereinbarungen">
        <Textarea value={data.special_agreements ?? ''} onChange={(e) => set('special_agreements', e.target.value)} rows={3} />
      </Section>
    </div>
  );
}