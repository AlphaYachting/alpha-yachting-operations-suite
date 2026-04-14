/**
 * DASHBOARD V2 — TODAY SECTION (isolated)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700',
  Scheduled: 'bg-blue-100 text-blue-700',
  Dispatched: 'bg-indigo-100 text-indigo-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

export default function DashboardV2TodaySection({ workOrders, getJobInfo }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        {workOrders.length === 0 ? (
          <p className="text-sm text-slate-500">No work orders scheduled for today</p>
        ) : (
          <div className="space-y-2">
            {workOrders.map(wo => {
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
                      {wo.scheduled_start_time && (
                        <p className="text-xs text-slate-500 mt-1">{wo.scheduled_start_time}</p>
                      )}
                    </div>
                    <Badge className={statusColors[wo.status] || 'bg-slate-100 text-slate-700'}>
                      {wo.status}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}