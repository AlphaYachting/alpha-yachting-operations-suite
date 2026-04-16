import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Ship, MapPin, Calendar, AlertTriangle, Clock, ChevronRight, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { format } from 'date-fns';
import { getPhaseConfig, getV3AgingLevel, getV3AgingDays, V3_PHASES } from '@/hooks/useLeadV3Data';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

// ─── User color helpers ──────────────────────────────────────────────────────
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

// ─── Priority config ─────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  Urgent: { label: 'Urgent', borderColor: '#ef4444', badgeCls: 'bg-red-100 text-red-700 border-red-200' },
  High:   { label: 'High',   borderColor: '#f59e0b', badgeCls: 'bg-amber-100 text-amber-700 border-amber-200' },
  Medium: { label: 'Medium', borderColor: '#3b82f6', badgeCls: 'bg-blue-50 text-blue-600 border-blue-200' },
  Low:    { label: 'Low',    borderColor: '#cbd5e1', badgeCls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

// ─── Offer stage derivation ───────────────────────────────────────────────────
function deriveOfferStage(offers) {
  if (!offers || offers.length === 0) return { label: 'No Offer', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  const statuses = offers.map(o => o.status);
  if (statuses.includes('Approved'))  return { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (statuses.includes('Sent'))      return { label: 'Sent', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
  if (statuses.includes('Draft'))     return { label: 'Draft', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  if (statuses.includes('Rejected'))  return { label: 'Rejected', cls: 'bg-red-100 text-red-600 border-red-200' };
  if (statuses.includes('Expired'))   return { label: 'Expired', cls: 'bg-orange-100 text-orange-600 border-orange-200' };
  if (statuses.includes('Converted')) return { label: 'Converted', cls: 'bg-teal-100 text-teal-700 border-teal-200' };
  if (statuses.length > 1)            return { label: 'Mixed', cls: 'bg-purple-100 text-purple-700 border-purple-200' };
  return { label: statuses[0] || 'Unknown', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
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
    e.preventDefault();
    e.stopPropagation();
    if (newStatus === lead.status || saving) return;
    setSaving(true);
    setOpen(false);
    try {
      await base44.entities.Lead.update(lead.id, { status: newStatus });
      onStatusChange && onStatusChange(lead.id, newStatus);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} className="relative" onClick={e => e.preventDefault()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        disabled={saving}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all',
          'hover:bg-slate-50 hover:border-slate-300 active:scale-95',
          saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          'bg-white border-slate-200 text-slate-700'
        )}
        title="Change status"
      >
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: phase.color }}
        />
        <span className="hidden sm:inline max-w-[90px] truncate">{phase.label}</span>
        <ChevronRight className={cn('w-3 h-3 text-slate-400 transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
          {V3_PHASES.map(p => (
            <button
              key={p.status}
              onClick={(e) => handleSelect(e, p.status)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                p.status === lead.status
                  ? 'bg-slate-50 text-slate-900 font-medium cursor-default'
                  : 'text-slate-700 hover:bg-slate-50'
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

// ─── Offer stage badge — fetches offers lazily ────────────────────────────────
function OfferStageBadge({ offerIds }) {
  const [stage, setStage] = useState(null);

  useEffect(() => {
    if (!offerIds || offerIds.length === 0) {
      setStage({ label: 'No Offer', cls: 'bg-slate-100 text-slate-500 border-slate-200' });
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const offers = await Promise.all(
          offerIds.slice(0, 3).map(id => base44.entities.Offer.filter({ id }))
        );
        if (!cancelled) {
          const flat = offers.flat();
          setStage(deriveOfferStage(flat));
        }
      } catch {
        if (!cancelled) setStage({ label: `${offerIds.length} Offer${offerIds.length > 1 ? 's' : ''}`, cls: 'bg-slate-100 text-slate-500 border-slate-200' });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [offerIds?.join(',')]);

  if (!stage) {
    return <span className="inline-block w-14 h-5 rounded bg-slate-100 animate-pulse" />;
  }

  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border', stage.cls)}>
      {stage.label}
    </span>
  );
}

// ─── Main Card ───────────────────────────────────────────────────────────────
export default function LeadV3Card({ lead, assignedUser, onStatusChange }) {
  const phase = getPhaseConfig(lead.status);
  const priority = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.Medium;
  const agingLevel = getV3AgingLevel(lead);
  const agingDays = getV3AgingDays(lead);
  const offerIds = lead.created_offer_ids || [];
  const ownerColor = getUserColor(assignedUser?.id || assignedUser?.email);
  const ownerInitials = getUserInitials(assignedUser);
  const isAccepted = lead.accepted_by_assignee;
  const isUnaccepted = assignedUser && !isAccepted;
  const hasError = !!lead.auto_offer_error;

  return (
    <div className="group relative">
      <Link
        to={createPageUrl('LeadDetail') + `?id=${lead.id}&from=v3`}
        className="block"
      >
        <div className={cn(
          'bg-white rounded-lg border shadow-sm overflow-hidden',
          'hover:shadow-md transition-all duration-150',
          isUnaccepted ? 'border-amber-200' : 'border-slate-200',
          'hover:border-slate-300',
        )}>
          <div className="flex">
            {/* Priority left border — 3px, color-coded */}
            <div
              className="w-1 flex-shrink-0"
              style={{ backgroundColor: priority.borderColor }}
            />

            {/* Card body */}
            <div className="flex-1 px-4 py-3">

              {/* ── ROW 1: Lead name + owner cluster + quick action ── */}
              <div className="flex items-start gap-3 mb-2">

                {/* Left: name + phase dot */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Phase color dot */}
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: phase.color }}
                    />
                    <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 truncate transition-colors leading-snug">
                      {lead.name}
                    </span>
                    {/* Priority badge — visible for Urgent/High */}
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

                {/* Right cluster: Owner → Acceptance → Offer stage → Quick status */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.preventDefault()}>

                  {/* Owner block */}
                  <div className="flex items-center gap-1.5">
                    {assignedUser ? (
                      <>
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                            'ring-2',
                            isAccepted ? 'ring-emerald-400' : 'ring-amber-400'
                          )}
                          style={{ backgroundColor: ownerColor }}
                          title={`${assignedUser.full_name || assignedUser.email} · ${isAccepted ? 'Accepted' : 'Not accepted'}`}
                        >
                          {ownerInitials}
                        </div>
                        <div className="hidden md:flex flex-col leading-none">
                          <span className="text-xs font-medium text-slate-700 truncate max-w-[80px]">
                            {(assignedUser.full_name || assignedUser.email || '').split(' ')[0]}
                          </span>
                          {isUnaccepted && (
                            <span className="text-xs text-amber-600 font-medium">pending</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0"
                        title="Unassigned"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    )}
                  </div>

                  {/* Offer stage badge */}
                  <OfferStageBadge offerIds={offerIds} />

                  {/* Quick status dropdown */}
                  <QuickStatusDropdown lead={lead} onStatusChange={onStatusChange} />
                </div>
              </div>

              {/* ── ROW 2: Boat + Location + inquiry type ── */}
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-2 flex-wrap">
                {lead.boat_name && (
                  <span className="flex items-center gap-1">
                    <Ship className="w-3 h-3 text-slate-400" />
                    <span className="font-medium text-slate-600">{lead.boat_name}</span>
                    {lead.boat_details && (
                      <span className="text-slate-400 hidden md:inline">· {lead.boat_details}</span>
                    )}
                  </span>
                )}
                {lead.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {lead.location}
                  </span>
                )}
                {lead.inquiry_type && (
                  <span className="text-slate-400">{lead.inquiry_type}</span>
                )}
              </div>

              {/* ── ROW 3: Description (only if meaningful) ── */}
              {lead.description && (
                <p className="text-xs text-slate-500 line-clamp-1 mb-2 leading-relaxed">
                  {lead.description}
                </p>
              )}

              {/* ── ROW 4: Footer — aging + date ── */}
              <div className="flex items-center justify-between gap-2">
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
                  {/* Priority label for Medium/Low (not shown as badge above) */}
                  {(lead.priority === 'Medium' || lead.priority === 'Low') && (
                    <span className="text-xs text-slate-400">{lead.priority}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {lead.converted_at && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Converted
                    </span>
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