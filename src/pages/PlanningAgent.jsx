import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { evaluateWorkOrder, computeCapacity } from '@/utils/planningAgent/agentLogic';
import { computeVisits, groupVisitsByTimeBucket } from '@/utils/visitPlanner';
import VisitCard from '@/components/planning/VisitCard';
import AgentSummaryBar from '@/components/planningAgent/AgentSummaryBar';
import AgentItemRow from '@/components/planningAgent/AgentItemRow';
import AgentSection from '@/components/planningAgent/AgentSection';
import { RefreshCw, Brain, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ACTIVE_JOB_STATUSES = ['New', 'Quoted', 'Approved', 'Scheduled', 'In Progress', 'Waiting for Parts', 'On Hold'];
const ACTIVE_WO_STATUSES  = ['Draft', 'Scheduled', 'Dispatched', 'In Transit', 'In Progress', 'Paused', 'Waiting for Parts', 'Waiting for Approval'];

export default function PlanningAgent() {
  const [viewMode, setViewMode] = useState('ranking'); // 'ranking' or 'dateFirst'
  const [activeFilter, setActiveFilter] = useState(null);
  const [showStartDateModal, setShowStartDateModal] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTechId, setSelectedTechId] = useState('');
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
        return evaluateWorkOrder({ workOrder: wo, job, customer, location, tasks: woTasks, technicians, today, workloadMap, jobOrgTaskCount }); // C: pass load signal
      })
      .filter(Boolean);
  }, [workOrders, maps, tasksByWO, isLoading]);

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

  // Date-First Board data (visit clustering)
  const visits = useMemo(() => computeVisits(workOrders, maps.jobs, maps.locations, technicians), [workOrders, maps.jobs, maps.locations, technicians]);
  const timeBuckets = useMemo(() => groupVisitsByTimeBucket(visits), [visits]);

  // Handle visit start date
  const handleSetStartDate = async (visit) => {
    setShowStartDateModal(visit);
    setSelectedDate(visit.startDate || '');
  };

  const saveStartDate = async () => {
    if (!showStartDateModal || !selectedDate) return;
    try {
      for (const wo of showStartDateModal.actionable) {
        await base44.entities.WorkOrder.update(wo.id, { scheduled_date: selectedDate });
      }
      handleRefresh();
      setShowStartDateModal(null);
    } catch (error) {
      console.error('Error updating start date:', error);
    }
  };

  // Handle visit executor assignment
  const handleAssignExecutor = async (visit) => {
    setShowAssignModal(visit);
    setSelectedTechId('');
  };

  const saveExecutor = async () => {
    if (!showAssignModal || !selectedTechId) return;
    try {
      for (const wo of showAssignModal.actionable) {
        await base44.entities.WorkOrder.update(wo.id, { lead_technician_id: selectedTechId });
      }
      handleRefresh();
      setShowAssignModal(null);
    } catch (error) {
      console.error('Error assigning executor:', error);
    }
  };

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
      {/* Header with view mode tabs */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Planning Agent</h1>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">V2</span>
          </div>
          <p className="text-sm text-slate-500 max-w-3xl">
            Unified planning surface. Toggle between Agent Ranking (automated prioritization) and Date-First Board (visit clustering).
          </p>
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex gap-3">
        <button
          onClick={() => setViewMode('ranking')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'ranking' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
        >
          Agent Ranking
        </button>
        <button
          onClick={() => setViewMode('dateFirst')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'dateFirst' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
        >
          Date-First Board
        </button>
      </div>

      {/* Ranking view */}
      {viewMode === 'ranking' && (
        <>
      {/* Summary bar */}
      <AgentSummaryBar
        buckets={buckets}
        capacity={capacity}
        onFilterClick={setActiveFilter}
        activeFilter={activeFilter}
      />

      {activeFilter && filteredView ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">Filtered: {activeFilter.replace(/_/g, ' ')}</h2>
            <Button variant="ghost" size="sm" onClick={() => setActiveFilter(null)}>Clear filter</Button>
          </div>
          <div className="space-y-2">
            {filteredView.length === 0
              ? <p className="text-sm text-slate-400 py-6 text-center">No items in this category.</p>
              : filteredView.map((item, idx) => (
                  <div key={item.workOrder.id}>
                    {/* inline import to avoid circular — use AgentItemRow directly */}
                    <AgentSectionItem item={item} rank={idx + 1} technicians={technicians} allWorkOrders={workOrders} jobs={maps.jobs} locations={maps.locations} onRefresh={handleRefresh} />
                  </div>
                ))
            }
          </div>
        </div>
      ) : (
        <>
          {/* THIS WEEK — HIGH CONFIDENCE */}
          <AgentSection
            title={`This Week — Recommended (${weekRanges.thisWeek})`}
            subtitle="Highest-value, high-confidence candidates. Ranked by urgency + priority + confidence."
            items={buckets.thisWeekHigh}
            ranked
            emptyMessage="No high-confidence work is recommended for this week."
            badgeClass="bg-emerald-100 text-emerald-700"
            badge={buckets.thisWeekHigh.length}
            technicians={technicians}
            allWorkOrders={workOrders}
            jobs={maps.jobs}
            locations={maps.locations}
            onRefresh={handleRefresh}
          />

          {/* THIS WEEK — LOW CONFIDENCE / RISKY */}
          {buckets.thisWeekLow.length > 0 && (
            <AgentSection
              title={`This Week — Urgent but Uncertain (${weekRanges.thisWeek})`}
              subtitle="Urgent or overdue items with low confidence. Verify before committing."
              items={buckets.thisWeekLow}
              ranked
              emptyMessage=""
              badgeClass="bg-orange-100 text-orange-700"
              badge={buckets.thisWeekLow.length}
              technicians={technicians}
              allWorkOrders={workOrders}
              jobs={maps.jobs}
              locations={maps.locations}
              onRefresh={handleRefresh}
            />
          )}

          {/* NEXT WEEK */}
          <AgentSection
            title={`Next Week — Prepare Now (${weekRanges.nextWeek})`}
            subtitle="Start resolving gaps today so these are ready to schedule next week."
            items={buckets.nextWeek}
            ranked
            emptyMessage="No items queued for next week preparation."
            badgeClass="bg-blue-100 text-blue-700"
            badge={buckets.nextWeek.length}
            technicians={technicians}
            allWorkOrders={workOrders}
            jobs={maps.jobs}
            locations={maps.locations}
            onRefresh={handleRefresh}
          />

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
          </AgentSection>

          <p className="text-xs text-slate-400 text-center">
          Planning Agent V2 · {evaluatedItems.length} work orders analysed
          </p>
          </>
          )}

          {/* Date-First Board view */}
          {viewMode === 'dateFirst' && (
          <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-600 font-medium">Total Visits</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{visits.length}</p>
            </div>
            <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-xs text-emerald-600 font-medium">Actionable WOs</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{visits.reduce((sum, v) => sum + v.actionableCount, 0)}</p>
            </div>
            <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-600 font-medium">Blocked/Paused</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">{visits.reduce((sum, v) => sum + v.blockedCount, 0)}</p>
            </div>
            <div className="px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-600 font-medium">Total Effort</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{visits.reduce((sum, v) => sum + v.effort.max, 0).toFixed(0)}h</p>
            </div>
          </div>

          {/* Time buckets */}
          {['This Week', 'Next Week', 'Later'].map(bucketName => {
            const bucketVisits = timeBuckets[bucketName];
            if (!bucketVisits?.length) return null;
            return (
              <div key={bucketName}>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">{bucketName}</h2>
                <div className="space-y-3">
                  {bucketVisits.map(visit => (
                    <VisitCard
                      key={`${visit.boatId}|${visit.jobId}|${visit.locationId}`}
                      visit={visit}
                      onSetStartDate={handleSetStartDate}
                      onAssignExecutor={handleAssignExecutor}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {visits.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No work orders ready for visit clustering.</p>
            </div>
          )}
        </div>
      )}

      {/* Modals for Date-First Board */}
      {showStartDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Set Visit Start Date</h3>
            <p className="text-sm text-slate-600 mb-4">
              {showStartDateModal.job?.title} @ {showStartDateModal.location?.name}
            </p>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowStartDateModal(null)}
                className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveStartDate}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Assign Executor</h3>
            <p className="text-sm text-slate-600 mb-4">
              {showAssignModal.job?.title} @ {showAssignModal.location?.name}
            </p>
            <select
              value={selectedTechId}
              onChange={e => setSelectedTechId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400"
            >
              <option value="">— Select technician —</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAssignModal(null)}
                className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveExecutor}
                disabled={!selectedTechId}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
          </div>
          </div>
          )}
          </div>
  );
}

function AgentSectionItem({ item, rank, technicians, allWorkOrders, jobs, locations, onRefresh }) {
  return <AgentItemRow item={item} rank={rank} technicians={technicians} onRefresh={onRefresh} />;
}