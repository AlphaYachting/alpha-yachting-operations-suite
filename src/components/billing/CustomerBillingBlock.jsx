import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Users, Ship, Briefcase, Clock, Package, ChevronRight,
  Receipt, Loader2, AlertTriangle, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const WO_TYPE_BADGE = {
  EXECUTION: 'bg-purple-50 text-purple-700 border-purple-300',
  STANDARD: 'bg-slate-50 text-slate-700 border-slate-300',
  ORGANIZATION: 'bg-blue-50 text-blue-700 border-blue-300',
};

export default function CustomerBillingBlock({
  customer,
  workOrders,      // eligible WOs for this customer
  jobs,            // all jobs (for lookup)
  boats,           // all boats
  technicians,
  timeEntries,     // all TEs (filtered to this customer's WOs)
  materialUsages,  // all MUs (filtered to this customer's WOs)
  linkedCME,       // CME linked to WO/job
  unlinkedCME,     // CME with no WO/job link
  onCreateOffer,   // fn(work_order_ids) => Promise
  createdOffer,    // result after creation
}) {
  const [selectedWOIds, setSelectedWOIds] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const customerName = customer?.company_name ||
    `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown Customer';

  const jobMap = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);
  const boatMap = useMemo(() => Object.fromEntries(boats.map(b => [b.id, b])), [boats]);
  const techMap = useMemo(() => Object.fromEntries(technicians.map(t => [t.id, t])), [technicians]);

  // Per-WO unbilled totals
  const woTotals = useMemo(() => {
    const result = {};
    for (const wo of workOrders) {
      const woTE = timeEntries.filter(te =>
        te.work_order_id === wo.id && te.is_billable === true &&
        !te.billed_offer_id && !te.staged_offer_id
      );
      const woMU = materialUsages.filter(m =>
        m.work_order_id === wo.id && m.billable === true &&
        !m.billed_offer_id && !m.staged_offer_id
      );
      const laborTotal = woTE.reduce((sum, te) => {
        const rate = techMap[te.technician_id]?.hourly_rate_billable || 0;
        return sum + rate * ((te.duration_minutes || 0) / 60);
      }, 0);
      const materialTotal = woMU.reduce((sum, m) => sum + (m.unit_price || 0) * (m.quantity || 1), 0);
      result[wo.id] = { laborTotal, materialTotal, teCount: woTE.length, muCount: woMU.length };
    }
    return result;
  }, [workOrders, timeEntries, materialUsages, techMap]);

  const customerTotals = useMemo(() => {
    let labor = 0, material = 0;
    for (const wo of workOrders) {
      labor += woTotals[wo.id]?.laborTotal || 0;
      material += woTotals[wo.id]?.materialTotal || 0;
    }
    const cmeTotal = linkedCME.filter(c => !c.billed_offer_id && !c.staged_offer_id)
      .reduce((sum, c) => sum + (c.total_purchase_price || 0), 0);
    return { labor, material, cme: cmeTotal, total: labor + material + cmeTotal };
  }, [workOrders, woTotals, linkedCME]);

  const selectedTotal = [...selectedWOIds].reduce((sum, id) => {
    const t = woTotals[id];
    return sum + (t?.laborTotal || 0) + (t?.materialTotal || 0);
  }, 0);

  const toggleWO = (id) => {
    setSelectedWOIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedWOIds(prev =>
      prev.size === workOrders.length ? new Set() : new Set(workOrders.map(w => w.id))
    );
  };

  const handleCreate = async () => {
    if (selectedWOIds.size === 0) return;
    setCreating(true);
    try {
      await onCreateOffer([...selectedWOIds]);
      setSelectedWOIds(new Set());
    } finally {
      setCreating(false);
    }
  };

  const activeLinkedCME = linkedCME.filter(c => !c.billed_offer_id && !c.staged_offer_id);

  return (
    <Card className="border-slate-200">
      {/* Customer Header */}
      <CardHeader className="pb-0">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{customerName}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                <span>{workOrders.length} WO{workOrders.length !== 1 ? 's' : ''}</span>
                <span>Labor: <strong className="text-blue-700">€{customerTotals.labor.toFixed(2)}</strong></span>
                <span>Material: <strong className="text-green-700">€{customerTotals.material.toFixed(2)}</strong></span>
                {customerTotals.cme > 0 && <span>Cust. Mat: <strong className="text-amber-700">€{customerTotals.cme.toFixed(2)}</strong></span>}
                <span className="font-semibold text-slate-700">Total: €{customerTotals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unlinkedCME.length > 0 && (
              <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs gap-1">
                <AlertTriangle className="h-3 w-3" />
                {unlinkedCME.length} unlinked
              </Badge>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4 space-y-4">
          {/* Created Offer Banner */}
          {createdOffer && (
            <Alert className="bg-emerald-50 border-emerald-300">
              <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
                <span className="text-emerald-800 text-sm">
                  <strong>Offer created:</strong> {createdOffer.offer_number} — {createdOffer.line_items_created} line items
                </span>
                <Link
                  to={createPageUrl('OfferDetail') + `?id=${createdOffer.offer_id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700"
                >
                  Open Offer <ExternalLink className="h-3 w-3" />
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* WorkOrders header row */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
              <Checkbox
                checked={selectedWOIds.size === workOrders.length && workOrders.length > 0}
                onCheckedChange={toggleAll}
              />
              Select all WorkOrders
            </label>
            <div className="flex items-center gap-3">
              {selectedWOIds.size > 0 && (
                <span className="text-xs text-slate-500">
                  Selected: <strong>€{selectedTotal.toFixed(2)}</strong>
                </span>
              )}
              <Button
                type="button"
                onClick={handleCreate}
                disabled={selectedWOIds.size === 0 || creating}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {creating
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating…</>
                  : <><Receipt className="h-3.5 w-3.5 mr-1.5" />Create Billing Offer ({selectedWOIds.size})</>
                }
              </Button>
            </div>
          </div>

          {/* WorkOrders list */}
          <div className="space-y-2">
            {workOrders.map(wo => {
              const job = jobMap[wo.job_id];
              const boat = boatMap[job?.boat_id];
              const totals = woTotals[wo.id] || {};
              const isSelected = selectedWOIds.has(wo.id);

              return (
                <div
                  key={wo.id}
                  onClick={() => toggleWO(wo.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleWO(wo.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{wo.work_order_number}</span>
                      <span className="text-slate-700 text-sm truncate">{wo.title}</span>
                      {wo.workorder_type && wo.workorder_type !== 'STANDARD' && (
                        <Badge variant="outline" className={`text-xs ${WO_TYPE_BADGE[wo.workorder_type]}`}>
                          {wo.workorder_type}
                        </Badge>
                      )}
                      <Badge className="bg-amber-100 text-amber-700 text-xs">Ready to Invoice</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      {boat && <span className="flex items-center gap-1"><Ship className="h-3 w-3" />{boat.vessel_name}</span>}
                      {job && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{job.title}</span>}
                      {(wo.scheduled_date || wo.actual_end_time) && (
                        <span>{wo.actual_end_time
                          ? `Done: ${new Date(wo.actual_end_time).toLocaleDateString('de-AT')}`
                          : `Scheduled: ${wo.scheduled_date}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs font-medium ${totals.teCount > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                        <Clock className="h-3 w-3" />
                        €{(totals.laborTotal || 0).toFixed(2)} <span className="font-normal text-slate-400">({totals.teCount || 0} entries)</span>
                      </span>
                      <span className={`flex items-center gap-1 text-xs font-medium ${totals.muCount > 0 ? 'text-green-700' : 'text-slate-400'}`}>
                        <Package className="h-3 w-3" />
                        €{(totals.materialTotal || 0).toFixed(2)} <span className="font-normal text-slate-400">({totals.muCount || 0} items)</span>
                      </span>
                    </div>
                  </div>
                  <Link
                    to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                    onClick={e => e.stopPropagation()}
                    className="shrink-0 p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                    title="Open WorkOrder Detail"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Linked Customer Material */}
          {activeLinkedCME.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-slate-400" />
                Linked Customer Material ({activeLinkedCME.length})
                <span className="font-normal text-slate-400">— included automatically when creating offer</span>
              </p>
              {activeLinkedCME.map(cme => (
                <div key={cme.id} className="flex items-center justify-between gap-3 text-xs text-slate-700 bg-white rounded border border-slate-200 px-3 py-2">
                  <span className="font-medium truncate">{cme.item_title}</span>
                  <span className="shrink-0 text-slate-500">
                    {cme.quantity || 1} {cme.unit || 'pcs'} · €{Number(cme.total_purchase_price || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Unlinked Customer Material Warning */}
          {unlinkedCME.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Unlinked Customer Material ({unlinkedCME.length}) — needs manual review
              </p>
              <p className="text-xs text-amber-700">
                These items are not linked to any WorkOrder or Project and will NOT be included in the Billing Offer automatically.
                Assign to a WorkOrder or Project first.
              </p>
              {unlinkedCME.map(cme => (
                <div key={cme.id} className="flex items-center justify-between gap-3 text-xs text-amber-900 bg-amber-100/60 rounded border border-amber-200 px-3 py-2">
                  <div className="min-w-0">
                    <span className="font-medium">{cme.item_title}</span>
                    {cme.supplier_name && <span className="text-amber-700 ml-2">· {cme.supplier_name}</span>}
                  </div>
                  <span className="shrink-0">
                    {cme.quantity || 1} {cme.unit || 'pcs'} · €{Number(cme.total_purchase_price || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}