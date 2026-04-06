// Phase 2 — Controlled Action Layer
// Two safe write actions: set execution owner, create org task.
// All other planning logic remains read-only.

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { UserCheck, ClipboardPlus, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlannerActionPanel({ item, technicians = [], onRefresh }) {
  const { workOrder, derived } = item;
  const [saving, setSaving] = useState(null); // 'exec' | 'org'
  const [execTechId, setExecTechId] = useState(workOrder.lead_technician_id || '');
  const [orgTitle, setOrgTitle] = useState('Organisationsaufgabe klären');
  const [orgAssigneeId, setOrgAssigneeId] = useState('');
  const [done, setDone] = useState({}); // { exec: bool, org: bool }

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
    <div className="mt-3 border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-600">Planning Gaps — Quick Actions</span>
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
                <input
                  type="text"
                  value={orgTitle}
                  onChange={e => setOrgTitle(e.target.value)}
                  placeholder="Task title…"
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-purple-400"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={orgAssigneeId}
                    onChange={e => setOrgAssigneeId(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-purple-400"
                  >
                    <option value="">— assign org owner (optional) —</option>
                    {orgCandidates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
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