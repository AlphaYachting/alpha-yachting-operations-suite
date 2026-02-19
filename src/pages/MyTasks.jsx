import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Calendar,
  ListTodo,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, isPast, isToday, differenceInDays, startOfDay } from 'date-fns';

// FIELD MAPPING (Task entity):
// - status values: "Not Started", "In Progress", "Completed", "Not Possible", "Needs Approval", "Skipped"
// - Tasks don't have direct user assignment
// - Tasks belong to WorkOrders, which have: assigned_technicians (array), lead_technician_id
// - Task assignment determined through parent WorkOrder

/**
 * Helper: Check if a task belongs to current user
 * A task belongs to user if the parent WorkOrder has user's technician in assigned_technicians or as lead_technician_id
 */
function isMyTask(task, workOrders, technicians, currentUserId) {
  const workOrder = workOrders.find(wo => wo.id === task.work_order_id);
  if (!workOrder) return false;
  
  // Find technician profile for current user
  const myTechnicianProfile = technicians.find(tech => tech.user_id === currentUserId);
  if (!myTechnicianProfile) return false;
  
  const myTechnicianId = myTechnicianProfile.id;
  
  // Check if user is lead technician
  if (workOrder.lead_technician_id === myTechnicianId) return true;
  
  // Check if user is in assigned technicians
  if (workOrder.assigned_technicians && workOrder.assigned_technicians.includes(myTechnicianId)) {
    return true;
  }
  
  return false;
}

/**
 * Get time-based status label for a task
 */
function getTaskTimeStatus(workOrder) {
  if (!workOrder || !workOrder.scheduled_date) {
    return { label: 'No Due Date', variant: 'outline', color: 'text-slate-500' };
  }
  
  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(workOrder.scheduled_date));
  const daysUntil = differenceInDays(dueDate, today);
  
  if (daysUntil < 0) {
    return { label: 'Overdue', variant: 'destructive', color: 'text-red-700' };
  }
  if (daysUntil === 0) {
    return { label: 'Due Today', variant: 'default', color: 'text-amber-700' };
  }
  if (daysUntil <= 7) {
    return { label: 'Upcoming', variant: 'secondary', color: 'text-blue-700' };
  }
  
  return { label: `Due ${format(dueDate, 'MMM d')}`, variant: 'outline', color: 'text-slate-600' };
}

/**
 * Sort tasks: by parent WorkOrder due date ascending (nulls last)
 */
function sortMyTasks(tasks, workOrders) {
  return tasks.sort((a, b) => {
    const woA = workOrders.find(wo => wo.id === a.work_order_id);
    const woB = workOrders.find(wo => wo.id === b.work_order_id);
    
    const aDate = woA?.scheduled_date ? parseISO(woA.scheduled_date) : null;
    const bDate = woB?.scheduled_date ? parseISO(woB.scheduled_date) : null;
    
    // Tasks with due dates come first
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    if (!aDate && !bDate) return 0;
    
    // Sort by due date ascending (earliest first)
    return aDate - bDate;
  });
}

const statusColors = {
  'Not Started': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-green-100 text-green-700',
  'Not Possible': 'bg-red-100 text-red-700',
  'Needs Approval': 'bg-amber-100 text-amber-700',
  'Skipped': 'bg-slate-100 text-slate-500'
};

export default function MyTasks() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [mode, setMode] = useState('open'); // 'open' or 'all'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      // Load all tasks (no limit to ensure we get all user's tasks)
      const [allTasks, allWorkOrders, allJobs, allTechnicians] = await Promise.all([
        base44.entities.Task.list('-created_date', 500),
        base44.entities.WorkOrder.list('-created_date', 500),
        base44.entities.Job.list('-created_date', 200),
        base44.entities.Technician.list('-created_date', 200)
      ]);
      
      setTasks(allTasks);
      setWorkOrders(allWorkOrders);
      setJobs(allJobs);
      setTechnicians(allTechnicians);
    } catch (error) {
      console.error('Error loading my tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks belonging to current user
  const myTechnicianProfile = technicians.find(tech => tech.user_id === currentUser?.id);
  
  const myTasks = tasks.filter(task => {
    if (!currentUser) return false;
    return isMyTask(task, workOrders, technicians, currentUser.id);
  });

  // Debug info
  console.log('My Tasks Debug:', {
    currentUserId: currentUser?.id,
    currentUserEmail: currentUser?.email,
    myTechnicianProfile,
    totalTasks: tasks.length,
    totalWorkOrders: workOrders.length,
    myTasksFound: myTasks.length,
    workOrdersWithMyTech: workOrders.filter(wo => 
      wo.lead_technician_id === myTechnicianProfile?.id || 
      wo.assigned_technicians?.includes(myTechnicianProfile?.id)
    ).length
  });

  // Apply mode filter (open vs all)
  const filteredTasks = myTasks.filter(task => {
    if (mode === 'open') {
      return task.status !== 'Completed' && task.status !== 'Skipped';
    }
    return true; // 'all' mode
  });

  // Sort by parent WorkOrder due date
  const sortedTasks = sortMyTasks([...filteredTasks], workOrders);

  // Get work order and job info for a task
  const getTaskContext = (task) => {
    const workOrder = workOrders.find(wo => wo.id === task.work_order_id);
    const job = workOrder ? jobs.find(j => j.id === workOrder.job_id) : null;
    return { workOrder, job };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-slate-500 mt-1">
            {sortedTasks.length} {mode === 'open' ? 'open' : 'total'} tasks assigned to you
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList>
          <TabsTrigger value="open">
            <ListTodo className="h-4 w-4 mr-2" />
            Open Tasks
          </TabsTrigger>
          <TabsTrigger value="all">
            <Filter className="h-4 w-4 mr-2" />
            All Tasks
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tasks List */}
      {sortedTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No tasks found</h3>
            <p className="text-slate-500 mt-1">
              {mode === 'open' 
                ? 'You have no open tasks assigned to you' 
                : 'You have no tasks assigned to you'}
            </p>
            {!myTechnicianProfile && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> You don't have a Technician profile linked to your account. 
                  Tasks are assigned to technicians, not directly to users.
                </p>
                <p className="text-xs text-amber-700 mt-2">
                  Contact an admin to create a Technician profile with your email: {currentUser?.email}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sortedTasks.map((task) => {
            const { workOrder, job } = getTaskContext(task);
            const timeStatus = getTaskTimeStatus(workOrder);
            
            return (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Link
                          to={createPageUrl('WorkOrderDetail') + `?id=${task.work_order_id}`}
                          className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {task.title}
                        </Link>
                        <Badge className={statusColors[task.status]}>
                          {task.status}
                        </Badge>
                        <Badge variant={timeStatus.variant} className={timeStatus.color}>
                          <Clock className="h-3 w-3 mr-1" />
                          {timeStatus.label}
                        </Badge>
                      </div>

                      {task.description && (
                        <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {workOrder && (
                          <span>WO: {workOrder.title || workOrder.work_order_number}</span>
                        )}
                        {job && (
                          <span>• Project: {job.title}</span>
                        )}
                        {workOrder?.scheduled_date && (
                          <div className="flex items-center gap-1">
                            • <Calendar className="h-3 w-3" />
                            {format(parseISO(workOrder.scheduled_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <Link to={createPageUrl('WorkOrderDetail') + `?id=${task.work_order_id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}