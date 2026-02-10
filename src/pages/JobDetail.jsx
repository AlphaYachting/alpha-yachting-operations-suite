import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft,
  Building2,
  Ship,
  MapPin,
  Calendar,
  User,
  Briefcase,
  ClipboardList,
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  AlertTriangle,
  Edit
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, isPast, isToday, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import JobForm from '@/components/jobs/JobForm';
import WorkOrderForm from '@/components/workorders/WorkOrderForm';

const statusColors = {
  New: 'bg-slate-100 text-slate-700',
  Quoted: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Scheduled: 'bg-purple-100 text-purple-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Waiting for Parts': 'bg-orange-100 text-orange-700',
  'On Hold': 'bg-red-100 text-red-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Invoiced: 'bg-teal-100 text-teal-700',
  Cancelled: 'bg-slate-100 text-slate-700'
};

const taskStatusColors = {
  'Not Started': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-green-100 text-green-700',
  'Not Possible': 'bg-red-100 text-red-700',
  'Needs Approval': 'bg-yellow-100 text-yellow-700',
  'Skipped': 'bg-slate-100 text-slate-700'
};

export default function ProjectDetail() {
   const [searchParams] = useSearchParams();
   const projectId = searchParams.get('id');

   const [project, setProject] = useState(null);
   const [customer, setCustomer] = useState(null);
   const [boat, setBoat] = useState(null);
   const [location, setLocation] = useState(null);
   const [workOrders, setWorkOrders] = useState([]);
   const [tasks, setTasks] = useState([]);
   const [teamOrders, setTeamOrders] = useState([]);
   const [loading, setLoading] = useState(true);
   const [showEditDialog, setShowEditDialog] = useState(false);
   const [allCustomers, setAllCustomers] = useState([]);
   const [allBoats, setAllBoats] = useState([]);
   const [allLocations, setAllLocations] = useState([]);
   const [allTechnicians, setAllTechnicians] = useState([]);
   const [leadTechnician, setLeadTechnician] = useState(null);
   const [editingWorkOrder, setEditingWorkOrder] = useState(null);
   const [showWorkOrderDialog, setShowWorkOrderDialog] = useState(false);

   useEffect(() => {
     if (projectId) {
       loadProjectData();
     }
   }, [projectId]);

   const loadProjectData = async () => {
     try {
       const [projectsData, allWOs, allTasks, customers, boats, locations, technicians, allTeamOrders] = await Promise.all([
         base44.entities.Job.list(),
         base44.entities.WorkOrder.list(),
         base44.entities.Task.list(),
         base44.entities.Customer.list(),
         base44.entities.Boat.list(),
         base44.entities.Location.list(),
         base44.entities.Technician.list(),
         base44.entities.TeamOrder.list()
       ]);

       const currentProject = projectsData.find(j => j.id === projectId);
       if (currentProject) {
         setProject(currentProject);
         setCustomer(customers.find(c => c.id === currentProject.customer_id));
         setBoat(boats.find(b => b.id === currentProject.boat_id));
         setLocation(locations.find(l => l.id === currentProject.location_id));
         setLeadTechnician(technicians.find(t => t.id === currentProject.lead_technician_id));
         setAllCustomers(customers);
         setAllBoats(boats);
         setAllLocations(locations);
         setAllTechnicians(technicians);

         const projectWOs = allWOs.filter(wo => wo.job_id === projectId);
         setWorkOrders(projectWOs);

         const woIds = projectWOs.map(wo => wo.id);
         const projectTasks = allTasks.filter(task => woIds.includes(task.work_order_id));
         setTasks(projectTasks);

         const projectTeamOrders = allTeamOrders.filter(to => woIds.includes(to.work_order_id));
         setTeamOrders(projectTeamOrders);
       }
     } catch (error) {
       console.error('Error loading project data:', error);
     } finally {
       setLoading(false);
     }
   };

  const getTasksForWO = (woId) => {
    return tasks.filter(t => t.work_order_id === woId).sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));
  };

  const handleSaveProject = async (projectData) => {
    try {
      await base44.entities.Job.update(projectId, projectData);
      setShowEditDialog(false);
      toast.success('Project updated');
      await loadProjectData();
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    }
  };

  const handleSaveWorkOrder = async (woData) => {
    try {
      await base44.entities.WorkOrder.update(editingWorkOrder.id, woData);
      setShowWorkOrderDialog(false);
      setEditingWorkOrder(null);
      toast.success('Work order updated');
      await loadProjectData();
    } catch (error) {
      console.error('Error updating work order:', error);
      toast.error('Failed to update work order');
    }
  };

  const getAssignedTechNames = (wo) => {
    if (!wo.assigned_technicians || wo.assigned_technicians.length === 0) return '—';
    return wo.assigned_technicians
      .map(techId => {
        const tech = allTechnicians.find(t => t.id === techId);
        return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
      })
      .join(', ');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">Project not found</h3>
        <Button asChild className="mt-4">
          <Link to={createPageUrl('Jobs')}>Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const isDueOverdue = project.requested_date && isPast(parseISO(project.requested_date)) && !isToday(parseISO(project.requested_date));
  const isDueToday = project.requested_date && isToday(parseISO(project.requested_date));
  const isDueSoon = project.requested_date && differenceInDays(parseISO(project.requested_date), new Date()) <= 7 && differenceInDays(parseISO(project.requested_date), new Date()) > 0;

  return (
    <div className="space-y-6">
      {/* Critical Due Date Alert */}
      {project.requested_date && (isDueOverdue || isDueToday) && (
        <Card className={`border-2 ${isDueOverdue ? 'border-red-500 bg-red-50' : 'border-amber-500 bg-amber-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-6 w-6 ${isDueOverdue ? 'text-red-700 animate-pulse' : 'text-amber-700 animate-pulse'}`} />
              <div>
                <p className={`font-bold text-lg ${isDueOverdue ? 'text-red-900' : 'text-amber-900'}`}>
                  {isDueOverdue ? 'CRITICAL: PROJECT OVERDUE' : 'URGENT: DUE TODAY'}
                </p>
                <p className={`text-sm ${isDueOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                  Project deadline: {format(parseISO(project.requested_date), 'MMMM d, yyyy')}
                  {isDueOverdue && ` (${Math.abs(differenceInDays(parseISO(project.requested_date), new Date()))} days overdue)`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={createPageUrl('Jobs')}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{project.title}</h1>
            <Badge className={statusColors[project.status]}>{project.status}</Badge>
            <Badge variant="outline">{project.job_number}</Badge>
            {project.requested_date && (
              <Badge className={`${
                isDueOverdue ? 'bg-red-600 text-white border-red-700 border-2' : 
                isDueToday ? 'bg-amber-600 text-white border-amber-700 border-2' : 
                isDueSoon ? 'bg-yellow-500 text-white border-yellow-600 border-2' : 
                'bg-blue-100 text-blue-700'
              }`}>
                <Calendar className="h-3 w-3 mr-1" />
                Due: {format(parseISO(project.requested_date), 'MMM d, yyyy')}
              </Badge>
            )}
          </div>
          <p className="text-slate-500 mt-1">{project.service_category} • {project.job_type}</p>
        </div>
        <Button onClick={() => setShowEditDialog(true)} className="gap-2">
          <Edit className="h-4 w-4" />
          Edit Project
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Customer</p>
                <p className="font-medium text-slate-900 truncate">
                  {customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Ship className="h-5 w-5 text-cyan-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Boat</p>
                <p className="font-medium text-slate-900 truncate">{boat?.vessel_name || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Location</p>
                <p className="font-medium text-slate-900 truncate">{location?.name || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <User className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Lead Technician</p>
                <p className="font-medium text-slate-900 truncate">
                  {leadTechnician ? `${leadTechnician.first_name} ${leadTechnician.last_name}` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Progress</p>
                <p className="font-medium text-slate-900">{progress}% ({completedTasks}/{totalTasks})</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Total Planned Hours</p>
                <p className="font-medium text-slate-900">
                  {workOrders.reduce((sum, wo) => {
                    const hours = parseFloat(wo.estimated_duration_hours);
                    return sum + (isNaN(hours) ? 0 : hours);
                  }, 0).toFixed(1)} h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Budget</p>
                <p className="font-medium text-slate-900">
                  {project.quote_amount ? `€${project.quote_amount.toFixed(2)}` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Team Order</p>
                <p className="font-medium text-slate-900">
                  {teamOrders.length > 0 ? `Yes (${teamOrders.length})` : 'No'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Priority</p>
              <p className="font-medium">{project.priority}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Intake Date</p>
              <p className="font-medium">
                {project.intake_date ? format(new Date(project.intake_date), 'MMM d, yyyy') : 'N/A'}
              </p>
            </div>
            <div className={project.requested_date && (isDueOverdue || isDueToday || isDueSoon) ? 'col-span-2' : ''}>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <AlertTriangle className={`h-3.5 w-3.5 ${project.requested_date ? 'text-red-600' : ''}`} />
                Project Due Date (Deadline)
              </p>
              <p className={`font-bold text-lg ${
                isDueOverdue ? 'text-red-700' : 
                isDueToday ? 'text-amber-700' : 
                isDueSoon ? 'text-yellow-700' : 
                'text-slate-900'
              }`}>
                {project.requested_date ? (
                  <>
                    {format(parseISO(project.requested_date), 'MMMM d, yyyy')}
                    {isDueOverdue && <span className="text-sm ml-2 text-red-600">({Math.abs(differenceInDays(parseISO(project.requested_date), new Date()))} days overdue)</span>}
                    {isDueToday && <span className="text-sm ml-2 text-amber-600">(Today!)</span>}
                    {isDueSoon && <span className="text-sm ml-2 text-orange-600">(in {differenceInDays(parseISO(project.requested_date), new Date())} days)</span>}
                  </>
                ) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Planned Hours (from Workorders)</p>
              <p className="font-medium">
                {workOrders.reduce((sum, wo) => {
                  const hours = parseFloat(wo.estimated_duration_hours);
                  return sum + (isNaN(hours) ? 0 : hours);
                }, 0).toFixed(1)} h
              </p>
            </div>
            {project.quote_amount && (
              <div>
                <p className="text-sm text-slate-500">Quote Amount</p>
                <p className="font-medium">€{project.quote_amount.toFixed(2)}</p>
              </div>
            )}
          </div>

          {project.description && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-slate-500 mb-1">Description</p>
                <p className="text-slate-700">{project.description}</p>
              </div>
            </>
          )}

          {project.internal_notes && (
            <div>
              <p className="text-sm text-slate-500 mb-1">Internal Notes</p>
              <p className="text-slate-700">{project.internal_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work Orders & Tasks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Work Orders & Tasks</h2>
          <Button asChild size="sm">
            <Link to={createPageUrl('WorkOrders') + `?job=${projectId}&new=true`}>
              Add Work Order
            </Link>
          </Button>
        </div>

        {workOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No work orders yet</h3>
              <p className="text-slate-500 mt-1">Create a work order to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {workOrders.map((wo) => {
              const woTasks = getTasksForWO(wo.id);
              const woCompleted = woTasks.filter(t => t.status === 'Completed').length;
              
              return (
                <Card key={wo.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{wo.title}</CardTitle>
                          <Badge className={statusColors[wo.status]}>{wo.status}</Badge>
                          <Badge variant="outline">{wo.work_order_number}</Badge>
                        </div>
                        {wo.scheduled_date && (
                          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(wo.scheduled_date), 'MMM d, yyyy')}
                            {wo.scheduled_start_time && ` at ${wo.scheduled_start_time}`}
                          </p>
                        )}
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap text-sm text-slate-600">
                            <User className="h-4 w-4" />
                            <span className="font-medium">Assigned to:</span>
                            {(!wo.assigned_technicians || wo.assigned_technicians.length === 0) ? (
                              <Badge className="bg-slate-100 text-slate-500">Not assigned</Badge>
                            ) : (
                              wo.assigned_technicians.map(techId => {
                                const tech = allTechnicians.find(t => t.id === techId);
                                const techName = tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
                                const techColor = tech?.color || '#3b82f6';
                                return (
                                  <Badge 
                                    key={techId} 
                                    className="font-semibold text-white"
                                    style={{ backgroundColor: techColor }}
                                  >
                                    {techName}
                                  </Badge>
                                );
                              })
                            )}
                          </div>
                          <p className="flex items-center gap-1 text-sm text-slate-600">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">Planned:</span> {(() => {
                              const hours = parseFloat(wo.estimated_duration_hours);
                              return isNaN(hours) ? '0 h' : `${hours} h`;
                            })()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setEditingWorkOrder(wo);
                            setShowWorkOrderDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}>
                            View Details
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {woTasks.length > 0 && (
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Tasks</span>
                          <span className="text-slate-700 font-medium">
                            {woCompleted} of {woTasks.length} completed
                          </span>
                        </div>
                        <div className="space-y-1">
                          {woTasks.map((task) => (
                            <div 
                              key={task.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              <button
                                onClick={async () => {
                                  if (task.status !== 'Completed') {
                                    await base44.entities.Task.update(task.id, { status: 'Completed', completed_at: new Date().toISOString() });
                                    loadProjectData();
                                  }
                                }}
                                disabled={task.status === 'Completed'}
                                className="flex-shrink-0 hover:scale-110 transition-transform disabled:cursor-not-allowed"
                              >
                                {task.status === 'Completed' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Circle className="h-4 w-4 text-slate-300 hover:text-green-500" />
                                )}
                              </button>
                              <span className={`flex-1 text-sm ${task.status === 'Completed' ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                                {task.title}
                              </span>
                              <Badge variant="outline" className={`text-xs ${taskStatusColors[task.status]}`}>
                                {task.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <JobForm
            job={project}
            customers={allCustomers}
            boats={allBoats}
            locations={allLocations}
            technicians={allTechnicians}
            onSave={handleSaveProject}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Work Order Dialog */}
      <Dialog open={showWorkOrderDialog} onOpenChange={setShowWorkOrderDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Work Order</DialogTitle>
          </DialogHeader>
          {editingWorkOrder && (
            <WorkOrderForm
              workOrder={editingWorkOrder}
              jobs={[project]}
              technicians={allTechnicians}
              customers={allCustomers}
              boats={allBoats}
              onSave={handleSaveWorkOrder}
              onCancel={() => {
                setShowWorkOrderDialog(false);
                setEditingWorkOrder(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}