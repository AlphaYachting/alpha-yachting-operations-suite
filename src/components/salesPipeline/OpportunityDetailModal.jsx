import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { STAGE_MAP } from './stageConfig';
import ActivityPanel from './ActivityPanel';
import { User, Ship, Calendar, DollarSign, Target, Tag } from 'lucide-react';
import { format } from 'date-fns';

export default function OpportunityDetailModal({ opportunity, customer, boat, onClose, onEdit }) {
  if (!opportunity) return null;

  const stage = STAGE_MAP[opportunity.stage];
  const customerName = customer
    ? (`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.company_name)
    : null;

  return (
    <Dialog open={!!opportunity} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{opportunity.title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {/* Left: Details */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge style={{ backgroundColor: stage?.color + '22', color: stage?.color, borderColor: stage?.color + '44' }} className="border">
                {opportunity.stage}
              </Badge>
              {opportunity.source && (
                <Badge variant="outline" className="text-xs">{opportunity.source}</Badge>
              )}
              {opportunity.follow_up_required && (
                <Badge className="bg-orange-100 text-orange-700 border-none text-xs">Follow-up needed</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {customerName && (
                <div>
                  <p className="text-slate-500 flex items-center gap-1"><User className="h-3 w-3" /> Customer</p>
                  <p className="font-medium mt-0.5">{customerName}</p>
                </div>
              )}
              {boat && (
                <div>
                  <p className="text-slate-500 flex items-center gap-1"><Ship className="h-3 w-3" /> Boat</p>
                  <p className="font-medium mt-0.5">{boat.vessel_name}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Expected Value</p>
                <p className="font-bold text-emerald-700 mt-0.5">
                  {opportunity.expected_value ? `€${opportunity.expected_value.toLocaleString()}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 flex items-center gap-1"><Target className="h-3 w-3" /> Probability</p>
                <p className="font-medium mt-0.5">{opportunity.probability ?? '—'}%</p>
              </div>
              {opportunity.next_action_date && (
                <div>
                  <p className="text-slate-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> Next Action</p>
                  <p className="font-medium mt-0.5">{format(new Date(opportunity.next_action_date), 'dd.MM.yyyy')}</p>
                </div>
              )}
              {opportunity.expected_close_date && (
                <div>
                  <p className="text-slate-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> Close By</p>
                  <p className="font-medium mt-0.5">{format(new Date(opportunity.expected_close_date), 'dd.MM.yyyy')}</p>
                </div>
              )}
            </div>

            {opportunity.notes && (
              <div>
                <p className="text-slate-500 text-sm mb-1">Notes</p>
                <p className="text-sm bg-slate-50 border rounded-md p-2 text-slate-700">{opportunity.notes}</p>
              </div>
            )}

            {opportunity.lost_reason && (
              <div>
                <p className="text-slate-500 text-sm mb-1">Lost Reason</p>
                <p className="text-sm bg-red-50 border border-red-100 rounded-md p-2 text-red-700">{opportunity.lost_reason}</p>
              </div>
            )}

            <Button size="sm" variant="outline" onClick={onEdit}>Edit Opportunity</Button>
          </div>

          {/* Right: Activity Panel */}
          <div>
            <Separator className="md:hidden mb-4" />
            <ActivityPanel opportunityId={opportunity.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}