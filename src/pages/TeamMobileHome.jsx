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

      const [tasksData, workOrdersData, locationsData, techniciansData, boatsData] = await Promise.all([
        base44.entities.Task.list(),
        base44.entities.WorkOrder.list(),
        base44.entities.Location.list(),
        base44.entities.Technician.list(),
        base44.entities.Boat.list()
      ]);

      setWorkOrders(workOrdersData);
      setLocations(locationsData);
      setBoats(boatsData);
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

  const getBoatInfo = (boatId) => {
    if (!boatId) return null;
    return boats.find(b => b.id === boatId);
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
    const location = getLocationName(workOrder.location_id);
    const boat = getBoatInfo(workOrder.boat_id);
    const woDate = workOrder.scheduled_date ? parseISO(workOrder.scheduled_date) : null;
    const isWorkOrderToday = woDate && isToday(woDate);
    const timeString = workOrder.scheduled_start_time || '—';
    const completedCount = woTasks.filter(t => t.status === 'Completed').length;
    const statusColor = workOrder.status === 'Completed' ? 'bg-green-500' :
                       workOrder.status === 'In Progress' ? 'bg-blue-500' :
                       'bg-slate-400';

    return (
      <Link to={createPageUrl('TeamTaskDetail') + `?woId=${workOrder.id}`}>
        <div className={`rounded-xl overflow-hidden border border-slate-200 hover:shadow-md transition-all cursor-pointer`}>
          {/* Header with status bar */}
          <div className={`${statusColor} text-white px-4 py-3 flex items-start justify-between`}>
            <div className="flex-1">
              <p className="text-xs font-semibold opacity-90">Work Order</p>
              <p className="text-lg font-bold">{workOrder.work_order_number}</p>
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 opacity-75" />
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Title */}
            <div>
              <p className="text-sm font-semibold text-slate-900">{workOrder.title}</p>
            </div>

            {/* Location & Boat */}
            <div className="space-y-1.5 text-sm">
              {location && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <span className="truncate">{location}</span>
                </div>
              )}
              {boat && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-sm">⛵</span>
                  <span className="truncate">{boat.vessel_name}</span>
                </div>
              )}
            </div>

            {/* Footer: Time, Date & Task Count */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono font-semibold text-slate-900">{timeString}</span>
                </div>
                {isWorkOrderToday && (
                  <Badge className="bg-red-100 text-red-700 text-xs">Today</Badge>
                )}
              </div>
              <div className="bg-slate-100 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-700">
                {completedCount}/{woTasks.length} tasks
              </div>
            </div>
          </div>
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