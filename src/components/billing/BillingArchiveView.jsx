import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Receipt, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const FIRA_STATUS_BADGE = {
  not_exported: 'bg-slate-100 text-slate-600',
  queued: 'bg-blue-100 text-blue-700',
  exporting: 'bg-blue-100 text-blue-700',
  exported: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

export default function BillingArchiveView({ customers }) {
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);

  const customerMap = Object.fromEntries((customers || []).map(c => [c.id, c]));

  const getCustomerName = (cid) => {
    const c = customerMap[cid];
    if (!c) return '—';
    return c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || '—';
  };

  useEffect(() => {
    setLoading(true);
    base44.entities.Offer.filter({ source_type: 'READY_TO_INVOICE_REVIEW' }, '-created_date', 100)
      .then(setOffers)
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-500 text-sm">Loading archive…</span>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-slate-500">No archived billing offers yet</p>
        <p className="text-sm mt-1">Billing Offers created from Billing Review will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {offers.map(offer => {
        const woCount = offer.source_work_order_ids?.length || 0;
        const firaStatus = offer.fira_export_status || 'not_exported';
        const statusBadge = FIRA_STATUS_BADGE[firaStatus] || FIRA_STATUS_BADGE.not_exported;

        return (
          <Card key={offer.id} className="border-slate-200">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{offer.offer_number}</span>
                    <span className="text-slate-600 text-sm truncate">{offer.title}</span>
                    <Badge className={`text-xs ${statusBadge}`}>
                      {firaStatus === 'exported' ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" />Exported</>
                      ) : firaStatus === 'failed' ? (
                        <><AlertCircle className="h-3 w-3 mr-1" />Failed</>
                      ) : firaStatus === 'not_exported' ? (
                        'Not exported'
                      ) : (
                        firaStatus
                      )}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${
                      offer.status === 'Draft' ? 'text-slate-500 border-slate-300' :
                      offer.status === 'Converted' ? 'text-emerald-700 border-emerald-300' :
                      'text-blue-700 border-blue-300'
                    }`}>
                      {offer.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>{getCustomerName(offer.customer_id)}</span>
                    {woCount > 0 && <span>{woCount} WorkOrder{woCount !== 1 ? 's' : ''}</span>}
                    {offer.total_amount != null && (
                      <span className="font-medium text-slate-700">€{Number(offer.total_amount).toFixed(2)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(offer.created_date).toLocaleDateString('de-AT')}
                    </span>
                    {offer.fira_exported_at && (
                      <span className="text-emerald-700">
                        Exported: {new Date(offer.fira_exported_at).toLocaleDateString('de-AT')}
                        {offer.fira_exported_by && ` by ${offer.fira_exported_by}`}
                      </span>
                    )}
                  </div>
                  {offer.source_work_order_ids?.length > 0 && (
                    <p className="text-xs text-slate-400">
                      WOs: {offer.source_work_order_ids.join(', ')}
                    </p>
                  )}
                </div>
                <Link
                  to={createPageUrl('OfferDetail') + `?id=${offer.id}`}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Open Offer <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}