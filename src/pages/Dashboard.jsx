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
  CheckCircle2,
  Phone,
  FileText,
  Briefcase,
  StickyNote,
  X,
  Zap,
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
import { format, parseISO, isPast, isToday, differenceInDays, addDays } from 'date-fns';
import { toast } from 'sonner';
import CapacityModal from '@/components/dashboard/CapacityModal';
import DispatchFullscreenModal from '@/components/dispatch/DispatchFullscreenModal';
import DashboardQuickActions from '@/components/dashboard/DashboardQuickActions';
import EmailToLeadParser from '@/components/leadsV2/EmailToLeadParser';

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
  const [quickCaptureEntries, setQuickCaptureEntries] = useState([]);

  // Modal/dialog state
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showEmailToLeadDialog, setShowEmailToLeadDialog] = useState(false);

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
      const [woData, jobsData, custData, boatsData, locData, leadsData, offersData, notesData, qcData] = await Promise.all([
        base44.entities.WorkOrder.list('-scheduled_date', 100),
        base44.entities.Job.list('-created_date', 50),
        base44.entities.Customer.list('-created_date', 50),
        base44.entities.Boat.list('-created_date', 50),
        base44.entities.Location.list(),
        base44.entities.Lead.list('-created_date', 30),
        base44.entities.Offer.list('-created_date', 30),
        base44.entities.Note.list('-created_date', 50),
        base44.entities.QuickCaptureEntry.filter({ status: 'pending_review' }, '-created_date', 20).catch(() => []),
      ]);

      setWorkOrders(woData);
      setJobs(jobsData);
      setCustomers(custData);
      setBoats(boatsData);
      setLocations(locData);
      setLeads(leadsData);
      setOffers(offersData);
      setNotes(notesData);
      setQuickCaptureEntries(qcData);

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

      const existingCache = await base44.entities.KPICache.filter({ cache_key: cacheKey });
      if (existingCache.length > 0) {
        setKpis(existingCache[0]);
        return;
      }

      const [allJobs, allWorkOrders, allOffers, allLeads, allTechnicians] = await Promise.all([
        base44.entities.Job.list('-created_date', 200),
        base44.entities.WorkOrder.list('-scheduled_date', 200),
        base44.entities.Offer.list('-created_date', 100),
        base44.entities.Lead.list('-created_date', 100),
        base44.entities.Technician.list()
      ]);

      const activeProjects = allJobs.filter(j => !['Completed', 'Invoiced', 'Cancelled'].includes(j.status)).length;
      const openWorkOrders = allWorkOrders.filter(wo => !['Completed', 'Cancelled'].includes(wo.status)).length;
      const openOffers = allOffers.filter(o => !['Approved', 'Rejected', 'Expired', 'Converted'].includes(o.status)).length;
      const activeLeads = allLeads.filter(l => !['Converted', 'Rejected', 'Lost'].includes(l.status)).length;

      const todayWOs = allWorkOrders.filter(wo => wo.scheduled_date && isToday(parseISO(wo.scheduled_date)));
      const assignedTechIds = new Set();
      todayWOs.forEach(wo => { if (wo.assigned_technicians) wo.assigned_technicians.forEach(id => assignedTechIds.add(id)); });
      const activeTechs = allTechnicians.filter(t => t.status === 'Active').length;
      const capacityToday = activeTechs > 0 ? Math.round((assignedTechIds.size / activeTechs) * 100) : 0;

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

  // Helpers
  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return 'Unknown';
    return customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  };

  const getBoatName = (boatId) => boats.find(b => b.id === boatId)?.vessel_name || 'Unknown';

  const getLocationName = (locationId) => {
    if (!locationId) return '';
    return locations.find(l => l.id === locationId)?.name || '';
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

  const today = new Date();

  const getAge = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const days = differenceInDays(today, parseISO(dateStr));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  // Derived data
  const overdueWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    if (!wo.scheduled_date) return false;
    return isPast(parseISO(wo.scheduled_date)) && !isToday(parseISO(wo.scheduled_date));
  });

  const unplannedWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    return !wo.scheduled_date || !wo.assigned_technicians || wo.assigned_technicians.length === 0;
  });

  const openOffers = offers.filter(o => !['Approved', 'Rejected', 'Expired', 'Converted'].includes(o.status));

  const staleLeads = leads.filter(l => {
    if (['Converted', 'Rejected', 'Lost'].includes(l.status)) return false;
    if (!l.last_contacted_at) return true;
    return differenceInDays(today, parseISO(l.last_contacted_at)) > 7;
  });

  const todayWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    return wo.scheduled_date && isToday(parseISO(wo.scheduled_date));
  });

  const thisWeekWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    if (!wo.scheduled_date) return false;
    const daysAway = differenceInDays(parseISO(wo.scheduled_date), today);
    return daysAway > 0 && daysAway <= 7;
  });

  const allOpenLeads = leads.filter(l => !['Converted', 'Rejected', 'Lost'].includes(l.status));
  const allOpenOffers = offers.filter(o => !['Approved', 'Rejected', 'Expired', 'Converted'].includes(o.status));
  const hasActionItems = overdueWorkOrders.length > 0 || unplannedWorkOrders.length > 0 || openOffers.length > 0 || staleLeads.length > 0;
  const activeNotes = notes.filter(n => !n.completed);

  // Notes handlers
  const handleSaveNote = async () => {
    if (!noteForm.text.trim()) { toast.error('Note text is required'); return; }
    if (noteForm.text.length > 300) { toast.error('Note must be 300 characters or less'); return; }
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

  const getReferenceName = (note) => {
    if (note.reference_type === 'Job') return jobs.find(j => j.id === note.reference_id)?.title || 'Unknown Project';
    if (note.reference_type === 'WorkOrder') return workOrders.find(w => w.id === note.reference_id)?.title || 'Unknown Work Order';
    if (note.reference_type === 'Customer') return getCustomerName(note.reference_id);
    return null;
  };

  // Email to Lead handler
  const handleEmailLeadParsed = async (leadData) => {
    try {
      const newLead = await base44.entities.Lead.create(leadData);
      setLeads([newLead, ...leads]);
      setShowEmailToLeadDialog(false);
      toast.success('Lead from email created');
    } catch (error) {
      console.error('Error creating lead from email:', error);
      toast.error('Failed to create lead');
    }
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

      {/* ── 1. HEADER + QUICK ACTIONS ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Operational overview</p>
        </div>
        <DashboardQuickActions
          onDispatch={() => setShowDispatchModal(true)}
          onEmailToLead={() => setShowEmailToLeadDialog(true)}
          onNote={() => setShowNoteDialog(true)}
        />
      </div>

      {/* ── 2. KPI ── */}
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

          <Link to={createPageUrl('Leads')} className="block">
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

      {/* ── 3. QUICK CAPTURE REVIEWS ── */}
      {quickCaptureEntries.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-slate-900">
                    Quick Capture Review
                  </p>
                  <p className="text-sm text-slate-600">
                    {quickCaptureEntries.length} {quickCaptureEntries.length === 1 ? 'entry' : 'entries'} pending review
                  </p>
                </div>
              </div>
              <Button size="sm" asChild className="bg-amber-600 hover:bg-amber-700 text-white">
                <Link to={createPageUrl('QuickCaptureReview')}>
                  Review Now
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 4 + 5. TODAY / THIS WEEK ── */}
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
                          <p className="text-sm text-slate-600 mt-1">{jobInfo?.boat} • {jobInfo?.location}</p>
                          {wo.scheduled_start_time && (
                            <p className="text-xs text-slate-500 mt-1">{wo.scheduled_start_time}</p>
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
                          <p className="text-sm text-slate-600 mt-1">{jobInfo?.boat} • {jobInfo?.location}</p>
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

      {/* ── 6. ACTION REQUIRED ── */}
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
                          <p className="text-sm text-slate-600 mt-1">{getCustomerName(offer.customer_id)}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{offer.status}</Badge>
                            <span className="text-xs text-slate-500">{getAge(offer.created_date)} old</span>
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
                          <p className="text-sm text-slate-600 mt-1">{lead.boat_name || 'No boat specified'}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{lead.status}</Badge>
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

      {/* ── 7. NOTES & REMINDERS ── */}
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

      {/* ── 8 + 9. OPEN LEADS / OPEN OFFERS ── */}
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
                        <p className="text-sm text-slate-600 mt-1">{lead.boat_name || 'No boat specified'}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{lead.status}</Badge>
                          <span className="text-xs text-slate-500">{getAge(lead.created_date)} old</span>
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
                        <p className="text-sm text-slate-600 mt-1">{getCustomerName(offer.customer_id)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">{offer.status}</Badge>
                          <span className="text-xs text-slate-500">{getAge(offer.created_date)} old</span>
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

      {/* ── MODALS & DIALOGS ── */}

      {/* Capacity Modal */}
      <CapacityModal open={showCapacityModal} onOpenChange={setShowCapacityModal} />

      {/* Dispatch Fullscreen Modal */}
      <DispatchFullscreenModal open={showDispatchModal} onClose={() => setShowDispatchModal(false)} />

      {/* E-Mail to Lead Parser Dialog */}
      <Dialog open={showEmailToLeadDialog} onOpenChange={setShowEmailToLeadDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail to Lead</DialogTitle>
          </DialogHeader>
          <EmailToLeadParser
            onLeadParsed={handleEmailLeadParsed}
            onCancel={() => setShowEmailToLeadDialog(false)}
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
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveNote}>Save Note</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}