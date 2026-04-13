# ROLLBACK SNAPSHOT - components/leadsV2/LeadCard.jsx BEFORE

Date: 2026-02-09
Purpose: Style-only changes to match new design screenshot

```jsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Anchor, MapPin, Calendar, Edit, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import LeadStatusChange from './LeadStatusChange';

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
  onEdit,
  onDelete,
  onStatusChange,
  onViewDetail,
}) {
  const agingBorderClass =
    agingLevel === 'danger' ? 'border-red-300 border-2' : agingLevel === 'warn' ? 'border-yellow-300 border-2' : '';

  return (
    <Card className={`hover:border-slate-300 transition-colors ${agingBorderClass}`}>
      <CardContent className="p-2.5 px-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Name + Priority + Inquiry */}
            <div className="flex items-center gap-2">
              <h3 className="text-slate-900 text-base font-semibold truncate">{lead.name}</h3>
              {lead.inquiry_type && (
                <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 border ${inquiryTypeColors[lead.inquiry_type] || inquiryTypeColors['Other']}`}>
                  {lead.inquiry_type}
                </Badge>
              )}
              {lead.priority && (
                <Badge className={`${priorityColors[lead.priority]} text-xs px-1.5 py-0 h-5`}>
                  {lead.priority}
                </Badge>
              )}
            </div>

            {/* Contact info + Boat + Location + Created Date */}
            <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
              {lead.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  <span>{lead.phone}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-1 min-w-0">
                  <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
              {lead.boat_name && (
                <div className="flex items-center gap-1">
                  <Anchor className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  <span>{lead.boat_name}</span>
                </div>
              )}
              {lead.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  <span>{lead.location}</span>
                </div>
              )}
              {lead.created_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  <span>{format(new Date(lead.created_date), 'MMM dd')}</span>
                </div>
              )}
            </div>

            {/* Description preview */}
            {lead.description && (
              <div className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                <span className="text-sm line-clamp-2">{lead.description}</span>
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
``