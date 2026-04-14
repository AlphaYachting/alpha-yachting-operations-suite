/**
 * DASHBOARD V2 — THIS WEEK SECTION (isolated)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700',
  Scheduled: 'bg-blue-100 text-blue-700',
  Dispatched: 'bg-indigo-100 text-indigo-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

export default function DashboardV2ThisWeekSection({ workOrders, getJobInfo }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        {workOrders.length === 0 ? (
          <p className="text-sm text-slate-500">No work orders scheduled this week</p>
        ) : (
          <div className="space-y-2">
            {workOrders.slice(0, 5).map(wo => {
              const jobInfo = getJobInfo(wo.job_id);
              return (
                <Link
                  key={wo.id}
                  to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                  className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{wo.title}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {jobInfo?.boat} • {jobInfo?.location}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(parseISO(wo.scheduled_date), 'EEE, MMM d')}
                      </p>
                    </div>
                    <Badge className={statusColors[wo.status] || 'bg-slate-100 text-slate-700'}>
                      {wo.status}
                    </Badge>
                  </div>
                </Link>
              );
            })}
            {workOrders.length > 5 && (
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to={createPageUrl('WorkOrders')}>View All ({workOrders.length})</Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}