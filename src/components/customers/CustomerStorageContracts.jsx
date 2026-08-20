import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Archive, FileDown, Calendar, Trash2, RefreshCw, Mail } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { openEinlagerungsvertragPdf, generateEinlagerungsvertragPdf } from '@/components/repairorder/einlagerungsvertragPdf';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700',
  'Ready to Print': 'bg-blue-100 text-blue-700',
  Signed: 'bg-emerald-100 text-emerald-700',
  Converted: 'bg-purple-100 text-purple-700'
};

export default function CustomerStorageContracts({ customerId }) {
  const [contracts, setContracts] = useState([]);
  const [regenerating, setRegenerating] = useState(null);

  useEffect(() => {
    if (!customerId) return;
    base44.entities.RepairOrder
      .filter({ customer_id: customerId, order_type: 'storage' }, '-created_date', 50)
      .then(setContracts)
      .catch(() => setContracts([]));
  }, [customerId]);

  const handleDelete = async (id) => {
    await base44.entities.RepairOrder.delete(id);
    setContracts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleRegenerate = async (c) => {
    setRegenerating(c.id);
    try {
      const doc = generateEinlagerungsvertragPdf(c);
      const blob = doc.output('blob');
      const fileName = `Einlagerungsvertrag_${(c.customer_name || 'Kunde').replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const saved_at = new Date().toISOString();
      await base44.entities.RepairOrder.update(c.id, { contract_pdf_url: file_url, contract_saved_at: saved_at });
      setContracts((prev) => prev.map((x) => x.id === c.id ? { ...x, contract_pdf_url: file_url, contract_saved_at: saved_at } : x));
    } finally {
      setRegenerating(null);
    }
  };

  const fmt = (d) => {
    try { return format(new Date(d), 'dd.MM.yyyy'); } catch (_e) { return d; }
  };

  const handleEmail = (c) => {
    const name = c.customer_name ? ` ${c.customer_name}` : '';
    const period = [c.storage_start_date ? fmt(c.storage_start_date) : null, c.storage_end_date ? fmt(c.storage_end_date) : null]
      .filter(Boolean).join(' bis ');
    const subject = `Ihr Einlagerungsvertrag${c.order_number ? ` ${c.order_number}` : ''} – Alpha Yachting`;
    const bodyLines = [
      `Sehr geehrte/r${name},`,
      '',
      `anbei erhalten Sie Ihren Einlagerungsvertrag${c.boat_name ? ` für Ihr Boot "${c.boat_name}"` : ''}${period ? ` (Zeitraum: ${period})` : ''}.`,
      '',
      'Bitte prüfen Sie die Angaben und senden Sie uns den unterschriebenen Vertrag zurück. Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
      ...(c.contract_pdf_url ? ['', `Vertrag als PDF: ${c.contract_pdf_url}`] : []),
      '',
      'Mit freundlichen Grüßen',
      'Ihr Alpha Yachting Team',
      'AQS GROUP d.o.o. / Alpha Yachting',
      'Bužinija 32A, 52466 Novigrad, Kroatien'
    ];
    const mailto = `mailto:${encodeURIComponent(c.customer_email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
    window.location.href = mailto;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Einlagerungsverträge ({contracts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contracts.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Keine Einlagerungsverträge vorhanden</p>
        ) : (
          <div className="space-y-3">
            {contracts.map((c) => (
              <div key={c.id} className="p-4 border border-slate-200 rounded-lg">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">
                      {c.order_number || 'Einlagerungsvertrag'}
                      {c.boat_name ? ` · ${c.boat_name}` : ''}
                    </h4>
                    <p className="text-sm text-slate-500">
                      {[c.storage_interval, c.storage_location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={statusColors[c.status] || 'bg-slate-100 text-slate-700'}>{c.status}</Badge>
                    {c.contract_pdf_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={c.contract_pdf_url} target="_blank" rel="noreferrer">
                          <FileDown className="h-3.5 w-3.5 mr-1.5" />
                          Gespeichertes PDF
                        </a>
                      </Button>
                    )}
                    {c.contract_pdf_url && (
                      <Button
                        variant="outline" size="sm"
                        disabled={regenerating === c.id}
                        onClick={() => handleRegenerate(c)}
                        title="Gespeichertes PDF neu generieren"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${regenerating === c.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openEinlagerungsvertragPdf(c)}>
                      <FileDown className="h-3.5 w-3.5 mr-1.5" />
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEmail(c)} title="Per E-Mail an den Kunden senden">
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      E-Mail
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Einlagerungsvertrag löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {c.order_number || 'Dieser Vertrag'} wird dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(c.id)}>
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                  {(c.storage_start_date || c.storage_end_date) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {c.storage_start_date ? fmt(c.storage_start_date) : '–'}
                      {' – '}
                      {c.storage_end_date ? fmt(c.storage_end_date) : 'offen'}
                    </span>
                  )}
                  {c.storage_price != null && c.storage_price !== '' && (
                    <span className="font-medium text-slate-900">
                      €{Number(c.storage_price).toFixed(2)}
                      {c.storage_billing_type ? ` (${c.storage_billing_type})` : ''}
                    </span>
                  )}
                  {c.storage_under_roof && <span>Dach: {c.storage_under_roof}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}