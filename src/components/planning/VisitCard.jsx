import { useState } from 'react';
import { ChevronDown, MapPin, Clock, Users, AlertTriangle, CheckCircle2, Ship, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VisitCard({ visit, onSetStartDate, onAssignExecutor }) {
  const [expanded, setExpanded] = useState(false);

  const { boat, job, location, startDate, effort, actionable, blocked, executor, actionableCount, blockedCount } = visit;

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-AT', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="border border-slate-200 rounded-lg bg-white hover:shadow-md transition-shadow">
      {/* Summary Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
      >
        <Ship className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {job?.title || 'Untitled Project'}
            </p>
            {location && (
              <span className="text-xs text-slate-400 flex-shrink-0">
                @ {location.name}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Start: {formatDate(startDate)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {effort.min}–{effort.max}h
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {actionableCount} work order{actionableCount !== 1 ? 's' : ''}
            </span>
            {blockedCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {blockedCount} blocked
              </span>
            )}
          </div>
        </div>

        {/* Executor pill */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <div className={cn(
            'px-2.5 py-1.5 rounded-full text-xs font-medium',
            executor.assigned
              ? 'bg-emerald-100 text-emerald-800'
              : executor.suggestion
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
          )}>
            {executor.name}
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 rotate-180" />
          )}
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-3">
          
          {/* Actionable work orders */}
          {actionable.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-semibold text-slate-700">Actionable ({actionableCount})</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {actionable.slice(0, 3).map(wo => (
                  <div key={wo.id} className="flex items-start gap-2 px-2.5 py-1.5 rounded bg-white border border-emerald-100">
                    <span className="text-xs text-emerald-600 font-medium min-w-fit flex-shrink-0 mt-0.5">✓</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-900">{wo.title}</p>
                      {wo.estimated_duration_hours && (
                        <p className="text-xs text-slate-500 mt-0.5">~{Math.round(wo.estimated_duration_hours * 10) / 10}h</p>
                      )}
                    </div>
                  </div>
                ))}
                {actionable.length > 3 && (
                  <p className="text-xs text-slate-500 px-2 py-1">+{actionable.length - 3} more</p>
                )}
              </div>
            </div>
          )}

          {/* Blocked/paused work orders */}
          {blocked.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-xs font-semibold text-slate-700">Blocked/Paused ({blockedCount})</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {blocked.slice(0, 3).map(wo => (
                  <div key={wo.id} className="flex items-start gap-2 px-2.5 py-1.5 rounded bg-white border border-amber-100">
                    <span className="text-xs text-amber-600 font-medium min-w-fit flex-shrink-0">—</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700">{wo.title}</p>
                      <p className="text-xs text-amber-600 mt-0.5">{wo.status}</p>
                    </div>
                  </div>
                ))}
                {blocked.length > 3 && (
                  <p className="text-xs text-slate-500 px-2 py-1">+{blocked.length - 3} more</p>
                )}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <button
              onClick={() => onSetStartDate?.(visit)}
              className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Set Start Date
            </button>
            {!executor.assigned && (
              <button
                onClick={() => onAssignExecutor?.(visit)}
                className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
              >
                Assign Executor
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}