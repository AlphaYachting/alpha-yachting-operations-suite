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

  const groupTasksBySection = () => {
    const today = startOfDay(new Date());
    const sections = { today: [], upcoming: [], later: [] };

    tasks.forEach(task => {
      const wo = workOrders.find(w => w.id === task.work_order_id);
      if (!wo) return;

      const taskDate = wo.scheduled_date ? startOfDay(parseISO(wo.scheduled_date)) : null;
      if (!taskDate) {
        sections.later.push(task);
      } else if (taskDate.getTime() === today.getTime()) {
        sections.today.push(task);
      } else if (taskDate < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        sections.upcoming.push(task);
      } else {
        sections.later.push(task);
      }
    });

    // Sort each section
    [sections.today, sections.upcoming, sections.later].forEach(section => {
      section.sort((a, b) => {
        const woA = workOrders.find(w => w.id === a.work_order_id);
        const woB = workOrders.find(w => w.id === b.work_order_id);
        const dateA = woA?.scheduled_date ? parseISO(woA.scheduled_date) : new Date();
        const dateB = woB?.scheduled_date ? parseISO(woB.scheduled_date) : new Date();
        return dateA - dateB;
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

  const sections = groupTasksBySection();

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

  const TaskCard = ({ task }) => {
    const wo = getWorkOrderInfo(task.id);
    if (!wo) return null;

    const location = getLocationName(wo.location_id);
    const boat = getBoatInfo(wo.boat_id);
    const taskDate = wo.scheduled_date ? parseISO(wo.scheduled_date) : null;
    const isTaskToday = taskDate && isToday(taskDate);
    const timeString = wo.scheduled_start_time || '—';
    
    // Format date with day of week
    const dateFormatted = taskDate ? format(taskDate, 'EEE, MMM d') : '—';

    return (
      <Link to={createPageUrl('TeamTaskDetail') + `?taskId=${task.id}`}>
        <Card className={`border-l-4 hover:shadow-lg transition-all ${
          task.status === 'Completed' ? 'border-l-green-500 opacity-60' :
          task.status === 'In Progress' ? 'border-l-blue-500 bg-blue-50' :
          'border-l-slate-300'
        }`}>
          <CardContent className="p-4 space-y-4">
            {/* Date, Time & Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-600">{dateFormatted}</div>
                {isTaskToday && (
                  <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">Today</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <div className="text-xl font-bold text-slate-900 font-mono">{timeString}</div>
              </div>
            </div>

            {/* Task Title */}
            <div>
              <p className="text-base font-semibold text-slate-900 leading-snug">
                {task.title}
              </p>
            </div>

            {/* Description if available */}
            {task.description && (
              <div>
                <p className="text-sm text-slate-600 line-clamp-2">
                  {task.description}
                </p>
              </div>
            )}

            {/* Location & Boat Info */}
            <div className="space-y-2">
              {location && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-900">{location}</p>
                  </div>
                </div>
              )}
              {boat && (
                <div className="flex items-start gap-2">
                  <div className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5 flex items-center justify-center">
                    <span className="text-xs font-bold">⛵</span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Boat</p>
                    <p className="text-sm font-medium text-slate-900">{boat.vessel_name}</p>
                    <p className="text-xs text-slate-500">{boat.vessel_type}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <Badge variant="outline" className={`text-xs ${
                task.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-300' :
                task.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                'bg-slate-100 text-slate-700'
              }`}>
                {task.status}
              </Badge>
              <p className="text-xs text-slate-500">WO: {wo.work_order_number}</p>
            </div>
          </CardContent>
        </Card>
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
            <div className="space-y-2">
              {sections.today.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {sections.upcoming.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Upcoming (Next 7 days)</h2>
            <div className="space-y-2">
              {sections.upcoming.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Later */}
        {sections.later.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Later</h2>
            <div className="space-y-2">
              {sections.later.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* No Tasks */}
        {tasks.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No tasks assigned yet</p>
          </div>
        )}
      </div>
    </div>
  );
}