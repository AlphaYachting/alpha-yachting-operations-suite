import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Plus, 
  Search, 
  ClipboardList,
  Filter,
  MoreHorizontal,
  Calendar,
  Clock,
  Users,
  ChevronRight,
  MapPin,
  Timer,
  Camera,
  FileText,
  Truck
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import WorkOrderForm from '@/components/workorders/WorkOrderForm';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700',
  Scheduled: 'bg-blue-100 text-blue-700',
  Dispatched: 'bg-violet-100 text-violet-700',
  'In Transit': 'bg-indigo-100 text-indigo-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Paused: 'bg-orange-100 text-orange-700',
  'Waiting for Parts': 'bg-red-100 text-red-700',
  'Waiting for Approval': 'bg-pink-100 text-pink-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-slate-100 text-slate-700'
};

export default function WorkOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [boatFilter, setBoatFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-asc');
  const [detailsFilter, setDetailsFilter] = useState('all');
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [editingWorkOrder, setEditingWorkOrder] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const preselectedJobId = searchParams.get('job');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [woData, jobsData, techData, custData, boatsData, locData, timeEntries, photos, reservationsData, vehiclesData] = await Promise.all([
        base44.entities.WorkOrder.list('scheduled_date'),
        base44.entities.Job.list(),
        base44.entities.Technician.list(),
        base44.entities.Customer.list(),
        base44.entities.Boat.list(),
        base44.entities.Location.list(),
        base44.entities.TimeEntry.list(),
        base44.entities.WorkOrderPhoto.list(),
        base44.entities.InventoryReservation.filter({ status: 'Reserved' }),
        base44.entities.InventoryItem.filter({ category: 'Vehicles' })
      ]);

      // Calculate aggregates per work order
      const woAggregates = {};
      woData.forEach(wo => {
        const woTimeEntries = timeEntries.filter(te => te.work_order_id === wo.id);
        const woPhotos = photos.filter(p => p.work_order_id === wo.id);
        const woReservations = reservationsData.filter(r => r.work_order_id === wo.id);
        
        woAggregates[wo.id] = {
          timeEntryCount: woTimeEntries.length,
          timeEntryTotalMinutes: woTimeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0),
          photoCount: woPhotos.length,
          hasNotes: !!(wo.internal_notes && wo.internal_notes.trim().length > 0),
          vehicleReservations: woReservations
        };
      });

      setWorkOrders(woData.map(wo => ({ ...wo, _aggregates: woAggregates[wo.id] })));
      setJobs(jobsData);
      setTechnicians(techData);
      setCustomers(custData);
      setBoats(boatsData);
      setLocations(locData);
      setReservations(reservationsData);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (workOrderData) => {
    try {
      if (editingWorkOrder) {
        await base44.entities.WorkOrder.update(editingWorkOrder.id, workOrderData);
      } else {
        const woNumber = `WO${Date.now().toString().slice(-6)}`;
        await base44.entities.WorkOrder.create({ ...workOrderData, work_order_number: woNumber });
      }
      await loadData();
      setShowForm(false);
      setEditingWorkOrder(null);
      setSearchParams({});
    } catch (error) {
      console.error('Error saving work order:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this work order?')) {
      try {
        await base44.entities.WorkOrder.delete(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting work order:', error);
      }
    }
  };

  const handleQuickUpdate = async (woId, field, value) => {
    try {
      await base44.entities.WorkOrder.update(woId, { [field]: value });
      await loadData();
    } catch (error) {
      console.error('Error updating work order:', error);
    }
  };

  const getJobInfo = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { title: 'Unknown', customer: '', boat: '', location: '' };
    
    const customer = customers.find(c => c.id === job.customer_id);
    const boat = boats.find(b => b.id === job.boat_id);
    const location = locations.find(l => l.id === job.location_id);
    
    return {
      title: job.title,
      customer: customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown',
      boat: boat?.vessel_name || 'Unknown',
      location: location?.name || ''
    };
  };

  const getTechnicianNames = (techIds) => {
    if (!techIds || techIds.length === 0) return [];
    return techIds.map(id => {
      const tech = technicians.find(t => t.id === id);
      return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
    });
  };

  const getDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d, yyyy');
  };

  const getVehicleDisplay = (woReservations) => {
    if (!woReservations || woReservations.length === 0) return null;
    
    const uniqueVehicleIds = [...new Set(woReservations.map(r => r.inventory_item_id))];
    
    if (uniqueVehicleIds.length === 1) {
      const vehicle = vehicles.find(v => v.id === uniqueVehicleIds[0]);
      if (!vehicle) return null;
      return {
        display: vehicle.license_plate || `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.name,
        count: 1,
        vehicleId: vehicle.id,
        reservation: woReservations[0]
      };
    } else {
      return {
        display: 'Multiple',
        count: uniqueVehicleIds.length,
        vehicleId: null,
        reservations: woReservations
      };
    }
  };

  const filteredWorkOrders = workOrders.filter(wo => {
    const jobInfo = getJobInfo(wo.job_id);
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = wo.title?.toLowerCase().includes(searchLower) ||
      wo.work_order_number?.toLowerCase().includes(searchLower) ||
      jobInfo.customer.toLowerCase().includes(searchLower) ||
      jobInfo.boat.toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    
    const job = jobs.find(j => j.id === wo.job_id);
    const matchesBoat = boatFilter === 'all' || job?.boat_id === boatFilter;
    
    const agg = wo._aggregates || {};
    const matchesDetails = detailsFilter === 'all' ||
      (detailsFilter === 'time' && agg.timeEntryCount > 0) ||
      (detailsFilter === 'photos' && agg.photoCount > 0) ||
      (detailsFilter === 'notes' && agg.hasNotes);
    
    return matchesSearch && matchesStatus && matchesBoat && matchesDetails;
  }).sort((a, b) => {
    if (sortBy === 'date-asc') {
      return (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
    } else if (sortBy === 'date-desc') {
      return (b.scheduled_date || '').localeCompare(a.scheduled_date || '');
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Work Orders</h1>
          <p className="text-slate-500 mt-1">{workOrders.length} total work orders</p>
        </div>
        <Button 
          onClick={() => { setEditingWorkOrder(null); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Work Order
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search work orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Scheduled">Scheduled</SelectItem>
            <SelectItem value="Dispatched">Dispatched</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={detailsFilter} onValueChange={setDetailsFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Details" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Details</SelectItem>
            <SelectItem value="time">Has Time Entries</SelectItem>
            <SelectItem value="photos">Has Photos</SelectItem>
            <SelectItem value="notes">Has Notes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={boatFilter} onValueChange={setBoatFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Boats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Boats</SelectItem>
            {boats.map(boat => (
              <SelectItem key={boat.id} value={boat.id}>
                {boat.vessel_name}
              </SelectItem>
            ))}
            </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="date-asc">Date: Earliest First</SelectItem>
            <SelectItem value="date-desc">Date: Latest First</SelectItem>
            </SelectContent>
            </Select>
            </div>

      {/* Work Orders List */}
      {loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filteredWorkOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No work orders found</h3>
            <p className="text-slate-500 mt-1">Create your first work order to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredWorkOrders.map((wo) => {
            const jobInfo = getJobInfo(wo.job_id);
            const techNames = getTechnicianNames(wo.assigned_technicians);
            const agg = wo._aggregates || {};
            
            return (
              <Card key={wo.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link 
                          to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {wo.title}
                        </Link>
                        <Badge className={statusColors[wo.status]}>{wo.status}</Badge>
                      </div>
                      
                      <p className="text-sm text-slate-500 mt-1">
                        {jobInfo.customer} • {jobInfo.boat}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 mt-3">
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-44 justify-start text-xs">
                                <Calendar className="h-3 w-3 mr-2" />
                                {wo.scheduled_date ? format(parseISO(wo.scheduled_date), 'MMM d, yyyy') : 'Set date'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={wo.scheduled_date ? parseISO(wo.scheduled_date) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    handleQuickUpdate(wo.id, 'scheduled_date', format(date, 'yyyy-MM-dd'));
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={wo.status}
                            onValueChange={(value) => handleQuickUpdate(wo.id, 'status', value)}
                          >
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Draft">Draft</SelectItem>
                              <SelectItem value="Scheduled">Scheduled</SelectItem>
                              <SelectItem value="Dispatched">Dispatched</SelectItem>
                              <SelectItem value="In Transit">In Transit</SelectItem>
                              <SelectItem value="In Progress">In Progress</SelectItem>
                              <SelectItem value="Paused">Paused</SelectItem>
                              <SelectItem value="Waiting for Parts">Waiting for Parts</SelectItem>
                              <SelectItem value="Waiting for Approval">Waiting for Approval</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-slate-400" />
                          <Select
                            value={wo.assigned_technicians?.[0] || ''}
                            onValueChange={(value) => handleQuickUpdate(wo.id, 'assigned_technicians', value ? [value] : [])}
                          >
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue placeholder="Assign tech" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={null}>Unassigned</SelectItem>
                              {technicians.map(tech => (
                                <SelectItem key={tech.id} value={tech.id}>
                                  {tech.first_name} {tech.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {jobInfo.location && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <MapPin className="h-4 w-4" />
                            {jobInfo.location}
                          </div>
                        )}
                      </div>

                      {/* Details Chips */}
                      {(agg.timeEntryCount > 0 || agg.photoCount > 0 || agg.hasNotes || (agg.vehicleReservations && agg.vehicleReservations.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                          {(() => {
                            const vehicleInfo = getVehicleDisplay(agg.vehicleReservations);
                            return vehicleInfo && (
                              <Link 
                                to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                                className="group"
                              >
                                <Badge 
                                  variant="outline" 
                                  className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                                >
                                  <Truck className="h-3 w-3 mr-1" />
                                  {vehicleInfo.display} {vehicleInfo.count > 1 && `(+${vehicleInfo.count})`}
                                </Badge>
                              </Link>
                            );
                          })()}
                          {agg.timeEntryCount > 0 && (
                            <Link 
                              to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}#time`}
                              className="group"
                            >
                              <Badge 
                                variant="outline" 
                                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                <Timer className="h-3 w-3 mr-1" />
                                Time · {agg.timeEntryCount} · {Math.floor(agg.timeEntryTotalMinutes / 60)}h {agg.timeEntryTotalMinutes % 60}m
                              </Badge>
                            </Link>
                          )}
                          {agg.photoCount > 0 && (
                            <Link 
                              to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}#photos`}
                              className="group"
                            >
                              <Badge 
                                variant="outline" 
                                className="bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 transition-colors cursor-pointer"
                              >
                                <Camera className="h-3 w-3 mr-1" />
                                Photos · {agg.photoCount}
                              </Badge>
                            </Link>
                          )}
                          {agg.hasNotes && (
                            <Link 
                              to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}#notes`}
                              className="group"
                            >
                              <Badge 
                                variant="outline" 
                                className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Notes
                              </Badge>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingWorkOrder(wo); setShowForm(true); }}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(wo.id)}
                            className="text-red-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Work Order Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingWorkOrder(null); setSearchParams({}); }}}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWorkOrder ? 'Edit Work Order' : 'Create Work Order'}</DialogTitle>
          </DialogHeader>
          <WorkOrderForm
            workOrder={editingWorkOrder}
            jobs={jobs}
            technicians={technicians}
            customers={customers}
            boats={boats}
            preselectedJobId={preselectedJobId}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingWorkOrder(null); setSearchParams({}); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}