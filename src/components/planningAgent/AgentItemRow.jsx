import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, MapPin, Clock, Users, Zap, Cloud, UserCheck, ListChecks, Calendar, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import PlannerActionPanel from './PlannerActionPanel';

const CONF_STYLE = {
  HIGH:   'bg-emerald-100 text-emerald-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  LOW:    'bg-orange-100 text-orange-700',
};

const BLOCKER_STYLE = {
  HARD:     'bg-red-100 text-red-700',
  EXTERNAL: 'bg-orange-100 text-orange-700',
  NONE:     '',
};

const ZONE_STYLE = {
  near:        'text-emerald-600',
  reasonable:  'text-blue-600',
  inefficient: 'text-orange-500',
  unknown:     'text-slate-400',
};

const OWNERSHIP_STYLE = {
  DOMAIN_OWNER:     'text-emerald-700 font-semibold',
  STRONG_MATCH:     'text-blue-600',
  CAPABLE_MATCH:    'text-slate-500',
  ADJACENT_CAPABLE: 'text-orange-400',
};

const OWNERSHIP_LABEL = {
  DOMAIN_OWNER:     'domain owner',
  STRONG_MATCH:     'strong match',
  CAPABLE_MATCH:    'capable',
  ADJACENT_CAPABLE: 'adjacent only',
};

