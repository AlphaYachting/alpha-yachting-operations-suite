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
import UserSimulator from '@/components/admin/UserSimulator';

// FIELD MAPPING (Task entity):
// - status values: "Not Started", "In Progress", "Completed", "Not Possible", "Needs Approval", "Skipped"
// - Tasks don't have direct user assignment
// - Tasks belong to WorkOrders, which have: assigned_technicians (array), lead_technician_id
// - Task assignment determined through parent WorkOrder

/**
 * Helper: Check if a task belongs to current user
 * A task belongs to user if the parent WorkOrder has user's technician in assigned_technicians or as lead_technician_id
 */
function isMyTask(task, workOrders, technicians, currentUser) {
  const workOrder = workOrders.find(wo => wo.id === task.work_order_id);
  if (!workOrder) return false;
  
  // Find technician profile for current user (match by user_id OR by email)
  const myTechnicianProfile = technicians.find(tech => 
    tech.user_id === currentUser.id || tech.email === currentUser.email
  );
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

const SIMULATION_KEY = 'admin_simulate_user_id';

export default function MyTasks() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [effectiveUser, setEffectiveUser] = useState(null);
  const [mode, setMode] = useState('open'); // 'open' or 'all'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get current user (real user)
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      // Check for simulation (admin only)
      let effectiveUserId = user.id;
      if (user.role === 'admin') {
        const simulatedId = localStorage.getItem(SIMULATION_KEY);
        if (simulatedId) {
          effectiveUserId = simulatedId;
        }
      }
      
      // Load effective user
      if (effectiveUserId !== user.id) {
        const [simulatedUser] = await base44.entities.User.filter({ id: effectiveUserId });
        setEffectiveUser(simulatedUser || user);
      } else {
        setEffectiveUser(user);
      }
      
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

  // Filter tasks belonging to effective user (respects simulation)
  const myTechnicianProfile = technicians.find(tech => 
    tech.user_id === effectiveUser?.id || tech.email === effectiveUser?.email
  );
  
  const myTasks = tasks.filter(task => {
    if (!effectiveUser) return false;
    return isMyTask(task, workOrders, technicians, effectiveUser);
  });

  // Debug info (admin only)
  const isSimulating = currentUser?.role === 'admin' && effectiveUser?.id !== currentUser?.id;
  if (currentUser?.role === 'admin') {
    console.log('My Tasks Debug:', {
      realUserId: currentUser?.id,
      realUserEmail: currentUser?.email,
      effectiveUserId: effectiveUser?.id,
      effectiveUserEmail: effectiveUser?.email,
      simulation: isSimulating ? 'ON' : 'OFF',
      myTechnicianProfile,
      totalTasks: tasks.length,
      totalWorkOrders: workOrders.length,
      myTasksFound: myTasks.length,
      workOrdersWithMyTech: workOrders.filter(wo => 
        wo.lead_technician_id === myTechnicianProfile?.id || 
        wo.assigned_technicians?.includes(myTechnicianProfile?.id)
      ).length
    });
  }

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
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-sm text-slate-500 mt-2">
            {sortedTasks.length} {mode === 'open' ? 'open' : 'total'} tasks • Sorted by due date (earliest first)
          </p>
        </div>
        
        {currentUser?.role === 'admin' && (
          <div className="w-80 flex-shrink-0">
            <UserSimulator currentUser={currentUser} />
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList>
              <TabsTrigger value="open">
                <ListTodo className="h-4 w-4 mr-2" />
                Open
              </TabsTrigger>
              <TabsTrigger value="all">
                All Tasks
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="text-xs text-slate-500">
            {myTasks.length} total tasks assigned
          </div>
        </div>
      </div>

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
        <div className="space-y-2">
          {sortedTasks.map((task) => {
            const { workOrder, job } = getTaskContext(task);
            const timeStatus = getTaskTimeStatus(workOrder);
            
            return (
              <Card key={task.id} className="hover:bg-slate-50 transition-colors border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-6">
                    {/* Left: Task Info */}
                    <div className="flex-1 min-w-0">
                      {/* Primary Line */}
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          to={createPageUrl('WorkOrderDetail') + `?id=${task.work_order_id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {task.title}
                        </Link>
                      </div>

                      {/* Secondary Line */}
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                        {workOrder && (
                          <span>{workOrder.title || workOrder.work_order_number}</span>
                        )}
                        {job && workOrder && <span>•</span>}
                        {job && (
                          <span className="text-slate-500">{job.title}</span>
                        )}
                      </div>

                      {/* Description */}
                      {task.description && (
                        <p className="text-sm text-slate-600 line-clamp-1 mb-2">
                          {task.description}
                        </p>
                      )}

                      {/* Badges Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={statusColors[task.status]} variant="outline">
                          {task.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Right: Meta */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge 
                        variant={timeStatus.variant === 'destructive' ? 'destructive' : 'secondary'}
                        className={`${timeStatus.variant === 'destructive' ? '' : timeStatus.color}`}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {timeStatus.label}
                      </Badge>
                      
                      {workOrder?.scheduled_date && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(workOrder.scheduled_date), 'MMM d, yyyy')}
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1"
                        asChild
                      >
                        <Link to={createPageUrl('WorkOrderDetail') + `?id=${task.work_order_id}`}>
                          View WO →
                        </Link>
                      </Button>
                    </div>
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