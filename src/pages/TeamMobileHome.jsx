import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, MapPin, AlertCircle, Settings, X, ChevronRight, CheckCircle2, Users, WifiOff, Wifi, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isToday, isTomorrow, startOfDay, formatDistanceToNow } from 'date-fns';
import TeamPreviewMode from '@/components/mobile/TeamPreviewMode';
import MobileHeaderWithWelcome from '@/components/mobile/MobileHeaderWithWelcome';
import SyncStatus from '@/components/mobile/SyncStatus';
import { offlineStorage } from '@/components/offline/offlineStorage';
import { connectionMonitor } from '@/components/offline/connectionMonitor';
import { syncQueue } from '@/components/offline/syncQueue';

export default function TeamMobileHome() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [locations, setLocations] = useState([]);
  const [boats, setBoats] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewUserId, setPreviewUserId] = useState(null);
  const [showPreviewMode, setShowPreviewMode] = useState(false);
  const [previewTechnicianName, setPreviewTechnicianName] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Monitor connection status
    const unsubscribe = connectionMonitor.subscribe((status) => {
      setIsOnline(status.isOnline);
      if (status.isOnline) {
        // Auto sync when connection restored
        syncPendingChanges();
      }
    });

    loadData();
    return unsubscribe;
  }, [previewUserId]);

  const syncPendingChanges = async () => {
    await syncQueue.processQueue();
    await syncQueue.clearCompletedItems();
  };

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      let tasksData, workOrdersData, locationsData, techniciansData, boatsData, jobsData;

      try {
        // Try to load from server - filter work orders by assigned technician
        const technicianId = previewUserId || currentUser?.id;
        [tasksData, workOrdersData, locationsData, techniciansData, boatsData, jobsData] = await Promise.all([
        base44.entities.Task.list(),
        base44.entities.WorkOrder.filter({
          $or: [
          { assigned_technicians: { $in: [technicianId] } },
          { lead_technician_id: technicianId }]

        }),
        base44.entities.Location.list(),
        base44.entities.Technician.list(),
        base44.entities.Boat.list(),
        base44.entities.Job.list()]
        );

        // Cache all data for offline access
        if (workOrdersData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.workOrders, workOrdersData);
        }
        if (tasksData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.tasks, tasksData);
        }
        if (locationsData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.locations, locationsData);
        }
        if (boatsData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.boats, boatsData);
        }
        if (jobsData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.jobs, jobsData);
        }
      } catch (error) {
        // Fall back to offline cache
        workOrdersData = await offlineStorage.getAllData(offlineStorage.STORES.workOrders);
        tasksData = await offlineStorage.getAllData(offlineStorage.STORES.tasks);
        locationsData = await offlineStorage.getAllData(offlineStorage.STORES.locations);
        boatsData = await offlineStorage.getAllData(offlineStorage.STORES.boats);
        jobsData = await offlineStorage.getAllData(offlineStorage.STORES.jobs);
      }

      setWorkOrders(workOrdersData || []);
      setLocations(locationsData || []);
      setBoats(boatsData || []);
      setJobs(jobsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupWorkOrdersBySection = () => {
    const today = startOfDay(new Date());
    const sections = { today: [], upcoming: [], later: [] };

    // Use preview user if in preview mode, otherwise use current user
    const technicianId = previewUserId || user?.id;

    // Get unique work orders assigned to this technician
    const userWorkOrders = workOrders.filter((wo) =>
    wo.assigned_technicians?.includes(technicianId) || wo.lead_technician_id === technicianId
    );

    userWorkOrders.forEach((wo) => {
      const woDate = wo.scheduled_date ? startOfDay(parseISO(wo.scheduled_date)) : null;
      if (!woDate) {
        sections.later.push(wo);
      } else if (woDate.getTime() === today.getTime()) {
        sections.today.push(wo);
      } else if (woDate < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        sections.upcoming.push(wo);
      } else {
        sections.later.push(wo);
      }
    });

    // Sort each section by date and time
    [sections.today, sections.upcoming, sections.later].forEach((section) => {
      section.sort((a, b) => {
        const dateA = a.scheduled_date ? parseISO(a.scheduled_date) : new Date();
        const dateB = b.scheduled_date ? parseISO(b.scheduled_date) : new Date();
        if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
        return (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || '');
      });
    });

    return sections;
  };

  const getWorkOrderInfo = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return null;
    return workOrders.find((w) => w.id === task.work_order_id);
  };

  const getLocationName = (locationId) => {
    if (!locationId) return null;
    const loc = locations.find((l) => l.id === locationId);
    return loc?.name || null;
  };

  const getBoatInfo = (jobId) => {
    if (!jobId) return null;
    const job = jobs.find((j) => j.id === jobId);
    if (!job?.boat_id) return null;
    return boats.find((b) => b.id === job.boat_id);
  };

  const getWorkOrderTasks = (woId) => {
    return tasks.filter((t) => t.work_order_id === woId);
  };

  const sections = groupWorkOrdersBySection();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MobileHeaderWithWelcome
          user={user}
          taskCount={0}
          onSettingsClick={() => {}}
          showSettings={false} />

        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>);

  }

  const WorkOrderCard = ({ workOrder, woTasks }) => {
    const woDate = workOrder.scheduled_date ? parseISO(workOrder.scheduled_date) : null;
    const dayName = woDate ? format(woDate, 'EEE').toUpperCase() : '—';
    const dateString = woDate ? format(woDate, 'd') : '—';
    const monthString = woDate ? format(woDate, 'MMM') : '—';
    const timeString = workOrder.scheduled_start_time || '—';
    const job = jobs.find((j) => j.id === workOrder.job_id);
    const boat = job?.boat_id ? boats.find((b) => b.id === job.boat_id) : null;
    const location = getLocationName(job?.location_id);
    const taskCount = woTasks?.length || 0;
    const statusBadgeColor = workOrder.status === 'Completed' ? 'bg-green-100 text-green-800' :
    workOrder.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
    'bg-slate-100 text-slate-800';

    return (
      <Link to={createPageUrl('TeamWorkOrderDetail') + `?woId=${workOrder.id}`}>
        <div className="bg-white my-3 rounded-lg border border-slate-200 hover:shadow-md transition-all cursor-pointer overflow-hidden">
          {/* Top Section: Colored Box + Title + Status */}
          <div className="flex items-stretch">
            {/* Left: Cyan Gradient Time Box */}
            <div className="bg-[#21b9e8] text-white pt-1 pr-6 pb-3 pl-5 rounded-lg from-blue-400 to-blue-600 flex flex-col items-center justify-center min-w-fit shadow-md flex-shrink-0">
              <p className="text-xs font-bold uppercase tracking-wider">{dayName}</p>
              <p className="text-2xl font-bold leading-tight mt-1">{dateString}</p>
              <p className="text-xs opacity-90 mt-0.5">{monthString}</p>
              {timeString !== '—' && <p className="mt-2 text-sm font-bold">{timeString}</p>}
            </div>

            {/* Center + Right: Title & Status */}
            <div className="flex-1 p-4 flex flex-col justify-between">
              <div>
                <p className="text-base font-bold text-slate-900 leading-tight">{workOrder.title}</p>
                {boat?.vessel_name &&
                <p className="text-sm text-slate-600 mt-1">{boat.vessel_name}</p>
                }
              </div>
            </div>

            {/* Right: Status Badge */}
            <div className="p-4 flex items-start">
              <Badge className={`text-xs whitespace-nowrap ${statusBadgeColor}`}>
                {workOrder.status}
              </Badge>
            </div>
          </div>

          {/* Location Section */}
          {location &&
          <div className="px-4 py-3 border-t border-slate-200">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <p className="text-sm font-medium text-slate-700">{location}</p>
              </div>
            </div>
          }

          {/* Bottom Section: Task Count & Additional Info */}
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            {/* Task Count */}
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium">{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
            </div>

            {/* Additional Info Badges */}
            <div className="flex items-center gap-2">
              {workOrder.internal_notes &&
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  <span>📝</span>
                  <span>Notes</span>
                </div>
              }
            </div>
          </div>
        </div>
      </Link>);

  };



  return (
    <div className="min-h-screen bg-slate-50">
      {/* Improved Header with Welcome Message */}
      <MobileHeaderWithWelcome
        user={user}
        taskCount={sections.today.length}
        onSettingsClick={() => setShowPreviewMode(!showPreviewMode)}
        showSettings={showPreviewMode} />


      {/* Test Mode Badge */}
      {previewUserId &&
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-500 text-white">🧪 TEST MODE</Badge>
            <span className="text-sm font-medium text-orange-900">{previewTechnicianName}</span>
          </div>
          <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setPreviewUserId(null);
            setPreviewTechnicianName(null);
          }}
          className="h-8 w-8 hover:bg-orange-100">

            <X className="h-4 w-4 text-orange-600" />
          </Button>
        </div>
      }

      {/* Preview Mode */}
      {showPreviewMode && user?.role === 'admin' &&
      <TeamPreviewMode
        onUserSelect={(techId, techName) => {
          setPreviewUserId(techId);
          setPreviewTechnicianName(techName);
          setShowPreviewMode(false);
        }}
        currentUserId={previewUserId} />

      }

      {/* Quick Actions */}
      <div className="px-4 pt-4">
        <Link to={createPageUrl('TeamCalendar')}>
          <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg">
            <Calendar className="h-5 w-5 mr-2" />
            Calendar View
          </Button>
        </Link>
      </div>

      {/* Content */}
            <div className="p-4 space-y-6">
              {/* Connection Status */}
              {!isOnline &&
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                  <WifiOff className="h-5 w-5 text-orange-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-orange-900">You're offline. Data is cached.</span>
                </div>
        }
        {/* Today */}
        {sections.today.length > 0 &&
        <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Today</h2>
            <div className="space-y-3">
              {sections.today.map((wo) =>
            <WorkOrderCard key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} />
            )}
            </div>
          </div>
        }

        {/* Upcoming */}
        {sections.upcoming.length > 0 &&
        <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Upcoming (Next 7 days)</h2>
            <div className="space-y-3">
              {sections.upcoming.map((wo) =>
            <WorkOrderCard key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} />
            )}
            </div>
          </div>
        }

        {/* Later */}
        {sections.later.length > 0 &&
        <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Later</h2>
            <div className="space-y-3">
              {sections.later.map((wo) =>
            <WorkOrderCard key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} />
            )}
            </div>
          </div>
        }

        {/* No Work Orders */}
        {workOrders.length === 0 &&
        <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No work orders assigned yet</p>
          </div>
        }
      </div>

      {/* Sync Status Component */}
      <SyncStatus />
    </div>);

}