import { BLOCKER_META } from './readinessEvaluator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MapPin, AlertTriangle } from 'lucide-react';

const PRIORITY_STYLE = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-slate-100 text-slate-600',
};

const PLANNING_STYLE = {
  ready:               'bg-emerald-100 text-emerald-700',
  needs_clarification: 'bg-yellow-100 text-yellow-700',
  not_plannable:       'bg-red-100 text-red-700',
};

const PLANNING_LABEL = {
  ready:               '✅ Planning Ready',
  needs_clarification: '⚠️ Needs Clarification',
  not_plannable:       '❌ Not Plannable',
};

export default function WOReadinessRow({ item, selected, onClick }) {
  const { workOrder, job, location, evaluation } = item;
  const topBlockers = evaluation.blockers.slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors',
        selected && 'bg-blue-50 border-l-2 border-l-blue-500'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{workOrder.title}</p>
          {job && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{job.title}</p>
          )}
          {location && (
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />{location.name}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge className={cn('text-xs', PLANNING_STYLE[evaluation.planningReadiness])}>
            {PLANNING_LABEL[evaluation.planningReadiness]}
          </Badge>
          <Badge className={cn('text-xs capitalize', PRIORITY_STYLE[evaluation.priority])}>
            {evaluation.priority}
          </Badge>
        </div>
      </div>
      {topBlockers.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {topBlockers.map(code => (
            <span key={code} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              <AlertTriangle className="h-3 w-3" />
              {BLOCKER_META[code]?.label || code}
            </span>
          ))}
          {evaluation.blockers.length > 2 && (
            <span className="text-xs text-slate-400">+{evaluation.blockers.length - 2} more</span>
          )}
        </div>
      )}
    </button>
  );
}