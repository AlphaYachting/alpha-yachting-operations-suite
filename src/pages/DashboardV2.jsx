/**
 * DASHBOARD V2 — Main orchestrator page
 *
 * Section order (frozen):
 *  1. Quick Actions (DashboardV2QuickActions)
 *  2. KPI (DashboardV2KPISection)
 *  3. Quick Capture Review banner (DashboardV2QuickCaptureBanner)
 *  4. Today  (DashboardV2TodaySection)
 *  5. This Week (DashboardV2ThisWeekSection)
 *  6. Action Required (DashboardV2ActionRequiredSection)
 *  7. Notes & Reminders (DashboardV2NotesSection)
 *  8. Open Leads (DashboardV2OpenLeadsSection)
 *  9. Open Offers (DashboardV2OpenOffersSection)
 *
 * NOT included: Project Health
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isPast, isToday, differenceInDays, addDays } from 'date-fns';
import { toast } from 'sonner';

// UI
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar } from 'lucide-react';

// Modals
import CapacityModal from '@/components/dashboard/CapacityModal';
import DispatchFullscreenModal from '@/components/dispatch/DispatchFullscreenModal';
import EmailToLeadParser from '@/components/leadsV2/EmailToLeadParser';

// V2 Isolated sections
import DashboardV2QuickActions from '@/components/dashboardV2/DashboardV2QuickActions';
import DashboardV2KPISection from '@/components/dashboardV2/DashboardV2KPISection';
import DashboardV2QuickCaptureBanner from '@/components/dashboardV2/DashboardV2QuickCaptureBanner';
import DashboardV2TodaySection from '@/components/dashboardV2/DashboardV2TodaySection';
import DashboardV2ThisWeekSection from '@/components/dashboardV2/DashboardV2ThisWeekSection';
import DashboardV2ActionRequiredSection from '@/components/dashboardV2/DashboardV2ActionRequiredSection';
import DashboardV2NotesSection from '@/components/dashboardV2/DashboardV2NotesSection';
import DashboardV2OpenLeadsSection from '@/components/dashboardV2/DashboardV2OpenLeadsSection';
import DashboardV2OpenOffersSection from '@/components/dashboardV2/DashboardV2OpenOffersSection';

export default function DashboardV2() {
  const [loading, setLoading] = useState(true);

  // Data
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [offers, setOffers] = useState([]);
  const [notes, setNotes] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [quickCaptureCount, setQuickCaptureCount] = useState(0);

  // Modal state
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showEmailToLeadDialog, setShowEmailToLeadDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showCapacityModal, setShowCapacityModal] = useState(false);

  // Note form state
  const [noteForm, setNoteForm] = useState({
    text: '',
    reference_type: 'None',
    reference_id: '',
    due_date: null,
  });

  // Email-to-Lead: after parse, open LeadsV2 create dialog
  const [parsedLeadData, setParsedLeadData] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [woData, jobsData, custData, boatsData, locData, leadsData, offersData, notesData] =
        await Promise.all([
          base44.entities.WorkOrder.list('-scheduled_date', 100),
          base44.entities.Job.list('-created_date', 50),
          base44.entities.Customer.list('-created_date', 50),
          base44.entities.Boat.list('-created_date', 50),
          base44.entities.Location.list(),
          base44.entities.Lead.list('-created_date', 30),
          base44.entities.Offer.list('-created_date', 30),
          base44.entities.Note.list('-created_date', 50),
        ]);

      setWorkOrders(woData);
      setJobs(jobsData);
      setCustomers(custData);
      setBoats(boatsData);
      setLocations(locData);
      setLeads(leadsData);
      setOffers(offersData);
      setNotes(notesData);

      // Quick Capture pending count
      try {
        const qcData = await base44.entities.QuickCaptureEntry.filter(
          { review_status: 'new' },
          '-created_date',
          200
        );
        setQuickCaptureCount(qcData.length);
      } catch {
        setQuickCaptureCount(0);
      }

      await loadKPIs();
    } catch (err) {
      console.error('DashboardV2 load error:', err);
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
        base44.entities.Technician.list(),
      ]);

      const activeProjects = allJobs.filter(
        j => !['Completed', 'Invoiced', 'Cancelled'].includes(j.status)
      ).length;
      const openWorkOrders = allWorkOrders.filter(
        wo => !['Completed', 'Cancelled'].includes(wo.status)
      ).length;
      const openOffers = allOffers.filter(
        o => !['Approved', 'Rejected', 'Expired', 'Converted'].includes(o.status)
      ).length;
      const activeLeads = allLeads.filter(
        l => !['Converted', 'Rejected', 'Lost'].includes(l.status)
      ).length;

      const todayWOs = allWorkOrders.filter(wo => {
        if (!wo.scheduled_date) return false;
        return isToday(parseISO(wo.scheduled_date));
      });
      const assignedTechIds = new Set();
      todayWOs.forEach(wo => {
        if (wo.assigned_technicians) wo.assigned_technicians.forEach(id => assignedTechIds.add(id));
      });
      const activeTechs = allTechnicians.filter(t => t.status === 'Active').length;
      const capacityToday = activeTechs > 0
        ? Math.round((assignedTechIds.size / activeTechs) * 100)
        : 0;

      const kpiData = {
        cache_key: cacheKey,
        date: todayDate,
        period: currentPeriod,
        active_projects: activeProjects,
        open_work_orders: openWorkOrders,
        open_offers: openOffers,
        active_leads: activeLeads,
        capacity_today: capacityToday,
      };
      const newCache = await base44.entities.KPICache.create(kpiData);
      setKpis(newCache);
    } catch (err) {
      console.error('KPI load error:', err);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const today = new Date();

  const getCustomerName = (customerId) => {
    const c = customers.find(c => c.id === customerId);
    if (!c) return 'Unknown';
    return c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
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
      location: getLocationName(job.location_id),
    };
  };

  const getAge = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const days = differenceInDays(today, parseISO(dateStr));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const getReferenceName = (note) => {
    if (note.reference_type === 'Job') {
      return jobs.find(j => j.id === note.reference_id)?.title || 'Unknown Project';
    }
    if (note.reference_type === 'WorkOrder') {
      return workOrders.find(w => w.id === note.reference_id)?.title || 'Unknown Work Order';
    }
    if (note.reference_type === 'Customer') {
      return getCustomerName(note.reference_id);
    }
    return null;
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const todayWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    if (!wo.scheduled_date) return false;
    return isToday(parseISO(wo.scheduled_date));
  });

  const thisWeekWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    if (!wo.scheduled_date) return false;
    const days = differenceInDays(parseISO(wo.scheduled_date), today);
    return days > 0 && days <= 7;
  });

  const overdueWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    if (!wo.scheduled_date) return false;
    const d = parseISO(wo.scheduled_date);
    return isPast(d) && !isToday(d);
  });

  const unplannedWorkOrders = workOrders.filter(wo => {
    if (['Completed', 'Cancelled'].includes(wo.status)) return false;
    return !wo.scheduled_date || !wo.assigned_technicians || wo.assigned_technicians.length === 0;
  });

  const actionRequiredOffers = offers.filter(
    o => !['Approved', 'Rejected', 'Expired', 'Converted'].includes(o.status)
  );

  const staleLeads = leads.filter(l => {
    if (['Converted', 'Rejected', 'Lost'].includes(l.status)) return false;
    if (!l.last_contacted_at) return true;
    return differenceInDays(today, parseISO(l.last_contacted_at)) > 7;
  });

  // ─── Note handlers ────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!noteForm.text.trim()) {
      toast.error('Note text is required');
      return;
    }
    if (noteForm.text.length > 300) {
      toast.error('Note must be 300 characters or less');
      return;
    }
    const noteData = {
      text: noteForm.text.trim(),
      reference_type: noteForm.reference_type,
      reference_id: noteForm.reference_type !== 'None' ? noteForm.reference_id : null,
      due_date: noteForm.due_date ? format(noteForm.due_date, 'yyyy-MM-dd') : null,
      completed: false,
    };
    const newNote = await base44.entities.Note.create(noteData);
    setNotes([newNote, ...notes]);
    setShowNoteDialog(false);
    setNoteForm({ text: '', reference_type: 'None', reference_id: '', due_date: null });
    toast.success('Note created');
  };

  const handleToggleNoteComplete = async (note) => {
    await base44.entities.Note.update(note.id, { completed: !note.completed });
    setNotes(notes.map(n => n.id === note.id ? { ...n, completed: !n.completed } : n));
  };

  const handleDeleteNote = async (noteId) => {
    await base44.entities.Note.delete(noteId);
    setNotes(notes.filter(n => n.id !== noteId));
    toast.success('Note deleted');
  };

  // ─── Email-to-Lead handler ────────────────────────────────────────────────
  const handleLeadParsed = async (leadData) => {
    // Create the lead directly and notify
    const newLead = await base44.entities.Lead.create(leadData);
    setLeads([newLead, ...leads]);
    setShowEmailToLeadDialog(false);
    setParsedLeadData(null);
    toast.success('Lead created from email');
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Operational overview</p>
        </div>

        {/* ① QUICK ACTIONS — isolated, frozen */}
        <DashboardV2QuickActions
          onDispatch={() => setShowDispatchModal(true)}
          onEmailToLead={() => setShowEmailToLeadDialog(true)}
          onNote={() => setShowNoteDialog(true)}
        />
      </div>

      {/* ② KPI SECTION */}
      <DashboardV2KPISection
        kpis={kpis}
        onCapacityClick={() => setShowCapacityModal(true)}
      />

      {/* ③ QUICK CAPTURE REVIEW BANNER */}
      <DashboardV2QuickCaptureBanner count={quickCaptureCount} />

      {/* ④ TODAY + ⑤ THIS WEEK — side by side */}
      <div className="grid md:grid-cols-2 gap-6">
        <DashboardV2TodaySection
          workOrders={todayWorkOrders}
          getJobInfo={getJobInfo}
        />
        <DashboardV2ThisWeekSection
          workOrders={thisWeekWorkOrders}
          getJobInfo={getJobInfo}
        />
      </div>

      {/* ⑥ ACTION REQUIRED */}
      <DashboardV2ActionRequiredSection
        overdueWorkOrders={overdueWorkOrders}
        unplannedWorkOrders={unplannedWorkOrders}
        openOffers={actionRequiredOffers}
        staleLeads={staleLeads}
        getJobInfo={getJobInfo}
        getCustomerName={getCustomerName}
        getAge={getAge}
      />

      {/* ⑦ NOTES & REMINDERS */}
      <DashboardV2NotesSection
        notes={notes}
        getReferenceName={getReferenceName}
        getAge={getAge}
        onToggleComplete={handleToggleNoteComplete}
        onDelete={handleDeleteNote}
      />

      {/* ⑧ OPEN LEADS + ⑨ OPEN OFFERS — side by side */}
      <div className="grid md:grid-cols-2 gap-6">
        <DashboardV2OpenLeadsSection leads={leads} getAge={getAge} />
        <DashboardV2OpenOffersSection
          offers={offers}
          getCustomerName={getCustomerName}
          getAge={getAge}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS — owned at orchestrator level
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Dispatch */}
      <DispatchFullscreenModal
        open={showDispatchModal}
        onClose={() => setShowDispatchModal(false)}
      />

      {/* Capacity */}
      <CapacityModal open={showCapacityModal} onOpenChange={setShowCapacityModal} />

      {/* E-Mail to Lead parser dialog */}
      <Dialog open={showEmailToLeadDialog} onOpenChange={setShowEmailToLeadDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail zu Lead</DialogTitle>
          </DialogHeader>
          <EmailToLeadParser
            onLeadParsed={handleLeadParsed}
            onCancel={() => setShowEmailToLeadDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="v2-note-text">Note Text *</Label>
              <Textarea
                id="v2-note-text"
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
              <Label>Link to (Optional)</Label>
              <Select
                value={noteForm.reference_type}
                onValueChange={(v) => setNoteForm({ ...noteForm, reference_type: v, reference_id: '' })}
              >
                <SelectTrigger className="mt-1">
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
                <Label>Select {noteForm.reference_type}</Label>
                <Select
                  value={noteForm.reference_id}
                  onValueChange={(v) => setNoteForm({ ...noteForm, reference_id: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={`Select ${noteForm.reference_type}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {noteForm.reference_type === 'Job' && jobs.map(j => (
                      <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
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