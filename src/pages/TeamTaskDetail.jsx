import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, MapPin, Clock, Navigation, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import TimeBooking from '@/components/mobile/TimeBooking';

export default function TeamTaskDetail() {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');

  const [task, setTask] = useState(null);
  const [workOrder, setWorkOrder] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [taskId]);

  const loadData = async () => {
    try {
      const [tasksData, workOrdersData, locationsData] = await Promise.all([
        base44.entities.Task.list(),
        base44.entities.WorkOrder.list(),
        base44.entities.Location.list()
      ]);

      const currentTask = tasksData.find(t => t.id === taskId);
      if (currentTask) {
        setTask(currentTask);
        const wo = workOrdersData.find(w => w.id === currentTask.work_order_id);
        setWorkOrder(wo);
        if (wo?.location_id) {
          const loc = locationsData.find(l => l.id === wo.location_id);
          setLocation(loc);
        }
      }
    } catch (error) {
      console.error('Error loading task detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!task) return;
    try {
      await base44.entities.Task.update(task.id, { status: newStatus });
      setTask({ ...task, status: newStatus });
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleNavigate = () => {
    if (!location) return;
    const { latitude, longitude } = location;
    if (latitude && longitude) {
      const mapsUrl = `https://maps.apple.com/?q=${latitude},${longitude}`;
      window.open(mapsUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!task || !workOrder) {
    return (
      <div className="p-4 text-center">
        <p className="text-slate-500">Task not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9">
            <Link to={createPageUrl('TeamMobileHome')}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-lg font-bold text-slate-900">Task Details</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status & Title */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
                <p className="text-xs text-slate-500 mt-1">WO: {workOrder.work_order_number}</p>
              </div>
              <Badge className={`text-xs flex-shrink-0 ${
                task.status === 'Completed' ? 'bg-green-100 text-green-700' :
                task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {task.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Date & Location */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {workOrder.scheduled_date && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Scheduled</p>
                  <p className="text-sm font-medium text-slate-900">
                    {format(parseISO(workOrder.scheduled_date), 'MMMM d, yyyy')}
                    {workOrder.scheduled_start_time && ` at ${workOrder.scheduled_start_time}`}
                  </p>
                </div>
              </div>
            )}
            {location && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-900">{location.name}</p>
                  </div>
                </div>
                {location.latitude && location.longitude && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNavigate}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Navigation className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        {task.description && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-2">Description</p>
              <p className="text-sm text-slate-700">{task.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Time Booking */}
        <TimeBooking taskId={task.id} />

        {/* Action Buttons */}
        <div className="flex gap-3 sticky bottom-4">
          {task.status !== 'In Progress' && (
            <Button
              onClick={() => handleStatusChange('In Progress')}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Start
            </Button>
          )}
          {task.status !== 'Completed' && (
            <Button
              onClick={() => handleStatusChange('Completed')}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Done
            </Button>
          )}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}