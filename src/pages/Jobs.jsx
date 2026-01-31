import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Plus, 
  Search, 
  Briefcase,
  Filter,
  MoreHorizontal,
  Ship,
  MapPin,
  Calendar,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { format, isPast, isToday, parseISO, differenceInDays } from 'date-fns';
import JobForm from '@/components/jobs/JobForm';

const priorityColors = {
  Low: 'bg-slate-100 text-slate-700',
  Normal: 'bg-blue-100 text-blue-700',
  High: 'bg-amber-100 text-amber-700',
  Urgent: 'bg-red-100 text-red-700',
  Express: 'bg-purple-100 text-purple-700'
};

const statusColors = {
  New: 'bg-blue-100 text-blue-700',
  Quoted: 'bg-violet-100 text-violet-700',
  Approved: 'bg-cyan-100 text-cyan-700',
  Scheduled: 'bg-indigo-100 text-indigo-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Waiting for Parts': 'bg-orange-100 text-orange-700',
  'On Hold': 'bg-slate-100 text-slate-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Invoiced: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700'
};

export default function Projects() {
   const [searchParams, setSearchParams] = useSearchParams();
   const [projects, setProjects] = useState([]);
   const [customers, setCustomers] = useState([]);
   const [boats, setBoats] = useState([]);
   const [locations, setLocations] = useState([]);
   const [workOrders, setWorkOrders] = useState([]);
   const [tasks, setTasks] = useState([]);
   const [loading, setLoading] = useState(true);
   const [formDataLoading, setFormDataLoading] = useState(false);
   const [saving, setSaving] = useState(false);
   const [loadError, setLoadError] = useState(null);
   const [progressByJobId, setProgressByJobId] = useState({});
   const [loadingProgressFor, setLoadingProgressFor] = useState(null);
   const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');

    // Apply filter from dashboard
    useEffect(() => {
      const filterParam = searchParams.get('filter');
      if (filterParam === 'active') {
        setStatusFilter('all');
        setPriorityFilter('all');
      } else if (filterParam === 'overdue') {
        setStatusFilter('all');
        setPriorityFilter('all');
      }
    }, [searchParams]);
   const [editingProject, setEditingProject] = useState(null);
   const [deletingProject, setDeletingProject] = useState(null);
   const [deleteRelated, setDeleteRelated] = useState(true);
   const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    console.log('[Jobs] Component mounted, starting data load');
    loadData().then(() => {
      // Load form data for dropdowns
      console.log('[Jobs] Initial load complete, loading form data');
      loadFormData();
    });
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      console.log('[Jobs] Starting data load...');
      // Load ONLY projects - no related data on initial load
      const projectsData = await base44.entities.Job.list('-created_date', 30);
      console.log('[Jobs] Loaded projects:', projectsData.length);

      // Sort projects: overdue first, then due today, then due soon, then by priority, then by due date, then by created date
      const sortedProjects = projectsData.sort((a, b) => {
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

      setProjects(sortedProjects);
      console.log('[Jobs] Projects loaded successfully');
    } catch (error) {
      console.error('[Jobs] CRITICAL ERROR loading projects:', error);
      console.error('[Jobs] Error details:', { message: error.message, stack: error.stack });
      setLoadError('Failed to load projects. Please refresh the page or contact support if this persists.');
    } finally {
      setLoading(false);
    }
  };
  
  // Load progress for a specific job on demand
  const loadProgressForJob = async (jobId) => {
    if (progressByJobId[jobId] || loadingProgressFor === jobId) {
      return; // Already loaded or loading
    }

    setLoadingProgressFor(jobId);
    try {
      console.log('[Jobs] Loading progress for job:', jobId);
      
      // Fetch only workorders and tasks for this specific job
      const jobWorkOrders = await base44.entities.WorkOrder.filter({ job_id: jobId });
      const workOrderIds = jobWorkOrders.map(wo => wo.id);
      
      let jobTasks = [];
      if (workOrderIds.length > 0) {
        // Fetch tasks for these work orders
        const allTasks = await base44.entities.Task.list('-created_date', 200);
        jobTasks = allTasks.filter(task => workOrderIds.includes(task.work_order_id));
      }

      const totalTasks = jobTasks.length;
      const completedTasks = jobTasks.filter(task => task.status === 'Completed').length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      setProgressByJobId(prev => ({
        ...prev,
        [jobId]: { totalTasks, completedTasks, progress }
      }));

      console.log('[Jobs] Progress loaded for job:', jobId, { totalTasks, completedTasks, progress });
    } catch (error) {
      console.error('[Jobs] ERROR loading progress for job:', jobId, error);
      setLoadError(`Failed to load progress. ${error.message}`);
    } finally {
      setLoadingProgressFor(null);
    }
  };

  // Load form data only when dialog opens - load in parallel for speed
  const loadFormData = async () => {
    if (customers.length > 0) {
      console.log('[Jobs] Form data already loaded, skipping');
      return;
    }

    setFormDataLoading(true);
    console.log('[Jobs] Loading form data...');
    try {
      // Load all in parallel - no delays needed, we have reasonable limits
      const [customersData, boatsData, locationsData] = await Promise.all([
        base44.entities.Customer.list('-created_date', 50),
        base44.entities.Boat.list('-created_date', 50),
        base44.entities.Location.list()
      ]);

      setCustomers(customersData);
      setBoats(boatsData);
      setLocations(locationsData);
      console.log('[Jobs] Form data loaded:', { 
        customers: customersData.length, 
        boats: boatsData.length, 
        locations: locationsData.length 
      });
    } catch (error) {
      console.error('[Jobs] CRITICAL ERROR loading form data:', error);
      console.error('[Jobs] Error details:', { message: error.message, stack: error.stack });
    } finally {
      setFormDataLoading(false);
    }
  };

  const handleSave = async (projectData) => {
    const startTime = Date.now();
    setSaving(true);
    try {
      console.log('[Jobs] Starting save operation...', { editing: !!editingProject });

      // Add timeout protection
      const savePromise = editingProject
        ? base44.entities.Job.update(editingProject.id, projectData)
        : base44.entities.Job.create({ 
            ...projectData, 
            job_number: `P${Date.now().toString().slice(-6)}`, 
            intake_date: new Date().toISOString() 
          });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation took too long. Please retry. If it persists, reduce filters or reload.')), 20000)
      );

      const result = await Promise.race([savePromise, timeoutPromise]);
      console.log('[Jobs] Save completed in', Date.now() - startTime, 'ms');

      if (editingProject) {
        setProjects(prev => prev.map(p => p.id === result.id ? result : p));
      } else {
        setProjects(prev => [result, ...prev]);
      }

      setShowForm(false);
      setEditingProject(null);
      setSearchParams({});
    } catch (error) {
      console.error('[Jobs] Save failed after', Date.now() - startTime, 'ms:', error);
      const userMessage = error.message.includes('took too long') 
        ? error.message 
        : `Failed to save project. ${error.message.includes('timeout') || error.message.includes('timed out') 
            ? 'Operation took too long. Please retry. If it persists, reduce filters or reload.' 
            : 'Please try again.'}`;
      alert(userMessage);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project) => {
    setDeletingProject(project);
    setDeleteRelated(true);
  };

  const confirmDelete = async () => {
    if (!deletingProject || isDeleting) return;

    setIsDeleting(true);
    console.log('[Jobs] Starting delete for project:', deletingProject.id);
    
    try {
      if (deleteRelated) {
        console.log('[Jobs] Deleting related data...');
        // Find all work orders for this project
        const projectWorkOrders = workOrders.filter(wo => wo.job_id === deletingProject.id);
        const workOrderIds = projectWorkOrders.map(wo => wo.id);
        console.log('[Jobs] Found work orders to delete:', projectWorkOrders.length);

        // Delete all tasks associated with these work orders
        const projectTasks = tasks.filter(task => workOrderIds.includes(task.work_order_id));
        console.log('[Jobs] Found tasks to delete:', projectTasks.length);
        
        for (const task of projectTasks) {
          console.log('[Jobs] Deleting task:', task.id);
          await base44.entities.Task.delete(task.id);
        }

        // Delete all work orders
        for (const wo of projectWorkOrders) {
          console.log('[Jobs] Deleting work order:', wo.id);
          await base44.entities.WorkOrder.delete(wo.id);
        }
      }

      // Delete the project
      console.log('[Jobs] Deleting project:', deletingProject.id);
      await base44.entities.Job.delete(deletingProject.id);
      console.log('[Jobs] Project deleted successfully');
      
      // Remove from local state instead of reloading
      setProjects(prev => prev.filter(p => p.id !== deletingProject.id));
      setDeletingProject(null);
    } catch (error) {
      console.error('[Jobs] CRITICAL ERROR deleting project:', error);
      console.error('[Jobs] Error details:', { 
        message: error.message, 
        stack: error.stack,
        projectId: deletingProject.id 
      });
      alert('Failed to delete project: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getCustomerName = (customerId) => {
    // Don't try to fetch if not loaded - just show placeholder
    if (customers.length === 0) return '—';
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return 'Unknown';
    return customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  };

  const getBoatName = (boatId) => {
    if (boats.length === 0) return '—';
    const boat = boats.find(b => b.id === boatId);
    return boat?.vessel_name || 'Unknown';
  };

  const getLocationName = (locationId) => {
    if (!locationId) return '';
    if (locations.length === 0) return '—';
    const location = locations.find(l => l.id === locationId);
    return location?.name || 'Unknown';
  };

  // Get cached progress for a job
  const getProjectTaskStats = (projectId) => {
    return progressByJobId[projectId] || null;
  };

  const filteredProjects = projects.filter(project => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = project.title?.toLowerCase().includes(searchLower) ||
      project.job_number?.toLowerCase().includes(searchLower) ||
      getCustomerName(project.customer_id).toLowerCase().includes(searchLower) ||
      getBoatName(project.boat_id).toLowerCase().includes(searchLower);

    const filterParam = searchParams.get('filter');
    let matchesFilter = true;

    if (filterParam === 'active') {
      matchesFilter = !['Completed', 'Invoiced', 'Cancelled'].includes(project.status);
    } else if (filterParam === 'overdue') {
      const today = new Date();
      matchesFilter = project.requested_date && 
                     isPast(parseISO(project.requested_date)) && 
                     !isToday(parseISO(project.requested_date)) &&
                     !['Completed', 'Invoiced', 'Cancelled'].includes(project.status);
    }

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1">{projects.length} total projects</p>
        </div>
        <Button 
          onClick={() => { setEditingProject(null); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </div>

      {/* Error Alert */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
            <p className="text-sm text-red-700 mt-1">{loadError}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setLoadError(null); loadData(); }}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="New">New</SelectItem>
            <SelectItem value="Quoted">Quoted</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Scheduled">Scheduled</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Waiting for Parts">Waiting for Parts</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Invoiced">Invoiced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Normal">Normal</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Urgent">Urgent</SelectItem>
            <SelectItem value="Express">Express</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No projects found</h3>
            <p className="text-slate-500 mt-1">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first project to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProjects.map((project) => {
            const taskStats = getProjectTaskStats(project.id);
            const isDueOverdue = project.requested_date && isPast(parseISO(project.requested_date)) && !isToday(parseISO(project.requested_date));
            const isDueToday = project.requested_date && isToday(parseISO(project.requested_date));
            const isDueSoon = project.requested_date && differenceInDays(parseISO(project.requested_date), new Date()) <= 7 && differenceInDays(parseISO(project.requested_date), new Date()) > 0;

            return (
            <Card key={project.id} className={`hover:shadow-md transition-shadow ${
              isDueOverdue ? 'border-red-500 border-2 bg-red-50/30' : 
              isDueToday ? 'border-amber-500 border-2 bg-amber-50/30' : 
              isDueSoon ? 'border-yellow-400 border-2 bg-yellow-50/30' : ''
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link 
                        to={createPageUrl('JobDetail') + `?id=${project.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {project.title}
                      </Link>
                      <Badge className={priorityColors[project.priority]}>{project.priority}</Badge>
                      <Badge className={statusColors[project.status]}>{project.status}</Badge>
                      {project.requested_date && (
                        <Badge className={`${
                          isDueOverdue ? 'bg-red-600 text-white border-red-700' : 
                          isDueToday ? 'bg-amber-600 text-white border-amber-700' : 
                          isDueSoon ? 'bg-yellow-500 text-white border-yellow-600' : 
                          'bg-slate-100 text-slate-700'
                        }`}>
                          <AlertTriangle className={`h-3 w-3 mr-1 text-red-600 ${isDueOverdue || isDueToday || isDueSoon ? 'animate-pulse' : ''}`} />
                          {isDueOverdue ? 'OVERDUE' : isDueToday ? 'DUE TODAY' : `Due ${format(parseISO(project.requested_date), 'MMM d')}`}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                      <span>{getCustomerName(project.customer_id)}</span>
                      <div className="flex items-center gap-1">
                        <Ship className="h-3.5 w-3.5" />
                        {getBoatName(project.boat_id)}
                      </div>
                      {project.location_id && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {getLocationName(project.location_id)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                      {project.job_number && <span>#{project.job_number}</span>}
                      {project.intake_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Intake: {format(new Date(project.intake_date), 'MMM d, yyyy')}
                        </div>
                      )}
                      {project.requested_date && (
                        <div className={`flex items-center gap-1 font-medium ${
                          isDueOverdue ? 'text-red-700' : 
                          isDueToday ? 'text-amber-700' : 
                          isDueSoon ? 'text-yellow-700' : 
                          'text-slate-600'
                        }`}>
                          <AlertTriangle className="h-3 w-3" />
                          Due: {format(parseISO(project.requested_date), 'MMM d, yyyy')}
                        </div>
                      )}
                      {project.estimated_hours && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {project.estimated_hours}h estimated
                        </div>
                      )}
                    </div>

                    {taskStats ? (
                      taskStats.totalTasks > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{taskStats.completedTasks} of {taskStats.totalTasks} tasks completed</span>
                            </div>
                            <span className="font-medium text-slate-700">{taskStats.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 transition-all rounded-full"
                              style={{ width: `${taskStats.progress}%` }}
                            />
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="mt-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            loadProgressForJob(project.id);
                          }}
                          disabled={loadingProgressFor === project.id}
                          className="text-xs h-7"
                        >
                          {loadingProgressFor === project.id ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Load Progress
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={createPageUrl('JobDetail') + `?id=${project.id}`}>
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
                        <DropdownMenuItem onClick={() => { setEditingProject(project); setShowForm(true); }}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl('WorkOrders') + `?job=${project.id}&new=true`}>
                            Create Work Order
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(project)}
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

      {/* Project Form Dialog */}
      <Dialog 
        open={showForm} 
        onOpenChange={(open) => { 
          if (open) loadFormData(); // Load form data when opening
          setShowForm(open); 
          if (!open) { 
            setEditingProject(null); 
            setSearchParams({}); 
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Create New Project'}</DialogTitle>
          </DialogHeader>
          {formDataLoading ? (
            <div className="py-8 text-center text-slate-500">Loading form data...</div>
          ) : (
            <JobForm
              job={editingProject}
              customers={customers}
              boats={boats}
              locations={locations}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingProject(null); setSearchParams({}); }}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Are you sure you want to delete this project?</p>
              {deletingProject && (() => {
                const projectWorkOrders = workOrders.filter(wo => wo.job_id === deletingProject.id);
                const workOrderIds = projectWorkOrders.map(wo => wo.id);
                const projectTasks = tasks.filter(task => workOrderIds.includes(task.work_order_id));

                return (
                  <>
                    {(projectWorkOrders.length > 0 || projectTasks.length > 0) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
                        <p className="font-medium text-amber-900">This project has associated data:</p>
                        <ul className="text-sm text-amber-800 space-y-1 ml-4 list-disc">
                          {projectWorkOrders.length > 0 && (
                            <li>{projectWorkOrders.length} work order(s)</li>
                          )}
                          {projectTasks.length > 0 && (
                            <li>{projectTasks.length} task(s)</li>
                          )}
                        </ul>
                      </div>
                    )}
                    <div className="flex items-start space-x-2 pt-2">
                      <input
                        type="checkbox"
                        id="deleteRelated"
                        checked={deleteRelated}
                        onChange={(e) => setDeleteRelated(e.target.checked)}
                        className="mt-1"
                      />
                      <label htmlFor="deleteRelated" className="text-sm text-slate-700 cursor-pointer">
                        Also delete all associated work orders and tasks
                      </label>
                    </div>
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete Project'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}