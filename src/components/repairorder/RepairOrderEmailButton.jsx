import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Mail, Loader2 } from 'lucide-react';
import { generateRepairOrderPdf } from '@/components/repairorder/repairOrderPdf';
import { toast } from 'sonner';

export function buildRepairOrderEmail(order, pdfUrl) {
  const salutation = order.customer_name
    ? `Sehr geehrte/r ${order.customer_name},`
    : 'Sehr geehrte Damen und Herren,';
  const boatLabel = [order.boat_name, order.boat_type_model].filter(Boolean).join(' – ') || 'Ihr Boot';
  const subject = `Reparaturauftrag${order.order_number ? ` ${order.order_number}` : ''} – ${boatLabel} · Bitte um Bestätigung`;
  const body = [
    salutation,
    '',
    `vielen Dank für Ihr Vertrauen. Anbei erhalten Sie den Reparaturauftrag für ${boatLabel}${order.order_number ? ` (Auftrags-Nr. ${order.order_number})` : ''} mit den vereinbarten Arbeiten.`,
    '',
    order.work_description ? `Beauftragte Arbeiten:\n${order.work_description}` : null,
    order.hourly_rate ? `Stundensatz: ${order.hourly_rate} € netto` : null,
    order.cost_cap ? `Kostenobergrenze ohne Rückfrage: ${order.cost_cap} €` : null,
    order.expected_completion ? `Voraussichtliche Fertigstellung: ${order.expected_completion}` : null,
    '',
    'Bitte prüfen Sie die Angaben und bestätigen Sie uns den Auftrag kurz per Antwort auf diese E-Mail oder senden Sie uns das unterschriebene PDF zurück. Erst nach Ihrer Bestätigung beginnen wir mit der Ausführung.',
    pdfUrl ? `\nReparaturauftrag als PDF: ${pdfUrl}` : null,
    '',
    'Für Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.',
    '',
    'Mit freundlichen Grüßen',
    'Ihr Alpha Yachting Team',
    'AQS GROUP d.o.o. / Alpha Yachting',
    'Bužinija 32A, 52466 Novigrad, Kroatien'
  ].filter((l) => l !== null).join('\n');

  return { subject, body };
}

export default function RepairOrderEmailButton({ order, ensureOrderId, onSaved, variant = 'outline', size }) {
  const [busy, setBusy] = useState(false);

  const handleSend = async () => {
    setBusy(true);
    try {
      const id = ensureOrderId ? await ensureOrderId() : order.id;
      let pdfUrl = order.contract_pdf_url;
      if (!pdfUrl) {
        const doc = generateRepairOrderPdf(order);
        const fileName = `Reparaturauftrag_${(order.customer_name || 'Kunde').replace(/[^\w]+/g, '_')}_${order.order_date || ''}.pdf`;
        const file = new File([doc.output('blob')], fileName, { type: 'application/pdf' });
        const uploaded = await base44.integrations.Core.UploadFile({ file });
        pdfUrl = uploaded.file_url;
      }
      if (id) {
        await base44.entities.RepairOrder.update(id, {
          contract_pdf_url: pdfUrl,
          contract_saved_at: order.contract_saved_at || new Date().toISOString(),
          contract_sent_at: new Date().toISOString()
        });
      }
      onSaved?.({ contract_pdf_url: pdfUrl });

      const { subject, body } = buildRepairOrderEmail(order, pdfUrl);
      window.location.href = `mailto:${encodeURIComponent(order.customer_email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      toast.success('E-Mail-Programm mit dem Reparaturauftrag geöffnet');
    } catch (err) {
      toast.error('Fehler: ' + err.message);
    }
    setBusy(false);
  };

  return (
    <Button onClick={handleSend} disabled={busy} variant={variant} size={size}>
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
      E-Mail an Kunden (Bestätigung)
    </Button>
  );
}