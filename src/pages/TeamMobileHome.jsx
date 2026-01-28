import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, MapPin, AlertCircle, Settings, X, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isToday, isTomorrow, startOfDay, formatDistanceToNow } from 'date-fns';
import TeamPreviewMode from '@/components/mobile/TeamPreviewMode';
import MobileHeaderWithWelcome from '@/components/mobile/MobileHeaderWithWelcome';

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

  useEffect(() => {
    loadData();
  }, [previewUserId]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [tasksData, workOrdersData, locationsData, techniciansData, boatsData, jobsData] = await Promise.all([
        base44.entities.Task.list(),
        base44.entities.WorkOrder.list(),
        base44.entities.Location.list(),
        base44.entities.Technician.list(),
        base44.entities.Boat.list(),
        base44.entities.Job.list()
      ]);

      setWorkOrders(workOrdersData);
      setLocations(locationsData);
      setBoats(boatsData);
      setJobs(jobsData);
      setTasks(tasksData);
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
    const userWorkOrders = workOrders.filter(wo => 
      wo.assigned_technicians?.includes(technicianId) || wo.lead_technician_id === technicianId
    );

    userWorkOrders.forEach(wo => {
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
    [sections.today, sections.upcoming, sections.later].forEach(section => {
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
    const task = tasks.find(t => t.id === taskId);
    if (!task) return null;
    return workOrders.find(w => w.id === task.work_order_id);
  };

  const getLocationName = (locationId) => {
    if (!locationId) return null;
    const loc = locations.find(l => l.id === locationId);
    return loc?.name || null;
  };

  const getBoatInfo = (jobId) => {
    if (!jobId) return null;
    const job = jobs.find(j => j.id === jobId);
    if (!job?.boat_id) return null;
    return boats.find(b => b.id === job.boat_id);
  };

  const getWorkOrderTasks = (woId) => {
    return tasks.filter(t => t.work_order_id === woId);
  };

  const sections = groupWorkOrdersBySection();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MobileHeaderWithWelcome 
          user={user}
          taskCount={0}
          onSettingsClick={() => {}}
          showSettings={false}
        />
        <div className="p-4 space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  const WorkOrderCard = ({ workOrder, woTasks }) => {
    const woDate = workOrder.scheduled_date ? parseISO(workOrder.scheduled_date) : null;
    const dateString = woDate ? format(woDate, 'MMM d, yyyy') : '—';
    const timeString = workOrder.scheduled_start_time || '—';
    const job = jobs.find(j => j.id === workOrder.job_id);
    const boat = job?.boat_id ? boats.find(b => b.id === job.boat_id) : null;
    const location = getLocationName(job?.location_id);
    const statusBadgeColor = workOrder.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            workOrder.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-800';

    return (
      <Link to={createPageUrl('TeamTaskDetail') + `?woId=${workOrder.id}`}>
        <div className="bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all cursor-pointer p-4 space-y-3">
          {/* Header: Title + Status Badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-lg font-bold text-slate-900">{workOrder.title}</p>
            </div>
            <Badge className={`text-xs whitespace-nowrap flex-shrink-0 ${statusBadgeColor}`}>
              {workOrder.status}
            </Badge>
          </div>

          {/* Subtitle: Boat */}
          <p className="text-sm text-slate-600">
            {boat?.vessel_name || '—'}
          </p>

          {/* Info Cards Row: Date | Status */}
          <div className="grid grid-cols-2 gap-2">
            {/* Date & Time Card */}
            <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <p className="text-xs font-medium text-slate-900">{dateString}</p>
              {timeString !== '—' && <p className="text-xs text-slate-600 mt-1">{timeString}</p>}
            </div>

            {/* Status Card */}
            <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <p className="text-xs font-medium text-slate-900">{workOrder.status}</p>
            </div>
          </div>

          {/* Location */}
          {location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">{location}</p>
            </div>
          )}

          {/* Notes Badge */}
          {workOrder.internal_notes && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 w-fit">
              <span className="text-lg">📝</span>
              <span className="text-xs font-semibold text-amber-800">Notes</span>
            </div>
          )}
        </div>
      </Link>
    );
  };



  return (
    <div className="min-h-screen bg-slate-50">
      {/* Improved Header with Welcome Message */}
      <MobileHeaderWithWelcome 
        user={user}
        taskCount={sections.today.length}
        onSettingsClick={() => setShowPreviewMode(!showPreviewMode)}
        showSettings={showPreviewMode}
      />

      {/* Test Mode Badge */}
      {previewUserId && (
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
            className="h-8 w-8 hover:bg-orange-100"
          >
            <X className="h-4 w-4 text-orange-600" />
          </Button>
        </div>
      )}

      {/* Preview Mode */}
      {showPreviewMode && user?.role === 'admin' && (
        <TeamPreviewMode 
          onUserSelect={(techId, techName) => {
            setPreviewUserId(techId);
            setPreviewTechnicianName(techName);
            setShowPreviewMode(false);
          }} 
          currentUserId={previewUserId} 
        />
      )}

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Today */}
        {sections.today.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Today</h2>
            <div className="space-y-3">
              {sections.today.map(wo => (
                <WorkOrderCard key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {sections.upcoming.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Upcoming (Next 7 days)</h2>
            <div className="space-y-3">
              {sections.upcoming.map(wo => (
                <WorkOrderCard key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Later */}
        {sections.later.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Later</h2>
            <div className="space-y-3">
              {sections.later.map(wo => (
                <WorkOrderCard key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} />
              ))}
            </div>
          </div>
        )}

        {/* No Work Orders */}
        {workOrders.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No work orders assigned yet</p>
          </div>
        )}
      </div>
    </div>
  );
}