import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Save, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { generateEinlagerungsvertragPdf } from '@/components/repairorder/einlagerungsvertragPdf';
import { toast } from 'sonner';

export default function StorageContractActions({ data, ensureOrderId, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const savePdf = async () => {
    const id = await ensureOrderId();
    if (!id) throw new Error('Vertrag konnte nicht gespeichert werden');
    const doc = generateEinlagerungsvertragPdf(data);
    const blob = doc.output('blob');
    const fileName = `Einlagerungsvertrag_${(data.customer_name || 'Kunde').replace(/[^\w]+/g, '_')}_${data.order_date || ''}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.RepairOrder.update(id, {
      contract_pdf_url: file_url,
      contract_saved_at: new Date().toISOString(),
      status: data.status === 'Signed' ? 'Signed' : 'Ready to Print'
    });
    onSaved?.({ id, contract_pdf_url: file_url });
    return { id, file_url };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePdf();
      toast.success('Einlagerungsvertrag gespeichert und im Kundenordner abgelegt');
    } catch (err) {
      toast.error('Fehler beim Speichern: ' + err.message);
    }
    setSaving(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { id, file_url } = await savePdf();
      const boatLabel = [data.boat_name, data.boat_type_model].filter(Boolean).join(' – ') || 'Ihr Boot';
      const period = [data.storage_start_date, data.storage_end_date].filter(Boolean).join(' bis ');
      const subject = `Einlagerungsvertrag ${data.order_number ? data.order_number + ' ' : ''}– ${boatLabel}`;
      const body = [
        'Sehr geehrte Damen und Herren,',
        '',
        `nachstehend erhalten Sie den Einlagerungsvertrag für ${boatLabel}.`,
        period ? `Vereinbarter Lagerzeitraum: ${period}.` : null,
        data.storage_location ? `Lagerort: ${data.storage_location}.` : null,
        '',
        'Bitte prüfen Sie den Vertrag, unterzeichnen Sie ihn und senden Sie uns ein unterschriebenes Exemplar zurück.',
        '',
        `Vertrag als PDF: ${file_url}`,
        '',
        'Mit freundlichen Grüßen',
        'Alpha Yachting'
      ].filter((l) => l !== null).join('\n');

      window.location.href = `mailto:${encodeURIComponent(data.customer_email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      await base44.entities.RepairOrder.update(id, { contract_sent_at: new Date().toISOString() });
      toast.success('E-Mail-Programm wurde mit dem Vertrag geöffnet');
    } catch (err) {
      toast.error('Fehler: ' + err.message);
    }
    setSending(false);
  };

  return (
    <>
      <Button onClick={handleSave} disabled={saving} variant="outline">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Vertrag speichern (Kundenordner)
      </Button>
      <Button onClick={handleSend} disabled={sending} className="bg-emerald-600 hover:bg-emerald-700">
        {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
        E-Mail an Kunden vorbereiten
      </Button>
      {data.contract_sent_at && (
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          gesendet
        </span>
      )}
    </>
  );
}