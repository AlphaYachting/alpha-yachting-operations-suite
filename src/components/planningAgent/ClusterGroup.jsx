import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Ship, Briefcase, MapPin, Calendar, AlertCircle, CheckCircle2, Crown, KeyRound, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import AgentItemRow from './AgentItemRow';
import { sortedCandidates } from '@/utils/planningAgent/sortCandidates';

export default function ClusterGroup({ boat, job, location, items = [], technicians = [], allWorkOrders = [], jobs = {}, locations = {}, onRefresh, ranked = false }) {
  const [expanded, setExpanded] = useState(true);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [localAccessConfirmed, setLocalAccessConfirmed] = useState(null); // null = use job value
  const leadRef = useRef(null);

  // Resolve current project lead
  const projectLead = job?.lead_technician_id ? technicians.find(t => t.id === job.lead_technician_id) : null;
  const projectLeadName = projectLead ? `${projectLead.first_name} ${projectLead.last_name}` : null;

  // Close lead dropdown on outside click
  useEffect(() => {
    if (!leadDropdownOpen) return;
    const handler = (e) => {
      if (leadRef.current && !leadRef.current.contains(e.target)) {
        setLeadDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [leadDropdownOpen]);

  // Sorted lead candidates
  const leadCandidates = sortedCandidates(technicians);

  const effectiveAccessConfirmed = localAccessConfirmed !== null ? localAccessConfirmed : !!job?.access_confirmed;

  const handleAccessToggle = async (e) => {
    e.stopPropagation();
    if (!job) return;
    const newValue = !effectiveAccessConfirmed;
    setLocalAccessConfirmed(newValue); // optimistic update
    setAccessSaving(true);
    try {
      await base44.entities.Job.update(job.id, { access_confirmed: newValue });
      onRefresh?.();
    } catch (error) {
      console.error('Error updating access:', error);
      setLocalAccessConfirmed(!newValue); // revert on error
    } finally {
      setAccessSaving(false);
    }
  };

  const handleLeadChange = async (technicianId) => {
    if (!job) return;
    setLeadSaving(true);
    try {
      await base44.entities.Job.update(job.id, { lead_technician_id: technicianId || null });
      setLeadDropdownOpen(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating project lead:', error);
    } finally {
      setLeadSaving(false);
    }
  };

  // Count actionable vs blocked
  const actionableCount = items.filter(i => !['BLOCKED', 'HARD'].includes(i.derived.blockerType)).length;
  const blockedCount = items.length - actionableCount;

  // Sort items by scheduled_date ascending (earliest first)
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = a.workOrder.scheduled_date ? new Date(a.workOrder.scheduled_date) : new Date(9999, 0, 1);
      const dateB = b.workOrder.scheduled_date ? new Date(b.workOrder.scheduled_date) : new Date(9999, 0, 1);
      return dateA - dateB;
    });
  }, [items]);

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
      {/* Cluster Header — div instead of button to allow nested interactive elements */}
      <div
        className="w-full px-4 py-3 flex items-start justify-between hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
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

            {/* Access confirmation — project-level toggle */}
            {job && (
              <button
                onClick={handleAccessToggle}
                disabled={accessSaving}
                title={effectiveAccessConfirmed ? 'Access confirmed — click to revoke' : 'Click to confirm boat/site access for this project'}
                className={cn(
                  'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
                  effectiveAccessConfirmed
                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    : 'text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                )}
                >
                {effectiveAccessConfirmed
                  ? <ShieldCheck className="h-3 w-3 flex-shrink-0" />
                  : <KeyRound className="h-3 w-3 flex-shrink-0" />}
                <span>{accessSaving ? '…' : (effectiveAccessConfirmed ? 'Access confirmed' : 'Confirm access')}</span>
              </button>
            )}

            {/* Project Lead quick-change */}
            {job && (
              <div
                ref={leadRef}
                className="relative flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={cn(
                    'flex items-center gap-1 cursor-pointer rounded px-1.5 py-0.5 transition-colors',
                    projectLeadName
                      ? 'text-blue-600 hover:bg-blue-50'
                      : 'text-slate-400 hover:bg-slate-100 italic'
                  )}
                  onClick={() => setLeadDropdownOpen(v => !v)}
                  title="Click to change project lead"
                >
                  <Crown className="h-3 w-3 flex-shrink-0" />
                  <span className="font-medium">{leadSaving ? '…' : (projectLeadName || 'Set lead')}</span>
                  <span className="text-slate-300 text-xs">✎</span>
                </div>
                {leadDropdownOpen && (
                  <div className="absolute top-6 left-0 z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[180px]">
                    <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-100 font-medium">Project Lead</div>
                    <button
                      onClick={() => handleLeadChange(null)}
                      className="block w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 border-b border-slate-100"
                      disabled={leadSaving}
                    >
                      — Unassign
                    </button>
                    {leadCandidates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleLeadChange(t.id)}
                        className={cn(
                          'block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-b-0',
                          t.id === job.lead_technician_id ? 'font-semibold text-blue-700 bg-blue-50' : 'text-slate-700'
                        )}
                        disabled={leadSaving}
                      >
                        {t.first_name} {t.last_name}
                        {t.id === job.lead_technician_id && ' ✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded cluster items */}
      {expanded && (
        <div className="border-t border-slate-100 px-0">
          <div className="space-y-0">
            {sortedItems.map((item, idx) => (
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