import { BLOCKER_META, NEXT_ACTIONS } from './readinessEvaluator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { X, CheckCircle2, XCircle, AlertCircle, Clock, MapPin, User, Wrench } from 'lucide-react';

const READINESS_WHY = {
  ready:               { color: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: '✅', text: 'This work order meets all planning criteria. It can be added to the schedule.' },
  needs_clarification: { color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: '⚠️', text: 'One or more soft blockers exist. Can be planned, but some details should be confirmed first.' },
  not_plannable:       { color: 'bg-red-50 border-red-200 text-red-800', icon: '❌', text: 'A hard blocker is preventing scheduling. See the blockers below and delegate resolution.' },
};

const CHECK_ROW = ({ ok, label }) => (
  <div className="flex items-center gap-2 text-sm">
    {ok
      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
      : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
    <span className={ok ? 'text-slate-700' : 'text-slate-500'}>{label}</span>
  </div>
);

const PRIORITY_COLOR = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-slate-100 text-slate-600' };
const PRIORITY_COLOR_TEXT = { high: 'text-red-600', medium: 'text-orange-500', low: 'text-slate-400' };
const PRIORITY_PERIOD_COLOR = { Today: 'text-red-600 font-semibold', 'This week': 'text-orange-600 font-medium', Later: 'text-slate-400' };
const SEVERITY_LABEL = { hard: 'Must fix', soft: 'Should confirm', gap: 'Nice to have' };
const SEVERITY_COLOR = { hard: 'bg-red-50 border-red-200 text-red-700', soft: 'bg-orange-50 border-orange-200 text-orange-700', gap: 'bg-blue-50 border-blue-200 text-blue-600' };

export default function WODetailPanel({ item, onClose }) {
  if (!item) return null;
  const { workOrder, job, customer, boat, location, evaluation, taskCount, taskEstimatedMinutesSum } = item;

  const hardB = evaluation.blockers.filter(b => BLOCKER_META[b]?.severity === 'hard');
  const softB = evaluation.blockers.filter(b => BLOCKER_META[b]?.severity === 'soft');
  const gapB  = evaluation.blockers.filter(b => BLOCKER_META[b]?.severity === 'gap');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-200">
        <div>
          <h3 className="font-semibold text-slate-900">{workOrder.title}</h3>
          {job && <p className="text-sm text-slate-500 mt-0.5">{job.title}</p>}
          <div className="flex items-center gap-2 mt-1">
            {location && <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="h-3 w-3" />{location.name}</span>}
            {customer && <span className="text-xs text-slate-400">{customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()}</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Why is this WO here? */}
        {(() => {
          const why = READINESS_WHY[evaluation.planningReadiness];
          return (
            <div className={`p-3 rounded-lg border text-sm ${why.color}`}>
              <span className="font-semibold">{why.icon} Why is this here?</span>{' '}{why.text}
            </div>
          );
        })()}

        {/* NEXT ACTIONS — shown first so user knows what to do immediately */}
        {evaluation.nextActions.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">What to do next</h4>
            <p className="text-xs text-slate-400 mb-2">Resolve these actions to move this work order forward. Sorted by urgency.</p>
            <div className="space-y-2">
              {evaluation.nextActions.map(action => (
                <div key={action.code} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-700">{action.text}</p>
                    <span className={cn('text-xs whitespace-nowrap', PRIORITY_PERIOD_COLOR[action.priority])}>{action.priority}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-slate-400 flex items-center gap-1"><User className="h-3 w-3" />{action.role}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Wrench className="h-3 w-3" />{action.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {evaluation.blockers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
            <p className="text-sm font-medium text-slate-700">No blockers detected</p>
            <p className="text-xs text-slate-400 mt-1">This work order is well-prepared for planning.</p>
          </div>
        )}

        {/* BLOCKERS — shown after actions, with human-readable severity labels */}
        {evaluation.blockers.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">What is blocking this</h4>
            <div className="space-y-1.5">
              {[...evaluation.blockers.filter(b => BLOCKER_META[b]?.severity === 'hard'),
                ...evaluation.blockers.filter(b => BLOCKER_META[b]?.severity === 'soft'),
                ...evaluation.blockers.filter(b => BLOCKER_META[b]?.severity === 'gap')
              ].map(code => (
                <div key={code} className={cn('flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border', SEVERITY_COLOR[BLOCKER_META[code]?.severity])}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="font-medium">{BLOCKER_META[code]?.label}</span>
                  <span className="text-xs opacity-60 ml-auto">{SEVERITY_LABEL[BLOCKER_META[code]?.severity]}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Planning Gate Checks */}
        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Planning gate checks</h4>
          <div className="space-y-1.5">
            <CHECK_ROW ok={!!job?.location_id} label={location ? `Location assigned: ${location.name}` : 'No location assigned to this job'} />
            {customer?.status === 'Blocked' && (
              <CHECK_ROW ok={false} label="Customer account is blocked" />
            )}
            <CHECK_ROW ok={!job?.requires_parts || job?.parts_ordered === true} label={job?.requires_parts ? (job?.parts_ordered ? 'Parts ordered' : 'Parts not yet ordered') : 'No parts required'} />
            <CHECK_ROW ok={!!workOrder.service_area} label={workOrder.service_area ? `Service area: ${workOrder.service_area}` : 'Service area not classified'} />
          </div>
        </section>

        {/* Ready to Dispatch? */}
        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ready to dispatch?</h4>
          <p className="text-xs text-slate-400 mb-2">Required before sending a technician: known duration, assigned crew, confirmed boat access.</p>
          <div className="space-y-1.5">
            <CHECK_ROW ok={evaluation.durationKnown} label={evaluation.durationKnown ? `Duration known (${workOrder.estimated_duration_hours ? workOrder.estimated_duration_hours + ' hrs' : Math.round(taskEstimatedMinutesSum / 60) + ' hrs from tasks'})` : 'Duration not estimated'} />
            <CHECK_ROW ok={evaluation.hasAssigned} label={evaluation.hasAssigned ? `${workOrder.assigned_technicians.length} technician(s) assigned` : 'No technician assigned'} />
            <CHECK_ROW ok={workOrder.access_confirmed || !!boat?.access_details} label={workOrder.access_confirmed ? 'Access confirmed' : boat?.access_details ? 'Boat access details on file' : 'Access not confirmed'} />
          </div>
          <div className="mt-2">
            <Badge className={evaluation.dispatchReady ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}>
              {evaluation.dispatchReady ? 'Ready to dispatch' : 'Not yet dispatch-ready'}
            </Badge>
          </div>
        </section>

        {/* Operational Priority — only shown if meaningful */}
        {(job?.requested_date || job?.priority) && (
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Scheduling priority</h4>
            <div className="flex items-center gap-3">
              <Badge className={cn('capitalize', PRIORITY_COLOR[evaluation.priority])}>{evaluation.priority} priority</Badge>
              {job?.requested_date && <span className="text-sm text-slate-500">Requested by: {new Date(job.requested_date).toLocaleDateString('de-AT')}</span>}
            </div>
            {job?.priority && (
              <p className="text-xs text-slate-400 mt-1">Job priority level: {job.priority}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              Tasks defined: {taskCount} · Estimated: {taskEstimatedMinutesSum > 0 ? Math.round(taskEstimatedMinutesSum / 60) + ' hrs' : 'unknown'}
            </p>
          </section>
        )}

      </div>
    </div>
  );
}