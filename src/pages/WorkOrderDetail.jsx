import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Calendar,
  Clock,
  User,
  Users,
  MapPin,
  CheckCircle2,
  Circle,
  AlertCircle,
  Package,
  Camera
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import TimeEntriesSection from '@/components/timeentries/TimeEntriesSection';
import PhotoUpload from '@/components/photos/PhotoUpload';
import PhotoGallery from '@/components/photos/PhotoGallery';

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

const taskStatusColors = {
  'Not Started': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-emerald-100 text-emerald-700',
  'Not Possible': 'bg-red-100 text-red-700',
  'Needs Approval': 'bg-amber-100 text-amber-700',
  'Skipped': 'bg-slate-100 text-slate-500'
};

export default function WorkOrderDetail() {
  const [searchParams] = useSearchParams();
  const workOrderId = searchParams.get('id');

  const [workOrder, setWorkOrder] = useState(null);
  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [boat, setBoat] = useState(null);
  const [location, setLocation] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workOrderId) {
      loadWorkOrderDetails();
    }
  }, [workOrderId]);

  const loadWorkOrderDetails = async () => {
    try {
      const [woData, allTasks, allTechs, allPhotos] = await Promise.all([
        base44.entities.WorkOrder.filter({ id: workOrderId }),
        base44.entities.Task.filter({ work_order_id: workOrderId }),
        base44.entities.Technician.list(),
        base44.entities.WorkOrderPhoto.filter({ work_order_id: workOrderId }, '-created_date')
      ]);

      if (woData.length === 0) {
        setLoading(false);
        return;
      }

      const wo = woData[0];
      setWorkOrder(wo);
      setTasks(allTasks);
      setTechnicians(allTechs);
      setPhotos(allPhotos);

      if (wo.job_id) {
        const [jobData] = await base44.entities.Job.filter({ id: wo.job_id });
        if (jobData) {
          setJob(jobData);
          
          const [custData, boatData, locData] = await Promise.all([
            jobData.customer_id ? base44.entities.Customer.filter({ id: jobData.customer_id }) : Promise.resolve([]),
            jobData.boat_id ? base44.entities.Boat.filter({ id: jobData.boat_id }) : Promise.resolve([]),
            jobData.location_id ? base44.entities.Location.filter({ id: jobData.location_id }) : Promise.resolve([])
          ]);

          if (custData.length > 0) setCustomer(custData[0]);
          if (boatData.length > 0) setBoat(boatData[0]);
          if (locData.length > 0) setLocation(locData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading work order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTechnicianNames = (techIds) => {
    if (!techIds || techIds.length === 0) return 'Unassigned';
    return techIds.map(id => {
      const tech = technicians.find(t => t.id === id);
      return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
    }).join(', ');
  };

  const getLeadTechnicianName = (techId) => {
    if (!techId) return 'Not assigned';
    const tech = technicians.find(t => t.id === techId);
    return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">Work Order not found</h3>
        <p className="text-slate-500 mt-1">The work order you're looking for doesn't exist</p>
        <Button asChild className="mt-4">
          <Link to={createPageUrl('WorkOrders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Work Orders
          </Link>
        </Button>
      </div>
    );
  }

  const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown';
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const totalTasks = tasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Button asChild variant="ghost" size="sm" className="mb-3">
            <Link to={createPageUrl('WorkOrders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Work Orders
            </Link>
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{workOrder.title}</h1>
            <Badge className={statusColors[workOrder.status]}>{workOrder.status}</Badge>
          </div>
          <p className="text-slate-500 mt-1">
            WO #{workOrder.work_order_number || workOrder.id.slice(-6)}
          </p>
        </div>
        <Button asChild>
          <Link to={createPageUrl('WorkOrders')}>Edit Work Order</Link>
        </Button>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Scheduled</p>
                <p className="text-sm font-semibold text-slate-900">
                  {workOrder.scheduled_date ? format(parseISO(workOrder.scheduled_date), 'MMM d, yyyy') : 'Not scheduled'}
                </p>
                {workOrder.scheduled_start_time && (
                  <p className="text-xs text-slate-500">{workOrder.scheduled_start_time}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <User className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Customer</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{customerName}</p>
                <p className="text-xs text-slate-500 truncate">{boat?.vessel_name || 'Unknown boat'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Lead Technician</p>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {getLeadTechnicianName(workOrder.lead_technician_id)}
                </p>
                {workOrder.assigned_technicians?.length > 0 && (
                  <p className="text-xs text-slate-500">{workOrder.assigned_technicians.length} assigned</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <CheckCircle2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Progress</p>
                <p className="text-sm font-semibold text-slate-900">
                  {completedTasks}/{totalTasks} tasks
                </p>
                <p className="text-xs text-slate-500">{taskProgress}% complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work Order Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Work Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {workOrder.description && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Description</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{workOrder.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {location && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Location</p>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {location.name}
                </div>
              </div>
            )}

            {workOrder.estimated_duration_hours && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Estimated Duration</p>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {workOrder.estimated_duration_hours}h
                </div>
              </div>
            )}
          </div>

          {workOrder.safety_notes && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-900 mb-1">Safety Notes</p>
              <p className="text-sm text-amber-800">{workOrder.safety_notes}</p>
            </div>
          )}

          {workOrder.internal_notes && (
            <div id="notes">
              <p className="text-sm font-medium text-slate-700 mb-1">Internal Notes</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{workOrder.internal_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Entries Section */}
      <div id="time">
        <TimeEntriesSection 
          workOrderId={workOrderId}
          workOrder={workOrder}
          tasks={tasks}
          technicians={technicians}
        />
      </div>

      {/* Photo Documentation Section */}
      <div id="photos">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Camera className="h-5 w-5 text-blue-600" />
                Photo Documentation
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Before, during, and after photos
              </p>
            </div>
            <PhotoUpload 
              workOrderId={workOrderId}
              tasks={tasks}
              onSuccess={loadWorkOrderDetails}
            />
          </CardHeader>
          <CardContent>
            <PhotoGallery 
              photos={photos}
              tasks={tasks}
              onPhotoDeleted={loadWorkOrderDetails}
              onPhotoUpdated={loadWorkOrderDetails}
            />
          </CardContent>
        </Card>
      </div>

      {/* Tasks Section */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Tasks ({tasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-0.5">
                        {task.status === 'Completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : task.status === 'In Progress' ? (
                          <Clock className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}
                        {task.notes && (
                          <p className="text-sm text-slate-500 mt-2 italic">{task.notes}</p>
                        )}
                        {task.estimated_minutes && (
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-500">
                              Est: {Math.floor(task.estimated_minutes / 60)}h {task.estimated_minutes % 60}m
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={taskStatusColors[task.status]}>
                      {task.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}