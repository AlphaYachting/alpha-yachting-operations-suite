/**
 * TechnicianWorkloadBar — compact technician utilization overview for Planning Agent header.
 * Read-only display, no side effects on other components.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

const ACTIVE_WO_STATUSES = ['Draft', 'Scheduled', 'Dispatched', 'In Transit', 'In Progress', 'Paused', 'Waiting for Parts', 'Waiting for Approval'];

function getBar(count) {
  if (count === 0) return { label: 'Free', color: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (count <= 2) return { label: 'Light', color: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50' };
  if (count <= 4) return { label: 'Busy', color: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' };
  return { label: 'Overloaded', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' };
}

export default function TechnicianWorkloadBar({ technicians = [], workOrders = [] }) {
  const activeTechs = useMemo(() =>
    technicians.filter(t => t.status === 'Active'),
  [technicians]);

  const workloadMap = useMemo(() => {
    const map = {};
    workOrders
      .filter(wo => ACTIVE_WO_STATUSES.includes(wo.status))
      .forEach(wo => {
        (wo.assigned_technicians || []).forEach(tid => {
          map[tid] = (map[tid] || 0) + 1;
        });
      });
    return map;
  }, [workOrders]);

  if (activeTechs.length === 0) return null;

  // Sort: most loaded first
  const sorted = [...activeTechs].sort((a, b) => (workloadMap[b.id] || 0) - (workloadMap[a.id] || 0));

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Techniker-Auslastung</p>
      <div className="flex flex-wrap gap-2">
        {sorted.map(tech => {
          const count = workloadMap[tech.id] || 0;
          const style = getBar(count);
          const maxCount = Math.max(...Object.values(workloadMap), 1);
          const barWidth = count === 0 ? 0 : Math.max(10, Math.round((count / maxCount) * 100));
          return (
            <div key={tech.id} className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs', style.bg)}>
              <span className="font-medium text-slate-700 whitespace-nowrap">
                {tech.first_name} {tech.last_name}
              </span>
              {/* Mini bar */}
              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', style.color)}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={cn('font-semibold whitespace-nowrap', style.text)}>
                {count} WO
              </span>
              <span className={cn('text-xs whitespace-nowrap opacity-70', style.text)}>
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}