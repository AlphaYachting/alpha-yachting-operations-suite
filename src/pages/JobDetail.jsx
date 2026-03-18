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
  Edit,
  GripVertical,
  MoreVertical,
  Trash2,
  Printer,
  Loader2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { notifyWorkOrderAssignment } from '@/components/notifications/notificationUtils';

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
   const [deleteWorkOrder, setDeleteWorkOrder] = useState(null);
   const [showDeleteDialog, setShowDeleteDialog] = useState(false);
   const [showNewWorkOrderDialog, setShowNewWorkOrderDialog] = useState(false);
   const [printLoading, setPrintLoading] = useState(false);
   const [showPrintDialog, setShowPrintDialog] = useState(false);
   const [printLanguage, setPrintLanguage] = useState('de');

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

         let projectWOs = allWOs.filter(wo => wo.job_id === projectId);

         // Initialize sort_index if missing (batch update with error handling)
         const needsIndexInit = projectWOs.filter(wo => wo.sort_index === null || wo.sort_index === undefined);
         if (needsIndexInit.length > 0) {
           const initPromises = needsIndexInit.map(async (wo, idx) => {
             const sortIndex = projectWOs.indexOf(wo) + 1;
             wo.sort_index = sortIndex;
             try {
               await base44.entities.WorkOrder.update(wo.id, { sort_index: sortIndex });
             } catch (error) {
               console.error(`Failed to init sort_index for WO ${wo.id}:`, error.message);
               // Skip this WO if it no longer exists
             }
           });
           await Promise.all(initPromises);

           // Re-fetch to ensure we have current data
           const refreshedWOs = await base44.entities.WorkOrder.filter({ job_id: projectId });
           projectWOs = refreshedWOs;
         }

         // Sort by sort_index
         projectWOs.sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
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
      // Sanitize numeric fields: convert empty strings to null
      const numericFields = ['estimated_hours', 'actual_hours', 'estimated_cost', 'actual_cost', 'quote_amount'];
      const cleanedData = { ...projectData };
      numericFields.forEach(field => {
        if (cleanedData[field] === '' || cleanedData[field] === undefined) {
          cleanedData[field] = null;
        }
      });
      await base44.entities.Job.update(projectId, cleanedData);
      setShowEditDialog(false);
      toast.success('Project updated');
      await loadProjectData();
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    }
  };

  const handleSaveWorkOrder = async (woData, templateId, suggestedTasks, splitOptions = {}) => {
    const toastId = toast.loading(editingWorkOrder ? 'Updating work order...' : 'Creating work order...');

    try {
      if (editingWorkOrder) {
        // Preserve sort_index and work_order_number when updating
        const updateData = {
          ...woData,
          sort_index: editingWorkOrder.sort_index,
          work_order_number: editingWorkOrder.work_order_number
        };
        await base44.entities.WorkOrder.update(editingWorkOrder.id, updateData);
        
        // Notify newly assigned technicians
        const oldTechs = editingWorkOrder.assigned_technicians || [];
        const newTechs = updateData.assigned_technicians || [];
        const addedTechs = newTechs.filter(id => !oldTechs.includes(id));
        
        if (addedTechs.length > 0) {
          try {
            await notifyWorkOrderAssignment(
              { ...editingWorkOrder, ...updateData },
              allTechnicians,
              updateData.title
            );
          } catch (notifyError) {
            console.error('Failed to send work order assignment notifications:', notifyError);
          }
        }
        
        // Update local state without full reload to preserve sorting
        setWorkOrders(prev => prev.map(wo => 
          wo.id === editingWorkOrder.id ? { ...wo, ...updateData } : wo
        ));
        
        setShowWorkOrderDialog(false);
        setEditingWorkOrder(null);
        toast.success('Work order updated', { id: toastId });
      } else {
        // Check if dual WorkOrder creation is requested (need at least one task stream)
        const shouldSplit = splitOptions?.splitMode && 
                            (splitOptions?.orgTasks?.length > 0 || splitOptions?.execTasks?.length > 0);

        if (shouldSplit) {
          // Create dual WorkOrders (ORG + EXEC)
          const dualResponse = await base44.functions.invoke('createDualWorkOrders', {
            baseWorkOrderData: woData,
            orgTasks: splitOptions.orgTasks,
            execTasks: splitOptions.execTasks
          });

          if (!dualResponse.data?.success) {
            throw new Error(dualResponse.data?.error || 'Failed to create dual work orders');
          }

          toast.success('Created 2 linked WorkOrders: ORG + EXEC', { id: toastId });
          setShowNewWorkOrderDialog(false);
          await loadProjectData();
          return;
        }

        // Single WorkOrder creation (standard path)
        const response = await base44.functions.invoke('createWorkOrderWithNumber', woData);
        const result = response.data;
        if (!result.success) {
          throw new Error(result.error || 'Failed to create work order');
        }
        const createdWoId = result.work_order.id;

        // Create tasks in parallel
        const taskPromises = [];

        if (suggestedTasks?.length > 0) {
          taskPromises.push(...suggestedTasks.map((task, idx) =>
            base44.entities.Task.create({
              work_order_id: createdWoId,
              title: task.title,
              description: task.description || '',
              estimated_minutes: task.estimated_minutes || (task.estimated_hours ? Math.round(task.estimated_hours * 60) : null),
              task_stream: task.task_stream || 'EXECUTION',
              sequence_order: idx,
              status: 'Not Started'
            })
          ));
        }

        if (templateId) {
          const [user, templateItems] = await Promise.all([
            base44.auth.me(),
            base44.entities.TaskTemplateItem.filter({ template_list_id: templateId }, 'sort_order')
          ]);

          if (templateItems.length > 0) {
            taskPromises.push(...templateItems.map((item, idx) =>
              base44.entities.Task.create({
                work_order_id: createdWoId,
                title: item.title,
                description: item.description || '',
                estimated_minutes: item.default_estimated_hours ? Math.round(item.default_estimated_hours * 60) : null,
                sequence_order: (suggestedTasks?.length || 0) + idx,
                status: 'Not Started',
                notes: item.required_tools_note || '',
                requires_approval: item.requires_customer_approval || false
              })
            ));

            taskPromises.push(
              base44.entities.WorkOrderTemplateUsage.create({
                work_order_id: createdWoId,
                template_list_id: templateId,
                applied_at: new Date().toISOString(),
                applied_by: user.email,
                mode: 'full',
                selected_item_ids: templateItems.map(t => t.id)
              })
            );
          }
        }

        if (taskPromises.length > 0) {
          await Promise.all(taskPromises);
          toast.success(`Work order created with ${taskPromises.length} tasks`, { id: toastId });
        } else {
          toast.success('Work order created', { id: toastId });
        }

        // Notify assigned technicians
        if (woData.assigned_technicians?.length > 0) {
          try {
            await notifyWorkOrderAssignment(
              { ...result.work_order, ...woData },
              allTechnicians,
              woData.title
            );
          } catch (notifyError) {
            console.error('Failed to send work order assignment notifications:', notifyError);
          }
        }

        setShowNewWorkOrderDialog(false);
        await loadProjectData();
      }
    } catch (error) {
      console.error('Error saving work order:', error);
      toast.error(`Failed: ${error.message || 'Unknown error'}`, { id: toastId });
      throw error;
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

  const handleDragEnd = async (result) => {
   if (!result.destination) return;
   if (result.source.index === result.destination.index) return;

   const items = Array.from(workOrders);
   const [reorderedItem] = items.splice(result.source.index, 1);
   items.splice(result.destination.index, 0, reorderedItem);

   // Assign new sort_index values
   const updatedItems = items.map((wo, index) => ({
     ...wo,
     sort_index: index + 1
   }));

   // Update local state immediately for UI responsiveness
   setWorkOrders(updatedItems);

   // Batch update sort_index for all workorders
   try {
     await Promise.all(
       updatedItems.map((wo) => 
         base44.entities.WorkOrder.update(wo.id, { sort_index: wo.sort_index })
       )
     );
     toast.success('Work order order saved');
   } catch (error) {
     console.error('Error updating work order order:', error);
     toast.error('Failed to save order');
     // Reload on error to restore correct state
     await loadProjectData();
   }
  };

  const handleDeleteWorkOrder = async () => {
    if (!deleteWorkOrder) return;

    try {
      // Get all tasks for this workorder
      const woTasks = tasks.filter(t => t.work_order_id === deleteWorkOrder.id);
      
      // Delete tasks first (batch)
      if (woTasks.length > 0) {
        await Promise.all(
          woTasks.map(task => base44.entities.Task.delete(task.id))
        );
      }
      
      // Delete workorder
      await base44.entities.WorkOrder.delete(deleteWorkOrder.id);
      
      // Update local state immediately
      setWorkOrders(prev => prev.filter(wo => wo.id !== deleteWorkOrder.id));
      setTasks(prev => prev.filter(t => t.work_order_id !== deleteWorkOrder.id));
      
      toast.success('Work order and tasks deleted');
      setShowDeleteDialog(false);
      setDeleteWorkOrder(null);
    } catch (error) {
      console.error('Error deleting work order:', error);
      toast.error('Failed to delete work order');
    }
  };

  const handlePrintProjectSheet = async () => {
    setPrintLoading(true);
    try {
      const response = await base44.functions.invoke('printProjectSheet', {
        job_id: projectId
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Project_${project.job_number || project.id}_WorkSheet.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success('Project worksheet downloaded');
    } catch (error) {
      console.error('Error generating project sheet:', error);
      toast.error('Failed to generate project sheet');
    } finally {
      setPrintLoading(false);
    }
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handlePrintProjectSheet}
            disabled={printLoading}
            className="gap-2"
          >
            {printLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Print Project Sheet
          </Button>
          <Button onClick={() => setShowEditDialog(true)} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Project
          </Button>
        </div>
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
                <p className={`font-medium ${
                  (() => {
                    const totalPlannedHours = workOrders.reduce((sum, wo) => {
                      const hours = parseFloat(wo.estimated_duration_hours);
                      return sum + (isNaN(hours) ? 0 : hours);
                    }, 0);
                    const calculatedAmount = totalPlannedHours * 70;
                    return calculatedAmount > (project?.quote_amount || 0) ? 'text-red-600' : 'text-slate-900';
                  })()
                }`}>
                  {workOrders.reduce((sum, wo) => {
                    const hours = parseFloat(wo.estimated_duration_hours);
                    return sum + (isNaN(hours) ? 0 : hours);
                  }, 0).toFixed(1)} h
                </p>
                {(() => {
                  const totalPlannedHours = workOrders.reduce((sum, wo) => {
                    const hours = parseFloat(wo.estimated_duration_hours);
                    return sum + (isNaN(hours) ? 0 : hours);
                  }, 0);
                  const calculatedAmount = totalPlannedHours * 70;
                  if (calculatedAmount > (project?.quote_amount || 0)) {
                    return (
                      <p className="text-xs text-red-600 mt-1">
                        €{calculatedAmount.toFixed(0)} exceeds budget
                      </p>
                    );
                  }
                  return null;
                })()}
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
              <p className={`font-medium ${
                (() => {
                  const totalPlannedHours = workOrders.reduce((sum, wo) => {
                    const hours = parseFloat(wo.estimated_duration_hours);
                    return sum + (isNaN(hours) ? 0 : hours);
                  }, 0);
                  const calculatedAmount = totalPlannedHours * 70;
                  return calculatedAmount > (project?.quote_amount || 0) ? 'text-red-600' : 'text-slate-900';
                })()
              }`}>
                {workOrders.reduce((sum, wo) => {
                  const hours = parseFloat(wo.estimated_duration_hours);
                  return sum + (isNaN(hours) ? 0 : hours);
                }, 0).toFixed(1)} h
              </p>
              {(() => {
                const totalPlannedHours = workOrders.reduce((sum, wo) => {
                  const hours = parseFloat(wo.estimated_duration_hours);
                  return sum + (isNaN(hours) ? 0 : hours);
                }, 0);
                const calculatedAmount = totalPlannedHours * 70;
                if (calculatedAmount > (project?.quote_amount || 0)) {
                  return (
                    <p className="text-xs text-red-600 mt-1">
                      Calculated: €{calculatedAmount.toFixed(0)} (exceeds budget)
                    </p>
                  );
                }
                return null;
              })()}
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
          <Button size="sm" onClick={() => setShowNewWorkOrderDialog(true)}>
            Add Work Order
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
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="workorders">
              {(provided) => (
                <div 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  className="space-y-4"
                >
                  {workOrders.map((wo, index) => {
                    const woTasks = getTasksForWO(wo.id);
                    const woCompleted = woTasks.filter(t => t.status === 'Completed').length;
                    
                    return (
                      <Draggable key={wo.id} draggableId={wo.id} index={index}>
                        {(provided, snapshot) => (
                          <Card 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''}
                          >
                            <CardHeader>
                              <div className="flex items-start gap-3">
                                <div 
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing pt-1 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  <GripVertical className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{wo.title}</CardTitle>
                          <Badge className={statusColors[wo.status]}>{wo.status}</Badge>
                          <Badge variant="outline">{wo.work_order_number}</Badge>
                          {wo.workorder_type && wo.workorder_type !== 'STANDARD' && (
                            <Badge variant="outline" className={
                              wo.workorder_type === 'ORGANIZATION' 
                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                : 'bg-purple-50 text-purple-700 border-purple-300'
                            }>
                              {wo.workorder_type === 'ORGANIZATION' ? '📋 ORG' : '🔧 EXEC'}
                            </Badge>
                          )}
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setDeleteWorkOrder(wo);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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
                                    const updateData = { 
                                      status: 'Completed', 
                                      completed_at: new Date().toISOString(),
                                      work_order_id: wo.id,
                                      sequence_order: task.sequence_order || 0
                                    };
                                    await base44.entities.Task.update(task.id, updateData);
                                    // Update local state without full reload to preserve work order sorting
                                    setTasks(prev => prev.map(t => 
                                      t.id === task.id ? { ...t, ...updateData } : t
                                    ));
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
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
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
              preselectedJobId={project.id}
              onSave={handleSaveWorkOrder}
              onCancel={() => {
                setShowWorkOrderDialog(false);
                setEditingWorkOrder(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* New Work Order Dialog */}
      <Dialog open={showNewWorkOrderDialog} onOpenChange={setShowNewWorkOrderDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Work Order</DialogTitle>
          </DialogHeader>
          <WorkOrderForm
            jobs={[project]}
            technicians={allTechnicians}
            customers={allCustomers}
            boats={allBoats}
            preselectedJobId={project.id}
            onSave={handleSaveWorkOrder}
            onCancel={() => setShowNewWorkOrderDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Work Order Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Order?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to permanently delete:{' '}
                <span className="font-semibold text-slate-900">{deleteWorkOrder?.title}</span>
              </p>
              <p className="text-red-600 font-medium">
                {deleteWorkOrder && (() => {
                  const taskCount = tasks.filter(t => t.work_order_id === deleteWorkOrder.id).length;
                  return taskCount > 0
                    ? `⚠ This will also delete ${taskCount} task${taskCount === 1 ? '' : 's'} belonging to this work order.`
                    : 'All associated data will be permanently deleted.';
                })()}
              </p>
              <p className="text-sm">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setDeleteWorkOrder(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkOrder}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Work Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}