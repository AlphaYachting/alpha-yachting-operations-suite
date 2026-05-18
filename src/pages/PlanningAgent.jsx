import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { evaluateWorkOrder, computeCapacity } from '@/utils/planningAgent/agentLogic';
import AgentSummaryBar from '@/components/planningAgent/AgentSummaryBar';
import AgentItemRow from '@/components/planningAgent/AgentItemRow';
import AgentSection from '@/components/planningAgent/AgentSection';
import ClusterGroup from '@/components/planningAgent/ClusterGroup';
import TechnicianWorkloadBar from '@/components/planningAgent/TechnicianWorkloadBar';
import { RefreshCw, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ACTIVE_JOB_STATUSES = ['New', 'Quoted', 'Approved', 'Scheduled', 'In Progress', 'Waiting for Parts', 'On Hold'];
const ACTIVE_WO_STATUSES  = ['Draft', 'Scheduled', 'Dispatched', 'In Transit', 'In Progress', 'Paused', 'Waiting for Parts', 'Waiting for Approval'];

export default function PlanningAgent() {
  const [activeFilter, setActiveFilter] = useState(null);
  const queryClient = useQueryClient();
  const handleRefresh = () => queryClient.invalidateQueries({ queryKey: ['pa-wos'] }).then(() => queryClient.invalidateQueries({ queryKey: ['pa-tasks'] }));

  const { data: jobs = [],        isLoading: lJobs }   = useQuery({ queryKey: ['pa-jobs'],    queryFn: () => base44.entities.Job.list('-updated_date', 300) });
  const { data: workOrders = [],  isLoading: lWOs }    = useQuery({ queryKey: ['pa-wos'],     queryFn: () => base44.entities.WorkOrder.list('-updated_date', 500) });
  const { data: tasks = [],       isLoading: lTasks }  = useQuery({ queryKey: ['pa-tasks'],   queryFn: () => base44.entities.Task.list('-updated_date', 1000) });
  const { data: customers = [],   isLoading: lCust }   = useQuery({ queryKey: ['pa-custs'],   queryFn: () => base44.entities.Customer.list('-updated_date', 300) });
  const { data: locations = [],   isLoading: lLocs }   = useQuery({ queryKey: ['pa-locs'],    queryFn: () => base44.entities.Location.list() });
  const { data: technicians = [], isLoading: lTechs }  = useQuery({ queryKey: ['pa-techs'],   queryFn: () => base44.entities.Technician.list() });
  const { data: boats = [],       isLoading: lBoats }  = useQuery({ queryKey: ['pa-boats'],   queryFn: () => base44.entities.Boat.list('-updated_date', 100) });

  const isLoading = lJobs || lWOs || lTasks || lCust || lLocs || lTechs || lBoats;

  // Build lookup maps
  const maps = useMemo(() => ({
    jobs:      Object.fromEntries(jobs.map(j => [j.id, j])),
    customers: Object.fromEntries(customers.map(c => [c.id, c])),
    locations: Object.fromEntries(locations.map(l => [l.id, l])),
    boats:     Object.fromEntries(boats.map(b => [b.id, b])),
  }), [jobs, customers, locations, boats]);

  // Group tasks by WO
  const tasksByWO = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      if (!m[t.work_order_id]) m[t.work_order_id] = [];
      m[t.work_order_id].push(t);
    }
    return m;
  }, [tasks]);

  // Count org tasks per job (across all WOs of that job) for job-level gap detection
  const jobOrgTaskCountMap = useMemo(() => {
    const woToJob = Object.fromEntries(workOrders.map(wo => [wo.id, wo.job_id]).filter(([, jid]) => jid));
    const m = {};
    for (const t of tasks) {
      if (t.task_stream !== 'ORGANIZATION') continue;
      const jobId = woToJob[t.work_order_id];
      if (!jobId) continue;
      m[jobId] = (m[jobId] || 0) + 1;
    }
    return m;
  }, [tasks, workOrders]);

  // Set of job IDs that have at least one ORGANIZATION-type WorkOrder
  const jobsWithOrgWO = useMemo(() =>
    new Set(workOrders.filter(wo => wo.workorder_type === 'ORGANIZATION' && wo.job_id).map(wo => wo.job_id)),
  [workOrders]);

  // C: build technician workload map from currently active WOs
  const workloadMap = useMemo(() => {
    const map = {};
    workOrders.filter(wo => ACTIVE_WO_STATUSES.includes(wo.status)).forEach(wo => {
      (wo.assigned_technicians || []).forEach(tid => {
        map[tid] = (map[tid] || 0) + 1;
      });
    });
    return map;
  }, [workOrders]);

  // Evaluate all relevant WOs
  const evaluatedItems = useMemo(() => {
    if (isLoading) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return workOrders
      .filter(wo => ACTIVE_WO_STATUSES.includes(wo.status) && wo.workorder_type !== 'ORGANIZATION') // A: exclude coordination-only WOs
      .map(wo => {
        const job      = wo.job_id ? maps.jobs[wo.job_id] : null;
        const customer = job?.customer_id ? maps.customers[job.customer_id] : null;
        const location = job?.location_id ? maps.locations[job.location_id] : null;
        const woTasks  = tasksByWO[wo.id] || [];

        if (job && !ACTIVE_JOB_STATUSES.includes(job.status)) return null;

        const jobOrgTaskCount = job ? (jobOrgTaskCountMap[job.id] ?? 0) : null;
        const hasOrgWorkOrder = wo.job_id ? jobsWithOrgWO.has(wo.job_id) : false;
        return evaluateWorkOrder({ workOrder: wo, job, customer, location, tasks: woTasks, technicians, today, workloadMap, jobOrgTaskCount, hasOrgWorkOrder }); // C: pass load signal
      })
      .filter(Boolean);
  }, [workOrders, maps, tasksByWO, isLoading, technicians, workloadMap, jobOrgTaskCountMap]);

  // Split into buckets
  const buckets = useMemo(() => {
    const thisWeek          = evaluatedItems.filter(i => i.derived.planningBucket === 'THIS_WEEK_CANDIDATE').sort((a, b) => b.derived.rankingScore - a.derived.rankingScore);
    const thisWeekHigh      = thisWeek.filter(i => i.derived.confidenceLevel !== 'LOW');
    const thisWeekLow       = thisWeek.filter(i => i.derived.confidenceLevel === 'LOW');
    const nextWeek          = evaluatedItems.filter(i => i.derived.planningBucket === 'NEXT_WEEK_CANDIDATE').sort((a, b) => b.derived.rankingScore - a.derived.rankingScore);
    const needsClarification= evaluatedItems.filter(i => i.derived.planningBucket === 'NEEDS_CLARIFICATION').sort((a, b) => b.derived.rankingScore - a.derived.rankingScore);
    const blocked           = evaluatedItems.filter(i => i.derived.planningBucket === 'BLOCKED');
    const hardBlocked       = blocked.filter(i => i.derived.blockerType === 'HARD');
    const externalBlocked   = blocked.filter(i => i.derived.blockerType === 'EXTERNAL');
    const quickWins         = evaluatedItems.filter(i => i.derived.isQuickWin).sort((a, b) => b.derived.rankingScore - a.derived.rankingScore);
    const badWeather        = evaluatedItems.filter(i => i.derived.isBadWeatherCandidate && i.derived.planningBucket !== 'BLOCKED').sort((a, b) => b.derived.rankingScore - a.derived.rankingScore);

    return { thisWeek, thisWeekHigh, thisWeekLow, nextWeek, needsClarification, blocked, hardBlocked, externalBlocked, quickWins, badWeather };
  }, [evaluatedItems]);

  const capacity = useMemo(() => {
    if (technicians.length === 0) return null;
    return computeCapacity(technicians, buckets.thisWeek, buckets.nextWeek);
  }, [technicians, buckets]);

  // Week date ranges for display
  const weekRanges = useMemo(() => {
    const fmt = d => d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisEnd  = new Date(today); thisEnd.setDate(today.getDate() + 6);
    const nextStart = new Date(today); nextStart.setDate(today.getDate() + 7);
    const nextEnd  = new Date(today); nextEnd.setDate(today.getDate() + 13);
    return {
      thisWeek: `${fmt(today)} – ${fmt(thisEnd)}`,
      nextWeek: `${fmt(nextStart)} – ${fmt(nextEnd)}`,
    };
  }, []);

  // Group items by boat+job+location
  const clusteredBuckets = useMemo(() => {
    const clusterKey = (item) => `${item.job?.boat_id || 'no-boat'}|${item.job?.id || 'no-job'}|${item.job?.location_id || 'no-loc'}`;
    const clusterize = (items) => {
      const map = {};
      items.forEach(item => {
        const key = clusterKey(item);
        if (!map[key]) {
          map[key] = {
            boat: item.job?.boat_id ? maps.boats[item.job.boat_id] : null,
            job: item.job,
            location: item.location,
            items: [],
          };
        }
        map[key].items.push(item);
      });
      return Object.values(map);
    };
    return {
      thisWeek: clusterize(buckets.thisWeekHigh),
      thisWeekLow: clusterize(buckets.thisWeekLow),
      nextWeek: clusterize(buckets.nextWeek),
    };
  }, [buckets, maps]);

  // Filter override
  const filterMap = {
    THIS_WEEK_CANDIDATE: buckets.thisWeek,
    NEXT_WEEK_CANDIDATE: buckets.nextWeek,
    NEEDS_CLARIFICATION: buckets.needsClarification,
    BLOCKED:             buckets.blocked,
    QUICK_WINS:          buckets.quickWins,
    BAD_WEATHER:         buckets.badWeather,
  };
  const filteredView = activeFilter ? filterMap[activeFilter] : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Brain className="h-10 w-10 text-slate-300 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-500 text-sm">Analysing active work orders…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Planning Agent</h1>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">V2</span>
          </div>
          <p className="text-sm text-slate-500 max-w-3xl">
            Automated planning prioritization and work order clustering by confidence, priority, and urgency.
          </p>
        </div>
      </div>

      {/* Main Planning Agent View */}
      <>
        {/* Summary bar */}
        <AgentSummaryBar
          buckets={buckets}
          capacity={capacity}
          onFilterClick={setActiveFilter}
          activeFilter={activeFilter}
        />

        {/* Techniker-Auslastung */}
        <TechnicianWorkloadBar technicians={technicians} workOrders={workOrders} />

        {activeFilter && filteredView ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-700">Filtered: {activeFilter.replace(/_/g, ' ')}</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveFilter(null)}>Clear filter</Button>
            </div>
            {filteredView.length === 0
              ? <p className="text-sm text-slate-400 py-6 text-center">No items in this category.</p>
              : (() => {
                  const clusterKey = (item) => `${item.job?.boat_id || 'no-boat'}|${item.job?.id || 'no-job'}|${item.job?.location_id || 'no-loc'}`;
                  const clusterMap = {};
                  filteredView.forEach(item => {
                    const key = clusterKey(item);
                    if (!clusterMap[key]) clusterMap[key] = { boat: item.job?.boat_id ? maps.boats[item.job.boat_id] : null, job: item.job, location: item.location, items: [] };
                    clusterMap[key].items.push(item);
                  });
                  return (
                    <div className="space-y-3">
                      {Object.values(clusterMap).map((cluster) => (
                        <ClusterGroup
                          key={`${cluster.boat?.id}-${cluster.job?.id}-${cluster.location?.id}`}
                          boat={cluster.boat}
                          job={cluster.job}
                          location={cluster.location}
                          items={cluster.items}
                          ranked
                          technicians={technicians}
                          allWorkOrders={workOrders}
                          jobs={maps.jobs}
                          locations={maps.locations}
                          onRefresh={handleRefresh}
                        />
                      ))}
                    </div>
                  );
                })()
            }
          </div>
        ) : (
          <>
            {/* THIS WEEK — HIGH CONFIDENCE */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold text-slate-800">{`This Week — Recommended (${weekRanges.thisWeek})`}</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{buckets.thisWeekHigh.length}</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">Highest-value, high-confidence candidates. Ranked by urgency + priority + confidence.</p>
              {buckets.thisWeekHigh.length === 0 ? (
                <div className="rounded-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">No high-confidence work is recommended for this week.</div>
              ) : (
                <div className="space-y-3">
                  {clusteredBuckets.thisWeek.map((cluster) => (
                    <ClusterGroup
                      key={`${cluster.boat?.id}-${cluster.job?.id}-${cluster.location?.id}`}
                      boat={cluster.boat}
                      job={cluster.job}
                      location={cluster.location}
                      items={cluster.items}
                      ranked
                      technicians={technicians}
                      allWorkOrders={workOrders}
                      jobs={maps.jobs}
                      locations={maps.locations}
                      onRefresh={handleRefresh}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* THIS WEEK — LOW CONFIDENCE / RISKY */}
            {buckets.thisWeekLow.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold text-slate-800">{`This Week — Urgent but Uncertain (${weekRanges.thisWeek})`}</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{buckets.thisWeekLow.length}</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Urgent or overdue items with low confidence. Verify before committing.</p>
                <div className="space-y-3">
                  {clusteredBuckets.thisWeekLow.map((cluster) => (
                    <ClusterGroup
                      key={`${cluster.boat?.id}-${cluster.job?.id}-${cluster.location?.id}`}
                      boat={cluster.boat}
                      job={cluster.job}
                      location={cluster.location}
                      items={cluster.items}
                      ranked
                      technicians={technicians}
                      allWorkOrders={workOrders}
                      jobs={maps.jobs}
                      locations={maps.locations}
                      onRefresh={handleRefresh}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* NEXT WEEK */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold text-slate-800">{`Next Week — Prepare Now (${weekRanges.nextWeek})`}</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{buckets.nextWeek.length}</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">Start resolving gaps today so these are ready to schedule next week.</p>
              {buckets.nextWeek.length === 0 ? (
                <div className="rounded-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">No items queued for next week preparation.</div>
              ) : (
                <div className="space-y-3">
                  {clusteredBuckets.nextWeek.map((cluster) => (
                    <ClusterGroup
                      key={`${cluster.boat?.id}-${cluster.job?.id}-${cluster.location?.id}`}
                      boat={cluster.boat}
                      job={cluster.job}
                      location={cluster.location}
                      items={cluster.items}
                      ranked
                      technicians={technicians}
                      allWorkOrders={workOrders}
                      jobs={maps.jobs}
                      locations={maps.locations}
                      onRefresh={handleRefresh}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* BLOCKED */}
            {(buckets.hardBlocked.length > 0 || buckets.externalBlocked.length > 0) && (
              <section>
                <div className="mb-3">
                  <h2 className="text-base font-semibold text-slate-800">Blocked</h2>
                  <p className="text-xs text-slate-400 mt-0.5">These cannot be scheduled until the underlying issue is resolved.</p>
                </div>
                <div className="space-y-4">
                  {buckets.hardBlocked.length > 0 && (
                    <AgentSection
                      title="Hard Blocked"
                      subtitle="Cannot proceed. Requires immediate resolution before any planning."
                      items={buckets.hardBlocked}
                      emptyMessage=""
                      badgeClass="bg-red-100 text-red-700"
                      badge={buckets.hardBlocked.length}
                      technicians={technicians}
                      allWorkOrders={workOrders}
                      jobs={maps.jobs}
                      locations={maps.locations}
                      onRefresh={handleRefresh}
                    />
                  )}
                  {buckets.externalBlocked.length > 0 && (
                    <AgentSection
                      title="Externally Blocked"
                      subtitle="Waiting on parts delivery or external approval."
                      items={buckets.externalBlocked}
                      emptyMessage=""
                      badgeClass="bg-orange-100 text-orange-700"
                      badge={buckets.externalBlocked.length}
                      technicians={technicians}
                      allWorkOrders={workOrders}
                      jobs={maps.jobs}
                      locations={maps.locations}
                      onRefresh={handleRefresh}
                    />
                  )}
                </div>
              </section>
            )}

            {/* NEEDS CLARIFICATION */}
            <AgentSection
              title="Needs Clarification"
              subtitle="These have insufficient data for reliable planning. Review and fill gaps."
              items={buckets.needsClarification}
              emptyMessage="No items need clarification right now."
              badgeClass="bg-yellow-100 text-yellow-700"
              badge={buckets.needsClarification.length}
              technicians={technicians}
              allWorkOrders={workOrders}
              jobs={maps.jobs}
              locations={maps.locations}
              onRefresh={handleRefresh}
            />

            {/* QUICK WINS */}
            <AgentSection
              title="Quick Wins"
              subtitle="Short jobs (≤2h) with medium+ confidence. Good for filling schedule gaps."
              items={buckets.quickWins}
              ranked
              emptyMessage="No quick wins identified."
              badgeClass="bg-purple-100 text-purple-700"
              badge={buckets.quickWins.length}
              technicians={technicians}
              allWorkOrders={workOrders}
              jobs={maps.jobs}
              locations={maps.locations}
              onRefresh={handleRefresh}
            />

            {/* BAD WEATHER FALLBACK */}
            <AgentSection
              title="Bad Weather Fallback"
              subtitle="Indoor or sheltered work (Electrical, Electronics, HVAC, GRP). Useful when outdoor access is limited."
              items={buckets.badWeather}
              emptyMessage="No bad-weather fallback jobs were identified."
              badgeClass="bg-sky-100 text-sky-700"
              badge={buckets.badWeather.length}
              technicians={technicians}
              allWorkOrders={workOrders}
              jobs={maps.jobs}
              locations={maps.locations}
              onRefresh={handleRefresh}
            />

            <p className="text-xs text-slate-400 text-center">
              Planning Agent V2 · {evaluatedItems.length} work orders analysed
            </p>
          </>
        )}
      </>
    </div>
  );
}

function AgentSectionItem({ item, rank, technicians, allWorkOrders, jobs, locations, onRefresh }) {
  return <AgentItemRow item={item} rank={rank} technicians={technicians} onRefresh={onRefresh} />;
}