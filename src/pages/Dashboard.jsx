import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Briefcase, 
  ClipboardList, 
  Users, 
  Ship,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Package,
  MapPin,
  Calendar,
  User,
  Pencil,
  Truck,
  Flag,
  ChevronRight,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { format, isToday, isTomorrow, parseISO, addDays, isWithinInterval, startOfDay, endOfDay, isPast, differenceInDays, startOfWeek, addMonths, startOfMonth } from 'date-fns';
import WorkOrderForm from '@/components/workorders/WorkOrderForm';
import DragDropCalendar from '@/components/schedule/DragDropCalendar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DispatchTimeline from '@/components/schedule/DispatchTimeline';
import FutureOverview from '@/components/schedule/FutureOverview';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const StatCard = ({ title, value, icon: Icon, trend, color, loading }) => (
  <Card className="relative overflow-hidden">
    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8 opacity-10 ${color}`} />
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-16 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">{trend}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const priorityColors = {
  Low: 'bg-slate-100 text-slate-700',
  Normal: 'bg-blue-100 text-blue-700',
  High: 'bg-amber-100 text-amber-700',
  Urgent: 'bg-red-100 text-red-700',
  Express: 'bg-purple-100 text-purple-700'
};

const statusColors = {
  New: 'bg-blue-100 text-blue-700',
  Scheduled: 'bg-cyan-100 text-cyan-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Waiting for Parts': 'bg-orange-100 text-orange-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Dispatched: 'bg-violet-100 text-violet-700',
  'In Transit': 'bg-indigo-100 text-indigo-700'
};

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkOrder, setEditingWorkOrder] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [locations, setLocations] = useState([]);
  const [inventoryReservations, setInventoryReservations] = useState([]);
  
  // Schedule state
  const [currentWeekStart, setCurrentWeekStart] = useState(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), -7));
  const [calendarViewType, setCalendarViewType] = useState('week');
  const [viewMode, setViewMode] = useState('calendar');
  const [dispatchViewMode, setDispatchViewMode] = useState('day');
  const [dispatchDate, setDispatchDate] = useState(new Date());
  const [gridSize, setGridSize] = useState('1h');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [technicianFilter, setTechnicianFilter] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rangeWeeks, setRangeWeeks] = useState(8);
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [focusBlockedDays, setFocusBlockedDays] = useState(false);
  const [overviewStartDate, setOverviewStartDate] = useState(startOfDay(new Date()));

  useEffect(() => {
    const loadData = async () => {
      try {
        const [jobsData, workOrdersData, tasksData, customersData, boatsData, techniciansData, reservationsData, vehiclesData, locationsData] = await Promise.all([
          base44.entities.Job.list(),
          base44.entities.WorkOrder.list('-scheduled_date', 100),
          base44.entities.Task.list(),
          base44.entities.Customer.list(),
          base44.entities.Boat.list(),
          base44.entities.Technician.list(),
          base44.entities.InventoryReservation.filter({ status: 'Reserved' }),
          base44.entities.InventoryItem.filter({ item_type: 'VEHICLE' }),
          base44.entities.Location.list()
        ]);
        
        // Sort jobs: overdue first, then due today, then due soon, then by priority, then by due date, then by created date
        const sortedJobs = jobsData.sort((a, b) => {
          const today = new Date();
          const aDate = a.requested_date ? parseISO(a.requested_date) : null;
          const bDate = b.requested_date ? parseISO(b.requested_date) : null;
          
          const aOverdue = aDate && isPast(aDate) && !isToday(aDate);
          const bOverdue = bDate && isPast(bDate) && !isToday(bDate);
          const aDueToday = aDate && isToday(aDate);
          const bDueToday = bDate && isToday(bDate);
          const aDueSoon = aDate && differenceInDays(aDate, today) <= 7 && differenceInDays(aDate, today) > 0;
          const bDueSoon = bDate && differenceInDays(bDate, today) <= 7 && differenceInDays(bDate, today) > 0;
          
          // Overdue first
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          
          // Due today second
          if (aDueToday && !bDueToday) return -1;
          if (!aDueToday && bDueToday) return 1;
          
          // Due soon third
          if (aDueSoon && !bDueSoon) return -1;
          if (!aDueSoon && bDueSoon) return 1;
          
          // Priority order
          const priorityOrder = { Express: 0, Urgent: 1, High: 2, Normal: 3, Low: 4 };
          const aPriority = priorityOrder[a.priority] ?? 5;
          const bPriority = priorityOrder[b.priority] ?? 5;
          if (aPriority !== bPriority) return aPriority - bPriority;
          
          // By due date
          if (aDate && bDate) {
            if (aDate < bDate) return -1;
            if (aDate > bDate) return 1;
          }
          if (aDate && !bDate) return -1;
          if (!aDate && bDate) return 1;
          
          // By created date (newest first)
          return new Date(b.created_date) - new Date(a.created_date);
        });
        
        setJobs(sortedJobs);
        setWorkOrders(workOrdersData);
        setTasks(tasksData);
        setCustomers(customersData);
        setBoats(boatsData);
        setTechnicians(techniciansData);
        setReservations(reservationsData);
        setVehicles(vehiclesData);
        setLocations(locationsData);
        setInventoryReservations(reservationsData);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const today = startOfDay(new Date());
  const threeDaysFromNow = endOfDay(addDays(today, 3));
  
  const activeJobs = jobs.filter(j => !['Completed', 'Invoiced', 'Cancelled'].includes(j.status));
  const urgentJobs = jobs.filter(j => ['Urgent', 'Express'].includes(j.priority) && !['Completed', 'Invoiced', 'Cancelled'].includes(j.status));
  const todayWorkOrders = workOrders.filter(wo => wo.scheduled_date && isToday(parseISO(wo.scheduled_date)));
  
  // Overdue jobs based on due date
  const overdueJobs = jobs.filter(j => {
    if (!j.requested_date || ['Completed', 'Invoiced', 'Cancelled'].includes(j.status)) return false;
    return isPast(parseISO(j.requested_date)) && !isToday(parseISO(j.requested_date));
  });
  
  // Draft work orders (unplanned)
  const draftWorkOrders = workOrders.filter(wo => wo.status === 'Draft');
  
  // Active work orders (not draft, not completed/cancelled, with scheduled dates)
  // Sort: overdue first, then by scheduled date
  const upcomingWorkOrders = workOrders.filter(wo => {
    if (!wo.scheduled_date) return false;
    return wo.status !== 'Draft' && !['Completed', 'Cancelled'].includes(wo.status);
  }).sort((a, b) => {
    const aDate = parseISO(a.scheduled_date);
    const bDate = parseISO(b.scheduled_date);
    const aOverdue = aDate < today;
    const bOverdue = bDate < today;
    
    // Overdue items first
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // Then sort by date
    return aDate - bDate;
  }).slice(0, 10);
  
  const overdueWorkOrders = workOrders.filter(wo => {
    if (!wo.scheduled_date) return false;
    const date = parseISO(wo.scheduled_date);
    return date < today && wo.status !== 'Draft' && !['Completed', 'Cancelled'].includes(wo.status);
  });
  
  const upcomingUnfinishedWorkOrders = workOrders.filter(wo => {
    if (!wo.scheduled_date) return false;
    const date = parseISO(wo.scheduled_date);
    const isInRange = isWithinInterval(date, { start: today, end: threeDaysFromNow });
    const isUnfinished = wo.status !== 'Draft' && !['Completed', 'Cancelled'].includes(wo.status);
    return isInRange && isUnfinished;
  });
  
  const allPendingWorkOrders = [...overdueWorkOrders, ...upcomingUnfinishedWorkOrders];

  const unfinishedTasksCount = tasks.filter(task => {
    const wo = workOrders.find(w => w.id === task.work_order_id);
    if (!wo?.scheduled_date) return false;
    const date = parseISO(wo.scheduled_date);
    const isInRange = isWithinInterval(date, { start: today, end: threeDaysFromNow });
    const isUnfinished = !['Completed', 'Skipped'].includes(task.status);
    return isInRange && isUnfinished;
  }).length;

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return 'Unknown';
    return customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  };

  const getBoatName = (boatId) => {
    const boat = boats.find(b => b.id === boatId);
    return boat?.vessel_name || 'Unknown';
  };

  const getTechnicianName = (technicianId) => {
    const tech = technicians.find(t => t.id === technicianId);
    if (!tech) return null;
    return `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
  };

  const getVehicleDisplay = (workOrderId) => {
    const woReservations = reservations.filter(r => r.work_order_id === workOrderId);
    if (woReservations.length === 0) return null;
    
    const uniqueVehicleIds = [...new Set(woReservations.map(r => r.inventory_item_id))];
    
    if (uniqueVehicleIds.length === 1) {
      const vehicle = vehicles.find(v => v.id === uniqueVehicleIds[0]);
      if (!vehicle) return null;
      return vehicle.license_plate || `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.name;
    } else {
      return `Multiple (+${uniqueVehicleIds.length})`;
    }
  };

  const handleEditWorkOrder = (wo, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingWorkOrder(wo);
    setShowEditDialog(true);
  };

  const handleSaveWorkOrder = async (workOrderData) => {
    try {
      await base44.entities.WorkOrder.update(editingWorkOrder.id, workOrderData);
      const [workOrdersData] = await Promise.all([
        base44.entities.WorkOrder.list('-scheduled_date', 100)
      ]);
      setWorkOrders(workOrdersData);
      setShowEditDialog(false);
      setEditingWorkOrder(null);
    } catch (error) {
      console.error('Error updating work order:', error);
    }
  };
  
  // Schedule navigation functions
  const prevWeek = () => setCurrentWeekStart(calendarViewType === 'month' ? addMonths(currentWeekStart, -1) : addDays(currentWeekStart, -7));
  const nextWeek = () => setCurrentWeekStart(calendarViewType === 'month' ? addMonths(currentWeekStart, 1) : addDays(currentWeekStart, 7));
  const goToToday = () => setCurrentWeekStart(calendarViewType === 'month' ? startOfMonth(new Date()) : addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), -7));
  const prevDay = () => setDispatchDate(addDays(dispatchDate, -1));
  const nextDay = () => setDispatchDate(addDays(dispatchDate, 1));
  const goToDispatchToday = () => setDispatchDate(new Date());
  const prevRange = () => setOverviewStartDate(addDays(overviewStartDate, -rangeWeeks * 7));
  const nextRange = () => setOverviewStartDate(addDays(overviewStartDate, rangeWeeks * 7));
  const goToOverviewToday = () => setOverviewStartDate(startOfDay(new Date()));
  
  const handleOverviewDateClick = (date, technicianId) => {
    setDispatchDate(date);
    setDispatchViewMode('day');
  };
  
  const handleWorkOrderClick = (workOrderId) => {
    const wo = workOrders.find(w => w.id === workOrderId);
    if (wo) {
      setEditingWorkOrder(wo);
      setShowEditDialog(true);
    }
  };
  
  const handleWorkOrderUpdate = async (workOrderId, updates) => {
    try {
      await base44.entities.WorkOrder.update(workOrderId, updates);
      const [workOrdersData] = await Promise.all([
        base44.entities.WorkOrder.list('-scheduled_date', 100)
      ]);
      setWorkOrders(workOrdersData);
    } catch (error) {
      console.error('Error updating work order:', error);
    }
  };
  
  const handleWorkOrderEditFromCalendar = (workOrder) => {
    setEditingWorkOrder(workOrder);
    setShowEditDialog(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowScheduleDialog(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to={createPageUrl('Jobs') + '?new=true'}>
              <Briefcase className="h-4 w-4 mr-2" />
              New Job
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Active Jobs" 
          value={activeJobs.length} 
          icon={Briefcase}
          color="bg-blue-500"
          loading={loading}
        />
        <StatCard 
          title="Today's Work Orders" 
          value={todayWorkOrders.length} 
          icon={ClipboardList}
          color="bg-cyan-500"
          loading={loading}
        />
        <StatCard 
          title="Overdue Jobs" 
          value={overdueJobs.length} 
          icon={Flag}
          color="bg-red-500"
          loading={loading}
        />
        <StatCard 
          title="Total Customers" 
          value={customers.length} 
          icon={Users}
          color="bg-emerald-500"
          loading={loading}
        />
      </div>

      {/* Unfinished Items Alert */}
      {allPendingWorkOrders.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-amber-900">
                  {overdueWorkOrders.length > 0 ? 'Overdue & ' : ''}Unfinished Work
                </CardTitle>
                <p className="text-sm text-amber-700 mt-0.5">
                  {overdueWorkOrders.length > 0 && `${overdueWorkOrders.length} overdue • `}
                  {upcomingUnfinishedWorkOrders.length} upcoming • {unfinishedTasksCount} task{unfinishedTasksCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allPendingWorkOrders.slice(0, 5).map((wo) => {
                const job = jobs.find(j => j.id === wo.job_id);
                const woTasks = tasks.filter(t => t.work_order_id === wo.id && !['Completed', 'Skipped'].includes(t.status));
                const isOverdue = wo.scheduled_date && parseISO(wo.scheduled_date) < today;
                
                return (
                  <Link
                    key={wo.id}
                    to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                    className={`block p-3 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-white'} hover:border-amber-300 hover:bg-amber-50 transition-all`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{wo.title}</p>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {job ? getBoatName(job.boat_id) : 'Unknown boat'}
                        </p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <Badge className={statusColors[wo.status] || 'bg-slate-100 text-slate-700'}>
                            {wo.status}
                          </Badge>
                          {wo.scheduled_date && (
                            <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-700 font-medium' : 'text-slate-600'}`}>
                              <Calendar className="h-3 w-3" />
                              {isOverdue && 'OVERDUE: '}
                              {isToday(parseISO(wo.scheduled_date)) ? 'Today' : 
                               isTomorrow(parseISO(wo.scheduled_date)) ? 'Tomorrow' :
                               format(parseISO(wo.scheduled_date), 'MMM d')}
                            </div>
                          )}
                          {woTasks.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-amber-700">
                              <CheckCircle2 className="h-3 w-3" />
                              {woTasks.length} task{woTasks.length !== 1 ? 's' : ''} pending
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {allPendingWorkOrders.length > 5 && (
                <Button asChild variant="outline" size="sm" className="w-full mt-2">
                  <Link to={createPageUrl('WorkOrders')}>
                    View all {allPendingWorkOrders.length} work orders
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Work Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Active Work Orders</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={createPageUrl('WorkOrders')}>
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : upcomingWorkOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p>No active work orders</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingWorkOrders.map((wo) => {
                  const job = jobs.find(j => j.id === wo.job_id);
                  const isOverdue = wo.scheduled_date && parseISO(wo.scheduled_date) < today;
                  const leadTechName = wo.lead_technician_id ? getTechnicianName(wo.lead_technician_id) : null;
                  
                  return (
                    <Link
                      key={wo.id}
                      to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                      className={`block p-4 rounded-xl border ${isOverdue ? 'border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50' : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/50'} transition-all`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{wo.title}</p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {job ? getBoatName(job.boat_id) : 'Unknown boat'}
                          </p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="h-3 w-3" />
                              {wo.scheduled_start_time || 'TBD'}
                            </div>
                            {wo.scheduled_date && (
                              <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                                <Calendar className="h-3 w-3" />
                                {isOverdue && 'OVERDUE: '}
                                {isToday(parseISO(wo.scheduled_date)) ? 'Today' : 
                                 isTomorrow(parseISO(wo.scheduled_date)) ? 'Tomorrow' :
                                 format(parseISO(wo.scheduled_date), 'MMM d, yyyy')}
                              </div>
                            )}
                            {leadTechName && (
                              <div className="flex items-center gap-1 text-xs text-blue-700">
                                <User className="h-3 w-3" />
                                {leadTechName}
                              </div>
                            )}
                            {(() => {
                              const vehicleDisplay = getVehicleDisplay(wo.id);
                              return vehicleDisplay && (
                                <div className="flex items-center gap-1 text-xs text-emerald-700">
                                  <Truck className="h-3 w-3" />
                                  {vehicleDisplay}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => handleEditWorkOrder(wo, e)}
                          >
                            <Pencil className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Badge className={statusColors[wo.status] || 'bg-slate-100 text-slate-700'}>
                            {wo.status}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Recent Jobs</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={createPageUrl('Jobs')}>
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p>No jobs yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.slice(0, 5).map((job) => {
                  const isDueOverdue = job.requested_date && isPast(parseISO(job.requested_date)) && !isToday(parseISO(job.requested_date));
                  const isDueToday = job.requested_date && isToday(parseISO(job.requested_date));
                  const isDueSoon = job.requested_date && differenceInDays(parseISO(job.requested_date), today) <= 7 && differenceInDays(parseISO(job.requested_date), today) > 0;
                  
                  return (
                  <Link
                    key={job.id}
                    to={createPageUrl('JobDetail') + `?id=${job.id}`}
                    className={`block p-4 rounded-xl border-2 transition-all ${
                      isDueOverdue ? 'border-red-500 bg-red-50 hover:border-red-600 hover:bg-red-100' : 
                      isDueToday ? 'border-amber-500 bg-amber-50 hover:border-amber-600 hover:bg-amber-100' : 
                      isDueSoon ? 'border-yellow-400 bg-yellow-50 hover:border-yellow-500 hover:bg-yellow-100' :
                      'border-slate-200 hover:border-blue-200 hover:bg-blue-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900 truncate">{job.title}</p>
                          <Badge className={priorityColors[job.priority] || 'bg-slate-100'} variant="secondary">
                            {job.priority}
                          </Badge>
                          {job.requested_date && (
                            <Badge className={`${
                              isDueOverdue ? 'bg-red-600 text-white border-red-700' : 
                              isDueToday ? 'bg-amber-600 text-white border-amber-700' : 
                              isDueSoon ? 'bg-yellow-500 text-white border-yellow-600' : 
                              'bg-blue-100 text-blue-700'
                            }`}>
                              <Flag className={`h-3 w-3 mr-1 ${isDueOverdue || isDueToday || isDueSoon ? 'animate-pulse' : ''}`} />
                              {isDueOverdue ? 'OVERDUE' : isDueToday ? 'DUE TODAY' : isDueSoon ? `Due ${format(parseISO(job.requested_date), 'MMM d')}` : `Due ${format(parseISO(job.requested_date), 'MMM d')}`}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {getCustomerName(job.customer_id)} • {getBoatName(job.boat_id)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={statusColors[job.status] || 'bg-slate-100 text-slate-700'}>
                            {job.status}
                          </Badge>
                          {job.job_number && (
                            <span className="text-xs text-slate-400">#{job.job_number}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unplanned Work Orders */}
      {draftWorkOrders.length > 0 && (
        <Card className="border-slate-200 bg-slate-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <ClipboardList className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Unplanned Work Orders
                </CardTitle>
                <p className="text-sm text-slate-600 mt-0.5">
                  {draftWorkOrders.length} draft work order{draftWorkOrders.length !== 1 ? 's' : ''} need scheduling
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {draftWorkOrders.slice(0, 5).map((wo) => {
                const job = jobs.find(j => j.id === wo.job_id);
                const woTasks = tasks.filter(t => t.work_order_id === wo.id);
                
                return (
                  <Link
                    key={wo.id}
                    to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                    className="block p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{wo.title}</p>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {job ? getBoatName(job.boat_id) : 'Unknown boat'}
                        </p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <Badge className="bg-slate-100 text-slate-700">
                            Draft
                          </Badge>
                          {woTasks.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                              <CheckCircle2 className="h-3 w-3" />
                              {woTasks.length} task{woTasks.length !== 1 ? 's' : ''}
                            </div>
                          )}
                          {(() => {
                            const vehicleDisplay = getVehicleDisplay(wo.id);
                            return vehicleDisplay && (
                              <div className="flex items-center gap-1 text-xs text-emerald-700">
                                <Truck className="h-3 w-3" />
                                {vehicleDisplay}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {draftWorkOrders.length > 5 && (
                <Button asChild variant="outline" size="sm" className="w-full mt-2">
                  <Link to={createPageUrl('WorkOrders')}>
                    View all {draftWorkOrders.length} draft work orders
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              to={createPageUrl('Jobs') + '?new=true'}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all"
            >
              <div className="p-3 rounded-xl bg-blue-100">
                <Briefcase className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">New Job</span>
            </Link>
            <Link
              to={createPageUrl('Customers') + '?new=true'}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all"
            >
              <div className="p-3 rounded-xl bg-emerald-100">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Add Customer</span>
            </Link>
            <Link
              to={createPageUrl('Boats') + '?new=true'}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-cyan-200 hover:bg-cyan-50/50 transition-all"
            >
              <div className="p-3 rounded-xl bg-cyan-100">
                <Ship className="h-5 w-5 text-cyan-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Add Boat</span>
            </Link>
            <Link
              to={createPageUrl('Inventory')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-amber-200 hover:bg-amber-50/50 transition-all"
            >
              <div className="p-3 rounded-xl bg-amber-100">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Inventory</span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Edit Work Order Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Work Order</DialogTitle>
          </DialogHeader>
          <WorkOrderForm
            workOrder={editingWorkOrder}
            jobs={jobs}
            technicians={technicians}
            customers={customers}
            boats={boats}
            onSave={handleSaveWorkOrder}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Schedule Full Screen Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] w-full h-full p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">Schedule</DialogTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (viewMode === 'calendar') goToToday();
                    else if (dispatchViewMode === 'day') goToDispatchToday();
                    else goToOverviewToday();
                  }}
                >
                  Today
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => {
                    if (viewMode === 'calendar') prevWeek();
                    else if (dispatchViewMode === 'day') prevDay();
                    else prevRange();
                  }}
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => {
                    if (viewMode === 'calendar') nextWeek();
                    else if (dispatchViewMode === 'day') nextDay();
                    else nextRange();
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="overflow-y-auto h-[calc(100%-80px)]">
            <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
                <TabsTrigger value="calendar" className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="dispatch" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Dispatch
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calendar" className="space-y-4">
                {loading ? (
                  <div className="grid grid-cols-7 gap-4">
                    {[1,2,3,4,5,6,7].map(i => (
                      <Skeleton key={i} className="h-64" />
                    ))}
                  </div>
                ) : (
                  <DragDropCalendar
                    currentWeekStart={currentWeekStart}
                    workOrders={workOrders}
                    jobs={jobs}
                    technicians={technicians}
                    customers={customers}
                    boats={boats}
                    locations={locations}
                    inventoryReservations={inventoryReservations}
                    onWorkOrderUpdate={handleWorkOrderUpdate}
                    onWorkOrderEdit={handleWorkOrderEditFromCalendar}
                    loading={loading}
                    viewType={calendarViewType}
                  />
                )}
              </TabsContent>

              <TabsContent value="dispatch" className="space-y-4">
                <div className="flex items-center gap-4">
                  <Tabs value={dispatchViewMode} onValueChange={setDispatchViewMode} className="w-full max-w-md">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="day">Day Timeline</TabsTrigger>
                      <TabsTrigger value="future">Future Overview</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {dispatchViewMode === 'day' && (
                  <>
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search by job, boat, or customer..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        <Select value={gridSize} onValueChange={setGridSize}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Grid size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30m">30 minutes</SelectItem>
                            <SelectItem value="1h">1 hour</SelectItem>
                            <SelectItem value="2h">2 hours</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={locationFilter} onValueChange={setLocationFilter}>
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="All Locations" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Locations</SelectItem>
                            {locations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {loading ? (
                      <Skeleton className="h-96" />
                    ) : (
                      <DispatchTimeline
                        technicians={technicians}
                        workOrders={workOrders}
                        jobs={jobs}
                        customers={customers}
                        boats={boats}
                        locations={locations}
                        selectedDate={dispatchDate}
                        viewMode={dispatchViewMode}
                        gridSize={gridSize}
                        locationFilter={locationFilter}
                        statusFilter={statusFilter}
                        technicianFilter={technicianFilter}
                        searchTerm={searchTerm}
                        onWorkOrderClick={handleWorkOrderClick}
                      />
                    )}
                  </>
                )}

                {dispatchViewMode === 'future' && (
                  <>
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search by job, boat, or customer..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        <Select value={rangeWeeks.toString()} onValueChange={(val) => setRangeWeeks(Number(val))}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4">4 weeks</SelectItem>
                            <SelectItem value="8">8 weeks</SelectItem>
                            <SelectItem value="12">12 weeks</SelectItem>
                            <SelectItem value="26">6 months</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={locationFilter} onValueChange={setLocationFilter}>
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="All Locations" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Locations</SelectItem>
                            {locations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {loading ? (
                      <Skeleton className="h-96" />
                    ) : (
                      <FutureOverview
                        technicians={technicians}
                        workOrders={workOrders}
                        jobs={jobs}
                        customers={customers}
                        boats={boats}
                        locations={locations}
                        startDate={overviewStartDate}
                        rangeWeeks={rangeWeeks}
                        locationFilter={locationFilter}
                        statusFilter={statusFilter}
                        technicianFilter={technicianFilter}
                        searchTerm={searchTerm}
                        showBlockedOnly={showBlockedOnly}
                        focusBlockedDays={focusBlockedDays}
                        onDateClick={handleOverviewDateClick}
                      />
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}