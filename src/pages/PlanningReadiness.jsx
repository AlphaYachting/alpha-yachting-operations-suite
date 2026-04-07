import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { evaluateWorkOrder } from '@/components/planning/readinessEvaluator';
import WOReadinessRow from '@/components/planning/WOReadinessRow';
import WODetailPanel from '@/components/planning/WODetailPanel';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ChevronDown, ChevronRight, HelpCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const EXCLUDED_JOB_STATUSES = ['Completed', 'Cancelled', 'Invoiced'];
const EXCLUDED_WO_STATUSES  = ['Completed', 'Cancelled'];

const SECTION_DESCRIPTIONS = {
  ready:               'These work orders have everything needed to be added to the schedule. Start here when planning the week.',
  needs_clarification: "Something is missing but not critical. Can often be resolved quickly - check the detail panel for what's needed.",
  not_plannable:       'These cannot be scheduled until a hard blocker is resolved. Review and delegate the required actions first.',
};

function SectionHeader({ label, count, open, onToggle, color, description }) {
  return (
    <div className={cn('border-b', color)}>
      <button
        onClick={onToggle}
        className={cn('w-full flex items-center justify-between px-4 py-2 text-sm font-semibold', color)}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {label}
        </span>
        <Badge className="bg-white/60">{count}</Badge>
      </button>
      {open && description && (
        <p className="px-4 pb-2 text-xs opacity-70">{description}</p>
      )}
    </div>
  );
}

