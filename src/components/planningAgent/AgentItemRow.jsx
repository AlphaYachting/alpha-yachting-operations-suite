import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, MapPin, Clock, Users, Zap, Cloud, UserCheck, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

export default function AgentItemRow({ item, rank }) {
  const [expanded, setExpanded] = useState(false);
  const { workOrder, job, customer, location, derived } = item;
  const d = derived;

  const customerName = customer?.company_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || '—';

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
            {job && <span className="truncate">{job.title}</span>}
            {customerName !== '—' && <span>· {customerName}</span>}
            {location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{location.name}</span>}
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

      {/* Suggested action + top resource — always visible */}
      <div className="px-4 pb-2 space-y-0.5">
        {d.suggestedNextAction && (
          <div className="flex items-start gap-2 text-xs">
            <span className="text-slate-400">→</span>
            <span className="text-slate-600 font-medium">{d.suggestedNextAction}</span>
            {d.mainUncertainty && <span className="text-slate-400 italic">· {d.mainUncertainty}</span>}
          </div>
        )}
        {d.preferredResourcePool?.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <UserCheck className="h-3 w-3 flex-shrink-0" />
            {d.preferredResourcePool.slice(0, 2).map((r, i) => (
              <span key={r.name}>
                {i > 0 && <span className="text-slate-300"> · </span>}
                <span className={cn('font-medium', r.team_type === 'Core' ? 'text-blue-700' : 'text-slate-600')}>{r.name}</span>
                <span className="text-slate-400"> ({r.skill_match_level}/{r.zone_compatibility})</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-3 text-sm">

          {/* Task context block */}
          {item.tasks?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" /> Work Content ({item.tasks.length} task{item.tasks.length !== 1 ? 's' : ''})
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
                      {t.description && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>
                      )}
                      {t.estimated_minutes > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">{Math.round(t.estimated_minutes / 60 * 10) / 10}h estimated</p>
                      )}
                    </div>
                  </div>
                ))}
                {item.tasks.length > 8 && (
                  <p className="text-xs text-slate-400 px-2">+{item.tasks.length - 8} more tasks</p>
                )}
              </div>
            </div>
          )}
          {item.tasks?.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
              <ListChecks className="h-3.5 w-3.5" /> No tasks defined for this work order
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

          {/* Resource Pools */}
          {(d.preferredResourcePool?.length > 0 || d.fallbackResourcePool?.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Resource Proposal</p>
              {d.resourceReasoning && (
                <p className="text-xs text-slate-600 mb-2 leading-relaxed">{d.resourceReasoning}</p>
              )}
              {d.preferredResourcePool?.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-slate-400 mb-1">Preferred candidates</p>
                  <div className="flex flex-col gap-1">
                    {d.preferredResourcePool.map(r => (
                      <ResourceCandidate key={r.name} r={r} />
                    ))}
                  </div>
                </div>
              )}
              {d.fallbackResourcePool?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Fallback candidates</p>
                  <div className="flex flex-col gap-1">
                    {d.fallbackResourcePool.map(r => (
                      <ResourceCandidate key={r.name} r={r} fallback />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Score breakdown</p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              {Object.entries(d.rankingBreakdown).map(([k, v]) => (
                <span key={k} className={cn('px-2 py-0.5 rounded bg-white border border-slate-200', v < 0 && 'text-red-500')}>
                  {k.replace(/([A-Z])/g, ' $1').trim()}: {v > 0 ? '+' : ''}{v}
                </span>
              ))}
              <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-semibold">Total: {d.rankingScore}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Reasoning</p>
            <p className="text-xs text-slate-600 leading-relaxed">{d.reasoningSummary}</p>
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

const ZONE_STYLE = {
  near:       'text-emerald-600',
  reasonable: 'text-blue-600',
  inefficient:'text-orange-500',
  unknown:    'text-slate-400',
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