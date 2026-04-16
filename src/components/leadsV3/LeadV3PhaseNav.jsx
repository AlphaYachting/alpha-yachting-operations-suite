import React from 'react';
import { V3_PHASES } from '@/hooks/useLeadV3Data';
import { cn } from '@/lib/utils';

export default function LeadV3PhaseNav({ leads, activePhase, onPhaseSelect }) {
  const phaseCounts = V3_PHASES.reduce((acc, p) => {
    acc[p.status] = leads.filter(l => l.status === p.status).length;
    return acc;
  }, {});

  const totalActive = leads.filter(l => !['Ordered / Confirmed', 'Rejected'].includes(l.status)).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header strip */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Lead Pipeline</span>
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 font-medium">
            {totalActive} active
          </span>
        </div>
        <button
          onClick={() => onPhaseSelect('All')}
          className={cn(
            'text-xs font-medium px-3 py-1 rounded-full transition-all',
            activePhase === 'All'
              ? 'bg-slate-800 text-white'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          )}
        >
          All
        </button>
      </div>

      {/* Phase tabs */}
      <div className="flex divide-x divide-slate-100 overflow-x-auto">
        {V3_PHASES.map((phase) => {
          const count = phaseCounts[phase.status] || 0;
          const isActive = activePhase === phase.status;

          return (
            <button
              key={phase.status}
              onClick={() => onPhaseSelect(phase.status)}
              className={cn(
                'flex-1 min-w-[100px] flex flex-col items-center gap-1 px-3 py-3 transition-all relative group',
                isActive ? 'bg-slate-50' : 'hover:bg-slate-50/60'
              )}
            >
              {/* Active indicator bar */}
              <div
                className={cn('absolute top-0 left-0 right-0 h-0.5 transition-all', isActive ? 'opacity-100' : 'opacity-0')}
                style={{ backgroundColor: phase.color }}
              />

              {/* Count */}
              <div
                className={cn(
                  'text-lg font-bold tabular-nums transition-colors',
                  isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'
                )}
              >
                {count}
              </div>

              {/* Label */}
              <div
                className={cn(
                  'text-xs font-medium uppercase tracking-wide text-center leading-tight transition-colors',
                  isActive ? phase.text : 'text-slate-400 group-hover:text-slate-500'
                )}
              >
                {phase.label}
              </div>

              {/* Phase dot */}
              <div
                className={cn('w-1.5 h-1.5 rounded-full transition-all', isActive ? 'opacity-100' : 'opacity-30')}
                style={{ backgroundColor: phase.color }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}