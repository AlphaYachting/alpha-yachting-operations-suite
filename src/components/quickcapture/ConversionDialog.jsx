import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, X } from 'lucide-react';

/**
 * ConversionDialog — converts a QuickCaptureEntry into an operational record.
 *
 * Props:
 *   entry         — QuickCaptureEntry object
 *   customers     — Customer[] for picker
 *   boats         — Boat[] for picker
 *   forcedTarget  — string | null  (e.g. 'Lead', 'Task', 'Note', 'Offer', 'CustomerMaterialEntry')
 *   onSuccess     — ({ recordType, recordId }) => void
 *   onCancel      — () => void
 */
export default function ConversionDialog({ entry, customers, boats, forcedTarget, onSuccess, onCancel }) {
  const navigate = useNavigate();

  const [target, setTarget] = useState(forcedTarget || 'Note');
  const [saving, setSaving] = useState(false);

  // --- shared fields ---
  const [customerId, setCustomerId] = useState(entry.customer_id || '');
  const [boatId, setBoatId] = useState(entry.boat_id || '');
  const [notes, setNotes] = useState(entry.raw_input || '');

  // --- Lead fields ---
  const [leadName, setLeadName] = useState(entry.ai_extracted_customer_name || '');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');

  // --- Task fields ---
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [workOrderId, setWorkOrderId] = useState('');
  const [taskTitle, setTaskTitle] = useState(entry.suggested_summary || entry.raw_input?.slice(0, 80) || '');
  const [loadingWOs, setLoadingWOs] = useState(false);
  const [showNewWO, setShowNewWO] = useState(false);
  const [newWOTitle, setNewWOTitle] = useState('');
  const [newWOJobId, setNewWOJobId] = useState('');
  const [creatingWO, setCreatingWO] = useState(false);

  // --- Material entry fields ---
  const [itemTitle, setItemTitle] = useState(entry.suggested_summary || '');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');

  // --- Offer fields ---
  const [offerTitle, setOfferTitle] = useState(entry.suggested_summary || entry.raw_input?.slice(0, 80) || '');

  // --- TimeEntry fields ---
  const [timeEntryWOId, setTimeEntryWOId] = useState('');
  const [timeEntryTechnicianId, setTimeEntryTechnicianId] = useState('');
  const [timeEntryDate, setTimeEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [timeEntryHours, setTimeEntryHours] = useState('');
  const [timeEntryNotes, setTimeEntryNotes] = useState('');
  const [technicians, setTechnicians] = useState([]);

  // Parse daily report info from review_notes
  const dailyReportParsed = (() => {
    const rn = entry.review_notes || '';
    const drMatch = rn.match(/DAILY REPORT VISIT \| (.+?) \| ([\d.]+) Stunden/);
    if (drMatch) {
      const desc = drMatch[1];
      const hours = drMatch[2];
      // Extract location
      const locMatch = rn.match(/Ort: (.+)$/);
      const loc = locMatch ? locMatch[1] : '';
      return { desc, hours: parseFloat(hours) || 0, location: loc !== '—' ? loc : '' };
    }
    return null;
  })();

  const ACTIVE_STATUSES = ['Draft','Scheduled','Dispatched','In Transit','In Progress','Paused','Waiting for Parts','Waiting for Approval','Ready to Invoice'];

  // Load work orders when target is Task — FIX: all active statuses, load jobs for new WO creation
  useEffect(() => {
    if (target !== 'Task') return;
    setLoadingWOs(true);
    base44.entities.WorkOrder.list('-created_date', 200)
      .then(wos => {
        const activeWOs = wos.filter(wo => ACTIVE_STATUSES.includes(wo.status));
        if (customerId) {
          base44.entities.Job.filter({ customer_id: customerId }).then(jobList => {
            setJobs(jobList);
            const jobIds = new Set(jobList.map(j => j.id));
            setWorkOrders(activeWOs.filter(wo => jobIds.has(wo.job_id)));
          });
        } else {
          base44.entities.Job.list('-created_date', 200).then(jobList => setJobs(jobList));
          setWorkOrders(activeWOs);
        }
      })
      .finally(() => setLoadingWOs(false));
  }, [target, customerId]);

  // Pre-fill lead name from linked customer
  useEffect(() => {
    if (!leadName && customerId) {
      const c = customers.find(x => x.id === customerId);
      if (c) setLeadName(c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim());
    }
  }, [customerId]);

  // Load technicians & pre-fill when target is TimeEntry
  useEffect(() => {
    if (target !== 'TimeEntry') return;
    base44.entities.Technician.filter({ status: 'Active' }, '-last_name', 200)
      .then(techs => setTechnicians(techs || []));
    // Pre-fill from daily report parsed data
    if (dailyReportParsed) {
      setTimeEntryHours(String(dailyReportParsed.hours));
      setTimeEntryNotes(dailyReportParsed.desc);
    }
  }, [target]);

  // Load work orders when target is TimeEntry and customer selected
  useEffect(() => {
    if (target !== 'TimeEntry' || !customerId) return;
    base44.entities.Job.filter({ customer_id: customerId }).then(jobList => {
      const jobIds = new Set(jobList.map(j => j.id));
      base44.entities.WorkOrder.filter({ status: 'In Progress' }, '-created_date', 200)
        .then(wos => {
          setWorkOrders((wos || []).filter(wo => jobIds.has(wo.job_id)));
        });
    });
  }, [target, customerId]);

  const writeTraceability = async (recordType, recordId) => {
    const user = await base44.auth.me();
    await base44.entities.QuickCaptureEntry.update(entry.id, {
      review_status: 'routed',
      routed_record_type: recordType,
      routed_record_id: recordId,
      routed_at: new Date().toISOString(),
      routed_by: user?.email || '',
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let recordType = target;
      let recordId = null;

      if (target === 'Note') {
        const note = await base44.entities.Note.create({
          content: notes,
          reference_type: customerId ? 'Customer' : 'Internal',
          reference_id: customerId || null,
          note_type: entry.suggested_type === 'tool_tracking' ? 'equipment_on_site' : 'general',
        });
        recordId = note.id;

      } else if (target === 'Lead') {
        if (!leadName.trim()) { toast.error('Name is required'); setSaving(false); return; }
        const lead = await base44.entities.Lead.create({
          name: leadName.trim(),
          phone: leadPhone.trim() || '—',
          email: leadEmail.trim() || undefined,
          customer_id: customerId || undefined,
          notes: notes,
          description: entry.raw_input,
          status: 'New Incoming',
          inquiry_type: 'Service Inquiry',
          contact_method: 'Other',
        });
        recordId = lead.id;
        await writeTraceability(recordType, recordId);
        onSuccess({ recordType, recordId });
        navigate(createPageUrl('LeadDetail') + `?id=${recordId}`);
        return;

      } else if (target === 'Offer') {
        if (!customerId) { toast.error('Customer is required for an Offer'); setSaving(false); return; }
        
        // Generate offer number (same pattern as frontend: OFF-YYYY-XXXX)
        const currentYear = new Date().getFullYear();
        const allOffers = await base44.entities.Offer.list('-created_date', 5000);
        const existingNumbers = allOffers
          .map(o => o.offer_number)
          .filter(num => num && num.startsWith(`OFF-${currentYear}-`))
          .map(num => parseInt(num.split('-')[2]) || 0);
        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        const offerNumber = `OFF-${currentYear}-${String(maxNumber + 1).padStart(4, '0')}`;
        
        const offer = await base44.entities.Offer.create({
          offer_number: offerNumber,
          customer_id: customerId,
          boat_id: boatId || undefined,
          title: offerTitle.trim() || 'Offer from Quick Capture',
          description: entry.raw_input,
          status: 'Draft',
        });
        recordId = offer.id;
        await writeTraceability(recordType, recordId);
        onSuccess({ recordType, recordId });
        navigate(createPageUrl('OfferDetail') + `?id=${recordId}`);
        return;

      } else if (target === 'Task') {
        if (!workOrderId) { toast.error('Please select a Work Order'); setSaving(false); return; }
        const task = await base44.entities.Task.create({
          work_order_id: workOrderId,
          title: taskTitle.trim() || entry.raw_input?.slice(0, 80) || 'Task from Quick Capture',
          notes: notes,
          status: 'Not Started',
        });
        recordId = task.id;

      } else if (target === 'TimeEntry') {
        if (!customerId) { toast.error('Customer is required'); setSaving(false); return; }
        if (!timeEntryWOId) { toast.error('Please select a Work Order'); setSaving(false); return; }
        if (!timeEntryTechnicianId) { toast.error('Please select a Technician'); setSaving(false); return; }
        const durationMin = Math.round(parseFloat(timeEntryHours || '0') * 60);
        if (durationMin <= 0) { toast.error('Hours must be > 0'); setSaving(false); return; }
        const te = await base44.entities.TimeEntry.create({
          work_order_id: timeEntryWOId,
          technician_id: timeEntryTechnicianId,
          entry_date: timeEntryDate,
          duration_minutes: durationMin,
          notes: timeEntryNotes || notes,
          is_billable: true,
        });
        recordId = te.id;
        recordType = 'TimeEntry';

      } else if (target === 'CustomerMaterialEntry') {
        if (!customerId) { toast.error('Customer is required for a Material Entry'); setSaving(false); return; }
        const mat = await base44.entities.CustomerMaterialEntry.create({
          customer_id: customerId,
          item_title: itemTitle.trim() || entry.raw_input?.slice(0, 80) || 'Material from Quick Capture',
          quantity: Number(quantity) || 1,
          unit_purchase_price: unitPrice ? Number(unitPrice) : undefined,
          total_purchase_price: unitPrice ? Number(quantity) * Number(unitPrice) : undefined,
          notes: notes,
          source_type: 'manual',
          billing_status: 'offen',
        });
        recordId = mat.id;
      }

      await writeTraceability(recordType, recordId);
      toast.success('Entry converted successfully');
      onSuccess({ recordType, recordId });
    } catch (err) {
      toast.error('Failed to convert: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const customerOptions = customers.map(c => ({
    id: c.id,
    label: c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
  }));

  const availableJobs = customerId ? jobs.filter(j => j.customer_id === customerId) : jobs;

  const handleCreateNewWO = async () => {
    if (!newWOTitle.trim()) { toast.error('Bitte einen Titel eingeben'); return; }
    if (!newWOJobId) { toast.error('Bitte ein Projekt auswählen'); return; }
    setCreatingWO(true);
    try {
      const wo = await base44.entities.WorkOrder.create({
        job_id: newWOJobId,
        title: newWOTitle.trim(),
        status: 'Draft',
        scheduled_date: new Date().toISOString().slice(0, 10),
      });
      setWorkOrders(prev => [wo, ...prev]);
      setWorkOrderId(wo.id);
      setShowNewWO(false);
      setNewWOTitle('');
      setNewWOJobId('');
      toast.success('Work Order angelegt');
    } catch (err) {
      toast.error('Fehler: ' + err.message);
    } finally {
      setCreatingWO(false);
    }
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Capture Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target selector — only if not forced */}
          {!forcedTarget && (
            <div className="space-y-1">
              <Label>Convert to</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Note">Customer Note</SelectItem>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Offer">Offer Draft</SelectItem>
                  <SelectItem value="Task">Task (under Work Order)</SelectItem>
                  <SelectItem value="CustomerMaterialEntry">Material Entry</SelectItem>
                  <SelectItem value="TimeEntry">Time Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Original text (read-only reference) */}
          <div className="bg-slate-50 rounded p-3 text-sm text-slate-600 italic border">
            "{entry.raw_input}"
          </div>

          {/* Customer picker */}
          <div className="space-y-1">
            <Label>Customer {['Offer','CustomerMaterialEntry','TimeEntry'].includes(target) && <span className="text-red-500">*</span>}</Label>
            <Select value={customerId} onValueChange={v => { setCustomerId(v); setBoatId(''); }}>
              <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>— None —</SelectItem>
                {customerOptions.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Boat picker (when customer selected) */}
          {customerId && (
            <div className="space-y-1">
              <Label>Boat (optional)</Label>
              <Select value={boatId} onValueChange={setBoatId}>
                <SelectTrigger><SelectValue placeholder="Select boat…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— None —</SelectItem>
                  {boats.filter(b => b.customer_id === customerId).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.vessel_name || b.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Lead fields */}
          {target === 'Lead' && (<>
            <div className="space-y-1">
              <Label>Contact Name <span className="text-red-500">*</span></Label>
              <Input value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={leadPhone} onChange={e => setLeadPhone(e.target.value)} placeholder="+43 …" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={leadEmail} onChange={e => setLeadEmail(e.target.value)} placeholder="email@example.com" type="email" />
            </div>
          </>)}

          {/* Offer fields */}
          {target === 'Offer' && (
            <div className="space-y-1">
              <Label>Offer Title</Label>
              <Input value={offerTitle} onChange={e => setOfferTitle(e.target.value)} />
            </div>
          )}

          {/* Task fields */}
          {target === 'Task' && (<>
            <div className="space-y-1">
              <Label>Work Order <span className="text-red-500">*</span></Label>
              {loadingWOs ? (
                <p className="text-sm text-slate-500">Loading work orders…</p>
              ) : (<>
                <Select value={workOrderId} onValueChange={v => { setWorkOrderId(v); setShowNewWO(false); }}>
                  <SelectTrigger><SelectValue placeholder="Select work order…" /></SelectTrigger>
                  <SelectContent>
                    {workOrders.length === 0
                      ? <SelectItem value="__none" disabled>Keine aktiven Work Orders gefunden</SelectItem>
                      : workOrders.map(wo => (
                          <SelectItem key={wo.id} value={wo.id}>
                            {wo.work_order_number ? `${wo.work_order_number} — ` : ''}{wo.title}
                          </SelectItem>
                        ))
                    }
                  </SelectContent>
                </Select>
                {!showNewWO ? (
                  <button
                    type="button"
                    onClick={() => setShowNewWO(true)}
                    className="mt-1.5 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="h-3 w-3" /> Neue Work Order anlegen
                  </button>
                ) : (
                  <div className="mt-2 p-3 border border-blue-200 rounded-lg bg-blue-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-700">Neue Work Order</span>
                      <button onClick={() => setShowNewWO(false)}><X className="h-3.5 w-3.5 text-slate-400" /></button>
                    </div>
                    <Input
                      value={newWOTitle}
                      onChange={e => setNewWOTitle(e.target.value)}
                      placeholder="Titel der Work Order…"
                      className="h-8 text-sm"
                    />
                    <Select value={newWOJobId} onValueChange={setNewWOJobId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Projekt auswählen…" /></SelectTrigger>
                      <SelectContent>
                        {availableJobs.length === 0
                          ? <SelectItem value="__none" disabled>Keine Projekte gefunden</SelectItem>
                          : availableJobs.map(j => (
                              <SelectItem key={j.id} value={j.id}>
                                {j.job_number ? `${j.job_number} — ` : ''}{j.title}
                              </SelectItem>
                            ))
                        }
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleCreateNewWO}
                      disabled={creatingWO || !newWOTitle.trim() || !newWOJobId}
                      className="w-full h-8 text-xs"
                    >
                      {creatingWO ? 'Anlegen…' : 'Work Order anlegen & auswählen'}
                    </Button>
                  </div>
                )}
              </>)}
            </div>
            <div className="space-y-1">
              <Label>Task Title</Label>
              <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
            </div>
          </>)}

          {/* TimeEntry fields */}
          {target === 'TimeEntry' && (<>
            <div className="space-y-1">
              <Label>Datum</Label>
              <Input type="date" value={timeEntryDate} onChange={e => setTimeEntryDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Stunden <span className="text-red-500">*</span></Label>
              <Input type="number" step="0.25" min="0.25" value={timeEntryHours} onChange={e => setTimeEntryHours(e.target.value)} placeholder="z.B. 2.5" />
            </div>
            <div className="space-y-1">
              <Label>Techniker <span className="text-red-500">*</span></Label>
              <Select value={timeEntryTechnicianId} onValueChange={setTimeEntryTechnicianId}>
                <SelectTrigger><SelectValue placeholder="Techniker wählen…" /></SelectTrigger>
                <SelectContent>
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Work Order <span className="text-red-500">*</span></Label>
              <Select value={timeEntryWOId} onValueChange={setTimeEntryWOId}>
                <SelectTrigger><SelectValue placeholder="Work Order wählen…" /></SelectTrigger>
                <SelectContent>
                  {workOrders.length === 0
                    ? <SelectItem value="__none" disabled>Keine Work Orders für diesen Kunden</SelectItem>
                    : workOrders.map(wo => (
                        <SelectItem key={wo.id} value={wo.id}>
                          {wo.work_order_number ? `${wo.work_order_number} — ` : ''}{wo.title}
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Beschreibung</Label>
              <Textarea value={timeEntryNotes} onChange={e => setTimeEntryNotes(e.target.value)} rows={2} placeholder="Was wurde gemacht?" />
            </div>
          </>)}

          {/* Material entry fields */}
          {target === 'CustomerMaterialEntry' && (<>
            <div className="space-y-1">
              <Label>Item / Material Name</Label>
              <Input value={itemTitle} onChange={e => setItemTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min={0.01} step={0.01} />
              </div>
              <div className="space-y-1">
                <Label>Unit Price (€)</Label>
                <Input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} min={0} step={0.01} placeholder="optional" />
              </div>
            </div>
          </>)}

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : `Create ${target === 'CustomerMaterialEntry' ? 'Material Entry' : target === 'TimeEntry' ? 'Time Entry' : target}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}