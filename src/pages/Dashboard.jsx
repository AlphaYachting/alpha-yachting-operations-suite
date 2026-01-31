import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  AlertTriangle, 
  Calendar, 
  Clock,
  Ship,
  MapPin,
  Users,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Phone,
  FileText,
  Briefcase,
  TrendingUp,
  Activity,
  Plus,
  StickyNote,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, parseISO, isPast, isToday, differenceInDays, startOfDay, endOfDay, addDays } from 'date-fns';
import { toast } from 'sonner';
import JobForm from '@/components/jobs/JobForm';
import WorkOrderForm from '@/components/workorders/WorkOrderForm';
import LeadForm from '@/components/leads/LeadForm';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700',
  Scheduled: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-emerald-100 text-emerald-700'
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [offers, setOffers] = useState([]);
  const [notes, setNotes] = useState([]);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showWorkOrderDialog, setShowWorkOrderDialog] = useState(false);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [noteForm, setNoteForm] = useState({
    text: '',
    reference_type: 'None',
    reference_id: '',
    due_date: null
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [woData, jobsData, custData, boatsData, locData, leadsData, offersData, notesData] = await Promise.all([
        base44.entities.WorkOrder.list('-scheduled_date', 100),
        base44.entities.Job.list('-created_date', 50),
        base44.entities.Customer.list('-created_date', 50),
        base44.entities.Boat.list('-created_date', 50),
        base44.entities.Location.list(),
        base44.entities.Lead.list('-created_date', 30),
        base44.entities.Offer.list('-created_date', 30),
        base44.entities.Note.list('-created_date', 50)
      ]);

      setWorkOrders(woData);
      setJobs(jobsData);
      setCustomers(custData);
      setBoats(boatsData);
      setLocations(locData);
      setLeads(leadsData);
      setOffers(offersData);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
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
    if (!locationId) return '';
    const location = locations.find(l => l.id === locationId);
    return location?.name || '';
  };

  const getJobInfo = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return null;
    return {
      job,
      customer: getCustomerName(job.customer_id),
      boat: getBoatName(job.boat_id),
      location: getLocationName(job.location_id)
    };
  };

  // ACTION REQUIRED: Overdue WorkOrders
  const overdueWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    if (!wo.scheduled_date) return false;
    const schedDate = parseISO(wo.scheduled_date);
    return isPast(schedDate) && !isToday(schedDate);
  });

  // ACTION REQUIRED: WorkOrders without date or technician
  const unplannedWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    return !wo.scheduled_date || !wo.assigned_technicians || wo.assigned_technicians.length === 0;
  });

  // ACTION REQUIRED: Open Offers
  const openOffers = offers.filter(o => !['Approved', 'Rejected', 'Expired', 'Converted'].includes(o.status));

  // ACTION REQUIRED: Open Leads without recent activity
  const today = new Date();
  const sevenDaysAgo = addDays(today, -7);
  const staleLeads = leads.filter(l => {
    if (['Converted', 'Rejected', 'Lost'].includes(l.status)) return false;
    if (!l.last_contacted_at) return true;
    return isPast(parseISO(l.last_contacted_at)) && differenceInDays(today, parseISO(l.last_contacted_at)) > 7;
  });

  // TODAY: WorkOrders scheduled for today
  const todayWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    if (!wo.scheduled_date) return false;
    return isToday(parseISO(wo.scheduled_date));
  });

  // THIS WEEK: WorkOrders in next 7 days
  const thisWeekWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    if (!wo.scheduled_date) return false;
    const schedDate = parseISO(wo.scheduled_date);
    const daysAway = differenceInDays(schedDate, today);
    return daysAway > 0 && daysAway <= 7;
  });

  // PROJECT HEALTH
  const activeJobs = jobs.filter(j => !['Completed', 'Invoiced', 'Cancelled'].includes(j.status));
  
  const getProjectHealth = (job) => {
    const jobWorkOrders = workOrders.filter(wo => wo.job_id === job.id);
    const activeWOs = jobWorkOrders.filter(wo => !['Completed', 'Cancelled'].includes(wo.status));
    
    // Red: overdue WO OR no active WO OR missing planning
    const hasOverdueWO = activeWOs.some(wo => {
      if (!wo.scheduled_date) return false;
      const schedDate = parseISO(wo.scheduled_date);
      return isPast(schedDate) && !isToday(schedDate);
    });
    
    if (hasOverdueWO || activeWOs.length === 0) {
      return { status: 'red', label: 'Critical', step: hasOverdueWO ? 'Overdue work order' : 'No active work orders' };
    }
    
    const hasUnplannedWO = activeWOs.some(wo => !wo.scheduled_date || !wo.assigned_technicians || wo.assigned_technicians.length === 0);
    if (hasUnplannedWO) {
      return { status: 'red', label: 'Critical', step: 'Missing planning' };
    }
    
    // Yellow: WO due soon
    const hasDueSoonWO = activeWOs.some(wo => {
      if (!wo.scheduled_date) return false;
      const schedDate = parseISO(wo.scheduled_date);
      const daysAway = differenceInDays(schedDate, today);
      return daysAway > 0 && daysAway <= 7;
    });
    
    if (hasDueSoonWO) {
      return { status: 'yellow', label: 'Attention', step: 'Work order due soon' };
    }
    
    // Green: all good
    return { status: 'green', label: 'Healthy', step: 'On track' };
  };
  
  const getProjectProgress = (job) => {
    const jobWorkOrders = workOrders.filter(wo => wo.job_id === job.id);
    if (jobWorkOrders.length === 0) return 0;
    const completedWOs = jobWorkOrders.filter(wo => wo.status === 'Completed').length;
    return Math.round((completedWOs / jobWorkOrders.length) * 100);
  };

  // SALES & ORGANISATION
  const allOpenLeads = leads.filter(l => !['Converted', 'Rejected', 'Lost'].includes(l.status));
  const allOpenOffers = offers.filter(o => !['Approved', 'Rejected', 'Expired', 'Converted'].includes(o.status));

  const getAge = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const days = differenceInDays(today, parseISO(dateStr));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const hasActionItems = overdueWorkOrders.length > 0 || unplannedWorkOrders.length > 0 || openOffers.length > 0 || staleLeads.length > 0;

  // Notes functions
  const handleSaveNote = async () => {
    if (!noteForm.text.trim()) {
      toast.error('Note text is required');
      return;
    }
    if (noteForm.text.length > 300) {
      toast.error('Note must be 300 characters or less');
      return;
    }

    try {
      const noteData = {
        text: noteForm.text.trim(),
        reference_type: noteForm.reference_type,
        reference_id: noteForm.reference_type !== 'None' ? noteForm.reference_id : null,
        due_date: noteForm.due_date ? format(noteForm.due_date, 'yyyy-MM-dd') : null,
        completed: false
      };

      const newNote = await base44.entities.Note.create(noteData);
      setNotes([newNote, ...notes]);
      setShowNoteDialog(false);
      setNoteForm({ text: '', reference_type: 'None', reference_id: '', due_date: null });
      toast.success('Note created');
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Failed to create note');
    }
  };

  const handleToggleNoteComplete = async (note) => {
    try {
      await base44.entities.Note.update(note.id, { completed: !note.completed });
      setNotes(notes.map(n => n.id === note.id ? { ...n, completed: !n.completed } : n));
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await base44.entities.Note.delete(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
      toast.success('Note deleted');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const activeNotes = notes.filter(n => !n.completed);
  const getReferenceName = (note) => {
    if (note.reference_type === 'Job') {
      const job = jobs.find(j => j.id === note.reference_id);
      return job?.title || 'Unknown Project';
    }
    if (note.reference_type === 'WorkOrder') {
      const wo = workOrders.find(w => w.id === note.reference_id);
      return wo?.title || 'Unknown Work Order';
    }
    if (note.reference_type === 'Customer') {
      return getCustomerName(note.reference_id);
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Operational overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            onClick={() => setShowProjectDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Project
          </Button>
          <Button 
            size="sm" 
            onClick={() => setShowWorkOrderDialog(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Work Order
          </Button>
          <Button 
            size="sm" 
            onClick={() => setShowLeadDialog(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Lead
          </Button>
          <Button 
            size="sm" 
            asChild
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <Link to={createPageUrl('Offers') + '?new=true'}>
              <Plus className="h-4 w-4 mr-1" />
              Offer
            </Link>
          </Button>
          <Button 
            size="sm" 
            onClick={() => setShowNoteDialog(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            <StickyNote className="h-4 w-4 mr-1" />
            Note
          </Button>
        </div>
      </div>

      {/* 1) ACTION REQUIRED */}
      {hasActionItems && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="h-5 w-5" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overdueWorkOrders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-red-900">Overdue Work Orders ({overdueWorkOrders.length})</h3>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={createPageUrl('WorkOrders') + '?filter=overdue'}>View All</Link>
                  </Button>
                </div>
                <div className="space-y-2">
                  {overdueWorkOrders.slice(0, 3).map(wo => {
                    const jobInfo = getJobInfo(wo.job_id);
                    return (
                      <Link 
                        key={wo.id} 
                        to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                        className="block p-3 bg-white rounded-lg border border-red-200 hover:border-red-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{wo.title}</p>
                            <p className="text-sm text-slate-600 mt-1">
                              {jobInfo?.boat} • {jobInfo?.customer}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-red-700">
                              <Calendar className="h-3 w-3" />
                              Due: {format(parseISO(wo.scheduled_date), 'MMM d, yyyy')}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {unplannedWorkOrders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-red-900">Unplanned Work Orders ({unplannedWorkOrders.length})</h3>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={createPageUrl('WorkOrders') + '?filter=pending'}>View All</Link>
                  </Button>
                </div>
                <div className="space-y-2">
                  {unplannedWorkOrders.slice(0, 3).map(wo => {
                    const jobInfo = getJobInfo(wo.job_id);
                    return (
                      <Link 
                        key={wo.id} 
                        to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                        className="block p-3 bg-white rounded-lg border border-amber-200 hover:border-amber-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{wo.title}</p>
                            <p className="text-sm text-slate-600 mt-1">
                              {jobInfo?.boat} • {jobInfo?.customer}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {!wo.scheduled_date && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                  No date
                                </Badge>
                              )}
                              {(!wo.assigned_technicians || wo.assigned_technicians.length === 0) && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                  No technician
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {openOffers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-red-900">Open Offers ({openOffers.length})</h3>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={createPageUrl('Offers')}>View All</Link>
                  </Button>
                </div>
                <div className="space-y-2">
                  {openOffers.slice(0, 3).map(offer => (
                    <Link 
                      key={offer.id} 
                      to={createPageUrl('OfferDetail') + `?id=${offer.id}`}
                      className="block p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{offer.title}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            {getCustomerName(offer.customer_id)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {offer.status}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {getAge(offer.created_date)} old
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {staleLeads.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-red-900">Stale Leads ({staleLeads.length})</h3>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={createPageUrl('Leads')}>View All</Link>
                  </Button>
                </div>
                <div className="space-y-2">
                  {staleLeads.slice(0, 3).map(lead => (
                    <Link 
                      key={lead.id} 
                      to={createPageUrl('LeadDetail') + `?id=${lead.id}`}
                      className="block p-3 bg-white rounded-lg border border-orange-200 hover:border-orange-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{lead.name}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            {lead.boat_name || 'No boat specified'}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              {lead.status}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              No contact for {lead.last_contacted_at ? getAge(lead.last_contacted_at) : 'unknown time'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2) TODAY / THIS WEEK */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayWorkOrders.length === 0 ? (
              <p className="text-sm text-slate-500">No work orders scheduled for today</p>
            ) : (
              <div className="space-y-2">
                {todayWorkOrders.map(wo => {
                  const jobInfo = getJobInfo(wo.job_id);
                  return (
                    <Link 
                      key={wo.id} 
                      to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                      className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{wo.title}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            {jobInfo?.boat} • {jobInfo?.location}
                          </p>
                          {wo.scheduled_start_time && (
                            <p className="text-xs text-slate-500 mt-1">
                              {wo.scheduled_start_time}
                            </p>
                          )}
                        </div>
                        <Badge className={statusColors[wo.status] || 'bg-slate-100 text-slate-700'}>
                          {wo.status}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {thisWeekWorkOrders.length === 0 ? (
              <p className="text-sm text-slate-500">No work orders scheduled this week</p>
            ) : (
              <div className="space-y-2">
                {thisWeekWorkOrders.slice(0, 5).map(wo => {
                  const jobInfo = getJobInfo(wo.job_id);
                  return (
                    <Link 
                      key={wo.id} 
                      to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                      className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{wo.title}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            {jobInfo?.boat} • {jobInfo?.location}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {format(parseISO(wo.scheduled_date), 'EEE, MMM d')}
                          </p>
                        </div>
                        <Badge className={statusColors[wo.status] || 'bg-slate-100 text-slate-700'}>
                          {wo.status}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
                {thisWeekWorkOrders.length > 5 && (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link to={createPageUrl('WorkOrders')}>View All ({thisWeekWorkOrders.length})</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3) PROJECT HEALTH */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" />
            Project Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeJobs.length === 0 ? (
            <p className="text-sm text-slate-500">No active projects</p>
          ) : (
            <div className="space-y-3">
              {activeJobs.map(job => {
                const health = getProjectHealth(job);
                const progress = getProjectProgress(job);
                const boat = boats.find(b => b.id === job.boat_id);
                const location = locations.find(l => l.id === job.location_id);
                
                return (
                  <Link 
                    key={job.id} 
                    to={createPageUrl('JobDetail') + `?id=${job.id}`}
                    className="block p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`h-3 w-3 rounded-full ${
                            health.status === 'red' ? 'bg-red-500' : 
                            health.status === 'yellow' ? 'bg-yellow-500' : 
                            'bg-green-500'
                          }`} />
                          <p className="font-medium text-slate-900">{job.title}</p>
                          <Badge variant="outline" className={
                            health.status === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
                            health.status === 'yellow' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            'bg-green-50 text-green-700 border-green-200'
                          }>
                            {health.label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Ship className="h-3.5 w-3.5" />
                            {boat?.vessel_name || 'Unknown'}
                          </div>
                          {location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {location.name}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Progress: {progress}%</span>
                            <span className="text-slate-500 italic">{health.step}</span>
                          </div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all rounded-full ${
                                health.status === 'red' ? 'bg-red-500' :
                                health.status === 'yellow' ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Section */}
      {activeNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-yellow-600" />
              Notes & Reminders ({activeNotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeNotes.slice(0, 5).map(note => (
                <div 
                  key={note.id}
                  className="p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-slate-900">{note.text}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {getReferenceName(note) && (
                          <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-xs">
                            {note.reference_type}: {getReferenceName(note)}
                          </Badge>
                        )}
                        {note.due_date && (
                          <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {format(parseISO(note.due_date), 'MMM d')}
                          </Badge>
                        )}
                        <span className="text-xs text-slate-500">
                          {getAge(note.created_date)} ago
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleToggleNoteComplete(note)}
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <X className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4) SALES & ORGANISATION */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-purple-600" />
              Open Leads ({allOpenLeads.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allOpenLeads.length === 0 ? (
              <p className="text-sm text-slate-500">No open leads</p>
            ) : (
              <div className="space-y-2">
                {allOpenLeads.slice(0, 5).map(lead => (
                  <Link 
                    key={lead.id} 
                    to={createPageUrl('LeadDetail') + `?id=${lead.id}`}
                    className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{lead.name}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {lead.boat_name || 'No boat specified'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            {lead.status}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {getAge(lead.created_date)} old
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </Link>
                ))}
                {allOpenLeads.length > 5 && (
                  <Button variant="outline" size="sm" asChild className="w-full mt-2">
                    <Link to={createPageUrl('Leads')}>View All ({allOpenLeads.length})</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-600" />
              Open Offers ({allOpenOffers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allOpenOffers.length === 0 ? (
              <p className="text-sm text-slate-500">No open offers</p>
            ) : (
              <div className="space-y-2">
                {allOpenOffers.slice(0, 5).map(offer => (
                  <Link 
                    key={offer.id} 
                    to={createPageUrl('OfferDetail') + `?id=${offer.id}`}
                    className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{offer.title}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {getCustomerName(offer.customer_id)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
                            {offer.status}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {getAge(offer.created_date)} old
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </Link>
                ))}
                {allOpenOffers.length > 5 && (
                  <Button variant="outline" size="sm" asChild className="w-full mt-2">
                    <Link to={createPageUrl('Offers')}>View All ({allOpenOffers.length})</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <JobForm
            customers={customers}
            boats={boats}
            locations={locations}
            onSave={async (projectData) => {
              const woNumber = `P${Date.now().toString().slice(-6)}`;
              const newJob = await base44.entities.Job.create({ 
                ...projectData, 
                job_number: woNumber, 
                intake_date: new Date().toISOString() 
              });
              setJobs([newJob, ...jobs]);
              setShowProjectDialog(false);
              toast.success('Project created');
              await loadDashboardData();
            }}
            onCancel={() => setShowProjectDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Work Order Dialog */}
      <Dialog open={showWorkOrderDialog} onOpenChange={setShowWorkOrderDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Work Order</DialogTitle>
          </DialogHeader>
          <WorkOrderForm
            jobs={jobs}
            technicians={[]}
            customers={customers}
            boats={boats}
            onSave={async (workOrderData) => {
              const woNumber = `WO${Date.now().toString().slice(-6)}`;
              const newWo = await base44.entities.WorkOrder.create({ 
                ...workOrderData, 
                work_order_number: woNumber 
              });
              setWorkOrders([newWo, ...workOrders]);
              setShowWorkOrderDialog(false);
              toast.success('Work order created');
              await loadDashboardData();
            }}
            onCancel={() => setShowWorkOrderDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Lead Dialog */}
      <Dialog open={showLeadDialog} onOpenChange={setShowLeadDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
          </DialogHeader>
          <LeadForm
            locations={locations}
            onSave={async (leadData) => {
              const newLead = await base44.entities.Lead.create(leadData);
              setLeads([newLead, ...leads]);
              setShowLeadDialog(false);
              toast.success('Lead created');
              await loadDashboardData();
            }}
            onCancel={() => setShowLeadDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-text">Note Text *</Label>
              <Textarea
                id="note-text"
                placeholder="Enter note (max 300 characters)..."
                value={noteForm.text}
                onChange={(e) => setNoteForm({ ...noteForm, text: e.target.value })}
                maxLength={300}
                rows={4}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                {noteForm.text.length}/300 characters
              </p>
            </div>

            <div>
              <Label htmlFor="reference-type">Link to (Optional)</Label>
              <Select
                value={noteForm.reference_type}
                onValueChange={(value) => setNoteForm({ ...noteForm, reference_type: value, reference_id: '' })}
              >
                <SelectTrigger id="reference-type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Job">Project</SelectItem>
                  <SelectItem value="WorkOrder">Work Order</SelectItem>
                  <SelectItem value="Customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {noteForm.reference_type !== 'None' && (
              <div>
                <Label htmlFor="reference-id">Select {noteForm.reference_type}</Label>
                <Select
                  value={noteForm.reference_id}
                  onValueChange={(value) => setNoteForm({ ...noteForm, reference_id: value })}
                >
                  <SelectTrigger id="reference-id" className="mt-1">
                    <SelectValue placeholder={`Select ${noteForm.reference_type}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {noteForm.reference_type === 'Job' && jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                    ))}
                    {noteForm.reference_type === 'WorkOrder' && workOrders.map(wo => (
                      <SelectItem key={wo.id} value={wo.id}>{wo.title}</SelectItem>
                    ))}
                    {noteForm.reference_type === 'Customer' && customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name || `${c.first_name} ${c.last_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Due Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left mt-1">
                    <Calendar className="h-4 w-4 mr-2" />
                    {noteForm.due_date ? format(noteForm.due_date, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={noteForm.due_date}
                    onSelect={(date) => setNoteForm({ ...noteForm, due_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNote}>
                Save Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}