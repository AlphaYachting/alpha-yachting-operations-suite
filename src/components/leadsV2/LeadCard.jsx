import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Anchor, MapPin, Calendar, Edit, Trash2, Eye, Ship, User, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import LeadStatusChange from './LeadStatusChange';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const statusColors = {
  'Pending': 'bg-amber-100 text-amber-700',
  'Contacted': 'bg-blue-100 text-blue-700',
  'Converted': 'bg-emerald-100 text-emerald-700',
  'Rejected': 'bg-red-100 text-red-700',
  'Lost': 'bg-slate-100 text-slate-700'
};

const priorityColors = {
  'Low': 'bg-slate-100 text-slate-700',
  'Medium': 'bg-blue-100 text-blue-700',
  'High': 'bg-amber-100 text-amber-700',
  'Urgent': 'bg-red-100 text-red-700'
};

// Generate a consistent color from a string
const USER_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#ef4444', '#f97316', '#6366f1'
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

const inquiryTypeColors = {
  'Service Inquiry': 'bg-blue-100 text-blue-700 border-blue-200',
  'Parts Request': 'bg-purple-100 text-purple-700 border-purple-200',
  'Maintenance': 'bg-teal-100 text-teal-700 border-teal-200',
  'Emergency': 'bg-red-100 text-red-700 border-red-200',
  'Other': 'bg-slate-100 text-slate-700 border-slate-200'
};

export default function LeadCard({
  lead,
  customer,
  agingLevel,
  assignedUser,
  onEdit,
  onDelete,
  onStatusChange,
  onViewDetail,
}) {
  const iconBgColor = {
    'Pending': 'bg-amber-50',
    'Contacted': 'bg-blue-50',
    'Converted': 'bg-emerald-50',
    'Rejected': 'bg-red-50',
    'Lost': 'bg-slate-50'
  }[lead.status] || 'bg-slate-50';

  const iconColor = {
    'Pending': 'text-amber-600',
    'Contacted': 'text-blue-600',
    'Converted': 'text-emerald-600',
    'Rejected': 'text-red-600',
    'Lost': 'text-slate-400'
  }[lead.status] || 'text-slate-400';

  // Aging border classes
  const agingBorderClass =
    agingLevel === 'danger' ? 'border-red-300 border-2' : 
    agingLevel === 'warn' ? 'border-yellow-300 border-2' : '';

  return (
    <Card className={`shadow-sm hover:shadow-md transition-shadow ${agingBorderClass}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className={`${iconBgColor} rounded-lg p-3 flex-shrink-0`}>
            <Phone className={`h-5 w-5 ${iconColor}`} />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Name + Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="text-base font-semibold text-slate-900">{lead.name}</h3>
              <Badge className={statusColors[lead.status]}>
                {lead.status}
              </Badge>
              {lead.priority && (
                <Badge className={priorityColors[lead.priority]}>
                  {lead.priority}
                </Badge>
              )}
              {lead.inquiry_type && (
                <Badge variant="outline" className={`border ${inquiryTypeColors[lead.inquiry_type] || inquiryTypeColors['Other']}`}>
                  {lead.inquiry_type}
                </Badge>
              )}
            </div>

            {/* Contact Line with bullet separators */}
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2 flex-wrap">
              {lead.phone && <span>{lead.phone}</span>}
              {lead.email && (
                <>
                  {lead.phone && <span>•</span>}
                  <span className="truncate">{lead.email}</span>
                </>
              )}
              {lead.boat_name && (
                <>
                  {(lead.phone || lead.email) && <span>•</span>}
                  <span className="flex items-center gap-1">
                    <Ship className="h-3 w-3" />
                    {lead.boat_name}
                  </span>
                </>
              )}
              {lead.location && (
                <>
                  {(lead.phone || lead.email || lead.boat_name) && <span>•</span>}
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {lead.location}
                  </span>
                </>
              )}
              {lead.created_date && (
                <>
                  {(lead.phone || lead.email || lead.boat_name || lead.location) && <span>•</span>}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(lead.created_date), 'MMM dd')}
                  </span>
                </>
              )}
            </div>

            {/* Description with Tooltip */}
            {lead.description && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm text-slate-600 line-clamp-1 cursor-help">{lead.description}</p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm text-xs whitespace-pre-wrap p-3">
                    {lead.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Assigned User + Accepted Status */}
            {assignedUser && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                  lead.accepted_by_assignee
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {lead.accepted_by_assignee
                    ? <CheckCircle2 className="h-3 w-3" />
                    : <User className="h-3 w-3" />
                  }
                  <span>{assignedUser.full_name || assignedUser.email}</span>
                  {lead.accepted_by_assignee && <span className="font-medium">· Übernommen</span>}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <LeadStatusChange
              lead={lead}
              onStatusChange={onStatusChange}
            />
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-7 w-7 p-0"
            >
              <Link to={createPageUrl('LeadDetail') + `?id=${lead.id}&from=v2`}>
                <Eye className="h-3 w-3" />
              </Link>
            </Button>
            {lead.status === 'Pending' && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2 text-xs"
                onClick={() => onStatusChange(lead.id, 'Converted')}
              >
                Convert
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(lead)}
              className="h-7 w-7 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(lead.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}