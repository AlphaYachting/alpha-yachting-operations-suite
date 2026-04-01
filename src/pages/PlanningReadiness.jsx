import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { evaluateWorkOrder } from '@/components/planning/readinessEvaluator';
import WOReadinessRow from '@/components/planning/WOReadinessRow';
import WODetailPanel from '@/components/planning/WODetailPanel';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ChevronDown, ChevronRight, HelpCircle, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const EXCLUDED_JOB_STATUSES = ['Completed', 'Cancelled', 'Invoiced'];
const EXCLUDED_WO_STATUSES  = ['Completed', 'Cancelled'];

const SECTION_DESCRIPTIONS = {
  ready:               'These work orders have everything needed to be added to the schedule. Start here when planning the week.',
  needs_clarification: "Something is missing but not critical. Can often be resolved quickly \u2014 check the detail panel for what's needed.", — check the detail panel for what's needed.',
  not_plannable:       'These cannot be scheduled until a hard blocker is resolved. Review and delegate the required actions first.',
};

const READINESS_WHY = {
  ready:               { color: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: '✅', text: 'This work order meets all planning criteria. It can be added to the schedule.' },
  needs_clarification: { color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: '⚠️', text: 'One or more soft blockers exist. Planning is possible but some details should be confirmed first.' },
  not_plannable:       { color: 'bg-red-50 border-red-200 text-red-800', icon: '❌', text: 'A hard blocker is preventing this work order from being scheduled. See the blockers below.' },
};

