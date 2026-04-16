import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Ship, MapPin, Calendar, FileText, AlertTriangle, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { getPhaseConfig, getV3AgingLevel, getV3AgingDays } from '@/hooks/useLeadV3Data';
import { cn } from '@/lib/utils';

// Isolated V3 color helpers
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

const PRIORITY_CONFIG = {
  Urgent: { label: 'Urgent', dot: 'bg-red-500',    text: 'text-red-600',    ring: 'ring-red-300' },
  High:   { label: 'High',   dot: 'bg-amber-500',  text: 'text-amber-600',  ring: 'ring-amber-300' },
  Medium: { label: 'Medium', dot: 'bg-blue-400',   text: 'text-blue-600',   ring: 'ring-blue-200' },
  Low:    { label: 'Low',    dot: 'bg-slate-300',  text: 'text-slate-500',  ring: 'ring-slate-200' },
};

const INQUIRY_COLORS = {
  'Service Inquiry': 'bg-blue-50 text-blue-700 border-blue-200',
  'Parts Request':   'bg-purple-50 text-purple-700 border-purple-200',
  'Maintenance':     'bg-teal-50 text-teal-700 border-teal-200',
  'Emergency':       'bg-red-50 text-red-700 border-red-200',
  'Other':           'bg-slate-50 text-slate-600 border-slate-200',
};

export default function LeadV3Card({ lead, assignedUser }) {
  const phase = getPhaseConfig(lead.status);
  const priority = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.Medium;
  const agingLevel = getV3AgingLevel(lead);
  const agingDays = getV3AgingDays(lead);

  const offerCount = (lead.created_offer_ids || []).length;
  const ownerColor = getUserColor(assignedUser?.id || assignedUser?.email);
  const ownerInitials = getUserInitials(assignedUser);
  const isAccepted = lead.accepted_by_assignee;
  const hasError = !!lead.auto_offer_error;

  return (
    <Link
      to={createPageUrl('LeadDetail') + `?id=${lead.id}&from=v3`}
      className="block group"
    >
      <div className={cn(
        'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden',
        'hover:shadow-md hover:border-slate-300 transition-all duration-150',
        agingLevel === 'danger' && 'border-l-0',
        agingLevel === 'warn' && 'border-l-0',
      )}>
        <div className="flex">
          {/* Left phase stripe */}
          <div
            className="w-1 flex-shrink-0 rounded-l-xl"
            style={{ backgroundColor: phase.color }}
          />

          {/* Card body */}
          <div className="flex-1 p-4">
            {/* Row 1: Name + Owner + Priority */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Priority dot */}
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-0.5', priority.dot)} />

                {/* Lead name */}
                <span className="text-[15px] font-semibold text-slate-900 group-hover:text-blue-700 truncate transition-colors">
                  {lead.name}
                </span>

                {/* Inquiry type chip */}
                {lead.inquiry_type && (
                  <span className={cn(
                    'hidden sm:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0',
                    INQUIRY_COLORS[lead.inquiry_type] || INQUIRY_COLORS.Other
                  )}>
                    {lead.inquiry_type}
                  </span>
                )}
              </div>

              {/* Right side: Owner avatar + offer badge */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Offer badge */}
                <div className={cn(
                  'flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
                  offerCount > 0
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                )}>
                  <FileText className="w-3 h-3" />
                  {offerCount > 0 ? `${offerCount} Offer${offerCount > 1 ? 's' : ''}` : 'No Offer'}
                </div>

                {/* Owner avatar */}
                {assignedUser ? (
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                      'ring-2',
                      isAccepted ? 'ring-emerald-400' : 'ring-white'
                    )}
                    style={{ backgroundColor: ownerColor }}
                    title={`${assignedUser.full_name || assignedUser.email}${isAccepted ? ' · Accepted' : ' · Not accepted yet'}`}
                  >
                    {ownerInitials}
                  </div>
                ) : (
                  <div
                    className="w-7 h-7 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0"
                    title="Unassigned"
                  >
                    <span className="text-slate-400 text-xs">?</span>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Boat + Location */}
            <div className="flex items-center gap-3 text-[12px] text-slate-500 mb-2 flex-wrap">
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
            </div>

            {/* Row 3: Description */}
            {lead.description && (
              <p className="text-[12px] text-slate-500 line-clamp-1 mb-2 leading-relaxed">
                {lead.description}
              </p>
            )}

            {/* Row 4: Meta footer */}
            <div className="flex items-center justify-between gap-2">
              {/* Left: Priority label + aging */}
              <div className="flex items-center gap-2">
                <span className={cn('text-[11px] font-semibold uppercase tracking-wide', priority.text)}>
                  {priority.label}
                </span>

                {agingDays !== null && (
                  <span className={cn(
                    'flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium',
                    agingLevel === 'danger' ? 'bg-red-50 text-red-600' :
                    agingLevel === 'warn'   ? 'bg-amber-50 text-amber-600' :
                    'text-slate-400'
                  )}>
                    <Clock className="w-3 h-3" />
                    {agingDays === 0 ? 'Today' : `${agingDays}d`}
                  </span>
                )}

                {/* Error indicator */}
                {hasError && (
                  <span className="flex items-center gap-1 text-[11px] text-red-500 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    Automation error
                  </span>
                )}
              </div>

              {/* Right: Created date + conversion indicator */}
              <div className="flex items-center gap-2">
                {lead.converted_at && (
                  <span className="text-[11px] text-emerald-600 font-medium">Converted</span>
                )}
                {lead.created_date && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(lead.created_date), 'MMM d')}
                  </span>
                )}
              </div>
            </div>

            {/* Owner acceptance info bar — shown only when assigned but not accepted */}
            {assignedUser && !isAccepted && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[11px] text-amber-600 font-medium">
                  {assignedUser.full_name || assignedUser.email} — not yet accepted
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}