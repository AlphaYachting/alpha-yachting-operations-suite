import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronDown,
  MapPin,
  Timer,
  Camera,
  FileText,
  Truck,
  Ship,
  LayoutList,
  Grip,
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Trash2
} from 'lucide-react';
import { notifyWorkOrderAssignment } from '@/components/notifications/notificationUtils';
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
import { toast } from 'sonner';
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
  const [statusFilter, setStatusFilter] = useState('Draft');
  const [boatFilter, setBoatFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-asc');
  const [detailsFilter, setDetailsFilter] = useState('all');
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [editingWorkOrder, setEditingWorkOrder] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('workOrdersViewMode') || 'list');
  const [expandedBoats, setExpandedBoats] = useState({});
  const [expandedWorkOrders, setExpandedWorkOrders] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const preselectedJobId = searchParams.get('job');

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.log('User not logged in');
      }
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    loadData();
    // Apply filter from dashboard
    const filterParam = searchParams.get('filter');
    if (filterParam === 'today') {
      setStatusFilter('all');
    } else if (filterParam === 'pending') {
      setStatusFilter('Draft');
    }
  }, [searchParams]);

  // Reload data when status filter changes
  useEffect(() => {
    if (!loading) {
      loadData();
    }
  }, [statusFilter]);

  const loadData = async () => {
    try {
      // Optimize: Only load work orders matching the current status filter
      const woQuery = statusFilter === 'all' 
        ? base44.entities.WorkOrder.list('scheduled_date', 100)
        : base44.entities.WorkOrder.filter({ status: statusFilter }, 'scheduled_date', 100);

      const woData = await woQuery;

      // Load all jobs (no limit) to ensure all referenced jobs are available
      const [jobsData, techData, custData, boatsData, locData, reservationsData, vehiclesData] = await Promise.all([
        base44.entities.Job.list('-created_date', 1000),
        base44.entities.Technician.list(),
        base44.entities.Customer.list('-created_date', 50),
        base44.entities.Boat.list('-created_date', 50),
        base44.entities.Location.list(),
        base44.entities.InventoryReservation.filter({ status: 'Reserved' }),
        base44.entities.InventoryItem.filter({ item_type: 'VEHICLE' })
      ]);

      // Only fetch related data for work orders being displayed
      const woIds = woData.map(wo => wo.id);
      const [timeEntries, photos, tasksData, allTeamOrders] = await Promise.all([
        base44.entities.TimeEntry.filter({ work_order_id: { $in: woIds } }),
        base44.entities.WorkOrderPhoto.filter({ work_order_id: { $in: woIds } }),
        base44.entities.Task.filter({ work_order_id: { $in: woIds } }),
        base44.entities.TeamOrder.filter({ work_order_id: { $in: woIds } })
      ]);

      const woAggregates = {};
      woData.forEach(wo => {
        const woTimeEntries = timeEntries.filter(te => te.work_order_id === wo.id);
        const woPhotos = photos.filter(p => p.work_order_id === wo.id);
        const woReservations = reservationsData.filter(r => r.work_order_id === wo.id);
        const woTasks = tasksData.filter(t => t.work_order_id === wo.id);
        const woTeamOrder = allTeamOrders.find(to => to.work_order_id === wo.id);

        const openTasks = woTasks.filter(t => t.status === 'Not Started' || t.status === 'In Progress');
        const blockedTasks = woTasks.filter(t => t.status === 'Needs Approval' || t.status === 'Not Possible');

        woAggregates[wo.id] = {
          timeEntryCount: woTimeEntries.length,
          timeEntryTotalMinutes: woTimeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0),
          photoCount: woPhotos.length,
          hasNotes: !!(wo.internal_notes && wo.internal_notes.trim().length > 0),
          vehicleReservations: woReservations,
          totalTasks: woTasks.length,
          openTasks: openTasks.length,
          blockedTasks: blockedTasks.length,
          completedTasks: woTasks.filter(t => t.status === 'Completed').length,
          nextOpenTasks: openTasks.slice(0, 3),
          hasTeamOrder: !!woTeamOrder
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
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (workOrderData, templateId, suggestedTasks) => {
    console.log('handleSave called with:', { workOrderData, templateId, suggestedTasks });
    try {
      let createdWoId;
      let savedWorkOrder;
      
      if (editingWorkOrder) {
        console.log('Updating existing work order...');
        await base44.entities.WorkOrder.update(editingWorkOrder.id, workOrderData);
        savedWorkOrder = { ...editingWorkOrder, ...workOrderData };
        
        // Check if new technicians were assigned
        const oldTechIds = editingWorkOrder.assigned_technicians || [];
        const newTechIds = workOrderData.assigned_technicians || [];
        const newlyAssigned = newTechIds.filter(id => !oldTechIds.includes(id));
        
        if (newlyAssigned.length > 0) {
          // Notify newly assigned technicians
          const newlyAssignedTechs = technicians.filter(t => newlyAssigned.includes(t.id));
          for (const tech of newlyAssignedTechs) {
            if (tech.email) {
              try {
                await notifyWorkOrderAssignment(
                  { ...savedWorkOrder, assigned_technicians: [tech.id] },
                  [tech],
                  workOrderData.title
                );
              } catch (notifyError) {
                console.error('Failed to send notification:', notifyError);
              }
            }
          }
        }
        
        toast.success('Work order updated');
      } else {
        console.log('Creating new work order...');
        const woNumber = `WO${Date.now().toString().slice(-6)}`;
        const newWo = await base44.entities.WorkOrder.create({ 
          ...workOrderData, 
          work_order_number: woNumber 
        });
        createdWoId = newWo.id;
        savedWorkOrder = newWo;
        console.log('Work order created:', createdWoId);
        
        // Send notifications to assigned technicians
        if (workOrderData.assigned_technicians && workOrderData.assigned_technicians.length > 0) {
          try {
            await notifyWorkOrderAssignment(newWo, technicians, workOrderData.title);
          } catch (notifyError) {
            console.error('Failed to send notifications:', notifyError);
          }
        }

        // If AI-suggested tasks, add them
        if (suggestedTasks && suggestedTasks.length > 0) {
          console.log('Adding AI-suggested tasks:', suggestedTasks.length);
          try {
            const taskPromises = suggestedTasks.map((task, idx) => {
              console.log(`Creating task ${idx + 1}:`, task.title);
              return base44.entities.Task.create({
                work_order_id: createdWoId,
                title: task.title,
                description: task.description || '',
                estimated_minutes: task.estimated_hours ? Math.round(task.estimated_hours * 60) : null,
                sequence_order: idx,
                status: 'Not Started'
              });
            });
            
            await Promise.all(taskPromises);
            console.log('All AI tasks created successfully');
            toast.success(`Work order created with ${suggestedTasks.length} AI-suggested tasks`);
          } catch (aiTaskError) {
            console.error('Error adding AI-suggested tasks:', aiTaskError);
            toast.error(`Work order created, but failed to add AI tasks: ${aiTaskError.message}`);
          }
        } else if (templateId) {
          toast.success('Work order created');
        } else {
          toast.success('Work order created');
        }

        // If template selected, apply it
        if (templateId) {
          console.log('Applying template:', templateId);
          try {
            const user = await base44.auth.me();
            const templateItems = await base44.entities.TaskTemplateItem.filter(
              { template_list_id: templateId },
              'sort_order'
            );

            if (templateItems.length > 0) {
              await Promise.all(
                templateItems.map((item, idx) =>
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
                )
              );

              await base44.entities.WorkOrderTemplateUsage.create({
                work_order_id: createdWoId,
                template_list_id: templateId,
                applied_at: new Date().toISOString(),
                applied_by: user.email,
                mode: 'full',
                selected_item_ids: templateItems.map(t => t.id)
              });
              console.log('Template applied successfully');
            }
          } catch (templateError) {
            console.error('Error applying template:', templateError);
            toast.error(`Template tasks failed: ${templateError.message}`);
          }
        }
      }
      
      console.log('Reloading data...');
      await loadData();
      console.log('Closing form...');
      setShowForm(false);
      setEditingWorkOrder(null);
      setSearchParams({});
      console.log('Save complete!');
    } catch (error) {
      console.error('Error saving work order:', error);
      toast.error(`Failed to save work order: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you absolutely sure? This will permanently delete the work order and ALL associated data (tasks, photos, time entries, comments, etc.) with no recovery possible.')) {
      return;
    }

    setDeleting(true);
    try {
      // Delete all related data
      const [allTasks, allPhotos, allTimeEntries, allComments, allMaterials, allTeamOrders, allAccessLogs, allRequirements, allReservations] = await Promise.all([
        base44.entities.Task.filter({ work_order_id: id }),
        base44.entities.WorkOrderPhoto.filter({ work_order_id: id }),
        base44.entities.TimeEntry.filter({ work_order_id: id }),
        base44.entities.WorkOrderComment.filter({ work_order_id: id }),
        base44.entities.MaterialUsage.filter({ work_order_id: id }),
        base44.entities.TeamOrder.filter({ work_order_id: id }),
        base44.entities.WorkOrderAccessLog.filter({ work_order_id: id }),
        base44.entities.WorkOrderRequirementList.filter({ work_order_id: id }),
        base44.entities.InventoryReservation.filter({ work_order_id: id })
      ]);

      // Delete all tasks
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
      await base44.entities.WorkOrder.delete(id);

      toast.success('Work order and all associated data deleted');
      await loadData();
    } catch (error) {
      console.error('Error deleting work order:', error);
      toast.error('Failed to delete work order');
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickUpdate = async (woId, field, value) => {
    try {
      await base44.entities.WorkOrder.update(woId, { [field]: value });
      // Optimistic update - only refresh affected work order
      setWorkOrders(prev => prev.map(wo => wo.id === woId ? { ...wo, [field]: value } : wo));
    } catch (error) {
      console.error('Error updating work order:', error);
    }
  };

  // Memoized lookup maps for O(1) access
  const jobMap = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);
  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c])), [customers]);
  const boatMap = useMemo(() => Object.fromEntries(boats.map(b => [b.id, b])), [boats]);
  const locationMap = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);
  const techMap = useMemo(() => Object.fromEntries(technicians.map(t => [t.id, t])), [technicians]);
  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map(v => [v.id, v])), [vehicles]);

  const getProjectInfo = useMemo(() => {
    return (projectId) => {
      if (!projectId) return { title: 'Unknown', customer: '', boat: '', location: '' };
      
      const project = jobMap[projectId];
      if (!project) {
        console.warn(`Job ${projectId} not found in jobMap. Available jobs:`, Object.keys(jobMap));
        return { title: 'Unknown', customer: '', boat: '', location: '' };
      }

      const customer = customerMap[project.customer_id];
      const boat = boatMap[project.boat_id];
      const location = locationMap[project.location_id];

      return {
        title: project.title || 'Untitled Project',
        customer: customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown',
        boat: boat?.vessel_name || 'Unknown',
        location: location?.name || ''
      };
    };
  }, [jobMap, customerMap, boatMap, locationMap]);

  const getTechnicianNames = useMemo(() => {
    return (techIds) => {
      if (!techIds || techIds.length === 0) return [];
      return techIds.map(id => {
        const tech = techMap[id];
        return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
      });
    };
  }, [techMap]);

  const getDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d, yyyy');
  };

  const getVehicleDisplay = useMemo(() => {
    return (woReservations) => {
      if (!woReservations || woReservations.length === 0) return null;

      const uniqueVehicleIds = [...new Set(woReservations.map(r => r.inventory_item_id))];

      if (uniqueVehicleIds.length === 1) {
        const vehicle = vehicleMap[uniqueVehicleIds[0]];
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
  }, [vehicleMap]);

  const getTeamOrderInfo = async (woId) => {
    try {
      const teamOrders = await base44.entities.TeamOrder.filter({ work_order_id: woId });
      return teamOrders.length > 0 ? teamOrders[0] : null;
    } catch (error) {
      console.error('Error fetching team order:', error);
      return null;
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('workOrdersViewMode', mode);
  };

  const toggleBoatExpand = (boatId) => {
    setExpandedBoats(prev => ({ ...prev, [boatId]: !prev[boatId] }));
  };

  const toggleWorkOrderExpand = (woId) => {
    setExpandedWorkOrders(prev => ({ ...prev, [woId]: !prev[woId] }));
  };

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      const projectInfo = getProjectInfo(wo.job_id);
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = wo.title?.toLowerCase().includes(searchLower) ||
        wo.work_order_number?.toLowerCase().includes(searchLower) ||
        projectInfo.customer.toLowerCase().includes(searchLower) ||
        projectInfo.boat.toLowerCase().includes(searchLower);

      const filterParam = searchParams.get('filter');
      let matchesFilter = true;

      if (filterParam === 'today') {
        const today = new Date();
        matchesFilter = wo.scheduled_date && isToday(parseISO(wo.scheduled_date)) && wo.status !== 'Completed' && wo.status !== 'Cancelled';
      } else if (filterParam === 'pending') {
        matchesFilter = wo.status === 'Draft';
      }

      const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;

      const job = jobMap[wo.job_id];
      const matchesBoat = boatFilter === 'all' || job?.boat_id === boatFilter;

      const agg = wo._aggregates || {};
      const matchesDetails = detailsFilter === 'all' ||
        (detailsFilter === 'time' && agg.timeEntryCount > 0) ||
        (detailsFilter === 'photos' && agg.photoCount > 0) ||
        (detailsFilter === 'notes' && agg.hasNotes);

      return matchesSearch && matchesStatus && matchesBoat && matchesDetails && matchesFilter;
    });
  }, [workOrders, searchTerm, statusFilter, boatFilter, sortBy, detailsFilter, searchParams, getProjectInfo, jobMap]);

  const getBoatInfo = useMemo(() => {
    return (boatId) => {
      const boat = boatMap[boatId];
      if (!boat) return null;
      
      const boatWorkOrders = filteredWorkOrders.filter(wo => {
        const job = jobMap[wo.job_id];
        return job?.boat_id === boatId;
      });
      
      const nextScheduledWO = boatWorkOrders
        .filter(wo => wo.scheduled_date && wo.status !== 'Completed' && wo.status !== 'Cancelled')
        .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))[0];
      
      const totalOpenTasks = boatWorkOrders.reduce((sum, wo) => sum + (wo._aggregates?.openTasks || 0), 0);
      const totalBlocked = boatWorkOrders.reduce((sum, wo) => sum + (wo._aggregates?.blockedTasks || 0), 0);
      const unassignedCount = boatWorkOrders.filter(wo => !wo.assigned_technicians || wo.assigned_technicians.length === 0).length;
      
      const firstJob = boatWorkOrders.length > 0 ? jobMap[boatWorkOrders[0].job_id] : null;
      const customer = firstJob ? customerMap[firstJob.customer_id] : null;
      const location = firstJob ? locationMap[firstJob.location_id] : null;
      
      const openWOCount = boatWorkOrders.filter(wo => wo.status !== 'Completed' && wo.status !== 'Cancelled').length;
      
      return { boat, customer, location, workOrderCount: boatWorkOrders.length, openWOCount, nextScheduledDate: nextScheduledWO?.scheduled_date, totalOpenTasks, attentionCount: totalBlocked + unassignedCount };
    };
  }, [boatMap, jobMap, customerMap, locationMap, filteredWorkOrders]);

  // Filter boats to only show those with work orders (client-side, no DB calls)
  const boatsWithWorkOrders = useMemo(() => {
    const boatIds = new Set(
      workOrders.map(wo => {
        const job = jobMap[wo.job_id];
        return job?.boat_id;
      }).filter(Boolean)
    );
    return boats.filter(boat => boatIds.has(boat.id));
  }, [boats, workOrders, jobMap]);

  const groupedByBoat = useMemo(() => {
    const groups = {};
    filteredWorkOrders.forEach(wo => {
      const job = jobMap[wo.job_id];
      const boatId = job?.boat_id || 'unknown';
      if (!groups[boatId]) groups[boatId] = [];
      groups[boatId].push(wo);
    });
    Object.keys(groups).forEach(boatId => {
      groups[boatId].sort((a, b) => {
        const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
        if (dateCompare !== 0) return dateCompare;
        const priorityOrder = { 'Urgent': 0, 'Express': 1, 'High': 2, 'Normal': 3, 'Low': 4 };
        const jobA = jobMap[a.job_id];
        const jobB = jobMap[b.job_id];
        return (priorityOrder[jobA?.priority] || 99) - (priorityOrder[jobB?.priority] || 99);
      });
    });
    return groups;
  }, [filteredWorkOrders, jobMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Work Orders</h1>
          <p className="text-slate-500 mt-1">{workOrders.length} work orders</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleViewModeChange('list')}
              className={viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-slate-200'}
            >
              <LayoutList className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button
              variant={viewMode === 'byboat' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleViewModeChange('byboat')}
              className={viewMode === 'byboat' ? 'bg-white shadow-sm' : 'hover:bg-slate-200'}
            >
              <Ship className="h-4 w-4 mr-2" />
              By Boat
            </Button>
          </div>
          <Button 
            onClick={() => { setEditingWorkOrder(null); setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Work Order
          </Button>
        </div>
      </div>

      {/* Performance Info Banner */}
      {statusFilter === 'Draft' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 text-sm text-blue-900">
              <AlertCircle className="h-4 w-4" />
              <span>Showing only <strong>Draft</strong> work orders for better performance. Change status filter to see all work orders.</span>
            </div>
          </CardContent>
        </Card>
      )}

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
        <Select value={boatFilter} onValueChange={setBoatFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Boats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Boats ({boatsWithWorkOrders.length})</SelectItem>
            {boatsWithWorkOrders.map(boat => (
              <SelectItem key={boat.id} value={boat.id}>
                {boat.vessel_name}
              </SelectItem>
            ))}
            </SelectContent>
            </Select>
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
            <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="unsorted">Unsorted (Fastest)</SelectItem>
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
      ) : viewMode === 'list' ? (
        <div className="grid gap-4">
          {filteredWorkOrders.map((wo) => {
            const projectInfo = getProjectInfo(wo.job_id);
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
                        {agg.hasTeamOrder && (
                          <Badge 
                            variant="outline" 
                            className="bg-purple-50 text-purple-700 border-purple-200"
                          >
                            <Briefcase className="h-3 w-3 mr-1" />
                            Team Order
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-slate-500 mt-1">
                        <span className="font-medium text-slate-700">{projectInfo.title}</span>
                        {' • '}
                        {projectInfo.customer} • {projectInfo.boat}
                        {(() => {
                          const job = jobMap[wo.job_id];
                          const boat = job ? boatMap[job.boat_id] : null;
                          return boat?.vessel_type ? ` • ${boat.vessel_type}` : '';
                        })()}
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

                        <div className="flex items-center gap-1">
                           <Timer className="h-4 w-4 text-slate-400" />
                           <Input
                             type="number"
                             min="0"
                             step="0.5"
                             placeholder="hrs"
                             defaultValue={wo.estimated_duration_hours || ''}
                             onBlur={(e) => {
                               const value = e.target.value ? parseFloat(e.target.value) : null;
                               if (value !== wo.estimated_duration_hours) {
                                 handleQuickUpdate(wo.id, 'estimated_duration_hours', value);
                               }
                             }}
                             className="h-8 w-20 text-xs"
                           />
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

                        {projectInfo.location && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <MapPin className="h-4 w-4" />
                            {projectInfo.location}
                          </div>
                        )}
                      </div>

                      {/* Task Preview */}
                      {agg.nextOpenTasks && agg.nextOpenTasks.length > 0 && (
                        <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-xs font-medium text-slate-600 mb-1">
                            Tasks: {agg.completedTasks}/{agg.totalTasks} done
                          </p>
                          <div className="space-y-1">
                            {agg.nextOpenTasks.slice(0, 2).map((task) => {
                              if (!task || !task.id) return null;
                              return (
                                <div key={task.id} className="flex items-center gap-2 text-xs">
                                  <div className={`h-1.5 w-1.5 rounded-full ${task.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                                  <span className="text-slate-700 line-clamp-1">{task.title || 'Untitled Task'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

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
                          {currentUser?.role === 'admin' && (
                            <DropdownMenuItem 
                              onClick={() => handleDelete(wo.id)}
                              disabled={deleting}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {deleting ? 'Deleting...' : 'Delete All'}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* By Boat View */
          <div className="space-y-4">
            <div className="space-y-4">
              {Object.entries(groupedByBoat).map(([boatId, boatWorkOrders]) => {
            const boatInfo = getBoatInfo(boatId);
            const isExpanded = expandedBoats[boatId] !== false; // Default expanded
            
            if (!boatInfo) return null;
            
            const customerName = boatInfo.customer?.company_name || 
              `${boatInfo.customer?.first_name || ''} ${boatInfo.customer?.last_name || ''}`.trim() || 
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
                          <h3 className="font-semibold text-slate-900">{boatInfo.boat.vessel_name}</h3>
                          {boatInfo.boat.manufacturer && boatInfo.boat.model && (
                            <span className="text-sm text-slate-500">
                              {boatInfo.boat.manufacturer} {boatInfo.boat.model}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">{customerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {boatInfo.attentionCount > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-red-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {boatInfo.attentionCount} need attention
                        </Badge>
                      )}
                      {boatInfo.openWOCount > 0 && (
                        <Badge variant="outline" className="bg-white">
                          {boatInfo.openWOCount} open
                        </Badge>
                      )}
                      {boatInfo.nextScheduledDate && (
                        <div className="flex items-center gap-1 text-sm font-medium text-slate-700">
                          <Calendar className="h-4 w-4" />
                          {format(parseISO(boatInfo.nextScheduledDate), 'MMM d')}
                        </div>
                      )}
                      {boatInfo.location && (
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {boatInfo.location.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Work Orders for this boat */}
                {isExpanded && (
                  <CardContent className="p-0">
                    {boatWorkOrders.map((wo, idx) => {
                      const projectInfo = getProjectInfo(wo.job_id);
                      const techNames = getTechnicianNames(wo.assigned_technicians);
                      const agg = wo._aggregates || {};
                      const isWoExpanded = expandedWorkOrders[wo.id];
                      
                      return (
                        <div 
                          key={wo.id} 
                          className={`p-4 ${idx < boatWorkOrders.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {/* A) Header Line - Highest Priority */}
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 -ml-1"
                                  onClick={() => toggleWorkOrderExpand(wo.id)}
                                >
                                  <ChevronRight className={`h-4 w-4 transition-transform ${isWoExpanded ? 'rotate-90' : ''}`} />
                                </Button>
                                <Link 
                                  to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                                  className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                                >
                                  {wo.title}
                                </Link>
                                <Badge className={statusColors[wo.status]}>{wo.status}</Badge>
                                
                                {/* Critical Warnings - Only if present */}
                                {agg.blockedTasks > 0 && (
                                  <Badge className="bg-red-100 text-red-700 border-red-200">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {agg.blockedTasks} blocked
                                  </Badge>
                                )}
                                {(!wo.assigned_technicians || wo.assigned_technicians.length === 0) && wo.status !== 'Completed' && wo.status !== 'Cancelled' && (
                                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Unassigned
                                  </Badge>
                                )}
                              </div>

                              {/* Project Reference Line - Show parent job */}
                              <div className="ml-7 mb-2">
                                <Link 
                                  to={createPageUrl('JobDetail') + `?id=${wo.job_id}`}
                                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                >
                                  Project: {projectInfo.title}
                                </Link>
                              </div>

                              {/* B) Schedule & Responsibility Line - Second Priority */}
                              <div className="flex flex-wrap items-center gap-3 ml-7 mb-2 text-sm">
                                {wo.scheduled_date ? (
                                  <div className="flex items-center gap-1 text-slate-700 font-medium">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {format(parseISO(wo.scheduled_date), 'MMM d, yyyy')}
                                    {wo.scheduled_start_time && wo.scheduled_end_time && (
                                      <span className="text-slate-500 ml-1">
                                        {wo.scheduled_start_time}–{wo.scheduled_end_time}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="bg-slate-50 text-slate-600">
                                    Not scheduled
                                  </Badge>
                                )}
                                
                                <div className="flex items-center gap-1 text-slate-600">
                                   <Users className="h-3.5 w-3.5" />
                                   {techNames.length > 0 ? techNames.join(', ') : (
                                     <span className="text-slate-400 italic">Unassigned</span>
                                   )}
                                 </div>

                                 <div className="flex items-center gap-1 text-slate-600">
                                   <Timer className="h-3.5 w-3.5" />
                                   <input
                                     type="number"
                                     min="0"
                                     step="0.5"
                                     placeholder="Est. hrs"
                                     defaultValue={wo.estimated_duration_hours || ''}
                                     onBlur={(e) => {
                                       const value = e.target.value ? parseFloat(e.target.value) : null;
                                       if (value !== wo.estimated_duration_hours) {
                                         handleQuickUpdate(wo.id, 'estimated_duration_hours', value);
                                       }
                                     }}
                                     className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs text-slate-700"
                                   />
                                   <span className="text-slate-500 text-xs">hrs</span>
                                 </div>
                                </div>

                              {/* C) Resources Line - Third Priority */}
                              <div className="flex flex-wrap items-center gap-2 ml-7 mb-2">
                                {(() => {
                                  const vehicleInfo = getVehicleDisplay(agg.vehicleReservations);
                                  return vehicleInfo && (
                                    <div className="flex items-center gap-1 text-sm text-emerald-700 font-medium">
                                      <Truck className="h-3.5 w-3.5" />
                                      {vehicleInfo.display}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* D) Documentation Line - Fourth Priority (compact chips) */}
                              {(agg.timeEntryCount > 0 || agg.photoCount > 0 || agg.hasNotes || agg.hasTeamOrder) && (
                                <div className="flex flex-wrap items-center gap-2 ml-7 mb-2">
                                  {agg.hasTeamOrder && (
                                    <Link 
                                      to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                                      className="group"
                                    >
                                      <Badge 
                                        variant="outline" 
                                        className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors text-xs cursor-pointer"
                                      >
                                        <Briefcase className="h-3 w-3 mr-1" />
                                        Team Order
                                      </Badge>
                                    </Link>
                                  )}
                                  {agg.timeEntryCount > 0 && (
                                    <Link 
                                      to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}#time`}
                                      className="group"
                                    >
                                      <Badge 
                                        variant="outline" 
                                        className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors text-xs cursor-pointer"
                                      >
                                        <Timer className="h-3 w-3 mr-1" />
                                        {Math.floor(agg.timeEntryTotalMinutes / 60)}h {agg.timeEntryTotalMinutes % 60}m
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
                                        className="bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 transition-colors text-xs cursor-pointer"
                                      >
                                        <Camera className="h-3 w-3 mr-1" />
                                        {agg.photoCount}
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
                                        className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors text-xs cursor-pointer"
                                      >
                                        <FileText className="h-3 w-3 mr-1" />
                                        Notes
                                      </Badge>
                                    </Link>
                                  )}
                                </div>
                              )}

                              {/* E) Task Preview - Collapsible, only show if blocked or expanded */}
                              {(agg.blockedTasks > 0 || (agg.nextOpenTasks && agg.nextOpenTasks.length > 0 && (isWoExpanded || wo.status === 'In Progress'))) && (
                                <div className="ml-7 mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium text-slate-600">
                                      Tasks: {agg.completedTasks}/{agg.totalTasks} done
                                      {agg.blockedTasks > 0 && (
                                        <span className="text-red-600 ml-2">• {agg.blockedTasks} blocked</span>
                                      )}
                                    </p>
                                  </div>
                                  {agg.nextOpenTasks && agg.nextOpenTasks.length > 0 && (
                                    <div className="space-y-1">
                                      {agg.nextOpenTasks.slice(0, 2).map((task) => (
                                        <div key={task.id} className="flex items-center gap-2 text-xs">
                                          <div className={`h-1.5 w-1.5 rounded-full ${task.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                                          <span className="text-slate-700 line-clamp-1">{task.title}</span>
                                        </div>
                                      ))}
                                      {agg.openTasks > 2 && (
                                        <Link 
                                          to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                                          className="text-xs text-blue-600 hover:underline inline-block mt-1"
                                        >
                                          +{agg.openTasks - 2} more
                                        </Link>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* F) Expanded Inline Detail Panel - On demand */}
                              {isWoExpanded && (
                                <div className="ml-7 mt-2 space-y-2">
                                  {agg.hasNotes && wo.internal_notes && (
                                    <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                                      <p className="text-xs font-medium text-amber-900 mb-1">Internal Notes</p>
                                      <p className="text-xs text-amber-800 line-clamp-2">{wo.internal_notes}</p>
                                    </div>
                                  )}
                                  {wo.work_summary && (
                                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                                      <p className="text-xs font-medium text-slate-900 mb-1">Work Summary</p>
                                      <p className="text-xs text-slate-700 line-clamp-2">{wo.work_summary}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Link to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}>
                                <Button variant="ghost" size="sm">
                                  View
                                </Button>
                              </Link>
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
                                  {currentUser?.role === 'admin' && (
                                    <DropdownMenuItem 
                                      onClick={() => handleDelete(wo.id)}
                                      disabled={deleting}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      {deleting ? 'Deleting...' : 'Delete All'}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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