export default function AgentItemRow({ item, rank, technicians = [], onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState(item.job?.location_id || '');
  const [locationSaving, setLocationSaving] = useState(false);
  const { workOrder, job, customer, location, derived } = item;
  const d = derived;

  // Resolve assigned executor from lead_technician_id
  const assignedExecutor = workOrder.lead_technician_id
    ? technicians.find(t => t.id === workOrder.lead_technician_id)
    : null;
  const assignedExecutorName = assignedExecutor
    ? `${assignedExecutor.first_name} ${assignedExecutor.last_name}`
    : null;

  const customerName = customer?.company_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || '—';

  // Fetch locations for dropdown
  const { data: locationsData = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await base44.entities.Location.list('-updated_date', 100);
      return res.filter(l => l.status === 'Active');
    },
  });

  // Format scheduled date for display
  const formatScheduledDate = () => {
    if (!workOrder.scheduled_date) return 'Unscheduled';
    const date = new Date(workOrder.scheduled_date);
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const isThisWeek = date >= today && date <= weekEnd;
    const formatted = date.toLocaleDateString('de-AT', { weekday: 'short', month: 'short', day: 'numeric' });
    return isThisWeek ? `This week: ${formatted}` : formatted;
  };

  // Update location
  const handleLocationChange = async (locationId) => {
    if (!locationId || !job) return;
    setLocationSaving(true);
    try {
      await base44.entities.Job.update(job.id, { location_id: locationId });
      setSelectedLocationId(locationId);
      setLocationDropdownOpen(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating location:', error);
    } finally {
      setLocationSaving(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden hover:shadow-sm transition-shadow">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded(e => !e)}
      >
        {rank != null && (
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center mt-0.5">
            {rank}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-semibold text-slate-900 truncate">{workOrder.title}</span>
            {d.isQuickWin && <Zap className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" title="Quick Win" />}
            {d.isBadWeatherCandidate && <Cloud className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" title="Bad Weather Candidate" />}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {workOrder.scheduled_date && (
              <span className="flex items-center gap-1 text-slate-600 font-medium">
                <Calendar className="h-3 w-3" />{formatScheduledDate()}
              </span>
            )}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLocationDropdownOpen(!locationDropdownOpen);
                }}
                className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                disabled={locationSaving}
              >
                <MapPin className="h-3 w-3" />
                {location?.name || 'No location'}
                {locationSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              </button>
              {locationDropdownOpen && (
                <div className="absolute top-5 left-0 z-40 bg-white border border-slate-200 rounded-lg shadow-lg min-w-max">
                  {locationsData.map(loc => (
                    <button
                      key={loc.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLocationChange(loc.id);
                      }}
                      className="block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                      disabled={locationSaving}
                    >
                      {loc.name} {loc.city && `(${loc.city})`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {job && <span className="truncate text-slate-400">·</span>}
            {job && <span className="truncate">{job.title}</span>}
            {customerName !== '—' && <span className="text-slate-400">·</span>}
            {customerName !== '—' && <span>{customerName}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-3 w-3" />{d.estimatedEffortMin}–{d.estimatedEffortMax}h
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap">
            <Users className="h-3 w-3" />{d.estimatedTeamSizeMin === d.estimatedTeamSizeMax ? d.estimatedTeamSizeMin : `${d.estimatedTeamSizeMin}–${d.estimatedTeamSizeMax}`}
          </span>
          <Badge className={cn('text-xs', CONF_STYLE[d.confidenceLevel])}>{d.confidenceLevel}</Badge>
          {d.blockerType !== 'NONE' && (
            <Badge className={cn('text-xs', BLOCKER_STYLE[d.blockerType])}>{d.blockerType}</Badge>
          )}
          {rank != null && (
            <span className="text-xs font-mono text-slate-400">{d.rankingScore}pts</span>
          )}
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {/* Summary bar — always visible */}
      <div className="px-4 pb-2 space-y-0.5">
        {d.suggestedNextAction && (
          <div className="flex items-start gap-2 text-xs">
            <span className="text-slate-400">→</span>
            <span className="text-slate-600 font-medium">{d.suggestedNextAction}</span>
            {d.mainUncertainty && <span className="text-slate-400 italic">· {d.mainUncertainty}</span>}
          </div>
        )}
        {/* Assigned executor shown prominently if set, else show suggestion */}
        {assignedExecutorName ? (
          <div className="flex items-center gap-1.5 text-xs">
            <UserCheck className="h-3 w-3 text-emerald-600 flex-shrink-0" />
            <span className="text-emerald-700 font-semibold">{assignedExecutorName}</span>
            <span className="text-slate-400">assigned executor</span>
          </div>
        ) : (
          d.preferredResourcePool?.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <UserCheck className="h-3 w-3 flex-shrink-0" />
              <span className="text-slate-400">Suggested:</span>
              {d.preferredResourcePool.slice(0, 2).map((r, i) => (
                <span key={r.name}>
                  {i > 0 && <span className="text-slate-300"> · </span>}
                  <span className={cn('font-medium', r.team_type === 'Core' ? 'text-blue-700' : 'text-slate-600')}>{r.name}</span>
                  <span className="text-slate-400"> ({r.skill_match_level}/{r.zone_compatibility})</span>
                </span>
              ))}
            </div>
          )
        )}
      </div>

      {/* Close location dropdown when expanding */}
      {expanded && locationDropdownOpen && (
        <script>setLocationDropdownOpen(false)</script>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 text-sm">

          {/* ── CURRENT STATE ───────────────────────────────── */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current State</p>

          {/* Task list */}
          {item.tasks?.length > 0 ? (
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" /> {item.tasks.length} task{item.tasks.length !== 1 ? 's' : ''} defined
              </p>
              <div className="flex flex-col gap-1">
                {item.tasks.slice(0, 8).map((t, i) => (
                  <div key={t.id || i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-white border border-slate-200">
                    <span className={cn(
                      'mt-0.5 flex-shrink-0 w-2 h-2 rounded-full',
                      t.status === 'Completed' ? 'bg-emerald-400' :
                      t.status === 'In Progress' ? 'bg-blue-400' :
                      t.status === 'Not Possible' ? 'bg-red-300' : 'bg-slate-300'
                    )} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 leading-snug">{t.title}</p>
                      {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
                      {t.estimated_minutes > 0 && <p className="text-xs text-slate-400 mt-0.5">{Math.round(t.estimated_minutes / 60 * 10) / 10}h estimated</p>}
                    </div>
                  </div>
                ))}
                {item.tasks.length > 8 && <p className="text-xs text-slate-400 px-2">+{item.tasks.length - 8} more tasks</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-3">
              <ListChecks className="h-3.5 w-3.5" /> No tasks defined for this work order
            </p>
          )}

          {/* Assigned executor */}
          {assignedExecutorName && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 mb-3">
              <UserCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-emerald-600">Assigned Executor</p>
                <p className="text-sm font-bold text-emerald-900">{assignedExecutorName}</p>
              </div>
            </div>
          )}

          {/* ── ACTIONS ─────────────────────────────────────── */}
          <PlannerActionPanel item={item} technicians={technicians} onRefresh={onRefresh} />

          {/* ── DIAGNOSIS ───────────────────────────────────── */}
          <div className="mt-4 pt-3 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Diagnosis</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Detail label="Bucket" value={d.planningBucket.replace(/_/g, ' ')} />
              <Detail label="Blocker" value={d.mainBlocker || 'None'} />
              <Detail label="Effort source" value={d.effortSource.replace(/_/g, ' ')} />
              <Detail label="Effort range" value={`${d.estimatedEffortMin}–${d.estimatedEffortMax}h`} />
              <Detail label="Team" value={`${d.estimatedTeamSizeMin}–${d.estimatedTeamSizeMax} person(s)`} />
              <Detail label="Tasks" value={`${d.taskCount} defined`} />
              <Detail label="Zone" value={d.jobZone?.replace(/_/g, ' ') || '—'} />
              {d.areaInferred && <Detail label="Service area" value={`${d.inferredServiceArea} (inferred)`} />}
              {d.durationUnknown && <Detail label="Duration" value="Unknown — fallback used" warn />}
              {d.partsEtaUnknown && <Detail label="Parts ETA" value="Unknown" warn />}
            </div>

            {/* Org-gap warnings — left-border style to distinguish from action cards */}
            {d.jobOrgGapMissing && (
              <div className="border-l-2 border-amber-400 pl-3 py-1 mb-2">
                <p className="text-xs font-semibold text-amber-700">⚠ Project has no organization tasks</p>
                <p className="text-xs text-amber-600 mt-0.5">No work order in this project has any ORGANIZATION stream tasks defined. Access, coordination and preparation responsibilities are not yet structured.</p>
              </div>
            )}
            {!d.jobOrgGapMissing && d.orgTasksMissing && d.estimatedEffortMax > 2 && (
              <div className="border-l-2 border-yellow-400 pl-3 py-1 mb-2">
                <p className="text-xs font-semibold text-yellow-700">○ Work order missing organization tasks</p>
                <p className="text-xs text-yellow-600 mt-0.5">Other work orders in this project may have org tasks, but this specific work order has none.</p>
              </div>
            )}
          </div>

          {/* ── RECOMMENDATION ──────────────────────────────── */}
          {(d.preferredResourcePool?.length > 0 || d.fallbackResourcePool?.length > 0) && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <button
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 uppercase tracking-wider mb-2"
                onClick={() => setShowResources(v => !v)}
              >
                <Users className="h-3.5 w-3.5" />
                Recommendation
                <span className="ml-1 text-slate-400 normal-case font-normal">{showResources ? '▲ hide' : '▼ show'}</span>
              </button>
              {showResources && (
                <div>
                  {d.resourceReasoning && <p className="text-xs text-slate-600 mb-2 leading-relaxed">{d.resourceReasoning}</p>}
                  {d.preferredResourcePool?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-slate-400 mb-1">{assignedExecutorName ? 'System suggestion (reference only)' : 'Preferred candidates'}</p>
                      <div className="flex flex-col gap-1">
                        {d.preferredResourcePool.map(r => <ResourceCandidate key={r.name} r={r} />)}
                      </div>
                    </div>
                  )}
                  {d.fallbackResourcePool?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Fallback candidates</p>
                      <div className="flex flex-col gap-1">
                        {d.fallbackResourcePool.map(r => <ResourceCandidate key={r.name} r={r} fallback />)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SCORE + REASONING ───────────────────────────── */}
          <div className="mt-3 pt-3 border-t border-slate-200">
            <button
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-1"
              onClick={() => setShowScore(v => !v)}
            >
              Score details {showScore ? '▲' : '▼'}
            </button>
            {showScore && (
              <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-2">
                {Object.entries(d.rankingBreakdown).map(([k, v]) => (
                  <span key={k} className={cn('px-2 py-0.5 rounded bg-white border border-slate-200', v < 0 && 'text-red-500')}>
                    {k.replace(/([A-Z])/g, ' $1').trim()}: {v > 0 ? '+' : ''}{v}
                  </span>
                ))}
                <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-semibold">Total: {d.rankingScore}</span>
              </div>
            )}
            <p className="text-xs text-slate-500 leading-relaxed">{d.reasoningSummary}</p>
          </div>

        </div>
      )}
    </div>
  );
}

function Detail({ label, value, warn }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cn('text-sm font-medium', warn ? 'text-orange-600' : 'text-slate-700')}>{value}</p>
    </div>
  );
}

function ResourceCandidate({ r, fallback }) {
  return (
    <div className={cn('flex items-center gap-2 text-xs px-2 py-1 rounded flex-wrap', fallback ? 'bg-slate-100' : 'bg-white border border-slate-200')}>
      <span className={cn('font-medium', r.team_type === 'Core' ? 'text-blue-700' : 'text-slate-600')}>{r.name}</span>
      <span className={OWNERSHIP_STYLE[r.ownership_level] || 'text-slate-400'}>{OWNERSHIP_LABEL[r.ownership_level] || r.ownership_level}</span>
      <span className={ZONE_STYLE[r.zone_compatibility] || 'text-slate-400'}>{r.zone_compatibility}</span>
      <span className="text-slate-400">{r.quick_response_mode?.replace(/_/g, ' ')}</span>
      {r.has_metadata_gap && <span className="text-orange-500 font-medium">⚠ metadata gap</span>}
      {r.short_note && <span className="text-slate-400 truncate max-w-xs">· {r.short_note}</span>}
    </div>
  );
}