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
  ChevronRight
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
import { format } from 'date-fns';
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [editingJob, setEditingJob] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [jobsData, customersData, boatsData, locationsData] = await Promise.all([
        base44.entities.Job.list('-created_date'),
        base44.entities.Customer.list(),
        base44.entities.Boat.list(),
        base44.entities.Location.list()
      ]);
      setJobs(jobsData);
      setCustomers(customersData);
      setBoats(boatsData);
      setLocations(locationsData);
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

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await base44.entities.Job.delete(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting job:', error);
      }
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
          {filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
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

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      {job.job_number && <span>#{job.job_number}</span>}
                      {job.intake_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(job.intake_date), 'MMM d, yyyy')}
                        </div>
                      )}
                      {job.estimated_hours && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {job.estimated_hours}h estimated
                        </div>
                      )}
                    </div>
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
                          onClick={() => handleDelete(job.id)}
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
          ))}
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
    </div>
  );
}