import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Ship, MapPin, Calendar, AlertTriangle, Clock, ChevronRight, CheckCircle2, Mail, User } from 'lucide-react';
import { format } from 'date-fns';
import { getPhaseConfig, getV3AgingLevel, getV3AgingDays, V3_PHASES } from '@/hooks/useLeadV3Data';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

// ─── User color helpers ───────────────────────────────────────────────────────
const USER_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#ef4444', '#f97316', '#6366f1',
];
function getUserColor(str) {
  if (!str) return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
function getUserInitials(user) {
  if (!user) return '?';
  const name = user.full_name || user.email || '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}
function getUserShortName(user) {
  if (!user) return null;
  const name = user.full_name || user.email || '';
  const parts = name.trim().split(/\s+/);
  return parts[0] || name;
}

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  Urgent: { borderColor: '#ef4444', badgeCls: 'bg-red-100 text-red-700 border-red-200', label: 'Urgent' },
  High:   { borderColor: '#f59e0b', badgeCls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'High' },
  Medium: { borderColor: '#3b82f6', badgeCls: null, label: 'Medium' },
  Low:    { borderColor: '#e2e8f0', badgeCls: null, label: 'Low' },
};

// ─── Offer stage derivation ───────────────────────────────────────────────────
function deriveOfferStage(offers) {
  if (!offers || offers.length === 0) return { label: 'No Offer', cls: 'bg-slate-100 text-slate-400 border-slate-200' };
  const statuses = offers.map(o => o.status);
  if (statuses.includes('Approved'))  return { label: 'Approved ✓', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (statuses.includes('Sent'))      return { label: 'Sent', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
  if (statuses.includes('Rejected'))  return { label: 'Rejected', cls: 'bg-red-100 text-red-600 border-red-200' };
  if (statuses.includes('Expired'))   return { label: 'Expired', cls: 'bg-orange-100 text-orange-600 border-orange-200' };
  if (statuses.includes('Converted')) return { label: 'Converted', cls: 'bg-teal-100 text-teal-700 border-teal-200' };
  if (statuses.includes('Draft'))     return { label: 'Draft', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  if (statuses.length > 1)            return { label: 'Mixed', cls: 'bg-purple-100 text-purple-700 border-purple-200' };
  return { label: statuses[0] || '—', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
}

// ─── Offer Stage Badge (lazy load) ───────────────────────────────────────────
function OfferStageBadge({ offerIds }) {
  const [stage, setStage] = useState(null);

  useEffect(() => {
    if (!offerIds || offerIds.length === 0) {
      setStage({ label: 'No Offer', cls: 'bg-slate-100 text-slate-400 border-slate-200' });
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const results = await Promise.all(offerIds.slice(0, 3).map(id => base44.entities.Offer.filter({ id })));
        if (!cancelled) setStage(deriveOfferStage(results.flat()));
      } catch {
        if (!cancelled) setStage({ label: `${offerIds.length} offer${offerIds.length > 1 ? 's' : ''}`, cls: 'bg-slate-100 text-slate-500 border-slate-200' });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [offerIds?.join(',')]);

  if (!stage) return <span className="inline-block w-16 h-5 rounded bg-slate-100 animate-pulse" />;

  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border whitespace-nowrap', stage.cls)}>
      {stage.label}
    </span>
  );
}

// ─── Quick Status Dropdown ────────────────────────────────────────────────────
function QuickStatusDropdown({ lead, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  const phase = getPhaseConfig(lead.status);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (e, newStatus) => {
    e.preventDefault(); e.stopPropagation();
    if (newStatus === lead.status || saving) return;
    setSaving(true); setOpen(false);
    try {
      await base44.entities.Lead.update(lead.id, { status: newStatus });
      onStatusChange?.(lead.id, newStatus);
    } finally { setSaving(false); }
  };

  return (
    <div ref={ref} className="relative" onClick={e => e.preventDefault()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        disabled={saving}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all',
          'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-95',
          saving && 'opacity-50 cursor-not-allowed'
        )}
        title="Change phase"
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
        <span className="max-w-[90px] truncate">{phase.label}</span>
        <ChevronRight className={cn('w-3 h-3 text-slate-400 transition-transform flex-shrink-0', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[200] bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[190px]">
          {V3_PHASES.map(p => (
            <button
              key={p.status}
              onClick={(e) => handleSelect(e, p.status)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                p.status === lead.status ? 'bg-slate-50 text-slate-900 font-medium cursor-default' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              {p.label}
              {p.status === lead.status && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-slate-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inline Assign Popover ────────────────────────────────────────────────────
function AssignPopover({ lead, assignedUser, users, onAssigned, children }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAssign = async (e, userId) => {
    e.preventDefault(); e.stopPropagation();
    if (saving) return;
    setSaving(true); setOpen(false);
    try {
      await base44.entities.Lead.update(lead.id, { assigned_to_user_id: userId, accepted_by_assignee: false });
      onAssigned?.(lead.id, userId);
    } finally { setSaving(false); }
  };

  const handleUnassign = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (saving) return;
    setSaving(true); setOpen(false);
    try {
      await base44.entities.Lead.update(lead.id, { assigned_to_user_id: null, accepted_by_assignee: false });
      onAssigned?.(lead.id, null);
    } finally { setSaving(false); }
  };

  return (
    <div ref={ref} className="relative" onClick={e => e.preventDefault()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        title={assignedUser ? `Assigned: ${assignedUser.full_name || assignedUser.email} — click to reassign` : 'Unassigned — click to assign'}
        className={cn('transition-all active:scale-95', saving && 'opacity-50')}
      >
        {children}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-[200] bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
            Assign to
          </div>
          {users.map(u => (
            <button
              key={u.id}
              onClick={(e) => handleAssign(e, u.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                u.id === lead.assigned_to_user_id
                  ? 'bg-slate-50 text-slate-900 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: getUserColor(u.id || u.email) }}
              >
                {getUserInitials(u)}
              </div>
              <span className="truncate">{u.full_name || u.email}</span>
              {u.id === lead.assigned_to_user_id && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-slate-400 flex-shrink-0" />}
            </button>
          ))}
          {assignedUser && (
            <>
              <div className="border-t border-slate-100 mt-1" />
              <button
                onClick={handleUnassign}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 text-slate-400" />
                </div>
                Unassign
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────
export default function LeadV3Card({ lead, assignedUser, users = [], onStatusChange, onAssigned }) {
  const phase = getPhaseConfig(lead.status);
  const priority = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.Medium;
  const agingLevel = getV3AgingLevel(lead);
  const agingDays = getV3AgingDays(lead);
  const offerIds = lead.created_offer_ids || [];
  const hasError = !!lead.auto_offer_error;
  const isAccepted = lead.accepted_by_assignee;
  const ownerColor = getUserColor(assignedUser?.id || assignedUser?.email);
  const ownerInitials = getUserInitials(assignedUser);
  const ownerShortName = getUserShortName(assignedUser);

  return (
    <div className="group relative">
      <Link to={createPageUrl('LeadDetail') + `?id=${lead.id}&from=v3`} className="block">
        <div className={cn(
          'bg-white rounded-xl border shadow-sm transition-all duration-150',
          'hover:shadow-md hover:border-slate-300',
          lead.accepted_by_assignee === false && assignedUser ? 'border-amber-200' : 'border-slate-200',
        )}>
          <div className="flex">
            {/* Priority left accent — slightly thicker for better peripheral visibility */}
            <div className="w-1.5 flex-shrink-0 rounded-l-xl" style={{ backgroundColor: priority.borderColor }} />

            {/* Card body */}
            <div className="flex-1 px-5 py-5">

              {/* ── PRIMARY BLOCK: Lead name + right cluster ── */}
              <div className="flex items-start gap-3 mb-1">

                {/* Lead name — dominant primary anchor */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-semibold text-slate-900 group-hover:text-blue-700 transition-colors leading-tight">
                      {lead.name}
                    </span>
                    {(lead.priority === 'Urgent' || lead.priority === 'High') && (
                      <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded border flex-shrink-0', priority.badgeCls)}>
                        {priority.label}
                      </span>
                    )}
                    {hasError && (
                      <span className="flex items-center gap-1 text-xs text-red-500 font-medium flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Error
                      </span>
                    )}
                  </div>
                </div>

                {/* Right cluster — offer badge + status only */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.preventDefault()}>
                  <OfferStageBadge offerIds={offerIds} />
                  <QuickStatusDropdown lead={lead} onStatusChange={onStatusChange} />
                </div>
              </div>

              {/* ── OWNER ROW — left-anchored, under the name ── */}
              <div className="flex items-center gap-2 mb-4" onClick={e => e.preventDefault()}>
                <AssignPopover lead={lead} assignedUser={assignedUser} users={users} onAssigned={onAssigned}>
                  {assignedUser ? (
                    <div className="flex items-center gap-1.5 group/owner">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0',
                          'ring-2',
                          isAccepted ? 'ring-emerald-400' : 'ring-amber-300'
                        )}
                        style={{ backgroundColor: ownerColor }}
                      >
                        {ownerInitials}
                      </div>
                      <span className="text-xs font-medium text-slate-600 group-hover/owner:text-slate-900 transition-colors">
                        {ownerShortName}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                      <div className="w-5 h-5 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3" />
                      </div>
                      <span className="text-xs text-slate-400">Unassigned</span>
                    </div>
                  )}
                </AssignPopover>

                {/* Phase dot + label — secondary, after owner */}
                <span className="text-slate-300 text-xs">·</span>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
                  <span className="text-xs text-slate-400">{phase.label}</span>
                </div>
              </div>

              {/* ── SECONDARY BLOCK: Boat + Location ── */}
              {(lead.boat_name || lead.location || lead.inquiry_type) && (
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3 flex-wrap">
                  {lead.boat_name && (
                    <span className="flex items-center gap-1">
                      <Ship className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-600">{lead.boat_name}</span>
                      {lead.boat_details && (
                        <span className="text-slate-400 hidden md:inline">· {lead.boat_details}</span>
                      )}
                    </span>
                  )}
                  {lead.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      {lead.location}
                    </span>
                  )}
                  {lead.inquiry_type && (
                    <span className="text-slate-400">{lead.inquiry_type}</span>
                  )}
                </div>
              )}

              {/* ── TERTIARY BLOCK: Description ── */}
              {lead.description && (
                <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                  {lead.description}
                </p>
              )}

              {/* ── FOOTER BLOCK: aging + email + date ── */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {agingDays !== null && (
                    <span className={cn(
                      'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium',
                      agingLevel === 'danger' ? 'bg-red-50 text-red-600 border border-red-200' :
                      agingLevel === 'warn'   ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                      'text-slate-400'
                    )}>
                      <Clock className="w-3 h-3" />
                      {agingDays === 0 ? 'Today' : `${agingDays}d ago`}
                    </span>
                  )}
                  {lead.converted_at && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Converted
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3" onClick={e => e.preventDefault()}>
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      onClick={e => e.stopPropagation()}
                      title={`Email: ${lead.email}`}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{lead.email}</span>
                    </a>
                  )}
                  {lead.created_date && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(lead.created_date), 'MMM d')}
                    </span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}