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
  AlertTriangle
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

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [editingJob, setEditingJob] = useState(null);
  const [deletingJob, setDeletingJob] = useState(null);
  const [deleteRelated, setDeleteRelated] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [jobsData, customersData, boatsData, locationsData, workOrdersData, tasksData] = await Promise.all([
        base44.entities.Job.list(),
        base44.entities.Customer.list(),
        base44.entities.Boat.list(),
        base44.entities.Location.list(),
        base44.entities.WorkOrder.list(),
        base44.entities.Task.list()
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
      setCustomers(customersData);
      setBoats(boatsData);
      setLocations(locationsData);
      setWorkOrders(workOrdersData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (jobData) => {
    if (editingJob) {
      await base44.entities.Job.update(editingJob.id, jobData);
    } else {
      const jobNumber = `J${Date.now().toString().slice(-6)}`;
      await base44.entities.Job.create({ ...jobData, job_number: jobNumber, intake_date: new Date().toISOString() });
    }
    await loadData();
    setShowForm(false);
    setEditingJob(null);
    setSearchParams({});
  };

  const handleDelete = async (job) => {
    setDeletingJob(job);
    setDeleteRelated(true);
  };

  const confirmDelete = async () => {
    if (!deletingJob || isDeleting) return;
    
    setIsDeleting(true);
    try {
      if (deleteRelated) {
        // Find all work orders for this job
        const jobWorkOrders = workOrders.filter(wo => wo.job_id === deletingJob.id);
        const workOrderIds = jobWorkOrders.map(wo => wo.id);
        
        // Delete all tasks associated with these work orders
        const jobTasks = tasks.filter(task => workOrderIds.includes(task.work_order_id));
        for (const task of jobTasks) {
          await base44.entities.Task.delete(task.id);
        }
        
        // Delete all work orders
        for (const wo of jobWorkOrders) {
          await base44.entities.WorkOrder.delete(wo.id);
        }
      }
      
      // Delete the job
      await base44.entities.Job.delete(deletingJob.id);
      await loadData();
      setDeletingJob(null);
    } catch (error) {
      console.error('Error deleting job:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return 'Unknown';
    return customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  };

  const getBoatName = (boatId) => {
    const boat = boats.find(b => b.id === boatId);
    return boat?.vessel_name || 'Unknown';
  };

  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || '';
  };

  const getJobTaskStats = (jobId) => {
    const jobWorkOrders = workOrders.filter(wo => wo.job_id === jobId);
    const workOrderIds = jobWorkOrders.map(wo => wo.id);
    const jobTasks = tasks.filter(task => workOrderIds.includes(task.work_order_id));
    
    const totalTasks = jobTasks.length;
    const completedTasks = jobTasks.filter(task => task.status === 'Completed').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    return { totalTasks, completedTasks, progress };
  };

  const filteredJobs = jobs.filter(job => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = job.title?.toLowerCase().includes(searchLower) ||
      job.job_number?.toLowerCase().includes(searchLower) ||
      getCustomerName(job.customer_id).toLowerCase().includes(searchLower) ||
      getBoatName(job.boat_id).toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || job.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
          <p className="text-slate-500 mt-1">{jobs.length} total jobs</p>
        </div>
        <Button 
          onClick={() => { setEditingJob(null); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Job
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search jobs..."
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

      {/* Jobs List */}
      {loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No jobs found</h3>
            <p className="text-slate-500 mt-1">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first job to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredJobs.map((job) => {
            const taskStats = getJobTaskStats(job.id);
            const isDueOverdue = job.requested_date && isPast(parseISO(job.requested_date)) && !isToday(parseISO(job.requested_date));
            const isDueToday = job.requested_date && isToday(parseISO(job.requested_date));
            const isDueSoon = job.requested_date && differenceInDays(parseISO(job.requested_date), new Date()) <= 7 && differenceInDays(parseISO(job.requested_date), new Date()) > 0;
            
            return (
            <Card key={job.id} className={`hover:shadow-md transition-shadow ${
              isDueOverdue ? 'border-red-500 border-2 bg-red-50/30' : 
              isDueToday ? 'border-amber-500 border-2 bg-amber-50/30' : 
              isDueSoon ? 'border-yellow-400 border-2 bg-yellow-50/30' : ''
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link 
                        to={createPageUrl('JobDetail') + `?id=${job.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {job.title}
                      </Link>
                      <Badge className={priorityColors[job.priority]}>{job.priority}</Badge>
                      <Badge className={statusColors[job.status]}>{job.status}</Badge>
                      {job.requested_date && (
                        <Badge className={`${
                          isDueOverdue ? 'bg-red-600 text-white border-red-700' : 
                          isDueToday ? 'bg-amber-600 text-white border-amber-700' : 
                          isDueSoon ? 'bg-yellow-500 text-white border-yellow-600' : 
                          'bg-slate-100 text-slate-700'
                        }`}>
                          <AlertTriangle className={`h-3 w-3 mr-1 ${isDueOverdue || isDueToday || isDueSoon ? 'animate-pulse' : ''}`} />
                          {isDueOverdue ? 'OVERDUE' : isDueToday ? 'DUE TODAY' : `Due ${format(parseISO(job.requested_date), 'MMM d')}`}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                      <span>{getCustomerName(job.customer_id)}</span>
                      <div className="flex items-center gap-1">
                        <Ship className="h-3.5 w-3.5" />
                        {getBoatName(job.boat_id)}
                      </div>
                      {job.location_id && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {getLocationName(job.location_id)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                      {job.job_number && <span>#{job.job_number}</span>}
                      {job.intake_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Intake: {format(new Date(job.intake_date), 'MMM d, yyyy')}
                        </div>
                      )}
                      {job.requested_date && (
                        <div className={`flex items-center gap-1 font-medium ${
                          isDueOverdue ? 'text-red-700' : 
                          isDueToday ? 'text-amber-700' : 
                          isDueSoon ? 'text-yellow-700' : 
                          'text-slate-600'
                        }`}>
                          <AlertTriangle className="h-3 w-3" />
                          Due: {format(parseISO(job.requested_date), 'MMM d, yyyy')}
                        </div>
                      )}
                      {job.estimated_hours && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {job.estimated_hours}h estimated
                        </div>
                      )}
                    </div>

                    {taskStats.totalTasks > 0 && (
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
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={createPageUrl('JobDetail') + `?id=${job.id}`}>
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
                        <DropdownMenuItem onClick={() => { setEditingJob(job); setShowForm(true); }}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl('WorkOrders') + `?job=${job.id}&new=true`}>
                            Create Work Order
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(job)}
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

      {/* Job Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingJob(null); setSearchParams({}); }}}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJob ? 'Edit Job' : 'Create New Job'}</DialogTitle>
          </DialogHeader>
          <JobForm
            job={editingJob}
            customers={customers}
            boats={boats}
            locations={locations}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingJob(null); setSearchParams({}); }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingJob} onOpenChange={(open) => !open && setDeletingJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Are you sure you want to delete this job?</p>
              {deletingJob && (() => {
                const jobWorkOrders = workOrders.filter(wo => wo.job_id === deletingJob.id);
                const workOrderIds = jobWorkOrders.map(wo => wo.id);
                const jobTasks = tasks.filter(task => workOrderIds.includes(task.work_order_id));
                
                return (
                  <>
                    {(jobWorkOrders.length > 0 || jobTasks.length > 0) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
                        <p className="font-medium text-amber-900">This job has associated data:</p>
                        <ul className="text-sm text-amber-800 space-y-1 ml-4 list-disc">
                          {jobWorkOrders.length > 0 && (
                            <li>{jobWorkOrders.length} work order(s)</li>
                          )}
                          {jobTasks.length > 0 && (
                            <li>{jobTasks.length} task(s)</li>
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
                'Delete Job'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}