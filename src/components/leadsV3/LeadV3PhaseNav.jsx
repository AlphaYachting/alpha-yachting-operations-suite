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
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      {/* Phase tabs — compact, V2-aligned density */}
      <div className="flex divide-x divide-slate-100 overflow-x-auto">
        {V3_PHASES.map((phase) => {
          const count = phaseCounts[phase.status] || 0;
          const isActive = activePhase === phase.status;

          return (
            <button
              key={phase.status}
              onClick={() => onPhaseSelect(phase.status)}
              className={cn(
                'flex-1 min-w-[90px] flex flex-col items-center gap-0.5 px-3 py-2.5 transition-all relative group',
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
                  'text-base font-bold tabular-nums transition-colors',
                  isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'
                )}
              >
                {count}
              </div>

              {/* Label */}
              <div
                className={cn(
                  'text-xs font-medium text-center leading-tight transition-colors',
                  isActive ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-500'
                )}
              >
                {phase.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}