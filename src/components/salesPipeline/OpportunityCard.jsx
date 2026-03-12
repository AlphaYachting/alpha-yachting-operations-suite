import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STAGE_MAP } from './stageConfig';
import { User, Calendar, AlertCircle, GripVertical } from 'lucide-react';
import { format } from 'date-fns';

export default function OpportunityCard({ opportunity, customer, boat, onClick, dragHandleProps }) {
  const stage = STAGE_MAP[opportunity.stage];
  const isFollowUp = opportunity.follow_up_required;
  const isOverdue = opportunity.next_action_date && new Date(opportunity.next_action_date) < new Date();

  const customerName = customer
    ? (`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.company_name)
    : null;

  return (
    <Card
      className="mb-2 cursor-pointer hover:shadow-md transition-all"
      style={{ borderLeft: `3px solid ${isFollowUp ? '#f97316' : (stage?.color || '#64748b')}` }}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-1.5">
          <div
            {...dragHandleProps}
            className="mt-0.5 text-slate-300 hover:text-slate-500 flex-shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{opportunity.title}</p>
            {customerName && (
              <div className="flex items-center gap-1 mt-1">
                <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 truncate">{customerName}</span>
              </div>
            )}
            {boat && (
              <p className="text-xs text-slate-500 truncate mt-0.5">⛵ {boat.vessel_name}</p>
            )}
            <div className="flex items-center justify-between mt-2">
              {opportunity.expected_value ? (
                <span className="text-sm font-bold text-emerald-700">
                  €{opportunity.expected_value.toLocaleString()}
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
              {opportunity.probability != null && (
                <span className="text-xs text-slate-400">{opportunity.probability}%</span>
              )}
            </div>
            {opportunity.next_action_date && (
              <div className={`flex items-center gap-1 mt-1 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                <span className="text-xs">{format(new Date(opportunity.next_action_date), 'dd.MM.yy')}</span>
              </div>
            )}
            {isFollowUp && (
              <Badge className="mt-1.5 text-xs bg-orange-100 text-orange-700 border-none">
                Follow-up needed
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}