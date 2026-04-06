import { useState } from 'react';
import { ChevronDown, ChevronRight, Ship, Briefcase, MapPin, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import AgentItemRow from './AgentItemRow';

export default function ClusterGroup({ boat, job, location, items = [], technicians = [], allWorkOrders = [], jobs = {}, locations = {}, onRefresh, ranked = false }) {
  const [expanded, setExpanded] = useState(true);

  // Count actionable vs blocked
  const actionableCount = items.filter(i => !['BLOCKED', 'HARD'].includes(i.derived.blockerType)).length;
  const blockedCount = items.length - actionableCount;

  // Find earliest scheduled date in cluster
  const scheduledDates = items
    .filter(i => i.workOrder.scheduled_date)
    .map(i => new Date(i.workOrder.scheduled_date))
    .sort((a, b) => a - b);
  const earliestDate = scheduledDates[0];

  const formatClusterDate = () => {
    if (!earliestDate) return 'Unscheduled';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const formatted = earliestDate.toLocaleDateString('de-AT', { weekday: 'short', month: 'short', day: 'numeric' });
    if (earliestDate >= today) {
      const daysOut = Math.ceil((earliestDate - today) / (1000 * 60 * 60 * 24));
      if (daysOut <= 7) return `This week: ${formatted}`;
      if (daysOut <= 14) return `Next week: ${formatted}`;
    }
    return formatted;
  };

  const boatName = boat?.name || boat?.vessel_name || boat?.boat_name || boat?.id || 'Unknown Boat';
  const jobTitle = job?.title || 'Unknown Project';
  const locationName = location?.name || 'Unknown Location';

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-sm transition-shadow">
      {/* Cluster Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-start justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Ship className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-900 truncate">{boatName}</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Briefcase className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-700 truncate">{jobTitle}</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-700 truncate">{locationName}</span>
            </div>
          </div>

          {/* Summary line */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              {formatClusterDate()}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">{items.length} WO{items.length !== 1 ? 's' : ''}</span>
            </div>
            {actionableCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-slate-400">·</span>
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-700 font-medium">{actionableCount} actionable</span>
              </div>
            )}
            {blockedCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-slate-400">·</span>
                <AlertCircle className="h-3 w-3 text-red-600" />
                <span className="text-red-700 font-medium">{blockedCount} blocked</span>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expanded cluster items */}
      {expanded && (
        <div className="border-t border-slate-100 px-0">
          <div className="space-y-0">
            {items.map((item, idx) => (
              <div key={item.workOrder.id} className={cn('px-4 py-2', idx > 0 && 'border-t border-slate-100')}>
                <AgentItemRow
                  item={item}
                  rank={ranked ? idx + 1 : null}
                  technicians={technicians}
                  allWorkOrders={allWorkOrders}
                  jobs={jobs}
                  locations={locations}
                  onRefresh={onRefresh}
                  compact
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}