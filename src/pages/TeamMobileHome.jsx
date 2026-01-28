import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, MapPin, AlertCircle, Settings, X } from 'lucide-react';
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

      // Filter tasks assigned to current user (via technician relationship)
      const userTechnicianId = techniciansData.find(t => t.email === (previewUserId ? currentUser.email : currentUser.email))?.id;
      const assignedTechId = previewUserId || userTechnicianId;

      const userTasks = tasksData.filter(task => {
        const wo = workOrdersData.find(w => w.id === task.work_order_id);
        if (!wo) return false;
        // Check if user is assigned to this work order
        return wo.assigned_technicians?.includes(assignedTechId) || wo.lead_technician_id === assignedTechId;
      });

      setTasks(userTasks);
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupWorkOrdersBySection = () => {
    const today = startOfDay(new Date());
    const sections = { today: [], upcoming: [], later: [] };
    const userTechnicianId = user?.id;

    // Get unique work orders assigned to this technician
    const userWorkOrders = workOrders.filter(wo => 
      wo.assigned_technicians?.includes(userTechnicianId) || wo.lead_technician_id === userTechnicianId
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
    const isToday = woDate && isToday(woDate);
    const timeString = workOrder.scheduled_start_time || '—';
    const dateFormatted = woDate ? format(woDate, 'EEE, MMM d') : '—';
    const completedCount = woTasks.filter(t => t.status === 'Completed').length;

    return (
      <Card className={`border-l-4 hover:shadow-lg transition-all ${
        workOrder.status === 'Completed' ? 'border-l-green-500 opacity-60' :
        workOrder.status === 'In Progress' ? 'border-l-blue-500 bg-blue-50' :
        'border-l-slate-300'
      }`}>
        <CardContent className="p-4 space-y-3">
          {/* Date, Time & Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-600">{dateFormatted}</div>
              {isToday && (
                <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">Today</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <div className="text-lg font-bold text-slate-900 font-mono">{timeString}</div>
            </div>
          </div>

          {/* Work Order Title */}
          <div>
            <p className="text-sm font-semibold text-slate-700">WO: {workOrder.work_order_number}</p>
            <p className="text-base font-semibold text-slate-900 leading-snug">{workOrder.title}</p>
          </div>

          {/* Location & Boat */}
          <div className="space-y-1">
            {location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                <p className="text-slate-600">{location}</p>
              </div>
            )}
            {boat && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-base">⛵</span>
                <p className="text-slate-600">{boat.vessel_name}</p>
              </div>
            )}
          </div>

          {/* Tasks Summary */}
          <div className="bg-slate-50 rounded-lg p-2.5 space-y-1.5">
            <p className="text-xs font-medium text-slate-600">Tasks ({completedCount}/{woTasks.length})</p>
            {woTasks.map(task => (
              <Link key={task.id} to={createPageUrl('TeamTaskDetail') + `?taskId=${task.id}`}>
                <div className="p-2 rounded bg-white hover:bg-blue-50 border border-slate-200 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{task.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-xs flex-shrink-0 ${
                      task.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-300' :
                      task.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {task.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
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