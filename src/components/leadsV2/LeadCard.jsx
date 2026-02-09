import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Anchor, MapPin, Calendar, Edit, Trash2, Eye, Ship } from 'lucide-react';
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

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
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
            </div>

            {/* Description */}
            {lead.description && (
              <p className="text-sm text-slate-600 line-clamp-1">{lead.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="h-8 w-8 p-0"
            >
              <Link to={createPageUrl('LeadDetail') + `?id=${lead.id}&from=v2`}>
                <Eye className="h-4 w-4 text-slate-600" />
              </Link>
            </Button>
            {lead.status === 'Pending' && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                onClick={() => onStatusChange(lead.id, 'Converted')}
              >
                Convert
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(lead)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4 text-slate-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(lead.id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}