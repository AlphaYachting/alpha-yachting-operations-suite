import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Printer, Briefcase, Loader2, CheckCircle2, FileText, Warehouse } from 'lucide-react';
import RepairOrderChat from '@/components/repairorder/RepairOrderChat';
import RepairOrderForm from '@/components/repairorder/RepairOrderForm';
import StorageOrderForm from '@/components/repairorder/StorageOrderForm';
import CustomerPicker from '@/components/repairorder/CustomerPicker';
import StorageOfferPicker from '@/components/repairorder/StorageOfferPicker';
import { openRepairOrderPdf } from '@/components/repairorder/repairOrderPdf';
import { openEinlagerungsvertragPdf } from '@/components/repairorder/einlagerungsvertragPdf';
import { toast } from 'sonner';

export default function RepairOrderChatPage() {
  const [data, setData] = useState({
    order_type: 'repair',
    order_date: new Date().toISOString().slice(0, 10),
    positions: [],
    work_categories: [],
    trailer_work: [],
    storage_services: []
  });
  const [orderId, setOrderId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertedJobId, setConvertedJobId] = useState(null);

  // Load acceptor name from current user
  useEffect(() => {
    base44.auth.me().then((u) => {
      setData((d) => ({ ...d, accepted_by: d.accepted_by || u?.full_name || '' }));
    }).catch(() => {});
  }, []);

  const persist = async (payload) => {
    setSaving(true);
    try {
      if (orderId) {
        await base44.entities.RepairOrder.update(orderId, payload);
      } else {
        const created = await base44.entities.RepairOrder.create({ ...payload, status: 'Draft' });
        setOrderId(created.id);
        return created;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExtracted = async (merged) => {
    setData(merged);
    await persist(merged);
  };

  const handleFormChange = (updated) => {
    setData(updated);
  };

  const mode = data.order_type || 'repair';
  const setMode = (m) => setData((d) => ({ ...d, order_type: m }));

  const applyCustomer = async (c) => {
    const name = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
    const address = [
      c.billing_address,
      [c.billing_postal_code, c.billing_city].filter(Boolean).join(' '),
      c.billing_country
    ].filter(Boolean).join(', ');
    setData((d) => ({
      ...d,
      customer_id: c.id,
      customer_name: name,
      customer_address: address || d.customer_address,
      customer_phone: c.phone || d.customer_phone,
      customer_email: c.email || d.customer_email,
      customer_tax_id: c.vat_number || d.customer_tax_id
    }));
    // Auto-select the customer's boat
    try {
      const boats = await base44.entities.Boat.filter({ customer_id: c.id });
      if (boats.length > 0) {
        const b = boats[0];
        setData((d) => ({
          ...d,
          boat_id: b.id,
          boat_name: b.vessel_name || d.boat_name,
          boat_type_model: [b.manufacturer, b.model].filter(Boolean).join(' ') || d.boat_type_model,
          boat_year: b.year ? String(b.year) : d.boat_year,
          boat_registration: b.registration_number || d.boat_registration,
          boat_length_m: b.length_m || d.boat_length_m,
          boat_beam_m: b.beam_m || d.boat_beam_m,
          boat_draft_m: b.draft_m || d.boat_draft_m,
          engine_make_type: [b.engine_manufacturer, b.engine_model].filter(Boolean).join(' ') || d.engine_make_type,
          engine_hours: b.engine_hours ? String(b.engine_hours) : d.engine_hours
        }));
        if (boats.length > 1) {
          toast.info(`Kunde hat ${boats.length} Boote – das erste wurde übernommen, bitte ggf. anpassen.`);
        }
      }
    } catch (_e) { /* boat lookup failed silently */ }
  };

  const clearCustomer = () => setData((d) => ({ ...d, customer_id: '', boat_id: '', source_offer_id: '' }));

  const applyOffer = (offer, tasks) => {
    setData((d) => {
      const serviceLines = (tasks || [])
        .filter((t) => t.item_type !== 'Chapter')
        .map((t) => {
          const total = t.total_amount != null ? ` – ${t.total_amount} €` : '';
          return `• ${t.title}${total}`;
        });
      const notesHeader = `Gemäß Angebot ${offer.offer_number || offer.title}:`;
      return {
        ...d,
        source_offer_id: offer.id,
        storage_price: offer.total_amount ?? offer.subtotal ?? d.storage_price,
        storage_billing_type: d.storage_billing_type || 'Pauschalpreis',
        storage_interval: d.storage_interval || (offer.storage_period ? 'Winterlagerung / Saisonlagerung' : d.storage_interval),
        storage_interval_other: offer.storage_period || d.storage_interval_other,
        storage_under_roof: offer.roof_option === true ? 'Ja' : (offer.roof_option === false ? d.storage_under_roof || 'Nein' : d.storage_under_roof),
        boat_length_m: d.boat_length_m || offer.boat_length || '',
        storage_services_notes: serviceLines.length > 0
          ? [notesHeader, ...serviceLines].join('\n')
          : d.storage_services_notes,
        special_agreements: d.special_agreements
          ? d.special_agreements
          : `Preise und Leistungen gemäß Angebot ${offer.offer_number || offer.title}.`
      };
    });
    toast.success(`Angebotsdaten aus ${offer.offer_number || offer.title} übernommen`);
  };

  const handlePrint = async () => {
    await persist(data);
    if (mode === 'storage') openEinlagerungsvertragPdf(data);
    else openRepairOrderPdf(data);
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      let id = orderId;
      if (!id) {
        const created = await persist(data);
        id = created?.id;
      } else {
        await persist(data);
      }
      const res = await base44.functions.invoke('convertRepairOrderToJob', { repair_order_id: id });
      if (res.data?.error) throw new Error(res.data.error);
      setConvertedJobId(res.data.job_id);
      toast.success(`Projekt ${res.data.job_number} angelegt`);
    } catch (err) {
      toast.error('Fehler: ' + err.message);
    }
    setConverting(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <MessageSquare className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Auftrags-Chat</h1>
          <p className="text-slate-500 text-sm mt-1">Dokumente per KI auslesen und Reparaturauftrag erstellen</p>
        </div>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-slate-400 ml-auto" />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={mode === 'repair' ? 'default' : 'outline'} size="sm" onClick={() => setMode('repair')}>
          <FileText className="h-4 w-4 mr-2" /> Reparaturauftrag
        </Button>
        <Button variant={mode === 'storage' ? 'default' : 'outline'} size="sm" onClick={() => setMode('storage')}>
          <Warehouse className="h-4 w-4 mr-2" /> Einlagerungsvertrag
        </Button>
        <div className="ml-auto flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-72">
            <CustomerPicker
              customerId={data.customer_id}
              customerName={data.customer_name}
              onSelect={applyCustomer}
              onClear={clearCustomer}
            />
          </div>
          {data.customer_id && (
            <div className="w-full sm:w-72">
              <StorageOfferPicker
                customerId={data.customer_id}
                selectedOfferId={data.source_offer_id}
                onApply={applyOffer}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chat */}
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> KI-Chat</h2>
          <RepairOrderChat data={data} onExtracted={handleExtracted} />
        </div>

        {/* Form preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2"><FileText className="h-4 w-4" /> {mode === 'storage' ? 'Einlagerungsvertrag (bearbeitbar)' : 'Auftragsblatt (bearbeitbar)'}</h2>
          </div>
          <Card>
            <CardContent className="p-4 max-h-[520px] overflow-y-auto">
              {mode === 'storage'
                ? <StorageOrderForm data={data} onChange={handleFormChange} />
                : <RepairOrderForm data={data} onChange={handleFormChange} />}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abschluss</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            {mode === 'storage' ? 'Einlagerungsvertrag drucken (PDF)' : 'Auftragsblatt + Arbeitszeiten drucken (PDF)'}
          </Button>
          {convertedJobId ? (
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <a href={`/JobDetail?id=${convertedJobId}`}><CheckCircle2 className="h-4 w-4 mr-2" /> Projekt öffnen</a>
            </Button>
          ) : (
            <Button onClick={handleConvert} disabled={converting} className="bg-blue-600 hover:bg-blue-700">
              {converting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Briefcase className="h-4 w-4 mr-2" />}
              Projekt (Job) mit Kunde + Boot anlegen
            </Button>
          )}
          <p className="text-xs text-slate-400 ml-auto">
            {mode === 'storage'
              ? 'Das PDF enthält den vollständigen Einlagerungsvertrag inkl. aller Vertragsbedingungen zum Unterschreiben.'
              : 'Das PDF enthält Seite 1: Reparaturauftrag zum Unterschreiben, Seite 2: Arbeitszeitenblatt für den Mechaniker.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}