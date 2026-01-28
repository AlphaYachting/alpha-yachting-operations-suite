import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft, MapPin, Ship, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import PhotoUpload from '@/components/photos/PhotoUpload';
import PhotoGallery from '@/components/photos/PhotoGallery';

export default function TeamWorkOrderDetail() {
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [job, setJob] = useState(null);
  const [location, setLocation] = useState(null);
  const [boat, setBoat] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const loadData = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const woId = params.get('woId');

      if (!woId) {
        navigate(createPageUrl('TeamMobileHome'));
        return;
      }

      const woData = await base44.entities.WorkOrder.filter({ id: woId });
      if (!woData || woData.length === 0) {
        navigate(createPageUrl('TeamMobileHome'));
        return;
      }

      const wo = woData[0];
      setWorkOrder(wo);
      setIsTaskStarted(wo.status === 'In Progress' || wo.status === 'Completed');

      // Load related data
      const [jobData, tasksData, photosData] = await Promise.all([
      base44.entities.Job.filter({ id: wo.job_id }),
      base44.entities.Task.filter({ work_order_id: woId }),
      base44.entities.WorkOrderPhoto.filter({ work_order_id: woId })]
      );

      if (jobData && jobData.length > 0) {
        const j = jobData[0];
        setJob(j);

        // Load location and boat if available
        if (j.location_id) {
          const locData = await base44.entities.Location.filter({ id: j.location_id });
          if (locData && locData.length > 0) {
            setLocation(locData[0]);
          }
        }

        if (j.boat_id) {
          const boatData = await base44.entities.Boat.filter({ id: j.boat_id });
          if (boatData && boatData.length > 0) {
            setBoat(boatData[0]);
          }
        }
      }

      setTasks(tasksData || []);
      setPhotos(photosData || []);
    } catch (error) {
      console.error('Error loading work order detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('TeamMobileHome'))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>);

  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('TeamMobileHome'))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Work order not found</p>
        </div>
      </div>);

  }

  const woDate = workOrder.scheduled_date ? parseISO(workOrder.scheduled_date) : null;
  const dateString = woDate ? format(woDate, 'MMM d, yyyy') : '—';
  const timeString = workOrder.scheduled_start_time || '—';

  const statusBadgeColor = workOrder.status === 'Completed' ? 'bg-green-100 text-green-800' :
  workOrder.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
  workOrder.status === 'Dispatched' ? 'bg-purple-100 text-purple-800' :
  'bg-slate-100 text-slate-800';

  const handleTimerToggle = async () => {
    try {
      if (timerRunning) {
        // Stop timer and save time entry
        setTimerRunning(false);
        const durationMinutes = Math.ceil(elapsedSeconds / 60);
        
        await base44.entities.TimeEntry.create({
          work_order_id: workOrder.id,
          technician_id: user?.id,
          entry_date: new Date().toISOString().split('T')[0],
          duration_minutes: durationMinutes,
          is_billable: true,
          notes: `Time tracked: ${Math.floor(elapsedSeconds / 3600)}h ${Math.floor((elapsedSeconds % 3600) / 60)}m`
        });
        
        setElapsedSeconds(0);
      } else {
        // Start timer
        setTimerRunning(true);
      }
    } catch (error) {
      console.error('Error toggling timer:', error);
      setTimerRunning(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleIndividualTaskStatusToggle = async (taskId, currentStatus) => {
    try {
      setUpdatingTaskId(taskId);
      const newStatus = currentStatus === 'In Progress' ? 'Completed' : 'In Progress';
      await base44.entities.Task.update(taskId, { status: newStatus });
      setTasks(tasks.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (error) {
      console.error('Error updating task status:', error);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('TeamMobileHome'))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold text-slate-600">Work Order Details</span>
        <Button
          onClick={handleTaskStatusToggle}
          className={`text-base font-semibold px-4 py-1.5 rounded-lg text-white ${
          isTaskStarted ?
          'bg-blue-600 hover:bg-blue-700' :
          'bg-green-600 hover:bg-green-700'}`
          }>

          {isTaskStarted ? 'Task Done' : 'Start Task'}
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title & Status Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <h1 className="text-lg font-bold text-slate-900">{workOrder.title}</h1>
              </div>
              <Badge className={`text-xs whitespace-nowrap ${statusBadgeColor}`}>
                {workOrder.status}
              </Badge>
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
              <Clock className="h-4 w-4" />
              <span>{dateString} at {timeString}</span>
            </div>

            {/* Boat */}
            {boat &&
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <Ship className="h-4 w-4" />
                <span>{boat.vessel_name}</span>
              </div>
            }
          </CardContent>
        </Card>

        {/* Location Card */}
        {location &&
        <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-medium">LOCATION</p>
                  <p className="text-sm font-semibold text-slate-900">{location.name}</p>
                  {location.address && <p className="text-xs text-slate-600 mt-1">{location.address}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        }

        {/* Description */}
        {job?.description &&
        <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Description</p>
              <p className="text-sm text-slate-700 leading-relaxed">{job.description}</p>
            </CardContent>
          </Card>
        }

        {/* Safety Notes */}
        {workOrder.safety_notes &&
        <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-orange-900 uppercase mb-1">Safety Notes</p>
                  <p className="text-sm text-orange-900">{workOrder.safety_notes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        }

        {/* Photos Section */}
        <Card>
         <CardContent className="p-4">
           <h2 className="text-sm font-semibold text-slate-900 mb-4">Documentation Photos</h2>
           <div className="mb-4">
             <PhotoUpload 
               workOrderId={workOrder.id} 
               tasks={tasks}
               onSuccess={() => loadData()} 
             />
           </div>
           {photos.length > 0 && (
             <PhotoGallery 
               photos={photos}
               tasks={tasks}
               onPhotoDeleted={() => loadData()}
               onPhotoUpdated={() => loadData()}
             />
           )}
         </CardContent>
        </Card>

        {/* Tasks Section */}
        {tasks.length > 0 &&
        <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Tasks ({tasks.length})</h2>
            <div className="space-y-3">
              {tasks.map((task) => (
              <Card key={task.id}>
              <CardContent className="p-4 relative">
                {/* Task Title & Status */}
                 <div className="mb-4 pr-32">
                   <p className="text-slate-900 text-base font-semibold">{task.title}</p>
                 </div>
                 <div className="absolute top-4 right-4 flex items-center gap-2">
                   <Button
                  onClick={() => handleIndividualTaskStatusToggle(task.id, task.status)}
                  disabled={updatingTaskId === task.id}
                  className={`text-sm font-semibold px-3 py-1.5 rounded text-white ${
                  task.status === 'In Progress' ?
                  'bg-blue-600 hover:bg-blue-700' :
                  task.status === 'Completed' ?
                  'bg-green-600 hover:bg-green-700' :
                  'bg-slate-600 hover:bg-slate-700'}`
                  }>

                        {task.status === 'Completed' ? 'Done' : task.status === 'In Progress' ? 'Finish' : 'Start'}
                     </Button>
                     <div className="flex-shrink-0">
                           {task.status === 'Completed' ?
                      <CheckCircle2 className="h-5 w-5 text-green-600" /> :
                      task.status === 'In Progress' ?
                      <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" /> :
                      <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
                      }
                     </div>
                     </div>

                    {/* Task Description */}
                    {task.description &&
                    <p className="text-xs text-slate-600 leading-relaxed mb-2">{task.description}</p>
                }

                    {/* Task Status Badge */}
                    <Badge variant="outline" className="text-xs">
                      {task.status}
                    </Badge>

                    {/* Task Notes */}
                    {task.notes &&
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                        <p className="font-medium mb-1">Notes:</p>
                        <p>{task.notes}</p>
                      </div>
                }

                    {/* Estimated Time */}
                    {task.estimated_minutes &&
                    <div className="mt-2 text-xs text-slate-600">
                        <span className="font-medium">Estimated:</span> {Math.round(task.estimated_minutes / 60)} min
                      </div>
                }
              </CardContent>
            </Card>
            ))}
            </div>
          </div>
        }

        {/* No Tasks */}
        {tasks.length === 0 &&
        <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No tasks assigned yet</p>
          </div>
        }
      </div>
    </div>);

}