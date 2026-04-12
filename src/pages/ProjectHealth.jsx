import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Activity, Ship, MapPin, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';

const today = new Date();

const getProjectHealth = (job, workOrders) => {
  const jobWorkOrders = workOrders.filter(wo => wo.job_id === job.id);
  const activeWOs = jobWorkOrders.filter(wo => !['Completed', 'Cancelled'].includes(wo.status));

  const hasOverdueWO = activeWOs.some(wo => {
    if (!wo.scheduled_date) return false;
    const schedDate = parseISO(wo.scheduled_date);
    return isPast(schedDate) && !isToday(schedDate);
  });

  if (hasOverdueWO || activeWOs.length === 0) {
    return { status: 'red', label: 'Critical', step: hasOverdueWO ? 'Overdue work order' : 'No active work orders' };
  }

  const hasUnplannedWO = activeWOs.some(wo => !wo.scheduled_date || !wo.assigned_technicians || wo.assigned_technicians.length === 0);
  if (hasUnplannedWO) {
    return { status: 'red', label: 'Critical', step: 'Missing planning' };
  }

  const hasDueSoonWO = activeWOs.some(wo => {
    if (!wo.scheduled_date) return false;
    const daysAway = differenceInDays(parseISO(wo.scheduled_date), today);
    return daysAway > 0 && daysAway <= 7;
  });

  if (hasDueSoonWO) {
    return { status: 'yellow', label: 'Attention', step: 'Work order due soon' };
  }

  return { status: 'green', label: 'Healthy', step: 'On track' };
};

const getProjectProgress = (job, workOrders) => {
  const jobWorkOrders = workOrders.filter(wo => wo.job_id === job.id);
  if (jobWorkOrders.length === 0) return 0;
  const completed = jobWorkOrders.filter(wo => wo.status === 'Completed').length;
  return Math.round((completed / jobWorkOrders.length) * 100);
};

export default function ProjectHealth() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [jobsData, woData, boatsData, locData] = await Promise.all([
          base44.entities.Job.list('-created_date', 200),
          base44.entities.WorkOrder.list('-scheduled_date', 500),
          base44.entities.Boat.list('-created_date', 200),
          base44.entities.Location.list(),
        ]);
        setJobs(jobsData);
        setWorkOrders(woData);
        setBoats(boatsData);
        setLocations(locData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeJobs = jobs.filter(j => !['Completed', 'Invoiced', 'Cancelled'].includes(j.status));

  const redJobs = activeJobs.filter(j => getProjectHealth(j, workOrders).status === 'red');
  const yellowJobs = activeJobs.filter(j => getProjectHealth(j, workOrders).status === 'yellow');
  const greenJobs = activeJobs.filter(j => getProjectHealth(j, workOrders).status === 'green');

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const renderJob = (job) => {
    const health = getProjectHealth(job, workOrders);
    const progress = getProjectProgress(job, workOrders);
    const boat = boats.find(b => b.id === job.boat_id);
    const location = locations.find(l => l.id === job.location_id);

    return (
      <Link
        key={job.id}
        to={createPageUrl('JobDetail') + `?id=${job.id}`}
        className="block p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`h-3 w-3 rounded-full flex-shrink-0 ${
                health.status === 'red' ? 'bg-red-500' :
                health.status === 'yellow' ? 'bg-yellow-500' :
                'bg-green-500'
              }`} />
              <p className="font-medium text-slate-900">{job.title}</p>
              <Badge variant="outline" className={
                health.status === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
                health.status === 'yellow' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-green-50 text-green-700 border-green-200'
              }>
                {health.label}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <Ship className="h-3.5 w-3.5" />
                {boat?.vessel_name || 'Unknown'}
              </div>
              {location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {location.name}
                </div>
              )}
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Progress: {progress}%</span>
                <span className="text-slate-500 italic">{health.step}</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${
                    health.status === 'red' ? 'bg-red-500' :
                    health.status === 'yellow' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Project Health</h1>
        <p className="text-slate-500 mt-1">{activeJobs.length} active projects</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{redJobs.length}</p>
            <p className="text-sm text-red-700 mt-1">Critical</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{yellowJobs.length}</p>
            <p className="text-sm text-yellow-700 mt-1">Attention</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{greenJobs.length}</p>
            <p className="text-sm text-green-700 mt-1">Healthy</p>
          </CardContent>
        </Card>
      </div>

      {activeJobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">No active projects</CardContent>
        </Card>
      ) : (
        <>
          {redJobs.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-800">
                  <Activity className="h-5 w-5" />
                  Critical ({redJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">{redJobs.map(renderJob)}</CardContent>
            </Card>
          )}

          {yellowJobs.length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800">
                  <Activity className="h-5 w-5" />
                  Attention ({yellowJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">{yellowJobs.map(renderJob)}</CardContent>
            </Card>
          )}

          {greenJobs.length > 0 && (
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Activity className="h-5 w-5" />
                  Healthy ({greenJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">{greenJobs.map(renderJob)}</CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}