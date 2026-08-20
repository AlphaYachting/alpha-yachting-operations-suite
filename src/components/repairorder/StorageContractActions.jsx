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
    if (!data.customer_email) {
      toast.error('Keine E-Mail-Adresse beim Kunden hinterlegt');
      return;
    }
    setSending(true);
    try {
      const { id } = await savePdf();
      const res = await base44.functions.invoke('sendStorageContractEmail', { repair_order_id: id });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`Vertrag per E-Mail an ${res.data.to} gesendet`);
    } catch (err) {
      toast.error('Fehler beim Senden: ' + err.message);
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
        Per E-Mail an Kunden senden
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