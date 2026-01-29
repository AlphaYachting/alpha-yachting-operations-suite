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
  Camera,
  Plus,
  Edit,
  MoreVertical,
  ClipboardList,
  Save,
  FileText as FileTextIcon,
  Send,
  Eye,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { format, parseISO } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import TimeEntriesSection from '@/components/timeentries/TimeEntriesSection';
import PhotoUpload from '@/components/photos/PhotoUpload';
import PhotoGallery from '@/components/photos/PhotoGallery';
import VehicleReservation from '@/components/workorders/VehicleReservation';
import TaskForm from '@/components/tasks/TaskForm';
import QuickTaskUpdate from '@/components/tasks/QuickTaskUpdate';
import TemplateSelector from '@/components/templates/TemplateSelector';
import WorkOrderForm from '@/components/workorders/WorkOrderForm';
import TeamOrderCard from '@/components/teamorder/TeamOrderCard';
import { notifyTaskStatusChange } from '@/components/notifications/notificationUtils';
import RequirementsSection from '@/components/requirements/RequirementsSection';

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
  const [currentUser, setCurrentUser] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [quickUpdateTask, setQuickUpdateTask] = useState(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showEditWorkOrder, setShowEditWorkOrder] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('General Service');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [teamOrder, setTeamOrder] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [timeEntries, setTimeEntries] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    if (workOrderId) {
      loadWorkOrderDetails();
    }
  }, [workOrderId]);

  const loadCurrentUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadWorkOrderDetails = async () => {
    try {
      const [woData, allTasks, allTechs, allPhotos, teamOrders, allComments, allTimeEntries, allAccessLogs] = await Promise.all([
        base44.entities.WorkOrder.filter({ id: workOrderId }),
        base44.entities.Task.filter({ work_order_id: workOrderId }),
        base44.entities.Technician.list(),
        base44.entities.WorkOrderPhoto.filter({ work_order_id: workOrderId }, '-created_date'),
        base44.entities.TeamOrder.filter({ work_order_id: workOrderId }),
        base44.entities.WorkOrderComment.filter({ work_order_id: workOrderId }, '-created_date'),
        base44.entities.TimeEntry.filter({ work_order_id: workOrderId }, '-entry_date'),
        base44.entities.WorkOrderAccessLog.filter({ work_order_id: workOrderId }, '-accessed_at')
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
      setTeamOrder(teamOrders.length > 0 ? teamOrders[0] : null);
      setComments(allComments);
      setTimeEntries(allTimeEntries);
      setAccessLogs(allAccessLogs);

      if (wo.job_id) {
        const [projectData] = await base44.entities.Job.filter({ id: wo.job_id });
        if (projectData) {
          setJob(projectData);

          const [custData, boatData, locData] = await Promise.all([
            projectData.customer_id ? base44.entities.Customer.filter({ id: projectData.customer_id }) : Promise.resolve([]),
            projectData.boat_id ? base44.entities.Boat.filter({ id: projectData.boat_id }) : Promise.resolve([]),
            projectData.location_id ? base44.entities.Location.filter({ id: projectData.location_id }) : Promise.resolve([])
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

  const handleTaskSave = async (taskData) => {
    try {
      if (editingTask) {
        await base44.entities.Task.update(editingTask.id, taskData);
      } else {
        await base44.entities.Task.create(taskData);
      }
      await loadWorkOrderDetails();
      setShowTaskForm(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleQuickTaskUpdate = async (taskData) => {
    try {
      const oldStatus = quickUpdateTask.status;
      await base44.entities.Task.update(quickUpdateTask.id, taskData);
      
      // Send notification if status changed
      if (taskData.status && taskData.status !== oldStatus) {
        try {
          await notifyTaskStatusChange(
            { ...quickUpdateTask, ...taskData },
            workOrder,
            technicians,
            oldStatus,
            taskData.status
          );
        } catch (notifyError) {
          console.error('Failed to send task notification:', notifyError);
        }
      }
      
      await loadWorkOrderDetails();
      setQuickUpdateTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await base44.entities.Task.delete(taskId);
        await loadWorkOrderDetails();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    if (tasks.length === 0) {
      alert('No tasks to save as template');
      return;
    }
    
    setSavingTemplate(true);
    try {
      // Create template list
      const templateList = await base44.entities.TaskTemplateList.create({
        name: templateName,
        category: templateCategory,
        is_active: true
      });

      // Create template items from tasks
      const templateItems = tasks
        .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
        .map((task, index) => ({
          template_list_id: templateList.id,
          sort_order: index + 1,
          title: task.title,
          description: task.description || '',
          default_estimated_hours: task.estimated_minutes ? task.estimated_minutes / 60 : null,
          is_optional: false
        }));

      await base44.entities.TaskTemplateItem.bulkCreate(templateItems);

      alert(`Template "${templateName}" created successfully!`);
      setShowSaveAsTemplate(false);
      setTemplateName('');
      setTemplateCategory('General Service');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
    setSavingTemplate(false);
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    try {
      const newComment = {
        work_order_id: workOrderId,
        author_name: currentUser?.full_name || 'Unknown',
        author_email: currentUser?.email || '',
        content: commentText,
        comment_type: 'worker_note'
      };

      const savedComment = await base44.entities.WorkOrderComment.create(newComment);
      setComments([...comments, savedComment]);
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await base44.entities.WorkOrderComment.delete(commentId);
        setComments(comments.filter(c => c.id !== commentId));
      } catch (error) {
        console.error('Error deleting comment:', error);
      }
    }
  };

  const handleGenerateBrief = async () => {
    if (!teamOrder) return;

    setGeneratingBrief(true);
    try {
      // Fetch PDF template
      const templates = await base44.entities.PDFTemplate.list();
      const template = templates.find(t => t.is_default) || templates[0];

      if (!template) {
        alert('No PDF template found. Please create one in Settings.');
        setGeneratingBrief(false);
        return;
      }

      const response = await base44.functions.invoke('generatePartnerBrief', {
        workOrderId,
        teamOrderId: teamOrder.id,
        templateData: template
      });

      if (response.data.success && response.data.html) {
        // Open print dialog with HTML content
        const printWindow = window.open('', '_blank');
        printWindow.document.write(response.data.html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
      } else {
        alert('Failed to generate partner brief: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error generating partner brief:', error);
      alert('Error generating partner brief: ' + error.message);
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleDeleteWorkOrder = async () => {
    if (!window.confirm('Are you absolutely sure? This will permanently delete the work order and ALL associated data (tasks, photos, time entries, comments, etc.) with no recovery possible.')) {
      return;
    }

    setDeleting(true);
    try {
      // Delete all related data
      const [allTasks, allPhotos, allTimeEntries, allComments, allMaterials, allTeamOrders, allAccessLogs, allRequirements, allReservations] = await Promise.all([
        base44.entities.Task.filter({ work_order_id: workOrderId }),
        base44.entities.WorkOrderPhoto.filter({ work_order_id: workOrderId }),
        base44.entities.TimeEntry.filter({ work_order_id: workOrderId }),
        base44.entities.WorkOrderComment.filter({ work_order_id: workOrderId }),
        base44.entities.MaterialUsage.filter({ work_order_id: workOrderId }),
        base44.entities.TeamOrder.filter({ work_order_id: workOrderId }),
        base44.entities.WorkOrderAccessLog.filter({ work_order_id: workOrderId }),
        base44.entities.WorkOrderRequirementList.filter({ work_order_id: workOrderId }),
        base44.entities.InventoryReservation.filter({ work_order_id: workOrderId })
      ]);

      // Delete all tasks first (and their related data)
      for (const task of allTasks) {
        await base44.entities.Task.delete(task.id);
      }

      // Delete photos
      for (const photo of allPhotos) {
        await base44.entities.WorkOrderPhoto.delete(photo.id);
      }

      // Delete time entries
      for (const entry of allTimeEntries) {
        await base44.entities.TimeEntry.delete(entry.id);
      }

      // Delete comments
      for (const comment of allComments) {
        await base44.entities.WorkOrderComment.delete(comment.id);
      }

      // Delete material usage
      for (const material of allMaterials) {
        await base44.entities.MaterialUsage.delete(material.id);
      }

      // Delete team orders
      for (const order of allTeamOrders) {
        await base44.entities.TeamOrder.delete(order.id);
      }

      // Delete access logs
      for (const log of allAccessLogs) {
        await base44.entities.WorkOrderAccessLog.delete(log.id);
      }

      // Delete requirements
      for (const req of allRequirements) {
        await base44.entities.WorkOrderRequirementList.delete(req.id);
      }

      // Delete reservations
      for (const res of allReservations) {
        await base44.entities.InventoryReservation.delete(res.id);
      }

      // Finally, delete the work order itself
      await base44.entities.WorkOrder.delete(workOrderId);

      // Redirect to work orders list
      window.location.href = createPageUrl('WorkOrders');
    } catch (error) {
      console.error('Error deleting work order:', error);
      alert('Failed to delete work order: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };



  const isAdmin = currentUser?.role === 'admin';
  const canEditTasks = isAdmin;

  // Debug: log current user role
  console.log('Current user role:', currentUser?.role, 'isAdmin:', isAdmin);

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
        <div className="flex gap-2">
           <Button 
             asChild
             variant="outline"
             size="sm"
           >
             <Link to={createPageUrl('AccessLogs') + `?workOrderId=${workOrderId}`}>
               <Eye className="h-4 w-4 mr-2" />
               View Access Logs
             </Link>
           </Button>
           <Button onClick={() => setShowEditWorkOrder(true)}>
             <Edit className="h-4 w-4 mr-2" />
             Edit Work Order
           </Button>
           {isAdmin && (
             <Button 
               onClick={handleDeleteWorkOrder} 
               disabled={deleting}
               variant="destructive"
               size="sm"
             >
               <Trash2 className="h-4 w-4 mr-2" />
               {deleting ? 'Deleting...' : 'Delete'}
             </Button>
           )}
         </div>
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
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Team Order</p>
                {teamOrder ? (
                  <p className="text-sm font-semibold text-slate-900">{teamOrder.status}</p>
                ) : (
                  <p className="text-sm font-semibold text-slate-900">Not assigned</p>
                )}
                {teamOrder && (
                  <p className="text-xs text-slate-500">
                    Budget: €{(teamOrder.approved_budget_total || 0).toFixed(0)}
                  </p>
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

      {/* Team Order Section */}
      {teamOrder && (
        <>
          <TeamOrderCard
            teamOrder={teamOrder}
            workOrder={workOrder}
            onEdit={() => window.location.href = createPageUrl('TeamOrderDetail') + `?id=${teamOrder.id}`}
            onGenerateBrief={handleGenerateBrief}
            isGenerating={generatingBrief}
          />
        </>
      )}

      {!teamOrder && isAdmin && (
        <Card className="border-dashed border-2 border-purple-200 bg-purple-50/30">
          <CardContent className="p-6 text-center">
            <p className="text-slate-700 mb-4">No Team Order assigned for this work order</p>
            <Button
              onClick={() => window.location.href = createPageUrl('TeamOrderDetail') + `?workOrderId=${workOrderId}`}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Team Order
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Requirements / Shopping List Section */}
      <RequirementsSection
        workOrderId={workOrderId}
        workOrder={workOrder}
        currentUser={currentUser}
        isAdmin={isAdmin}
      />

      {/* Vehicle Reservation Section */}
      <VehicleReservation 
        workOrder={workOrder}
        onReservationChange={loadWorkOrderDetails}
      />

      {/* Time Entries Section */}
      <div id="time">
        <TimeEntriesSection 
          workOrderId={workOrderId}
          workOrder={workOrder}
          tasks={tasks}
          technicians={technicians}
          onTimeEntryAdded={loadWorkOrderDetails}
        />
        {/* Mobile Time Entries from Team App */}
        {timeEntries.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Mobile Time Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {timeEntries.map(entry => (
                  <div key={entry.id} className="flex justify-between py-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{format(parseISO(entry.entry_date), 'MMM d, yyyy')}</p>
                      {entry.notes && <p className="text-xs text-slate-500">{entry.notes}</p>}
                    </div>
                    <p className="font-semibold">{entry.duration_minutes} min</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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

      {/* Access Logs Section - Admin Only */}
      {isAdmin && accessLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Access Logs</CardTitle>
            <p className="text-sm text-slate-500 mt-1">When technicians viewed this work order</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accessLogs.map((log) => (
                <div key={log.id} className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold text-slate-900">{log.technician_email}</p>
                        <Badge variant="outline" className="text-xs">
                          {log.duration_seconds ? `${Math.round(log.duration_seconds / 60)}m` : 'Viewing'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
                        <div>
                          <p className="text-xs text-slate-500 font-medium mb-0.5">Accessed</p>
                          <p>{format(parseISO(log.accessed_at), 'MMM d, yyyy HH:mm:ss')}</p>
                        </div>
                        {log.closed_at && (
                          <div>
                            <p className="text-xs text-slate-500 font-medium mb-0.5">Closed</p>
                            <p>{format(parseISO(log.closed_at), 'MMM d, yyyy HH:mm:ss')}</p>
                          </div>
                        )}
                        {log.ip_address && (
                          <div>
                            <p className="text-xs text-slate-500 font-medium mb-0.5">IP Address</p>
                            <p className="font-mono text-xs">{log.ip_address}</p>
                          </div>
                        )}
                        {log.device_info && (
                          <div>
                            <p className="text-xs text-slate-500 font-medium mb-0.5">Device</p>
                            <p className="text-xs truncate" title={log.device_info}>{log.device_info.substring(0, 40)}...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Order Comments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Work Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Comment Input */}
          <div className="space-y-2">
            <Label>Leave a Note</Label>
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add notes, observations, or follow-up items..."
              rows={3}
              className="text-sm"
            />
            <Button
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>

          {/* Comments List */}
          {comments.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{comment.author_name}</p>
                      <p className="text-xs text-slate-500">{comment.author_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{format(parseISO(comment.created_date), 'MMM d, HH:mm')}</span>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete note"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{comment.content}</p>
                </div>
              ))}
            </div>
          )}

          {comments.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No notes yet. Add one to document your progress.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Tasks ({tasks.length})</CardTitle>
          {canEditTasks && (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowTemplateSelector(true)}
                variant="outline"
                size="sm"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                From Template
              </Button>
              {tasks.length > 0 && (
                <Button
                  onClick={() => setShowSaveAsTemplate(true)}
                  variant="outline"
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as Template
                </Button>
              )}
              <Button
                onClick={() => {
                  setEditingTask(null);
                  setShowTaskForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No tasks yet. {canEditTasks && 'Click "Add Task" to create one.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks
                .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
                .map((task) => (
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900">{task.title}</p>
                            {task.sequence_order > 0 && (
                              <Badge variant="outline" className="text-xs">
                                #{task.sequence_order}
                              </Badge>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                          )}
                          {task.notes && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                              <p className="text-xs font-medium text-blue-900">Notes:</p>
                              <p className="text-sm text-blue-800 mt-0.5">{task.notes}</p>
                            </div>
                          )}
                          {task.issue_notes && (
                            <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                              <p className="text-xs font-medium text-red-900">Issues:</p>
                              <p className="text-sm text-red-800 mt-0.5">{task.issue_notes}</p>
                            </div>
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
                      <div className="flex items-center gap-2">
                        <Badge className={taskStatusColors[task.status]}>
                          {task.status}
                        </Badge>
                        {canEditTasks && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingTask(task);
                                  setShowTaskForm(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Task
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Task
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Form Dialog */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          </DialogHeader>
          <TaskForm
            task={editingTask}
            workOrderId={workOrderId}
            technicians={technicians}
            onSave={handleTaskSave}
            onCancel={() => {
              setShowTaskForm(false);
              setEditingTask(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Quick Update Dialog (for non-admin users) */}
      <Dialog open={!!quickUpdateTask} onOpenChange={(open) => !open && setQuickUpdateTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Task Status</DialogTitle>
          </DialogHeader>
          {quickUpdateTask && (
            <QuickTaskUpdate
              task={quickUpdateTask}
              onSave={handleQuickTaskUpdate}
              onCancel={() => setQuickUpdateTask(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Template Selector Dialog */}
      <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Tasks from Template</DialogTitle>
          </DialogHeader>
          <TemplateSelector
            workOrderId={workOrderId}
            onApplied={() => {
              loadWorkOrderDetails();
              setShowTemplateSelector(false);
            }}
            onCancel={() => setShowTemplateSelector(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Work Order Dialog */}
      <Dialog open={showEditWorkOrder} onOpenChange={setShowEditWorkOrder}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Work Order</DialogTitle>
          </DialogHeader>
          {workOrder && job && (
            <WorkOrderForm
              workOrder={workOrder}
              jobs={job ? [job] : []}
              technicians={technicians}
              customers={customer ? [customer] : []}
              boats={boat ? [boat] : []}
              onSave={async (formData) => {
                try {
                  await base44.entities.WorkOrder.update(workOrderId, formData);
                  await loadWorkOrderDetails();
                  setShowEditWorkOrder(false);
                } catch (error) {
                  console.error('Error updating work order:', error);
                }
              }}
              onCancel={() => setShowEditWorkOrder(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Save as Template Dialog */}
      <Dialog open={showSaveAsTemplate} onOpenChange={setShowSaveAsTemplate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save Tasks as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Engine Service 50h"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Engine">Engine</SelectItem>
                  <SelectItem value="Electrical">Electrical</SelectItem>
                  <SelectItem value="Hull">Hull</SelectItem>
                  <SelectItem value="Commissioning">Commissioning</SelectItem>
                  <SelectItem value="Winterization">Winterization</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Plumbing">Plumbing</SelectItem>
                  <SelectItem value="Rigging">Rigging</SelectItem>
                  <SelectItem value="General Service">General Service</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-500">
              This will create a template with {tasks.length} tasks from this work order.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowSaveAsTemplate(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsTemplate} disabled={savingTemplate}>
              {savingTemplate ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}