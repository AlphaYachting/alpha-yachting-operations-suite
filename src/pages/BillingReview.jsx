import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Receipt, AlertTriangle, Archive, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import CustomerBillingBlock from '@/components/billing/CustomerBillingBlock';
import BillingArchiveView from '@/components/billing/BillingArchiveView';

export default function BillingReview() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Raw data
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [materialUsages, setMaterialUsages] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [allCME, setAllCME] = useState([]); // all CustomerMaterialEntry for relevant customers

  // Per-customer created offer result
  const [createdOffers, setCreatedOffers] = useState({}); // { customerId: offerResult }

  // Admin reconciliation
  const [activeTab, setActiveTab] = useState('open');
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const allWOs = await base44.entities.WorkOrder.filter({ status: 'Ready to Invoice' });
      const eligibleWOs = allWOs.filter(wo => wo.workorder_type !== 'ORGANIZATION');

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

      // Batch requests in chunks of 5 to avoid rate limiting
      const chunkSize = 5;
      const batchFetch = async (ids, fetchFn) => {
        const results = [];
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(chunk.map(fetchFn));
          results.push(...chunkResults.flat());
        }
        return results;
      };

      const [teAll, muAll] = await Promise.all([
        batchFetch(woIds, id => base44.entities.TimeEntry.filter({ work_order_id: id })),
        batchFetch(woIds, id => base44.entities.MaterialUsage.filter({ work_order_id: id })),
      ]);
      setTimeEntries(teAll);
      setMaterialUsages(muAll);

      // Load CustomerMaterialEntry for all relevant customers
      const relevantJobMap = Object.fromEntries(jobList.filter(j => jobIds.includes(j.id)).map(j => [j.id, j]));
      const customerIds = [...new Set(Object.values(relevantJobMap).map(j => j.customer_id).filter(Boolean))];
      const cmeResults = await Promise.all(
        customerIds.map(cid =>
          base44.entities.CustomerMaterialEntry.filter({ customer_id: cid })
            .then(r => r.filter(c => !c.billed_offer_id))
            .catch(() => [])
        )
      );
      setAllCME(cmeResults.flat());
    } catch (e) {
      setError(e.message);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  // Group by customer
  const customerGroups = useMemo(() => {
    const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
    const woIdSet = new Set(workOrders.map(w => w.id));

    // Build set of job_ids from eligible WOs
    const eligibleJobIds = new Set(workOrders.map(w => w.job_id).filter(Boolean));

    // Group WOs by customer
    const groups = {}; // customerId → { customer, workOrders, linkedCME, unlinkedCME }
    for (const wo of workOrders) {
      const job = jobMap[wo.job_id];
      const customerId = job?.customer_id;
      if (!customerId) continue;
      if (!groups[customerId]) {
        groups[customerId] = {
          customer: customerMap[customerId],
          workOrders: [],
          linkedCME: [],
          unlinkedCME: [],
        };
      }
      groups[customerId].workOrders.push(wo);
    }

    // Distribute CME into customer groups
    for (const cme of allCME) {
      const customerId = cme.customer_id;
      if (!groups[customerId]) continue;
      const isLinked = (cme.work_order_id && woIdSet.has(cme.work_order_id)) ||
        (cme.job_id && eligibleJobIds.has(cme.job_id));
      if (isLinked) {
        groups[customerId].linkedCME.push(cme);
      } else if (!cme.staged_offer_id) {
        groups[customerId].unlinkedCME.push(cme);
      }
    }

    // Sort by customer name
    return Object.entries(groups).sort(([, a], [, b]) => {
      const nameA = a.customer?.company_name || `${a.customer?.last_name || ''}`;
      const nameB = b.customer?.company_name || `${b.customer?.last_name || ''}`;
      return nameA.localeCompare(nameB);
    });
  }, [workOrders, jobs, customers, allCME]);

  const handleCreateOffer = async (customerId, woIds, unlinkedCMEIds = []) => {
    try {
      // Pass WO metadata already in memory → backend skips WorkOrder.list(1000)
      const work_order_meta = Object.fromEntries(
        workOrders
          .filter(wo => woIds.includes(wo.id))
          .map(wo => [wo.id, {
            number: wo.work_order_number,
            title: wo.title,
            job_id: wo.job_id,
            status: wo.status,
            workorder_type: wo.workorder_type || 'STANDARD',
          }])
      );
      const payload = { work_order_ids: woIds, work_order_meta };
      if (unlinkedCMEIds.length > 0) payload.unlinked_cme_ids = unlinkedCMEIds;
      const response = await base44.functions.invoke('createBillingOfferFromWO', payload);
      const result = response.data;
      if (!result?.success) throw new Error(result?.error || 'Failed to create billing offer');
      setCreatedOffers(prev => ({ ...prev, [customerId]: result }));
      if (result.line_items_created === 0) {
        toast.warning(`Offer ${result.offer_number} created — but no billable line items were transferred. Check that TimeEntries and MaterialUsage exist and are not already billed.`);
      } else {
        toast.success(`Billing Offer ${result.offer_number} created — ${result.line_items_created} line item${result.line_items_created !== 1 ? 's' : ''} transferred.`);
      }
      await loadAll(true);
    } catch (e) {
      toast.error(e.message);
      throw e;
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
      if (!dryRun && result?.success) await loadAll(true);
    } catch (e) {
      setReconcileResult({ error: e.message });
      toast.error('Reconciliation failed: ' + e.message);
    } finally {
      setReconciling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 mr-3" />
        <span className="text-slate-500">Loading billing data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-600" />
            Billing Review
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            One customer, one billing offer. Select WorkOrders per customer → Create Offer → Finalize in Offer module.
          </p>
        </div>
        <Button type="button" onClick={() => loadAll()} variant="outline" size="sm" disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('open')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'open' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Open Billing Review
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'archive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Archive className="h-4 w-4" />
          Archive
        </button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Archive tab */}
      {activeTab === 'archive' && (
        <BillingArchiveView customers={customers} />
      )}

      {/* Open billing tab */}
      {activeTab === 'open' && (
        <>
          {customerGroups.length === 0 ? (
            <Card>
              <CardContent className="text-center py-16 text-slate-400">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No WorkOrders with status "Ready to Invoice"</p>
                <p className="text-sm mt-1">WorkOrders transition here automatically when all tasks are complete.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                <strong>{customerGroups.length}</strong> customer{customerGroups.length !== 1 ? 's' : ''} with billable WorkOrders
              </p>
              {customerGroups.map(([customerId, group]) => (
                <CustomerBillingBlock
                  key={customerId}
                  customer={group.customer}
                  workOrders={group.workOrders}
                  jobs={jobs}
                  boats={boats}
                  technicians={technicians}
                  timeEntries={timeEntries.filter(te =>
                    group.workOrders.some(wo => wo.id === te.work_order_id)
                  )}
                  materialUsages={materialUsages.filter(m =>
                    group.workOrders.some(wo => wo.id === m.work_order_id)
                  )}
                  linkedCME={group.linkedCME}
                  unlinkedCME={group.unlinkedCME}
                  onCreateOffer={(woIds, unlinkedCMEIds) => handleCreateOffer(customerId, woIds, unlinkedCMEIds)}
                  createdOffer={createdOffers[customerId] || null}
                />
              ))}
            </>
          )}
        </>
      )}

      {/* Admin Reconciliation */}
      {isAdmin && (
        <Card className="border-slate-300 bg-slate-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-slate-400" />
              Ready-to-Invoice Reconciliation
              <Badge variant="outline" className="text-xs text-slate-500 border-slate-300">Admin only</Badge>
            </CardTitle>
            <p className="text-xs text-slate-500">
              Scans historical WorkOrders and sets them to the correct terminal status.
              Dry Run is always safe — no changes are written.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => handleReconcile(true)}
                disabled={reconciling}
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                {reconciling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Dry Run (report only)
              </Button>
              {!showApplyConfirm ? (
                <Button
                  type="button" variant="outline" size="sm"
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
                    type="button" size="sm"
                    onClick={() => handleReconcile(false)}
                    disabled={reconciling}
                    className="bg-amber-600 hover:bg-amber-700 h-7 text-xs"
                  >
                    {reconciling && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Yes, Apply
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm"
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