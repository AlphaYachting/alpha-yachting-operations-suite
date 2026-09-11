import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, FileDown, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { openRepairOrderPdf } from '@/components/repairorder/repairOrderPdf';
import RepairOrderEmailButton from '@/components/repairorder/RepairOrderEmailButton';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700',
  'Ready to Print': 'bg-blue-100 text-blue-700',
  Signed: 'bg-emerald-100 text-emerald-700',
  Converted: 'bg-purple-100 text-purple-700'
};

export default function CustomerRepairOrders({ customerId }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!customerId) return;
    base44.entities.RepairOrder
      .filter({ customer_id: customerId, order_type: 'repair' }, '-created_date', 50)
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [customerId]);

  const fmt = (d) => {
    try { return format(new Date(d), 'dd.MM.yyyy'); } catch (_e) { return d; }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Reparaturaufträge ({orders.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Keine Reparaturaufträge vorhanden</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="p-4 border border-slate-200 rounded-lg">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">
                      {o.order_number || 'Reparaturauftrag'}
                      {o.boat_name ? ` · ${o.boat_name}` : ''}
                    </h4>
                    {o.work_description && (
                      <p className="text-sm text-slate-500 line-clamp-2">{o.work_description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={statusColors[o.status] || 'bg-slate-100 text-slate-700'}>{o.status}</Badge>
                    {o.contract_pdf_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={o.contract_pdf_url} target="_blank" rel="noreferrer">
                          <FileDown className="h-3.5 w-3.5 mr-1.5" />
                          Gespeichertes PDF
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openRepairOrderPdf(o)}>
                      <FileDown className="h-3.5 w-3.5 mr-1.5" />
                      PDF
                    </Button>
                    <RepairOrderEmailButton
                      order={o}
                      size="sm"
                      onSaved={({ contract_pdf_url }) =>
                        setOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, contract_pdf_url } : x))
                      }
                    />
                    {o.converted_job_id && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/JobDetail?id=${o.converted_job_id}`}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Projekt
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                  {o.order_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {fmt(o.order_date)}
                    </span>
                  )}
                  {o.accepted_by && <span>Angenommen von: {o.accepted_by}</span>}
                  {o.contract_saved_at && <span>PDF archiviert: {fmt(o.contract_saved_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}