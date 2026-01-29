import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft, MapPin, Ship, Clock, AlertCircle, CheckCircle2, WifiOff, Send, Trash2, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import PhotoUpload from '@/components/photos/PhotoUpload';
import PhotoGallery from '@/components/photos/PhotoGallery';
import { offlineStorage } from '@/components/offline/offlineStorage';
import { connectionMonitor } from '@/components/offline/connectionMonitor';
import { syncQueue } from '@/components/offline/syncQueue';

// Get IP address info
const getClientInfo = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return {
      ip_address: data.ip,
      device_info: `${navigator.userAgent.substring(0, 200)}`
    };
  } catch (error) {
    return {
      ip_address: null,
      device_info: navigator.userAgent.substring(0, 200)
    };
  }
};

export default function TeamWorkOrderDetail({ woId, onNavigate }) {
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [accessLogId, setAccessLogId] = useState(null);

  useEffect(() => {
    logAccessStart();
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

    // Monitor connection status
    const unsubscribe = connectionMonitor.subscribe((status) => {
      setIsOnline(status.isOnline);
    });

    // Restore timer state from localStorage
    const params = new URLSearchParams(window.location.search);
    const woId = params.get('woId');
    if (woId) {
      const savedTimerState = localStorage.getItem(`timer_${woId}`);
      if (savedTimerState) {
        try {
          const { timerRunning: savedRunning, elapsedSeconds: savedElapsed } = JSON.parse(savedTimerState);
          setTimerRunning(savedRunning);
          setElapsedSeconds(savedElapsed);
        } catch (e) {
          console.error('Error restoring timer state:', e);
        }
      }
    }

    return () => {
      // Log access close on unmount
      logAccessClose();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          const newSeconds = prev + 1;
          // Save timer state to localStorage
          const params = new URLSearchParams(window.location.search);
          const woId = params.get('woId');
          if (woId) {
            localStorage.setItem(`timer_${woId}`, JSON.stringify({
              timerRunning: true,
              elapsedSeconds: newSeconds
            }));
          }
          return newSeconds;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const logAccessStart = async () => {
    try {
      if (!user?.id) return; // Validate user is authenticated
      
      const params = new URLSearchParams(window.location.search);
      const woId = params.get('woId');
      
      if (!woId) return;

      // Get client info silently (don't block UI)
      const clientInfo = await getClientInfo();
      
      // Create access log entry
      const logEntry = {
        work_order_id: woId,
        technician_id: user.id,
        technician_email: user.email,
        accessed_at: new Date().toISOString(),
        ip_address: clientInfo.ip_address,
        device_info: clientInfo.device_info
      };

      if (isOnline) {
        try {
          const savedLog = await base44.entities.WorkOrderAccessLog.create(logEntry);
          setAccessLogId(savedLog.id);
          // Store backup ID in sessionStorage for recovery
          sessionStorage.setItem(`accessLog_${woId}`, savedLog.id);
        } catch (error) {
          console.error('Error logging access:', error);
          // Fallback: store in local state for potential retry
        }
      } else {
        // Offline: queue for sync
        await offlineStorage.save(offlineStorage.STORES.workOrderAccessLogs, logEntry);
      }
    } catch (error) {
      console.error('Error in logAccessStart:', error);
    }
  };

  const logAccessClose = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const woId = params.get('woId');
      
      if (!woId) return;

      // Use stored ID or try sessionStorage recovery
      let logId = accessLogId || sessionStorage.getItem(`accessLog_${woId}`);
      
      if (!logId) return;

      const now = new Date();

      // Get the original access log to calculate duration
      const logs = await base44.entities.WorkOrderAccessLog.filter({ id: logId });
      if (logs.length > 0) {
        const logEntry = logs[0];
        const duration = Math.round((now - new Date(logEntry.accessed_at)) / 1000);
        
        await base44.entities.WorkOrderAccessLog.update(logId, {
          closed_at: now.toISOString(),
          duration_seconds: duration
        });
      }
      
      // Cleanup sessionStorage
      sessionStorage.removeItem(`accessLog_${woId}`);
    } catch (error) {
      console.error('Error logging access close:', error);
      // Non-blocking: don't prevent page exit
    }
  };

  const loadData = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const paramWoId = params.get('woId');
      const effectiveWoId = woId || paramWoId;

      if (!effectiveWoId) {
        if (onNavigate) {
          onNavigate('home');
        } else {
          navigate(createPageUrl('TeamMobileHome'));
        }
        return;
      }

      let woData, jobData, tasksData, photosData;

      try {
        // Try to load from server
        [woData, jobData, tasksData, photosData] = await Promise.all([
          base44.entities.WorkOrder.filter({ id: effectiveWoId }),
          base44.entities.Job.filter({ id: await offlineStorage.getData(offlineStorage.STORES.workOrders, effectiveWoId).then(wo => wo?.job_id) }),
          base44.entities.Task.filter({ work_order_id: effectiveWoId }),
          base44.entities.WorkOrderPhoto.filter({ work_order_id: effectiveWoId })
        ]);

        // Cache data for offline access
        if (woData && woData.length > 0) {
          await offlineStorage.saveData(offlineStorage.STORES.workOrders, woData[0]);
        }
        if (jobData && jobData.length > 0) {
          await offlineStorage.saveData(offlineStorage.STORES.jobs, jobData[0]);
        }
        if (tasksData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.tasks, tasksData);
        }
        if (photosData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.photos, photosData);
        }
      } catch (error) {
        // Fall back to offline data
        const cachedWo = await offlineStorage.getData(offlineStorage.STORES.workOrders, effectiveWoId);
        if (!cachedWo) {
          if (onNavigate) {
            onNavigate('home');
          } else {
            navigate(createPageUrl('TeamMobileHome'));
          }
          return;
        }
        woData = [cachedWo];
        jobData = [await offlineStorage.getData(offlineStorage.STORES.jobs, cachedWo.job_id)];
        tasksData = await offlineStorage.getByIndex(offlineStorage.STORES.tasks, 'work_order_id', effectiveWoId) || [];
        photosData = await offlineStorage.getByIndex(offlineStorage.STORES.photos, 'work_order_id', effectiveWoId) || [];
      }

      if (!woData || woData.length === 0) {
        if (onNavigate) {
          onNavigate('home');
        } else {
          navigate(createPageUrl('TeamMobileHome'));
        }
        return;
      }

      const wo = woData[0];
      setWorkOrder(wo);

      if (jobData && jobData.length > 0) {
        const j = jobData[0];
        setJob(j);

        if (j?.location_id) {
          const cachedLoc = await offlineStorage.getData(offlineStorage.STORES.locations, j.location_id);
          if (cachedLoc) {
            setLocation(cachedLoc);
          }
        }

        if (j?.boat_id) {
          const cachedBoat = await offlineStorage.getData(offlineStorage.STORES.boats, j.boat_id);
          if (cachedBoat) {
            setBoat(cachedBoat);
          }
        }
      }

      setTasks(tasksData || []);
      setPhotos(photosData || []);

      // Load comments
      let commentsData = [];
      try {
        commentsData = await base44.entities.WorkOrderComment.filter({ work_order_id: effectiveWoId });
        await offlineStorage.saveMultiple(offlineStorage.STORES.comments, commentsData);
      } catch (error) {
        commentsData = await offlineStorage.getByIndex(offlineStorage.STORES.comments, 'work_order_id', effectiveWoId) || [];
      }
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading work order detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('home');
    } else {
      navigate(createPageUrl('TeamMobileHome'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
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
          <Button variant="ghost" size="icon" onClick={handleBack}>
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
        const timeEntryData = {
          work_order_id: workOrder.id,
          technician_id: user?.id,
          entry_date: new Date().toISOString().split('T')[0],
          duration_minutes: durationMinutes,
          is_billable: true,
          notes: `Time tracked: ${Math.floor(elapsedSeconds / 3600)}h ${Math.floor((elapsedSeconds % 3600) / 60)}m`
        };

        if (isOnline) {
          const result = await base44.entities.TimeEntry.create(timeEntryData);
          await offlineStorage.saveData(offlineStorage.STORES.timeEntries, result);
        } else {
          // Queue for offline sync
          await syncQueue.addToQueue('TimeEntry', 'create', timeEntryData, `temp_${Date.now()}`);
          setPendingChanges(prev => [...prev, { entity: 'TimeEntry', id: `temp_${Date.now()}` }]);
        }

        setElapsedSeconds(0);
        localStorage.removeItem(`timer_${workOrder.id}`);
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

  const openMapsRoute = () => {
    if (!location?.latitude || !location?.longitude) return;
    const lat = location.latitude;
    const lng = location.longitude;
    const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(mapUrl, '_blank');
  };

  const handleIndividualTaskStatusToggle = async (taskId, currentStatus) => {
    try {
      setUpdatingTaskId(taskId);
      const newStatus = currentStatus === 'In Progress' ? 'Completed' : 'In Progress';
      const updatedTask = { ...tasks.find(t => t.id === taskId), status: newStatus };

      if (isOnline) {
        await base44.entities.Task.update(taskId, { status: newStatus });
      } else {
        // Queue for offline sync
        await syncQueue.addToQueue('Task', 'update', { status: newStatus }, taskId);
        setPendingChanges(prev => [...prev, { entity: 'Task', id: taskId }]);
      }

      setTasks(tasks.map((t) => t.id === taskId ? updatedTask : t));
      await offlineStorage.saveData(offlineStorage.STORES.tasks, updatedTask);
    } catch (error) {
      console.error('Error updating task status:', error);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    try {
      const tempId = `temp_${Date.now()}`;
      const newComment = {
        id: tempId,
        work_order_id: workOrder.id,
        author_name: user?.full_name || 'Unknown',
        author_email: user?.email || '',
        content: commentText,
        comment_type: 'worker_note',
        created_date: new Date().toISOString()
      };

      // Always save to offline storage first
      await offlineStorage.saveData(offlineStorage.STORES.comments, newComment);
      setComments([...comments, newComment]);
      setCommentText('');

      // Try to sync if online
      if (isOnline) {
        try {
          const savedComment = await base44.entities.WorkOrderComment.create(newComment);
          // Update with server response (which includes server-generated ID)
          await offlineStorage.saveData(offlineStorage.STORES.comments, savedComment);
          setComments(prev => prev.map(c => c.id === tempId ? savedComment : c));
        } catch (syncError) {
          console.error('Error syncing comment to server:', syncError);
          // Queue for later sync
          await syncQueue.addToQueue('WorkOrderComment', 'create', newComment, tempId);
          setPendingChanges(prev => [...prev, { entity: 'WorkOrderComment', id: tempId }]);
        }
      } else {
        // Queue for offline sync
        await syncQueue.addToQueue('WorkOrderComment', 'create', newComment, tempId);
        setPendingChanges(prev => [...prev, { entity: 'WorkOrderComment', id: tempId }]);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      setUpdatingTaskId(taskId);

      if (isOnline) {
        await base44.entities.Task.delete(taskId);
      } else {
        // Queue for offline sync
        await syncQueue.addToQueue('Task', 'delete', {}, taskId);
        setPendingChanges(prev => [...prev, { entity: 'Task', id: taskId }]);
      }

      setTasks(tasks.filter(t => t.id !== taskId));
      await offlineStorage.deleteData(offlineStorage.STORES.tasks, taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">Work Order Details</span>
          {!isOnline && <WifiOff className="h-4 w-4 text-orange-600" />}
          {pendingChanges.length > 0 && <Badge className="bg-orange-100 text-orange-800 text-xs">{pendingChanges.length} pending</Badge>}
        </div>
        <Button
          onClick={handleTimerToggle}
          className={`text-base font-semibold px-4 py-1.5 rounded-lg text-white ${
          timerRunning ?
          'bg-red-600 hover:bg-red-700' :
          'bg-green-600 hover:bg-green-700'}`
          }>

          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span>{timerRunning ? 'Stop Timer' : 'Start Timer'}</span>
            {timerRunning && <span className="font-mono text-sm">{formatTime(elapsedSeconds)}</span>}
          </div>
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
            <CardContent className="p-0">
              <button
                onClick={openMapsRoute}
                disabled={!location.latitude || !location.longitude}
                className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50 disabled:bg-slate-50 disabled:cursor-not-allowed transition-colors"
              >
                <MapPin className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-medium">LOCATION</p>
                  <p className="text-sm font-semibold text-slate-900">{location.name}</p>
                  {location.address && <p className="text-xs text-slate-600 mt-1">{location.address}</p>}
                </div>
                {location.latitude && location.longitude && (
                  <span className="text-xs text-blue-600 font-medium whitespace-nowrap">Open Maps →</span>
                )}
              </button>
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

        {/* Comments Section */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Work Notes</h2>

            {/* Comment Input */}
            <div className="space-y-2 mb-4">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Leave a note about this work order..."
                rows={3}
                className="text-sm"
              />
              <Button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </div>

            {/* Comments List */}
            {comments.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-sm text-slate-900">{comment.author_name}</p>
                      <span className="text-xs text-slate-500">{comment.created_date ? format(parseISO(comment.created_date), 'MMM d, HH:mm') : 'Just now'}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}

            {comments.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No notes yet</p>
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
                   {user?.role === 'admin' && (
                     <Button
                       onClick={() => handleDeleteTask(task.id)}
                       disabled={updatingTaskId === task.id}
                       variant="ghost"
                       size="icon"
                       className="text-red-600 hover:text-red-700 hover:bg-red-50"
                       title="Delete task"
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                   )}
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