export { READINESS_WHY };

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
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ ready: true, needs_clarification: true, not_plannable: true });

  // ── DATA FETCHING (read-only) ──────────────────────────────────────────

  const { data: jobs = [],        isLoading: l1 } = useQuery({ queryKey: ['planning-jobs'],         queryFn: () => base44.entities.Job.list() });
  const { data: workOrders = [],  isLoading: l2 } = useQuery({ queryKey: ['planning-wos'],          queryFn: () => base44.entities.WorkOrder.list() });
  const { data: tasks = [],       isLoading: l3 } = useQuery({ queryKey: ['planning-tasks'],        queryFn: () => base44.entities.Task.list() });
  const { data: customers = [],   isLoading: l4 } = useQuery({ queryKey: ['planning-customers'],    queryFn: () => base44.entities.Customer.list() });
  const { data: boats = [],       isLoading: l5 } = useQuery({ queryKey: ['planning-boats'],        queryFn: () => base44.entities.Boat.list() });
  const { data: locations = [],   isLoading: l6 } = useQuery({ queryKey: ['planning-locations'],   queryFn: () => base44.entities.Location.list() });
  const { data: technicians = [], isLoading: l7 } = useQuery({ queryKey: ['planning-technicians'], queryFn: () => base44.entities.Technician.list() });

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7;

  // ── LOOKUP MAPS ────────────────────────────────────────────────────────

  const maps = useMemo(() => ({
    jobs:       Object.fromEntries(jobs.map(j => [j.id, j])),
    customers:  Object.fromEntries(customers.map(c => [c.id, c])),
    boats:      Object.fromEntries(boats.map(b => [b.id, b])),
    locations:  Object.fromEntries(locations.map(l => [l.id, l])),
  }), [jobs, customers, boats, locations]);

  // ── TASK AGGREGATION ───────────────────────────────────────────────────

  const tasksByWO = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      if (!m[t.work_order_id]) m[t.work_order_id] = { count: 0, minutesSum: 0 };
      m[t.work_order_id].count++;
      m[t.work_order_id].minutesSum += (t.estimated_minutes || 0);
    }
    return m;
  }, [tasks]);

  // ── ACTIVE JOB IDs ─────────────────────────────────────────────────────

  const activeJobIds = useMemo(() =>
    new Set(jobs.filter(j => !EXCLUDED_JOB_STATUSES.includes(j.status)).map(j => j.id)),
  [jobs]);

  // ── BUILD ENRICHED ITEMS ───────────────────────────────────────────────

  const allItems = useMemo(() => {
    const relevantWOs = workOrders.filter(wo => {
      if (EXCLUDED_WO_STATUSES.includes(wo.status)) return false;
      if (wo.job_id && !activeJobIds.has(wo.job_id)) return false;
      return true;
    });

    return relevantWOs.map(wo => {
      const job      = wo.job_id ? maps.jobs[wo.job_id] : null;
      const customer = job?.customer_id ? maps.customers[job.customer_id] : null;
      const boat     = job?.boat_id ? maps.boats[job.boat_id] : null;
      const location = job?.location_id ? maps.locations[job.location_id] : null;
      const tData    = tasksByWO[wo.id] || { count: 0, minutesSum: 0 };

      const evaluation = evaluateWorkOrder({
        workOrder: wo,
        job,
        customer,
        boat,
        location,
        taskCount: tData.count,
        taskEstimatedMinutesSum: tData.minutesSum,
      });

      return { workOrder: wo, job, customer, boat, location, taskCount: tData.count, taskEstimatedMinutesSum: tData.minutesSum, evaluation };
    });
  }, [workOrders, activeJobIds, maps, tasksByWO]);

  // ── SEARCH FILTER ──────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!search.trim()) return allItems;
    const q = search.toLowerCase();
    return allItems.filter(i =>
      i.workOrder.title?.toLowerCase().includes(q) ||
      i.job?.title?.toLowerCase().includes(q) ||
      i.location?.name?.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  // ── GROUPS ─────────────────────────────────────────────────────────────

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

  // ── RENDER ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-500">Loading planning data...</span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 bg-white rounded-xl border border-slate-200 overflow-hidden">

      {/* LEFT: list panel */}
      <div className={cn('flex flex-col border-r border-slate-200 overflow-hidden', selectedId ? 'w-1/2' : 'w-full')}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200">
          {/* Intro banner */}
          <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800">What is this page?</span>
              {' '}This cockpit shows which work orders are ready to be scheduled, which need a quick clarification, and which are blocked. Use it every morning before dispatching to identify gaps before they become problems.
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
                  ['1', '❌ Start with "Not Plannable"', 'Identify hard blockers — delegate resolution immediately.'],
                  ['2', '⚠️ Review "Needs Clarification"', 'Small gaps that can often be resolved in minutes.'],
                  ['3', '✅ Use "Planning Ready" for scheduling', 'These are safe to add to the dispatch board.'],
                  ['4', '🚀 "Deployable" = dispatch-ready this week', 'Has duration + assigned technician + confirmed access.'],
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

          <h1 className="text-lg font-bold text-slate-900">Planning Readiness Cockpit</h1>
          <p className="text-xs text-slate-500 mt-0.5">Read-only · No changes are made to any records</p>

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
            <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200" title="Has estimated duration + assigned technician + confirmed access">
              <p className="text-lg font-bold text-blue-700">{deployableCount}</p>
              <p className="text-xs text-blue-600">🚀 Deployable</p>
              <p className="text-xs text-blue-400" style={{fontSize:'9px'}}>duration + crew + access</p>
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
          {/* Ready */}
          <SectionHeader
            label="✅ Planning Ready"
            description={SECTION_DESCRIPTIONS.ready}
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
            label="⚠️ Needs Clarification"
            description={SECTION_DESCRIPTIONS.needs_clarification}
          {openSections.needs_clarification && groups.needs_clarification.map(item => (
            <WOReadinessRow key={item.workOrder.id} item={item} selected={selectedId === item.workOrder.id} onClick={() => setSelectedId(item.workOrder.id)} />
          ))}
          {openSections.needs_clarification && groups.needs_clarification.length === 0 && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-slate-400">👍 No clarification needed right now.</p>
            </div>
          )}

          {/* Not Plannable */}
          <SectionHeader
            label="❌ Not Plannable"
            description={SECTION_DESCRIPTIONS.not_plannable}
          {openSections.not_plannable && groups.not_plannable.map(item => (
            <WOReadinessRow key={item.workOrder.id} item={item} selected={selectedId === item.workOrder.id} onClick={() => setSelectedId(item.workOrder.id)} />
          ))}
          {openSections.not_plannable && groups.not_plannable.length === 0 && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-slate-400">✅ No hard blockers found. Great shape!</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: detail panel */}
      {selectedId && (
        <div className="w-1/2 overflow-hidden flex flex-col bg-white">
          <WODetailPanel item={selectedItem} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}