export default function PlanningReadiness() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ ready: true, needs_clarification: true, not_plannable: true });

  const { data: jobs = [],        isLoading: l1 } = useQuery({ queryKey: ['planning-jobs'],        queryFn: () => base44.entities.Job.list('-updated_date', 100) });
  const { data: workOrders = [],  isLoading: l2 } = useQuery({ queryKey: ['planning-wos'],         queryFn: () => base44.entities.WorkOrder.list('-updated_date', 200) });
  const { data: tasks = [],       isLoading: l3 } = useQuery({ queryKey: ['planning-tasks'],       queryFn: () => base44.entities.Task.list('-updated_date', 500) });
  const { data: customers = [],   isLoading: l4 } = useQuery({ queryKey: ['planning-customers'],   queryFn: () => base44.entities.Customer.list('-updated_date', 100) });
  const { data: boats = [],       isLoading: l5 } = useQuery({ queryKey: ['planning-boats'],       queryFn: () => base44.entities.Boat.list('-updated_date', 100) });
  const { data: locations = [],   isLoading: l6 } = useQuery({ queryKey: ['planning-locations'],  queryFn: () => base44.entities.Location.list('-updated_date', 50) });
  const { data: technicians = [], isLoading: l7 } = useQuery({ queryKey: ['planning-technicians'],queryFn: () => base44.entities.Technician.list('-updated_date', 50) });

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7;

  const maps = useMemo(() => ({
    jobs:      Object.fromEntries(jobs.map(j => [j.id, j])),
    customers: Object.fromEntries(customers.map(c => [c.id, c])),
    boats:     Object.fromEntries(boats.map(b => [b.id, b])),
    locations: Object.fromEntries(locations.map(l => [l.id, l])),
  }), [jobs, customers, boats, locations]);

  const tasksByWO = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      if (!m[t.work_order_id]) m[t.work_order_id] = { count: 0, minutesSum: 0, orgCount: 0 };
      m[t.work_order_id].count++;
      m[t.work_order_id].minutesSum += (t.estimated_minutes || 0);
      if (t.task_stream === 'ORGANIZATION') m[t.work_order_id].orgCount++;
    }
    return m;
  }, [tasks]);

  // Count org tasks per job (across all WOs) for job-level gap detection
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

  // Set of job IDs that have at least one ORGANIZATION-type work order
  const jobsWithOrgWO = useMemo(() =>
    new Set(workOrders.filter(wo => wo.workorder_type === 'ORGANIZATION' && wo.job_id).map(wo => wo.job_id)),
  [workOrders]);

  const activeJobIds = useMemo(() =>
    new Set(jobs.filter(j => !EXCLUDED_JOB_STATUSES.includes(j.status)).map(j => j.id)),
  [jobs]);

  const allItems = useMemo(() => {
    const relevantWOs = workOrders.filter(wo => {
      if (EXCLUDED_WO_STATUSES.includes(wo.status)) return false;
      if (wo.workorder_type === 'ORGANIZATION') return false; // A: exclude coordination-only WOs
      if (wo.job_id && !activeJobIds.has(wo.job_id)) return false;
      return true;
    });
    return relevantWOs.map(wo => {
      const job      = wo.job_id ? maps.jobs[wo.job_id] : null;
      const customer = job?.customer_id ? maps.customers[job.customer_id] : null;
      const boat     = job?.boat_id ? maps.boats[job.boat_id] : null;
      const location = job?.location_id ? maps.locations[job.location_id] : null;
      const tData    = tasksByWO[wo.id] || { count: 0, minutesSum: 0, orgCount: 0 };
      const jobOrgTaskCount = job ? (jobOrgTaskCountMap[job.id] ?? 0) : null;
      const hasOrgWorkOrder = wo.job_id ? jobsWithOrgWO.has(wo.job_id) : false;
      const evaluation = evaluateWorkOrder({ workOrder: wo, job, customer, boat, location, taskCount: tData.count, taskEstimatedMinutesSum: tData.minutesSum, orgTaskCount: tData.orgCount, hasOrgWorkOrder });
      return { workOrder: wo, job, customer, boat, location, taskCount: tData.count, taskEstimatedMinutesSum: tData.minutesSum, evaluation };
    });
  }, [workOrders, activeJobIds, maps, tasksByWO]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(i =>
      i.workOrder.title?.toLowerCase().includes(q) ||
      i.job?.title?.toLowerCase().includes(q) ||
      i.location?.name?.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const sortByPriority = (a, b) => {
    const pd = PRIORITY_ORDER[a.evaluation.priority] - PRIORITY_ORDER[b.evaluation.priority];
    if (pd !== 0) return pd;
    const da = a.job?.requested_date ? new Date(a.job.requested_date) : new Date('9999-01-01');
    const db = b.job?.requested_date ? new Date(b.job.requested_date) : new Date('9999-01-01');
    return da - db;
  };

  const groups = useMemo(() => ({
    ready:               filteredItems.filter(i => i.evaluation.planningReadiness === 'ready').sort(sortByPriority),
    needs_clarification: filteredItems.filter(i => i.evaluation.planningReadiness === 'needs_clarification').sort(sortByPriority),
    not_plannable:       filteredItems.filter(i => i.evaluation.planningReadiness === 'not_plannable').sort(sortByPriority),
  }), [filteredItems]);

  const deployableCount = useMemo(() => allItems.filter(i => i.evaluation.deployable).length, [allItems]);
  const selectedItem = useMemo(() => allItems.find(i => i.workOrder.id === selectedId), [allItems, selectedId]);
  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-500">Loading planning data...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* LEFT: list panel */}
      <div className={cn('flex flex-col border-r border-slate-200 overflow-hidden', selectedId ? 'w-1/2' : 'w-full')}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200">

          {/* Title first */}
          <h1 className="text-lg font-bold text-slate-900">Planning Readiness Cockpit</h1>
          <p className="text-xs text-slate-500 mt-0.5">Read-only · No changes are made to any records</p>

          {/* Intro banner */}
          <div className="mt-3 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800">What is this page?</span>
              {' '}This cockpit shows which work orders are ready to schedule, which need a quick clarification, and which are hard-blocked. Use it every morning before dispatching to identify gaps before they become problems.
            </p>
            <button
              onClick={() => setHelpOpen(v => !v)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {helpOpen ? 'Hide usage guide' : 'How to use this page'}
            </button>
            {helpOpen && (
              <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                <p className="text-xs font-semibold text-slate-700 mb-1">Recommended daily workflow:</p>
                {[
                  ['1', 'Start with "Not Plannable"', 'Identify hard blockers — delegate resolution immediately.'],
                  ['2', 'Review "Needs Clarification"', 'Small gaps that can often be resolved in minutes.'],
                  ['3', 'Use "Planning Ready" for scheduling', 'These are safe to add to the dispatch board.'],
                  ['4', '"Deployable This Week" = your shortlist', 'Has duration + assigned technician + confirmed access. These can go out this week.'],
                ].map(([n, title, desc]) => (
                  <div key={n} className="flex gap-2 text-xs">
                    <span className="text-slate-400 w-3 flex-shrink-0">{n}.</span>
                    <div>
                      <span className="font-medium text-slate-700">{title}</span>
                      <span className="text-slate-500"> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary counters */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="text-center p-2 bg-emerald-50 rounded-lg">
              <p className="text-lg font-bold text-emerald-700">{groups.ready.length}</p>
              <p className="text-xs text-emerald-600">Planning Ready</p>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded-lg">
              <p className="text-lg font-bold text-yellow-700">{groups.needs_clarification.length}</p>
              <p className="text-xs text-yellow-600">Needs Clarification</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <p className="text-lg font-bold text-red-700">{groups.not_plannable.length}</p>
              <p className="text-xs text-red-600">Not Plannable</p>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-lg font-bold text-blue-700">{deployableCount}</p>
              <p className="text-xs text-blue-600 font-medium">Deployable This Week</p>
              <p className="text-xs text-blue-400 mt-0.5">duration + crew + access ✓</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search work orders, jobs, locations..."
              className="pl-9 text-sm"
            />
          </div>
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto">

          {/* Global empty state when search returns nothing */}
          {search.trim() && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Search className="h-8 w-8 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No work orders match "{search}"</p>
              <p className="text-xs text-slate-400 mt-1">Try searching by work order title, project name, or location.</p>
            </div>
          )}

          {/* Ready */}
          <SectionHeader
            label="Planning Ready"
            count={groups.ready.length}
            open={openSections.ready}
            onToggle={() => toggleSection('ready')}
            color="bg-emerald-50 text-emerald-800 border-emerald-100"
            description={SECTION_DESCRIPTIONS.ready}
          />
          {openSections.ready && groups.ready.map(item => (
            <WOReadinessRow key={item.workOrder.id} item={item} selected={selectedId === item.workOrder.id} onClick={() => setSelectedId(item.workOrder.id)} />
          ))}
          {openSections.ready && groups.ready.length === 0 && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-slate-400">No work orders are fully planning-ready yet.</p>
              <p className="text-xs text-slate-300 mt-1">Resolve items in "Needs Clarification" or "Not Plannable" first.</p>
            </div>
          )}

          {/* Needs Clarification */}
          <SectionHeader
            label="Needs Clarification"
            count={groups.needs_clarification.length}
            open={openSections.needs_clarification}
            onToggle={() => toggleSection('needs_clarification')}
            color="bg-yellow-50 text-yellow-800 border-yellow-100"
            description={SECTION_DESCRIPTIONS.needs_clarification}
          />
          {openSections.needs_clarification && groups.needs_clarification.map(item => (
            <WOReadinessRow key={item.workOrder.id} item={item} selected={selectedId === item.workOrder.id} onClick={() => setSelectedId(item.workOrder.id)} />
          ))}
          {openSections.needs_clarification && groups.needs_clarification.length === 0 && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-slate-400">No clarification needed right now.</p>
            </div>
          )}

          {/* Not Plannable */}
          <SectionHeader
            label="Not Plannable"
            count={groups.not_plannable.length}
            open={openSections.not_plannable}
            onToggle={() => toggleSection('not_plannable')}
            color="bg-red-50 text-red-800 border-red-100"
            description={SECTION_DESCRIPTIONS.not_plannable}
          />
          {openSections.not_plannable && groups.not_plannable.map(item => (
            <WOReadinessRow key={item.workOrder.id} item={item} selected={selectedId === item.workOrder.id} onClick={() => setSelectedId(item.workOrder.id)} />
          ))}
          {openSections.not_plannable && groups.not_plannable.length === 0 && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-slate-400">No hard blockers found. Great shape!</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: detail panel */}
      {selectedId && (
        <div className="w-1/2 overflow-hidden flex flex-col bg-white">
          <WODetailPanel
            item={selectedItem}
            onClose={() => setSelectedId(null)}
            technicians={technicians}
            locations={locations}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['planning-wos'] });
              queryClient.invalidateQueries({ queryKey: ['planning-jobs'] });
            }}
            />
        </div>
      )}
      </div>
    </div>
    );
  }