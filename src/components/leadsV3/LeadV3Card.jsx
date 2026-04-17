import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Ship, MapPin, Calendar, AlertTriangle, Clock, ChevronDown, CheckCircle2, Mail, User, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { getPhaseConfig, getV3AgingLevel, getV3AgingDays, V3_PHASES } from '@/hooks/useLeadV3Data';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
  Urgent: { borderColor: '#ef4444', badgeCls: 'bg-red-100 text-red-700', label: 'Urgent' },
  High:   { borderColor: '#f59e0b', badgeCls: 'bg-amber-100 text-amber-700', label: 'High' },
  Medium: { borderColor: '#3b82f6', badgeCls: null, label: 'Medium' },
  Low:    { borderColor: '#e2e8f0', badgeCls: null, label: 'Low' },
};

// ─── Offer stage derivation ───────────────────────────────────────────────────
function deriveOfferStage(offers) {
  if (!offers || offers.length === 0) return null;
  const statuses = offers.map(o => o.status);
  if (statuses.includes('Approved'))  return { label: 'Approved ✓', cls: 'bg-emerald-100 text-emerald-700' };
  if (statuses.includes('Sent'))      return { label: 'Sent', cls: 'bg-indigo-100 text-indigo-700' };
  if (statuses.includes('Rejected'))  return { label: 'Rejected', cls: 'bg-red-100 text-red-600' };
  if (statuses.includes('Expired'))   return { label: 'Expired', cls: 'bg-orange-100 text-orange-600' };
  if (statuses.includes('Converted')) return { label: 'Converted', cls: 'bg-teal-100 text-teal-700' };
  if (statuses.includes('Draft'))     return { label: 'Offer Draft', cls: 'bg-slate-100 text-slate-600' };
  return { label: statuses[0] || '—', cls: 'bg-slate-100 text-slate-500' };
}

