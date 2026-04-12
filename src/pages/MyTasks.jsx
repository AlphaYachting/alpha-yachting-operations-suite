import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Calendar,
  ListTodo,
  Filter,
  Ship,
  ChevronRight,
  MapPin,
  Users,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
function isMyTask(task, workOrders, technicians, currentUser) {
  // Check task-level direct user assignment first
  if (task.assigned_user_id && task.assigned_user_id === currentUser.id) return true;

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
    // Completed tasks always go to the bottom
    const aCompleted = a.status === 'Completed';
    const bCompleted = b.status === 'Completed';
    if (aCompleted && !bCompleted) return 1;
    if (!aCompleted && bCompleted) return -1;

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
  'In Progress': 'bg-amber-100 text-amber-700',
  'Completed': 'bg-green-100 text-green-700',
  'Not Possible': 'bg-red-100 text-red-700',
  'Needs Approval': 'bg-yellow-100 text-yellow-700',
  'Skipped': 'bg-slate-100 text-slate-500'
};

export default function MyTasks() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [boats, setBoats] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [effectiveUser, setEffectiveUser] = useState(null);
  const [mode, setMode] = useState('open'); // 'open' or 'all'
  const [expandedBoats, setExpandedBoats] = useState({});
  const [simulatedTechnicianId, setSimulatedTechnicianId] = useState('');
  const [updatingTaskId, setUpdatingTaskId] = useState(null);


  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get current user (real user)
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      setEffectiveUser(user);
      
      // Load all tasks and related data (no limit to ensure we get all user's tasks)
      const [allTasks, allWorkOrders, allJobs, allBoats, allCustomers, allLocations, allTechnicians] = await Promise.all([
        base44.entities.Task.list('-created_date', 500),
        base44.entities.WorkOrder.list('-created_date', 500),
        base44.entities.Job.list('-created_date', 1000),
        base44.entities.Boat.list('-created_date', 200),
        base44.entities.Customer.list('-created_date', 200),
        base44.entities.Location.list('-created_date', 200),
        base44.entities.Technician.list('-created_date', 200)
      ]);
      
      setTasks(allTasks);
      setWorkOrders(allWorkOrders);
      setJobs(allJobs);
      setBoats(allBoats);
      setCustomers(allCustomers);
      setLocations(allLocations);
      setTechnicians(allTechnicians);
    } catch (error) {
      console.error('Error loading my tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskStatusChange = async (taskId, newStatus) => {
    setUpdatingTaskId(taskId);
    try {
      await base44.entities.Task.update(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (error) {
      console.error('Error updating task status:', error);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const myTechnicianProfile = technicians.find(tech => tech.user_id === effectiveUser?.id || tech.email === effectiveUser?.email);

  const myTasks = tasks.filter(task => {
    if (simulatedTechnicianId) {
      const workOrder = workOrders.find(wo => wo.id === task.work_order_id);
      if (!workOrder) return false;
      return workOrder.lead_technician_id === simulatedTechnicianId ||
        (workOrder.assigned_technicians && workOrder.assigned_technicians.includes(simulatedTechnicianId));
    }
    if (!effectiveUser) return false;
    return isMyTask(task, workOrders, technicians, effectiveUser);
  });



  // Apply mode filter (open vs all)
  // In 'open' mode: show all non-Skipped tasks (Completed stays visible until project is done)
  const filteredTasks = myTasks.filter(task => {
    if (mode === 'open') {
      return task.status !== 'Skipped';
    }
    return true; // 'all' mode
  });

  // Lookup maps for O(1) access
  const jobMap = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);
  const boatMap = useMemo(() => Object.fromEntries(boats.map(b => [b.id, b])), [boats]);
  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c])), [customers]);
  const locationMap = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);

  // Get boat ID for a task (via Task → WorkOrder → Job → Boat)
  const getTaskBoatId = (task) => {
    const workOrder = workOrders.find(wo => wo.id === task.work_order_id);
    if (!workOrder) return 'unknown';
    const job = jobMap[workOrder.job_id];
    return job?.boat_id || 'unknown';
  };

  // Group tasks by boat
  const groupedByBoat = useMemo(() => {
    const groups = {};
    filteredTasks.forEach(task => {
      const boatId = getTaskBoatId(task);
      if (!groups[boatId]) groups[boatId] = [];
      groups[boatId].push(task);
    });
    
    // Sort tasks within each group by due date
    Object.keys(groups).forEach(boatId => {
      groups[boatId] = sortMyTasks([...groups[boatId]], workOrders);
    });
    
    return groups;
  }, [filteredTasks, workOrders, jobMap]);

  // Sort boat groups by earliest due date (completed-only groups go to bottom)
  const sortedBoatGroups = useMemo(() => {
    return Object.entries(groupedByBoat).sort(([boatIdA, tasksA], [boatIdB, tasksB]) => {
      const allCompletedA = tasksA.every(t => t.status === 'Completed');
      const allCompletedB = tasksB.every(t => t.status === 'Completed');
      if (allCompletedA && !allCompletedB) return 1;
      if (!allCompletedA && allCompletedB) return -1;

      // Find earliest due date using only non-completed tasks
      const getEarliestDate = (tasks) => {
        const dates = tasks
          .filter(t => t.status !== 'Completed')
          .map(t => {
            const wo = workOrders.find(wo => wo.id === t.work_order_id);
            return wo?.scheduled_date ? parseISO(wo.scheduled_date) : null;
          })
          .filter(Boolean);
        
        if (dates.length === 0) return null;
        return dates.reduce((earliest, date) => date < earliest ? date : earliest);
      };
      
      const dateA = getEarliestDate(tasksA);
      const dateB = getEarliestDate(tasksB);
      
      // Boats with due dates come first
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      
      // Unknown boat always last
      if (boatIdA === 'unknown' && boatIdB !== 'unknown') return 1;
      if (boatIdA !== 'unknown' && boatIdB === 'unknown') return -1;
      
      // Both have dates, sort by earliest
      if (dateA && dateB) return dateA - dateB;
      
      return 0;
    });
  }, [groupedByBoat, workOrders]);

  const toggleBoatExpand = (boatId) => {
    setExpandedBoats(prev => ({ ...prev, [boatId]: !prev[boatId] }));
  };

  // Get work order and job info for a task
  const getTaskContext = (task) => {
    const workOrder = workOrders.find(wo => wo.id === task.work_order_id);
    const job = workOrder ? jobMap[workOrder.job_id] : null;
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
            {filteredTasks.length} {mode === 'open' ? 'open' : 'total'} tasks • Grouped by boat, sorted by due date
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
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

          <div className="flex items-center gap-3">
            {technicians.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <select
                  value={simulatedTechnicianId}
                  onChange={e => setSimulatedTechnicianId(e.target.value)}
                  className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Eigene Ansicht</option>
                  {[...technicians]
                    .filter(t => t.status !== 'Inactive')
                    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}{t.role ? ` (${t.role})` : ''}
                      </option>
                    ))
                  }
                </select>
              </div>
            )}
            <div className="text-xs text-slate-500">
              {myTasks.length} total tasks assigned
            </div>
          </div>
        </div>
      </div>

      {/* Tasks Grouped by Boat */}
      {filteredTasks.length === 0 ? (
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
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left max-w-lg mx-auto">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> You don't have a Technician profile linked to your account. 
                  Tasks are assigned to technicians, not directly to users.
                </p>
                <p className="text-xs text-amber-700 mt-2">
                  Contact an admin to create a Technician profile with your email: {effectiveUser?.email || currentUser?.email}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedBoatGroups.map(([boatId, boatTasks]) => {
            const boat = boatMap[boatId];
            const isExpanded = expandedBoats[boatId] === true; // Default collapsed
            
            // Get boat context
            const firstTask = boatTasks[0];
            const { workOrder, job } = getTaskContext(firstTask);
            const customer = job ? customerMap[job.customer_id] : null;
            const location = job ? locationMap[job.location_id] : null;
            
            // Calculate next due date
            const nextDueTask = boatTasks.find(t => {
              const wo = workOrders.find(wo => wo.id === t.work_order_id);
              return wo?.scheduled_date;
            });
            const nextDueWo = nextDueTask ? workOrders.find(wo => wo.id === nextDueTask.work_order_id) : null;
            
            // Unknown boat fallback
            if (boatId === 'unknown') {
              return (
                <Card key={boatId} className="overflow-hidden">
                  <div 
                    className="bg-slate-50 border-b border-slate-200 p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleBoatExpand(boatId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <div>
                          <h3 className="font-semibold text-slate-900">No Boat / Unassigned</h3>
                          <p className="text-sm text-slate-600">{boatTasks.length} tasks</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <CardContent className="p-0">
                      {boatTasks.map((task, idx) => {
                        const { workOrder, job } = getTaskContext(task);
                        const timeStatus = getTaskTimeStatus(workOrder);
                        
                        return (
                          <div 
                            key={task.id} 
                            className={`p-4 transition-colors ${task.status === 'Completed' ? 'bg-green-50/50' : 'hover:bg-slate-50'} ${idx < boatTasks.length - 1 ? 'border-b border-slate-100' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Link
                                    to={createPageUrl('WorkOrderDetail') + `?id=${task.work_order_id}`}
                                    className={`font-semibold hover:text-blue-600 transition-colors ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}
                                  >
                                    {task.title}
                                  </Link>
                                </div>

                                {(workOrder || job) && (
                                  <p className="text-sm text-slate-600 mb-2">
                                    {workOrder && <span>{workOrder.title || workOrder.work_order_number}</span>}
                                    {job && workOrder && <span> • </span>}
                                    {job && <span>{job.title}</span>}
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <select
                                  value={task.status}
                                  onChange={e => handleTaskStatusChange(task.id, e.target.value)}
                                  disabled={updatingTaskId === task.id}
                                  className={`text-xs border rounded-md px-2 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-blue-400 ${statusColors[task.status]} border-transparent`}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <option value="Not Started">Not Started</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Completed">Completed</option>
                                  <option value="Not Possible">Not Possible</option>
                                  <option value="Needs Approval">Needs Approval</option>
                                  <option value="Skipped">Skipped</option>
                                </select>
                                <Badge 
                                  variant={timeStatus.variant === 'destructive' ? 'destructive' : 'secondary'}
                                  className={timeStatus.variant === 'destructive' ? '' : timeStatus.color}
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  {timeStatus.label}
                                </Badge>
                                <Button size="sm" variant="ghost" asChild>
                                  <Link to={createPageUrl('WorkOrderDetail') + `?id=${task.work_order_id}`}>
                                    View WO →
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                        })}
                        </CardContent>
                        )}
                        </Card>
                        );
                        }

                        // Regular boat group
            const customerName = customer?.company_name || 
              `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
              'Unknown Customer';
            
            return (
              <Card key={boatId} className="overflow-hidden">
                {/* Boat Header */}
                <div 
                  className="bg-slate-50 border-b border-slate-200 p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => toggleBoatExpand(boatId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <Ship className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{boat?.vessel_name || 'Unknown Boat'}</h3>
                          {boat?.manufacturer && boat?.model && (
                            <span className="text-sm text-slate-500">
                              {boat.manufacturer} {boat.model}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">{customerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-white">
                        {boatTasks.length} {boatTasks.length === 1 ? 'task' : 'tasks'}
                      </Badge>
                      {nextDueWo?.scheduled_date && (
                        <div className="flex items-center gap-1 text-sm font-medium text-slate-700">
                          <Calendar className="h-4 w-4" />
                          {format(parseISO(nextDueWo.scheduled_date), 'MMM d')}
                        </div>
                      )}
                      {location && (
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {location.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tasks for this boat */}
                {isExpanded && (
                  <CardContent className="p-0">
                    {boatTasks.map((task, idx) => {
                      const { workOrder, job } = getTaskContext(task);
                      const timeStatus = getTaskTimeStatus(workOrder);
                      
                      return (
                        <div 
                          key={task.id} 
                          className={`p-4 transition-colors ${task.status === 'Completed' ? 'bg-green-50/50' : 'hover:bg-slate-50'} ${idx < boatTasks.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {/* Task title */}
                              <div className="flex items-center gap-2 mb-1">
                                <Link
                                  to={createPageUrl('WorkOrderDetail') + `?id=${task.work_order_id}`}
                                  className={`font-semibold hover:text-blue-600 transition-colors ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}
                                >
                                  {task.title}
                                </Link>
                              </div>
                              
                              {/* Work order / project reference */}
                              {(workOrder || job) && (
                                <p className="text-sm text-slate-600 mb-2">
                                  {workOrder && <span>{workOrder.title || workOrder.work_order_number}</span>}
                                  {job && workOrder && <span> • </span>}
                                  {job && (
                                    <Link 
                                      to={createPageUrl('JobDetail') + `?id=${job.id}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {job.title}
                                    </Link>
                                  )}
                                </p>
                              )}
                              
                              {/* Task description */}
                              {task.description && (
                                <p className="text-sm text-slate-600 line-clamp-1 mb-2">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            
                            {/* Right side: status selector + due date + actions */}
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <select
                                value={task.status}
                                onChange={e => handleTaskStatusChange(task.id, e.target.value)}
                                disabled={updatingTaskId === task.id}
                                className={`text-xs border rounded-md px-2 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-blue-400 ${statusColors[task.status]} border-transparent cursor-pointer`}
                                onClick={e => e.stopPropagation()}
                              >
                                <option value="Not Started">Not Started</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                                <option value="Not Possible">Not Possible</option>
                                <option value="Needs Approval">Needs Approval</option>
                                <option value="Skipped">Skipped</option>
                              </select>
                              <Badge 
                                variant={timeStatus.variant === 'destructive' ? 'destructive' : 'secondary'}
                                className={timeStatus.variant === 'destructive' ? '' : timeStatus.color}
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
                              
                              <Button size="sm" variant="ghost" className="mt-1" asChild>
                                <Link to={createPageUrl('WorkOrderDetail') + `?id=${task.work_order_id}`}>
                                  View WO →
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}