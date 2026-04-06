// Phase 2 — Controlled Action Layer
// Two safe write actions: set execution owner, create org task.
// All other planning logic remains read-only.

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { UserCheck, ClipboardPlus, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Org Task Suggestion Engine ──────────────────────────────────────────────
// Pure function — no state, no side effects. Returns up to 3 contextual suggestions.
// ownerType: 'EXEC_OWNER' | 'ORG_OWNER' | 'FLEXIBLE'
function suggestOrgTasks(item) {
  const { workOrder, job, derived, tasks = [] } = item;
  const suggestions = [];
  const existingTitles = tasks.map(t => t.title?.toLowerCase() || '');
  const hasExisting = (keyword) => existingTitles.some(t => t.includes(keyword));
  const area = derived.inferredServiceArea || workOrder.service_area || '';
  const isExecKnown = !!workOrder.lead_technician_id;

  // 1. Access not confirmed — executor handles on-site
  if (!workOrder.access_confirmed && !hasExisting('access') && !hasExisting('zugang')) {
    suggestions.push({
      title: 'Confirm site/vessel access before scheduled date',
      ownerType: isExecKnown ? 'EXEC_OWNER' : 'FLEXIBLE',
      reason: 'Access not yet confirmed',
    });
  }

  // 2. No location assigned — needs project-level resolution
  if (!job?.location_id && !hasExisting('location') && !hasExisting('standort')) {
    suggestions.push({
      title: 'Assign a work location to this project',
      ownerType: 'ORG_OWNER',
      reason: 'No location assigned to job',
    });
  }

  // 3. Parts required but not yet ordered
  if (job?.requires_parts && !job.parts_ordered && !hasExisting('order') && !hasExisting('bestell') && !hasExisting('material')) {
    suggestions.push({
      title: 'Order required materials and confirm delivery window',
      ownerType: 'ORG_OWNER',
      reason: 'Parts required but not ordered',
    });
  }

  // 4. Parts ordered but ETA unknown
  if (job?.requires_parts && job.parts_ordered && !job.parts_eta && !hasExisting('eta') && !hasExisting('lieferung')) {
    suggestions.push({
      title: 'Confirm parts delivery ETA with supplier',
      ownerType: 'FLEXIBLE',
      reason: 'Parts ordered but delivery date unknown',
    });
  }

  // 5. Technical service area — execution-level parts/tools prep
  const technicalAreas = ['Mechanical', 'Electrical', 'Electronics', 'Plumbing', 'HVAC'];
  if (technicalAreas.includes(area) && !hasExisting('parts') && !hasExisting('tool') && !hasExisting('werkzeug') && !hasExisting('material')) {
    suggestions.push({
      title: 'Clarify required tools and parts before execution',
      ownerType: 'EXEC_OWNER',
      reason: `${area} work typically needs pre-execution prep`,
    });
  }

  // 6. Urgent/Express — customer notification
  const isUrgent = ['Urgent', 'Express'].includes(job?.priority);
  if (isUrgent && !hasExisting('customer') && !hasExisting('kunden') && !hasExisting('notify') && !hasExisting('inform')) {
    suggestions.push({
      title: 'Notify customer of scheduled date and confirm attendance',
      ownerType: 'ORG_OWNER',
      reason: 'Urgent/Express priority — customer should be informed',
    });
  }

  // 7. Non-trivial effort — marina/site coordination
  if (derived.estimatedEffortMax > 4 && !hasExisting('marina') && !hasExisting('koordin') && !hasExisting('berth') && !hasExisting('steg')) {
    suggestions.push({
      title: 'Coordinate marina/berth access and mooring availability',
      ownerType: 'FLEXIBLE',
      reason: 'Multi-hour job may require site coordination',
    });
  }

  // 8. External blocker — follow-up
  if (derived.blockerType === 'EXTERNAL' && !hasExisting('follow') && !hasExisting('warten')) {
    suggestions.push({
      title: 'Follow up on external dependency and update status',
      ownerType: 'FLEXIBLE',
      reason: 'Externally blocked — needs status tracking',
    });
  }

  // 9. Execution owner missing — responsibility clarification
  if (derived.executionOwnerMissing && !hasExisting('owner') && !hasExisting('verantwort')) {
    suggestions.push({
      title: 'Clarify execution responsibility and assign work owner',
      ownerType: 'ORG_OWNER',
      reason: 'No execution owner set',
    });
  }

  // Return max 3, most specific first (already ordered by specificity above)
  return suggestions.slice(0, 3);
}

const OWNER_BADGE = {
  EXEC_OWNER:  { label: 'EXEC', cls: 'bg-blue-100 text-blue-700' },
  ORG_OWNER:   { label: 'ORG',  cls: 'bg-purple-100 text-purple-700' },
  FLEXIBLE:    { label: '?',    cls: 'bg-slate-100 text-slate-500' },
};

export default function PlannerActionPanel({ item, technicians = [], onRefresh }) {
  const { workOrder, derived } = item;
  const [saving, setSaving] = useState(null); // 'exec' | 'org'
  const [execTechId, setExecTechId] = useState(workOrder.lead_technician_id || '');
  const [orgTitle, setOrgTitle] = useState('');
  const [orgAssigneeId, setOrgAssigneeId] = useState('');
  const [done, setDone] = useState({}); // { exec: bool, org: bool }
  const [activeSuggestion, setActiveSuggestion] = useState(null); // index of selected chip

  const orgSuggestions = suggestOrgTasks(item);

  const hasGaps = derived.executionOwnerMissing || derived.orgTasksMissing;
  if (!hasGaps && !done.exec && !done.org) return null;

  // Only org-capable candidates for org owner
  const orgCandidates = technicians.filter(t =>
    t.status !== 'Inactive' && (t.skills || []).includes('Organisation')
  );

  // All active execution technicians for exec owner
  const execCandidates = technicians.filter(t =>
    t.status !== 'Inactive' &&
    t.primary_role_tendency !== 'SUPPORT'
  );

  // Ordered assignee list based on active suggestion's ownerType
  const activeSuggestionOwnerType = activeSuggestion !== null ? orgSuggestions[activeSuggestion]?.ownerType : null;
  const orderedAssigneeCandidates = (() => {
    const allActive = technicians.filter(t => t.status !== 'Inactive');
    if (activeSuggestionOwnerType === 'ORG_OWNER') {
      const org = allActive.filter(t => (t.skills || []).includes('Organisation'));
      const rest = allActive.filter(t => !(t.skills || []).includes('Organisation'));
      return [...org, ...rest];
    }
    if (activeSuggestionOwnerType === 'EXEC_OWNER') {
      const exec = allActive.filter(t => t.primary_role_tendency !== 'SUPPORT');
      const rest = allActive.filter(t => t.primary_role_tendency === 'SUPPORT');
      return [...exec, ...rest];
    }
    return allActive;
  })();

  async function saveExecOwner() {
    if (!execTechId) return;
    setSaving('exec');
    await base44.entities.WorkOrder.update(workOrder.id, { lead_technician_id: execTechId });
    setSaving(null);
    setDone(d => ({ ...d, exec: true }));
    onRefresh?.();
  }

  async function createOrgTask() {
    if (!orgTitle.trim()) return;
    setSaving('org');
    await base44.entities.Task.create({
      work_order_id: workOrder.id,
      title: orgTitle.trim(),
      task_stream: 'ORGANIZATION',
      status: 'Not Started',
      assigned_user_id: orgAssigneeId || undefined,
    });
    setSaving(null);
    setDone(d => ({ ...d, org: true }));
    onRefresh?.();
  }

  return (
    <div className="mt-2 border border-blue-200 rounded-lg bg-blue-50/40 overflow-hidden">
      <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-blue-700">Actions — resolve planning gaps</span>
      </div>

      <div className="px-3 py-3 space-y-4">

        {/* Execution Owner */}
        {(derived.executionOwnerMissing || done.exec) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-slate-700">Execution Owner</span>
              {done.exec && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {!done.exec && <span className="text-xs text-orange-500 font-medium">Missing</span>}
            </div>
            {!done.exec && (
              <div className="flex items-center gap-2">
                <select
                  value={execTechId}
                  onChange={e => setExecTechId(e.target.value)}
                  className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400"
                >
                  <option value="">— select technician —</option>
                  {execCandidates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                      {t.primary_role_tendency ? ` (${t.primary_role_tendency})` : ''}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveExecOwner}
                  disabled={!execTechId || saving === 'exec'}
                  className="text-xs h-7 px-3"
                >
                  {saving === 'exec' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
              </div>
            )}
            {done.exec && (
              <p className="text-xs text-emerald-600">Execution owner assigned — refresh to see updated data.</p>
            )}
          </div>
        )}

        {/* Org Task */}
        {(derived.orgTasksMissing || done.org) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardPlus className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-semibold text-slate-700">Organisation Task</span>
              {done.org && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {!done.org && <span className="text-xs text-orange-500 font-medium">Missing</span>}
            </div>
            {!done.org && (
              <div className="space-y-2">

                {/* Suggestion chips */}
                {orgSuggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1.5">Likely missing — click to pre-fill:</p>
                    <div className="flex flex-col gap-1.5">
                      {orgSuggestions.map((s, i) => {
                        const badge = OWNER_BADGE[s.ownerType];
                        const isActive = activeSuggestion === i;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setActiveSuggestion(isActive ? null : i);
                              setOrgTitle(isActive ? '' : s.title);
                              setOrgAssigneeId('');
                            }}
                            className={cn(
                              'flex items-start gap-2 text-left px-2.5 py-1.5 rounded border text-xs transition-colors',
                              isActive
                                ? 'border-purple-300 bg-purple-50 text-purple-900'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            )}
                          >
                            <span className="flex-1 leading-snug">{s.title}</span>
                            <span className={cn('flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded', badge.cls)}>
                              {badge.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {activeSuggestion !== null && (
                      <p className="text-xs text-slate-400 mt-1">
                        {orgSuggestions[activeSuggestion]?.reason}
                        {' · '}
                        <span className="italic">
                          {orgSuggestions[activeSuggestion]?.ownerType === 'EXEC_OWNER' && 'Suggested: execution owner'}
                          {orgSuggestions[activeSuggestion]?.ownerType === 'ORG_OWNER' && 'Suggested: organisation owner'}
                          {orgSuggestions[activeSuggestion]?.ownerType === 'FLEXIBLE' && 'Owner: your choice'}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {/* Title input — editable, pre-filled by chip click */}
                <input
                  type="text"
                  value={orgTitle}
                  onChange={e => { setOrgTitle(e.target.value); setActiveSuggestion(null); }}
                  placeholder="Task title… (or click a suggestion above)"
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-purple-400"
                />

                {/* Assignee select — reordered by suggested owner type */}
                <div className="flex items-center gap-2">
                  <select
                    value={orgAssigneeId}
                    onChange={e => setOrgAssigneeId(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-purple-400"
                  >
                    <option value="">— assign owner (optional) —</option>
                    {orderedAssigneeCandidates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                        {(t.skills || []).includes('Organisation') ? ' · org' : ''}
                        {t.primary_role_tendency ? ` · ${t.primary_role_tendency.toLowerCase()}` : ''}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={createOrgTask}
                    disabled={!orgTitle.trim() || saving === 'org'}
                    className="text-xs h-7 px-3 border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    {saving === 'org' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
                  </Button>
                </div>
              </div>
            )}
            {done.org && (
              <p className="text-xs text-emerald-600">Organisation task created — refresh to see updated data.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}