// ─── Offer Stage Badge (lazy load) ───────────────────────────────────────────
function OfferStageBadge({ offerIds }) {
  const [stage, setStage] = useState(undefined);

  useEffect(() => {
    if (!offerIds || offerIds.length === 0) { setStage(null); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const results = await Promise.all(offerIds.slice(0, 3).map(id => base44.entities.Offer.filter({ id })));
        if (!cancelled) setStage(deriveOfferStage(results.flat()));
      } catch {
        if (!cancelled) setStage({ label: `${offerIds.length} offer${offerIds.length > 1 ? 's' : ''}`, cls: 'bg-slate-100 text-slate-500' });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [offerIds?.join(',')]);

  if (stage === undefined) return <span className="inline-block w-14 h-4 rounded bg-slate-100 animate-pulse" />;
  if (!stage) return null;

  return (
    <Badge className={cn('text-xs font-medium px-2 py-0.5 rounded-sm', stage.cls)}>
      {stage.label}
    </Badge>
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
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        disabled={saving}
        className="h-7 px-2 text-xs gap-1.5 font-medium border-slate-200 text-slate-600 hover:bg-slate-50"
        title="Change phase"
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
        <span className="max-w-[80px] truncate hidden sm:inline">{phase.label}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
      </Button>

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
        title={assignedUser ? `Assigned: ${assignedUser.full_name || assignedUser.email}` : 'Unassigned'}
        className={cn('transition-all active:scale-95 rounded', saving && 'opacity-50')}
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
                u.id === lead.assigned_to_user_id ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-700 hover:bg-slate-50'
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

  // Aging border — same pattern as V2
  const agingBorderClass =
    lead.status === 'Ordered / Confirmed' ? 'border-emerald-300' :
    agingLevel === 'danger' ? 'border-red-300' :
    agingLevel === 'warn' ? 'border-amber-300' :
    lead.accepted_by_assignee === false && assignedUser ? 'border-amber-200' : 'border-slate-200';

  return (
    <div className="group">
      <Link to={createPageUrl('LeadDetail') + `?id=${lead.id}&from=v3`} className="block">
        <div className={cn(
          'bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow',
          agingBorderClass
        )}>
          <div className="flex items-stretch">
            {/* Priority accent bar */}
            <div className="w-1 flex-shrink-0 rounded-l-lg" style={{ backgroundColor: priority.borderColor }} />

            {/* Card body — V2-aligned p-4 rhythm */}
            <div className="flex-1 p-4">
              <div className="flex items-start gap-3">

                {/* Status icon block — matches V2 iconBg pattern */}
                <div
                  className="rounded-lg p-2.5 flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: phase.color + '18' }}
                >
                  <Phone className="h-4 w-4" style={{ color: phase.color }} />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">

                  {/* Row 1: Name + badges + owner avatar */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {/* Owner avatar */}
                    <AssignPopover lead={lead} assignedUser={assignedUser} users={users} onAssigned={onAssigned}>
                      {assignedUser ? (
                        <div
                          className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer"
                          style={{
                            backgroundColor: ownerColor,
                            boxShadow: isAccepted ? '0 0 0 2px #10b981' : '0 0 0 2px #fbbf24'
                          }}
                          title={`${ownerShortName}${isAccepted ? ' · Accepted' : ' · Pending'}`}
                        >
                          {ownerInitials}
                        </div>
                      ) : (
                        <div
                          className="flex-shrink-0 h-6 w-6 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors"
                          title="Unassigned"
                        >
                          <User className="w-3 h-3 text-slate-400" />
                        </div>
                      )}
                    </AssignPopover>

                    {/* Name */}
                    <span className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {lead.name}
                    </span>

                    {/* Status badge */}
                    <Badge className={cn('text-xs', phase.badgeCls || 'bg-slate-100 text-slate-600')}>
                      {phase.label}
                    </Badge>

                    {/* Priority badge — only urgent/high */}
                    {(lead.priority === 'Urgent' || lead.priority === 'High') && (
                      <Badge className={cn('text-xs', priority.badgeCls)}>
                        {priority.label}
                      </Badge>
                    )}

                    {/* Offer badge */}
                    <OfferStageBadge offerIds={offerIds} />

                    {/* Error indicator */}
                    {hasError && (
                      <span className="flex items-center gap-1 text-xs text-red-500 font-medium flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Error
                      </span>
                    )}
                  </div>

                  {/* Row 2: Contact + boat + location + date — V2 bullet-separated pattern */}
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1.5 flex-wrap">
                    {lead.phone && <span>{lead.phone}</span>}
                    {lead.email && (
                      <>
                        {lead.phone && <span className="text-slate-300">•</span>}
                        <span className="truncate text-slate-500">{lead.email}</span>
                      </>
                    )}
                    {lead.boat_name && (
                      <>
                        {(lead.phone || lead.email) && <span className="text-slate-300">•</span>}
                        <span className="flex items-center gap-1">
                          <Ship className="h-3 w-3 text-slate-400" />
                          {lead.boat_name}
                        </span>
                      </>
                    )}
                    {lead.location && (
                      <>
                        {(lead.phone || lead.email || lead.boat_name) && <span className="text-slate-300">•</span>}
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {lead.location}
                        </span>
                      </>
                    )}
                    {lead.created_date && (
                      <>
                        {(lead.phone || lead.email || lead.boat_name || lead.location) && <span className="text-slate-300">•</span>}
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(lead.created_date), 'MMM dd')}
                        </span>
                      </>
                    )}
                    {agingDays !== null && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className={cn(
                          'flex items-center gap-1 text-xs font-medium',
                          agingLevel === 'danger' ? 'text-red-600' :
                          agingLevel === 'warn' ? 'text-amber-600' : 'text-slate-400'
                        )}>
                          <Clock className="w-3 h-3" />
                          {agingDays === 0 ? 'Today' : `${agingDays}d`}
                        </span>
                      </>
                    )}
                    {lead.converted_at && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Converted
                        </span>
                      </>
                    )}
                  </div>

                  {/* Row 3: Description (1 line) */}
                  {lead.description && (
                    <p className="text-sm text-slate-500 line-clamp-1">{lead.description}</p>
                  )}

                </div>

                {/* Action zone — right side, V2-style button cluster */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.preventDefault()}>
                  <QuickStatusDropdown lead={lead} onStatusChange={onStatusChange} />
                  {lead.email && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        const subject = encodeURIComponent(`Anfrage${lead.boat_name ? ` – ${lead.boat_name}` : ''}${lead.name ? ` (${lead.name})` : ''}`);
                        const body = encodeURIComponent(`${lead.description ? lead.description + '\n\n' : ''}---\nAnfrage von: ${lead.name || ''}${lead.boat_name ? '\nBoot: ' + lead.boat_name : ''}${lead.phone ? '\nTel: ' + lead.phone : ''}`);
                        window.open(`mailto:${lead.email}?subject=${subject}&body=${body}`, '_self');
                      }}
                      className="h-7 w-7 p-0 text-sky-600 hover:bg-sky-50"
                      title={`Email: ${lead.email}`}
                    >
                      <Mail className="h-3 w-3" />
                    </Button>
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