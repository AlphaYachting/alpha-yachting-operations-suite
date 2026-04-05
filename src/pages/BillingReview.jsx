import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle, ExternalLink, Loader2, Receipt, Clock, Package,
  ChevronRight, Ship, Briefcase, Users, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import UnlinkedMaterialSection from '@/components/billing/UnlinkedMaterialSection';

const WO_TYPE_BADGE = {
  EXECUTION: 'bg-purple-50 text-purple-700 border-purple-300',
  STANDARD: 'bg-slate-50 text-slate-700 border-slate-300',
  ORGANIZATION: 'bg-blue-50 text-blue-700 border-blue-300',
};

export default function BillingReview() {
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [materialUsages, setMaterialUsages] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [unlinkedCME, setUnlinkedCME] = useState([]);
  const [selectedWOIds, setSelectedWOIds] = useState(new Set());
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [creating, setCreating] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [createdOffer, setCreatedOffer] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      // Load Ready-to-Invoice WOs (exclude ORGANIZATION type — they are never billable)
      const allWOs = await base44.entities.WorkOrder.filter({ status: 'Ready to Invoice' });
      const eligibleWOs = allWOs.filter(wo => wo.workorder_type !== 'ORGANIZATION');

      // Load supporting context in parallel
      const woIds = eligibleWOs.map(wo => wo.id);
      const jobIds = [...new Set(eligibleWOs.map(wo => wo.job_id).filter(Boolean))];

      const [jobList, techList, allCustomers, allBoats] = await Promise.all([
        base44.entities.Job.list('-created_date', 500),
        base44.entities.Technician.list('-created_date', 200),
        base44.entities.Customer.list('-created_date', 500),
        base44.entities.Boat.list('-created_date', 500),
      ]);

      setJobs(jobList);
      setTechnicians(techList);
      setCustomers(allCustomers);
      setBoats(allBoats);
      setWorkOrders(eligibleWOs);

      // Load TimeEntries and MaterialUsage for all eligible WOs
      const [teAll, muAll] = await Promise.all([
        Promise.all(woIds.map(id => base44.entities.TimeEntry.filter({ work_order_id: id }))).then(r => r.flat()),
        Promise.all(woIds.map(id => base44.entities.MaterialUsage.filter({ work_order_id: id }))).then(r => r.flat()),
      ]);

      setTimeEntries(teAll);
      setMaterialUsages(muAll);

      // Load unlinked CME per unique customer
      const customerIds = [...new Set(jobList.filter(j => jobIds.includes(j.id)).map(j => j.customer_id).filter(Boolean))];
      const cmeResults = await Promise.all(
        customerIds.map(cid =>
          base44.functions.invoke('getUnlinkedCustomerMaterial', { customer_id: cid })
            .then(r => r.data?.records || [])
            .catch(() => [])
        )
      );
      setUnlinkedCME(cmeResults.flat());
    } catch (e) {
      setError(e.message);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  // Per-WO unbilled totals (exclude already billed or staged items)
  const woTotals = useMemo(() => {
    const techMap = Object.fromEntries(technicians.map(t => [t.id, t]));
    const result = {};
    for (const wo of workOrders) {
      const woTE = timeEntries.filter(te =>
        te.work_order_id === wo.id &&
        te.is_billable === true &&
        !te.billed_offer_id &&
        !te.staged_offer_id
      );
      const woMU = materialUsages.filter(m =>
        m.work_order_id === wo.id &&
        m.billable === true &&
        !m.billed_offer_id &&
        !m.staged_offer_id
      );
      const laborTotal = woTE.reduce((sum, te) => {
        const tech = techMap[te.technician_id];
        const rate = tech?.hourly_rate_billable || 0;
        return sum + rate * ((te.duration_minutes || 0) / 60);
      }, 0);
      const materialTotal = woMU.reduce((sum, m) => {
        return sum + (m.unit_price || 0) * (m.quantity || 1);
      }, 0);
      result[wo.id] = {
        laborTotal,
        materialTotal,
        teCount: woTE.length,
        muCount: woMU.length,
        hasAvailableItems: woTE.length > 0 || woMU.length > 0,
      };
    }
    return result;
  }, [workOrders, timeEntries, materialUsages, technicians]);

  const jobMap = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);
  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c])), [customers]);
  const boatMap = useMemo(() => Object.fromEntries(boats.map(b => [b.id, b])), [boats]);

  const getCustomerName = (customerId) => {
    const c = customerMap[customerId];
    if (!c) return '—';
    return c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || '—';
  };

  const toggleWO = (id) => {
    setSelectedWOIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedWOIds.size === workOrders.length) {
      setSelectedWOIds(new Set());
    } else {
      setSelectedWOIds(new Set(workOrders.map(wo => wo.id)));
    }
  };

  const handleReconcile = async (dryRun) => {
    setReconciling(true);
    setReconcileResult(null);
    setShowApplyConfirm(false);
    try {
      const response = await base44.functions.invoke('reconcileReadyToInvoiceWorkOrders', { dry_run: dryRun });
      const result = response.data;
      setReconcileResult({ ...result, dry_run: dryRun });
      if (!dryRun && result?.success) {
        await loadAll(true); // background refresh — no full-page spinner
      }
    } catch (e) {
      setReconcileResult({ error: e.message });
      toast.error('Reconciliation failed: ' + e.message);
    } finally {
      setReconciling(false);
    }
  };

  const handleCreateOffer = async () => {
    if (selectedWOIds.size === 0) {
      toast.error('Select at least one WorkOrder');
      return;
    }
    setCreating(true);
    setError(null);
    setCreatedOffer(null);
    try {
      const response = await base44.functions.invoke('createBillingOfferFromWO', {
        work_order_ids: [...selectedWOIds],
      });
      const result = response.data;
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create billing offer');
      }
      setCreatedOffer(result);
      setSelectedWOIds(new Set());
      toast.success(`Billing Offer ${result.offer_number} created`);
      // Reload to refresh staged states
      await loadAll();
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const selectedTotal = [...selectedWOIds].reduce((sum, id) => {
    const t = woTotals[id];
    return sum + (t?.laborTotal || 0) + (t?.materialTotal || 0);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 mr-3" />
        <span className="text-slate-500">Loading billing data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-600" />
            Billing Review
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Select Ready-to-Invoice WorkOrders → Create Billing Offer → Finalize in Offer module
          </p>
        </div>
        <Button
          onClick={loadAll}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Created Offer Banner */}
      {createdOffer && (
        <Alert className="bg-emerald-50 border-emerald-300">
          <AlertCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-emerald-800">
              <strong>Billing Offer created:</strong> {createdOffer.offer_number} —{' '}
              {createdOffer.line_items_created} line items
              {createdOffer.warnings?.length > 0 && (
                <span className="ml-2 text-amber-700">({createdOffer.warnings.length} warning{createdOffer.warnings.length > 1 ? 's' : ''})</span>
              )}
            </span>
            <Link
              to={createPageUrl('OfferDetail') + `?id=${createdOffer.offer_id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              Open in Offer Module
              <ExternalLink className="h-4 w-4" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Ready-to-Invoice WorkOrders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Ready to Invoice WorkOrders
              <Badge variant="outline">{workOrders.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-3">
              {workOrders.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <Checkbox
                    checked={selectedWOIds.size === workOrders.length && workOrders.length > 0}
                    onCheckedChange={toggleAll}
                  />
                  Select all
                </label>
              )}
              <Button
                onClick={handleCreateOffer}
                disabled={selectedWOIds.size === 0 || creating}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {creating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                ) : (
                  <><Receipt className="h-4 w-4 mr-2" />Create Billing Offer ({selectedWOIds.size})</>
                )}
              </Button>
            </div>
          </div>
          {selectedWOIds.size > 0 && (
            <p className="text-sm text-slate-500 mt-1">
              Selected total (labor + material): <strong>€{selectedTotal.toFixed(2)}</strong>
            </p>
          )}
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No WorkOrders with status "Ready to Invoice"</p>
              <p className="text-sm mt-1">WorkOrders transition here automatically when all tasks are complete.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workOrders.map(wo => {
                const job = jobMap[wo.job_id];
                const customer = customerMap[job?.customer_id];
                const boat = boatMap[job?.boat_id];
                const totals = woTotals[wo.id] || {};
                const isSelected = selectedWOIds.has(wo.id);
                const hasItems = totals.hasAvailableItems;

                return (
                  <div
                    key={wo.id}
                    onClick={() => toggleWO(wo.id)}
                    className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleWO(wo.id)}
                      onClick={e => e.stopPropagation()}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
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
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        {customer && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {getCustomerName(job?.customer_id)}
                          </span>
                        )}
                        {boat && (
                          <span className="flex items-center gap-1">
                            <Ship className="h-3.5 w-3.5" />
                            {boat.vessel_name}
                          </span>
                        )}
                        {job && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" />
                            {job.title}
                          </span>
                        )}
                        {(wo.scheduled_date || wo.actual_end_time) && (
                          <span>
                            {wo.actual_end_time
                              ? `Done: ${new Date(wo.actual_end_time).toLocaleDateString('de-AT')}`
                              : `Scheduled: ${wo.scheduled_date}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className={`flex items-center gap-1 text-xs font-medium ${totals.teCount > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                          <Clock className="h-3.5 w-3.5" />
                          Labor: €{(totals.laborTotal || 0).toFixed(2)}
                          <span className="text-slate-400 font-normal">({totals.teCount || 0} entries)</span>
                        </span>
                        <span className={`flex items-center gap-1 text-xs font-medium ${totals.muCount > 0 ? 'text-green-700' : 'text-slate-400'}`}>
                          <Package className="h-3.5 w-3.5" />
                          Material: €{(totals.materialTotal || 0).toFixed(2)}
                          <span className="text-slate-400 font-normal">({totals.muCount || 0} items)</span>
                        </span>
                        {!hasItems && (
                          <Badge variant="outline" className="text-xs text-slate-400 border-slate-300">
                            No unbilled items found
                          </Badge>
                        )}
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
          )}
        </CardContent>
      </Card>

      {/* Unlinked Customer Material */}
      <UnlinkedMaterialSection
        unlinkedCME={unlinkedCME}
        customers={customers}
        customerMap={customerMap}
      />

      {/* Admin-only Reconciliation Block */}
      {isAdmin && (
        <Card className="border-slate-300 bg-slate-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-slate-400" />
              Ready-to-Invoice Reconciliation
              <Badge variant="outline" className="text-xs text-slate-500 border-slate-300">Admin only</Badge>
            </CardTitle>
            <p className="text-xs text-slate-500">
              Scans historical WorkOrders and sets them to the correct terminal status if all tasks already meet completion criteria.
              Dry Run is always safe — no changes are written.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleReconcile(true)}
                disabled={reconciling}
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                {reconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Dry Run (report only)
              </Button>
              {!showApplyConfirm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApplyConfirm(true)}
                  disabled={reconciling}
                  className="border-amber-400 text-amber-700 hover:bg-amber-50"
                >
                  Apply Reconciliation
                </Button>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                  <span className="text-xs text-amber-800 font-medium">This will update historical WorkOrder statuses. Confirm?</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleReconcile(false)}
                    disabled={reconciling}
                    className="bg-amber-600 hover:bg-amber-700 h-7 text-xs"
                  >
                    {reconciling ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    Yes, Apply
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowApplyConfirm(false)}
                    className="h-7 text-xs text-slate-500"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {reconcileResult && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                {reconcileResult.error ? (
                  <p className="text-sm text-red-600">Error: {reconcileResult.error}</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-slate-700">
                      {reconcileResult.dry_run ? '📋 Dry Run Report' : '✅ Reconciliation Applied'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[['Scanned', reconcileResult.summary?.scanned], ['Updated', reconcileResult.summary?.updated], ['Unchanged', reconcileResult.summary?.unchanged], ['Skipped', reconcileResult.summary?.skipped], ['Errors', reconcileResult.summary?.errors]].map(([label, val]) => (
                        <div key={label} className="text-center">
                          <p className="text-lg font-bold text-slate-800">{val ?? '—'}</p>
                          <p className="text-xs text-slate-500">{label}</p>
                        </div>
                      ))}
                    </div>
                    {reconcileResult.summary?.updated_to_ready_to_invoice?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1">→ Ready to Invoice:</p>
                        <p className="text-xs text-slate-500">{reconcileResult.summary.updated_to_ready_to_invoice.map(w => w.number || w.id).join(', ')}</p>
                      </div>
                    )}
                    {reconcileResult.summary?.updated_to_completed?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1">→ Completed (ORG):</p>
                        <p className="text-xs text-slate-500">{reconcileResult.summary.updated_to_completed.map(w => w.number || w.id).join(', ')}</p>
                      </div>
                    )}
                    {reconcileResult.summary?.skip_reasons && Object.keys(reconcileResult.summary.skip_reasons).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1">Skip reasons:</p>
                        <ul className="space-y-0.5">
                          {Object.entries(reconcileResult.summary.skip_reasons).map(([reason, count]) => (
                            <li key={reason} className="text-xs text-slate-400">{count}× {reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}