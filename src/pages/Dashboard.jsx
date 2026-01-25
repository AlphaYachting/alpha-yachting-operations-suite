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
  Truck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, isToday, isTomorrow, parseISO, addDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import WorkOrderForm from '@/components/workorders/WorkOrderForm';

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const [jobsData, workOrdersData, tasksData, customersData, boatsData, techniciansData, reservationsData, vehiclesData] = await Promise.all([
          base44.entities.Job.list('-created_date', 100),
          base44.entities.WorkOrder.list('-scheduled_date', 100),
          base44.entities.Task.list(),
          base44.entities.Customer.list(),
          base44.entities.Boat.list(),
          base44.entities.Technician.list(),
          base44.entities.InventoryReservation.filter({ status: 'Reserved' }),
          base44.entities.InventoryItem.filter({ item_type: 'VEHICLE' })
        ]);
        setJobs(jobsData);
        setWorkOrders(workOrdersData);
        setTasks(tasksData);
        setCustomers(customersData);
        setBoats(boatsData);
        setTechnicians(techniciansData);
        setReservations(reservationsData);
        setVehicles(vehiclesData);
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to={createPageUrl('Schedule')}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </Link>
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
          title="Urgent Items" 
          value={urgentJobs.length} 
          icon={AlertTriangle}
          color="bg-amber-500"
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
                {jobs.slice(0, 5).map((job) => (
                  <Link
                    key={job.id}
                    to={createPageUrl('JobDetail') + `?id=${job.id}`}
                    className="block p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 truncate">{job.title}</p>
                          <Badge className={priorityColors[job.priority] || 'bg-slate-100'} variant="secondary">
                            {job.priority}
                          </Badge>
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
                ))}
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
    </div>
  );
}