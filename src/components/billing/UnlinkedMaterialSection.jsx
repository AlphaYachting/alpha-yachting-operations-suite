import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package } from 'lucide-react';

export default function UnlinkedMaterialSection({ unlinkedCME, customerMap }) {
  if (!unlinkedCME || unlinkedCME.length === 0) return null;

  // Group by customer
  const grouped = {};
  for (const cme of unlinkedCME) {
    const key = cme.customer_id || 'unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(cme);
  }

  const getCustomerName = (customerId) => {
    const c = customerMap[customerId];
    if (!c) return 'Unknown Customer';
    return c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
  };

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Unlinked Customer Material
          <Badge variant="outline" className="text-amber-700 border-amber-300">{unlinkedCME.length}</Badge>
        </CardTitle>
        <p className="text-sm text-amber-700">
          These customer-ordered materials are not linked to any WorkOrder or Project.
          They will NOT be included automatically in any Billing Offer.
          Assign them to a WorkOrder or Project before billing.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(grouped).map(([customerId, items]) => (
          <div key={customerId}>
            <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-400" />
              {getCustomerName(customerId)}
              <Badge variant="outline" className="text-xs">{items.length} item{items.length > 1 ? 's' : ''}</Badge>
            </p>
            <div className="space-y-2">
              {items.map(cme => (
                <div key={cme.id} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800">{cme.item_title}</p>
                    {(cme.supplier_name || cme.document_number) && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cme.supplier_name && <span>Supplier: {cme.supplier_name}</span>}
                        {cme.supplier_name && cme.document_number && <span> · </span>}
                        {cme.document_number && <span>Doc: {cme.document_number}</span>}
                        {cme.document_date && <span> ({cme.document_date})</span>}
                      </p>
                    )}
                    {cme.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{cme.notes}</p>}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="font-medium text-slate-800">
                      {cme.quantity || 1} {cme.unit || 'pcs'}
                    </p>
                    {cme.total_purchase_price != null && (
                      <p className="text-xs text-slate-500">€{Number(cme.total_purchase_price).toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}