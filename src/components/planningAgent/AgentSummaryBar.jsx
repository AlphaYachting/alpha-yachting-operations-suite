import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Zap, Cloud, Users } from 'lucide-react';

const UTIL_STYLE = {
  ok:        'text-emerald-700 bg-emerald-50 border-emerald-200',
  near_full: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  overloaded:'text-orange-700 bg-orange-50 border-orange-200',
  critical:  'text-red-700 bg-red-50 border-red-200',
};
const UTIL_LABEL = {
  ok: '✅ Capacity available',
  near_full: '⚠️ Near full',
  overloaded: '🔴 Overloaded',
  critical: '🚨 Severely overloaded',
};

export default function AgentSummaryBar({ buckets, capacity, onFilterClick, activeFilter }) {
  const cards = [
    { key: 'THIS_WEEK_CANDIDATE', label: 'This Week', count: buckets.thisWeek.length, color: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: CheckCircle2 },
    { key: 'NEXT_WEEK_CANDIDATE', label: 'Next Week', count: buckets.nextWeek.length, color: 'bg-blue-50 border-blue-200 text-blue-800', icon: Clock },
    { key: 'NEEDS_CLARIFICATION', label: 'Needs Clarification', count: buckets.needsClarification.length, color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: AlertTriangle },
    { key: 'BLOCKED',             label: 'Blocked', count: buckets.blocked.length, color: 'bg-red-50 border-red-200 text-red-800', icon: AlertTriangle },
    { key: 'QUICK_WINS',          label: 'Quick Wins', count: buckets.quickWins.length, color: 'bg-purple-50 border-purple-200 text-purple-800', icon: Zap },
    { key: 'BAD_WEATHER',         label: 'Bad Weather', count: buckets.badWeather.length, color: 'bg-sky-50 border-sky-200 text-sky-800', icon: Cloud },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          const isActive = activeFilter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onFilterClick(isActive ? null : c.key)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all hover:shadow-sm',
                c.color,
                isActive && 'ring-2 ring-offset-1 ring-slate-400'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon className="h-4 w-4 opacity-60" />
                <span className="text-2xl font-bold">{c.count}</span>
              </div>
              <p className="text-xs font-medium">{c.label}</p>
            </button>
          );
        })}
      </div>

      {capacity && (
        <div className={cn('rounded-xl border px-4 py-2.5 flex flex-wrap items-center gap-4 text-sm', UTIL_STYLE[capacity.utilizationStatus])}>
          <Users className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">{UTIL_LABEL[capacity.utilizationStatus]}</span>
          <span className="opacity-70">
            {capacity.activeTechs} techs × 40h = <strong>{capacity.weeklyCapacity}h</strong> capacity
          </span>
          <span className="opacity-70">
            This week: <strong>{capacity.thisWeekEffortMin}–{capacity.thisWeekEffortMax}h</strong> ({capacity.utilizationPct}%)
          </span>
          <span className="text-xs opacity-50 italic">rough estimate</span>
        </div>
      )}
    </div>
  );
}