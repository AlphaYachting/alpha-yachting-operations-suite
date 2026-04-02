import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, MapPin, Clock, Users, AlertCircle, Zap, Cloud } from 'lucide-react';
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

      {/* Suggested action — always visible */}
      {d.suggestedNextAction && (
        <div className="px-4 pb-2 flex items-start gap-2 text-xs">
          <span className="text-slate-400">→</span>
          <span className="text-slate-600 font-medium">{d.suggestedNextAction}</span>
          {d.mainUncertainty && <span className="text-slate-400 italic">· {d.mainUncertainty}</span>}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Detail label="Bucket" value={d.planningBucket.replace(/_/g, ' ')} />
            <Detail label="Blocker" value={d.mainBlocker || 'None'} />
            <Detail label="Effort source" value={d.effortSource.replace(/_/g, ' ')} />
            <Detail label="Effort range" value={`${d.estimatedEffortMin}–${d.estimatedEffortMax}h`} />
            <Detail label="Team" value={`${d.estimatedTeamSizeMin}–${d.estimatedTeamSizeMax} person(s)`} />
            <Detail label="Tasks" value={`${d.taskCount} defined`} />
            {d.areaInferred && <Detail label="Service area" value={`${d.inferredServiceArea} (inferred)`} />}
            {d.durationUnknown && <Detail label="Duration" value="Unknown — fallback used" warn />}
            {d.partsEtaUnknown && <Detail label="Parts ETA" value="Unknown" warn />}
          </div>

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