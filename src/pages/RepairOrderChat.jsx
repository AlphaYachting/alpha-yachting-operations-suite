import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Printer, Briefcase, Loader2, CheckCircle2, FileText } from 'lucide-react';
import RepairOrderChat from '@/components/repairorder/RepairOrderChat';
import RepairOrderForm from '@/components/repairorder/RepairOrderForm';
import { openRepairOrderPdf } from '@/components/repairorder/repairOrderPdf';
import { toast } from 'sonner';

export default function RepairOrderChatPage() {
  const [data, setData] = useState({
    order_date: new Date().toISOString().slice(0, 10),
    positions: [],
    work_categories: [],
    trailer_work: []
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

  const handlePrint = async () => {
    await persist(data);
    openRepairOrderPdf(data);
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chat */}
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> KI-Chat</h2>
          <RepairOrderChat data={data} onExtracted={handleExtracted} />
        </div>

        {/* Form preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2"><FileText className="h-4 w-4" /> Auftragsblatt (bearbeitbar)</h2>
          </div>
          <Card>
            <CardContent className="p-4 max-h-[520px] overflow-y-auto">
              <RepairOrderForm data={data} onChange={handleFormChange} />
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
            <Printer className="h-4 w-4 mr-2" /> Auftragsblatt + Arbeitszeiten drucken (PDF)
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
          <p className="text-xs text-slate-400 ml-auto">Das PDF enthält Seite 1: Reparaturauftrag zum Unterschreiben, Seite 2: Arbeitszeitenblatt für den Mechaniker.</p>
        </CardContent>
      </Card>
    </div>
  );
}