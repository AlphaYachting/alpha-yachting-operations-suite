import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, MapPin, AlertCircle, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isToday, isTomorrow, startOfDay } from 'date-fns';
import TeamPreviewMode from '@/components/mobile/TeamPreviewMode';

export default function TeamMobileHome() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewUserId, setPreviewUserId] = useState(null);
  const [showPreviewMode, setShowPreviewMode] = useState(false);

  useEffect(() => {
    loadData();
  }, [previewUserId]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [tasksData, workOrdersData, locationsData, techniciansData] = await Promise.all([
        base44.entities.Task.list(),
        base44.entities.WorkOrder.list(),
        base44.entities.Location.list(),
        base44.entities.Technician.list()
      ]);

      setWorkOrders(workOrdersData);
      setLocations(locationsData);

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

  const sections = groupTasksBySection();

  const TaskCard = ({ task }) => {
    const wo = getWorkOrderInfo(task.id);
    if (!wo) return null;

    const location = getLocationName(wo.location_id);
    const taskDate = wo.scheduled_date ? parseISO(wo.scheduled_date) : null;
    const dateLabel = taskDate ? (
      isToday(taskDate) ? 'Today' : 
      isTomorrow(taskDate) ? 'Tomorrow' : 
      format(taskDate, 'MMM d')
    ) : 'TBD';

    return (
      <Link to={createPageUrl('TeamTaskDetail') + `?taskId=${task.id}`}>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Task Title */}
              <div>
                <p className="font-semibold text-slate-900 text-sm">{task.title}</p>
                <p className="text-xs text-slate-500 mt-1">WO: {wo.work_order_number}</p>
              </div>

              {/* Time & Location */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{dateLabel}</span>
                  {wo.scheduled_start_time && <span>• {wo.scheduled_start_time}</span>}
                </div>
                {location && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{location}</span>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <Badge variant="outline" className={`text-xs w-fit ${
                task.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-300' :
                task.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                'bg-slate-100 text-slate-700'
              }`}>
                {task.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">My Tasks</h1>
            <p className="text-xs text-slate-500">Today: {sections.today.length} tasks</p>
          </div>
          {user?.role === 'admin' && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowPreviewMode(!showPreviewMode)}
              className="h-9 w-9"
            >
              <Settings className="h-4 w-4 text-slate-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Preview Mode */}
      {showPreviewMode && user?.role === 'admin' && (
        <TeamPreviewMode onUserSelect={setPreviewUserId} currentUserId={previewUserId} />
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