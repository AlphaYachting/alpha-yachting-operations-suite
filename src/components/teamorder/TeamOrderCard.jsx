import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Users, Euro, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function TeamOrderCard({ teamOrder, workOrder, onEdit, onGenerateBrief }) {
  const statusConfig = {
    'Draft': { color: 'bg-slate-100 text-slate-700', icon: Clock },
    'Sent': { color: 'bg-blue-100 text-blue-700', icon: Clock },
    'Accepted': { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    'In Progress': { color: 'bg-cyan-100 text-cyan-700', icon: Clock },
    'Completed': { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    'Closed': { color: 'bg-slate-100 text-slate-700', icon: CheckCircle2 },
    'Cancelled': { color: 'bg-red-100 text-red-700', icon: XCircle }
  };

  const config = statusConfig[teamOrder.status] || statusConfig['Draft'];
  const StatusIcon = config.icon;

  const costPolicies = [];
  if (teamOrder.accommodation_paid) costPolicies.push('Accommodation');
  if (teamOrder.meals_per_diem_paid) costPolicies.push('Per Diem');
  if (teamOrder.mileage_paid) costPolicies.push('Mileage');
  if (teamOrder.travel_time_paid) costPolicies.push('Travel Time');

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Team Order</CardTitle>
              <p className="text-sm text-slate-600">External Partner Assignment</p>
            </div>
          </div>
          <Badge className={config.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {teamOrder.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-600">Partner</p>
            <p className="font-semibold">
              {teamOrder.partner_name || 'Not assigned'}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Approved Budget</p>
            <p className="font-semibold text-green-600">
              €{(teamOrder.approved_budget_total || 0).toFixed(2)}
            </p>
          </div>
        </div>

        {costPolicies.length > 0 && (
          <div>
            <p className="text-sm text-slate-600 mb-2">Cost Coverage</p>
            <div className="flex flex-wrap gap-2">
              {costPolicies.map(policy => (
                <Badge key={policy} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {policy}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={onEdit} variant="outline" size="sm" className="flex-1">
            Edit Team Order
          </Button>
          <Button onClick={onGenerateBrief} size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700">
            <FileText className="h-4 w-4 mr-2" />
            Partner Brief
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}