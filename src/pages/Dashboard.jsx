import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  AlertTriangle,
  AlertCircle,
  Calendar, 
  Clock,
  Ship,
  MapPin,
  Users,
  ChevronRight,
  CheckCircle2,
  Phone,
  FileText,
  Briefcase,
  TrendingUp,
  Activity,
  Plus,
  StickyNote,
  X,
  BarChart2
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
import { format, parseISO, isPast, isToday, differenceInDays, startOfDay, endOfDay, addDays, startOfWeek } from 'date-fns';
import { toast } from 'sonner';
import JobForm from '@/components/jobs/JobForm';
import WorkOrderForm from '@/components/workorders/WorkOrderForm';
import LeadForm from '@/components/leads/LeadForm';
import CapacityModal from '@/components/dashboard/CapacityModal';
import DispatchFullscreenModal from '@/components/dispatch/DispatchFullscreenModal';

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
  const [kpis, setKpis] = useState(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showWorkOrderDialog, setShowWorkOrderDialog] = useState(false);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
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

      // Load or calculate KPIs (max 2x per day)
      await loadKPIs();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    try {
      const now = new Date();
      const todayDate = format(now, 'yyyy-MM-dd');
      const currentPeriod = now.getHours() < 12 ? 'morning' : 'afternoon';
      const cacheKey = `kpi_${todayDate}_${currentPeriod}`;

      // Check if cache exists for current period
      const existingCache = await base44.entities.KPICache.filter({ cache_key: cacheKey });

      if (existingCache.length > 0) {
        // Use cached values
        setKpis(existingCache[0]);
        return;
      }

      // Calculate KPIs (simple count queries only)
      const [allJobs, allWorkOrders, allOffers, allLeads, allTechnicians] = await Promise.all([
        base44.entities.Job.list('-created_date', 200),
        base44.entities.WorkOrder.list('-scheduled_date', 200),
        base44.entities.Offer.list('-created_date', 100),
        base44.entities.Lead.list('-created_date', 100),
        base44.entities.Technician.list()
      ]);

      // Count active projects
      const activeProjects = allJobs.filter(j => !['Completed', 'Invoiced', 'Cancelled'].includes(j.status)).length;

      // Count open work orders
      const openWorkOrders = allWorkOrders.filter(wo => !['Completed', 'Cancelled'].includes(wo.status)).length;

      // Count open offers
      const openOffers = allOffers.filter(o => !['Approved', 'Rejected', 'Expired', 'Converted'].includes(o.status)).length;

      // Count active leads
      const activeLeads = allLeads.filter(l => !['Converted', 'Rejected', 'Lost'].includes(l.status)).length;

      // Calculate capacity today (assigned techs / total techs)
      const todayWOs = allWorkOrders.filter(wo => {
        if (!wo.scheduled_date) return false;
        return isToday(parseISO(wo.scheduled_date));
      });
      const assignedTechIds = new Set();
      todayWOs.forEach(wo => {
        if (wo.assigned_technicians) {
          wo.assigned_technicians.forEach(id => assignedTechIds.add(id));
        }
      });
      const activeTechs = allTechnicians.filter(t => t.status === 'Active').length;
      const capacityToday = activeTechs > 0 ? Math.round((assignedTechIds.size / activeTechs) * 100) : 0;

      // Store in cache
      const kpiData = {
        cache_key: cacheKey,
        date: todayDate,
        period: currentPeriod,
        active_projects: activeProjects,
        open_work_orders: openWorkOrders,
        open_offers: openOffers,
        active_leads: activeLeads,
        capacity_today: capacityToday
      };

      const newCache = await base44.entities.KPICache.create(kpiData);
      setKpis(newCache);
    } catch (error) {
      console.error('Error loading KPIs:', error);
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
  const criticalProjects = activeJobs.filter(job => getProjectHealth(job).status === 'red');

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Operational overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => setShowDispatchModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Calendar className="h-4 w-4 mr-1" />
            Dispatch
          </Button>
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
      <Card className={hasActionItems ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 bg-emerald-50/30'}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${hasActionItems ? 'text-red-900' : 'text-emerald-800'}`}>
            {hasActionItems ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            {hasActionItems ? 'Action Required' : 'All Clear'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasActionItems && (
            <p className="text-sm text-emerald-700">No critical action items. Everything is on track.</p>
          )}

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
                          <p className="text-sm text-slate-600 mt-1">{jobInfo?.boat} • {jobInfo?.customer}</p>
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
                          <p className="text-sm text-slate-600 mt-1">{jobInfo?.boat} • {jobInfo?.customer}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {!wo.scheduled_date && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">No date</Badge>
                            )}
                            {(!wo.assigned_technicians || wo.assigned_technicians.length === 0) && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">No technician</Badge>
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
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{openOffers.length} offer{openOffers.length !== 1 ? 's' : ''} awaiting response</p>
                  <p className="text-xs text-slate-500">Follow up with customers</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('Offers')}>View Offers</Link>
              </Button>
            </div>
          )}

          {staleLeads.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{staleLeads.length} lead{staleLeads.length !== 1 ? 's' : ''} without recent contact</p>
                  <p className="text-xs text-slate-500">No activity in over 7 days</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('LeadsV2')}>View Leads</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2) TODAY */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Today
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowDispatchModal(true)}>
              <Calendar className="h-4 w-4 mr-1" />
              Schedule
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayWorkOrders.length === 0 ? (
            <p className="text-sm text-slate-500">No work orders scheduled for today</p>
          ) : (
            <div className="space-y-2">
              {todayWorkOrders.slice(0, 4).map(wo => {
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
                        <p className="text-sm text-slate-600 mt-1">{jobInfo?.boat} • {jobInfo?.location}</p>
                        {wo.scheduled_start_time && (
                          <p className="text-xs text-slate-500 mt-1">{wo.scheduled_start_time}</p>
                        )}
                      </div>
                      <Badge className={statusColors[wo.status] || 'bg-slate-100 text-slate-700'}>{wo.status}</Badge>
                    </div>
                  </Link>
                );
              })}
              {todayWorkOrders.length > 4 && (
                <Button variant="outline" size="sm" onClick={() => setShowDispatchModal(true)} className="w-full">
                  +{todayWorkOrders.length - 4} more — Open Schedule
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3) NOTES & REMINDERS */}
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
                <div key={note.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
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
                        <span className="text-xs text-slate-500">{getAge(note.created_date)} ago</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleNoteComplete(note)}>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteNote(note.id)}>
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

      {/* 4) PROJECT ALERTS — only when critical/red projects exist */}
      {criticalProjects.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Critical Projects ({criticalProjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criticalProjects.map(job => {
                const health = getProjectHealth(job);
                const boat = boats.find(b => b.id === job.boat_id);
                const location = locations.find(l => l.id === job.location_id);
                return (
                  <Link
                    key={job.id}
                    to={createPageUrl('JobDetail') + `?id=${job.id}`}
                    className="block p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="h-3 w-3 rounded-full bg-red-500" />
                          <p className="font-medium text-slate-900">{job.title}</p>
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{health.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          {boat && <div className="flex items-center gap-1"><Ship className="h-3.5 w-3.5" />{boat.vessel_name}</div>}
                          {location && <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{location.name}</div>}
                        </div>
                        <p className="text-xs text-red-700 mt-1 italic">{health.step}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
              {activeJobs.length > criticalProjects.length && (
                <p className="text-xs text-slate-500 pt-1">
                  {activeJobs.length - criticalProjects.length} other active project{activeJobs.length - criticalProjects.length !== 1 ? 's' : ''} are on track. <Link to={createPageUrl('Jobs')} className="text-blue-600 underline">View all projects</Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5) KPI OVERVIEW — secondary, management reference */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Link to={createPageUrl('Jobs')} className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Active Projects</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.active_projects}</p>
                  </div>
                  <Briefcase className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl('WorkOrders')} className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Open Work Orders</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.open_work_orders}</p>
                  </div>
                  <Clock className="h-8 w-8 text-indigo-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl('Offers')} className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Open Offers</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.open_offers}</p>
                  </div>
                  <FileText className="h-8 w-8 text-cyan-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to={createPageUrl('LeadsV2')} className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Active Leads</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.active_leads}</p>
                  </div>
                  <Phone className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <div onClick={() => setShowCapacityModal(true)} className="cursor-pointer">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Capacity Today</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{kpis.capacity_today}%</p>
                  </div>
                  <Users className="h-8 w-8 text-emerald-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

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

      {/* Capacity Modal */}
      <CapacityModal open={showCapacityModal} onOpenChange={setShowCapacityModal} />

      {/* Dispatch Fullscreen Modal */}
      <DispatchFullscreenModal open={showDispatchModal} onClose={() => setShowDispatchModal(false)} />

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
              <p className="text-xs text-slate-500 mt-1">{noteForm.text.length}/300 characters</p>
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
                      <SelectItem key={c.id} value={c.id}>{c.company_name || `${c.first_name} ${c.last_name}`}</SelectItem>
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
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveNote}>Save Note</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}