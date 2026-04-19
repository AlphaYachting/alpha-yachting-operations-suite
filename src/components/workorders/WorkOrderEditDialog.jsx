import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Loader2 } from 'lucide-react';

const WO_STATUSES = [
  'Draft', 'Scheduled', 'Dispatched', 'In Transit', 'In Progress',
  'Paused', 'Waiting for Parts', 'Waiting for Approval',
  'Ready to Invoice', 'Completed', 'Cancelled'
];

export default function WorkOrderEditDialog({ workOrder, technicians, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workOrder) {
      setForm({
        title: workOrder.title || '',
        description: workOrder.description || '',
        status: workOrder.status || 'Draft',
        scheduled_date: workOrder.scheduled_date || '',
        scheduled_start_time: workOrder.scheduled_start_time || '',
        scheduled_end_time: workOrder.scheduled_end_time || '',
        lead_technician_id: workOrder.lead_technician_id || '',
        assigned_technicians: workOrder.assigned_technicians || [],
        internal_notes: workOrder.internal_notes || '',
        estimated_duration_hours: workOrder.estimated_duration_hours || '',
      });
    }
  }, [workOrder]);

  const toggleTechnician = (techId) => {
    setForm(prev => {
      const current = prev.assigned_technicians || [];
      return {
        ...prev,
        assigned_technicians: current.includes(techId)
          ? current.filter(id => id !== techId)
          : [...current, techId]
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.WorkOrder.update(workOrder.id, {
        title: form.title,
        description: form.description,
        status: form.status,
        scheduled_date: form.scheduled_date || null,
        scheduled_start_time: form.scheduled_start_time || null,
        scheduled_end_time: form.scheduled_end_time || null,
        lead_technician_id: form.lead_technician_id || null,
        assigned_technicians: form.assigned_technicians,
        internal_notes: form.internal_notes,
        estimated_duration_hours: form.estimated_duration_hours ? Number(form.estimated_duration_hours) : null,
      });
      onSaved && onSaved(updated);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const activeTechs = technicians.filter(t => t.status !== 'Inactive');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Work Order bearbeiten</DialogTitle>
          <p className="text-sm text-slate-500">#{workOrder?.work_order_number || workOrder?.id}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <Label>Titel</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WO_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Datum</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Von</Label>
              <Input type="time" value={form.scheduled_start_time} onChange={e => setForm(p => ({ ...p, scheduled_start_time: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Bis</Label>
              <Input type="time" value={form.scheduled_end_time} onChange={e => setForm(p => ({ ...p, scheduled_end_time: e.target.value }))} />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <Label>Geschätzte Dauer (Stunden)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={form.estimated_duration_hours}
              onChange={e => setForm(p => ({ ...p, estimated_duration_hours: e.target.value }))}
            />
          </div>

          {/* Lead Technician */}
          <div className="space-y-1">
            <Label>Lead Techniker</Label>
            <Select value={form.lead_technician_id || '__none__'} onValueChange={v => setForm(p => ({ ...p, lead_technician_id: v === '__none__' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Keiner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Keiner —</SelectItem>
                {activeTechs.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned Technicians */}
          <div className="space-y-2">
            <Label>Zugewiesene Techniker</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg min-h-[40px]">
              {(form.assigned_technicians || []).map(techId => {
                const tech = activeTechs.find(t => t.id === techId);
                if (!tech) return null;
                return (
                  <Badge key={techId} variant="secondary" className="flex items-center gap-1 cursor-pointer hover:bg-red-100 hover:text-red-700" onClick={() => toggleTechnician(techId)}>
                    {tech.first_name} {tech.last_name}
                    <X className="h-3 w-3" />
                  </Badge>
                );
              })}
              {(form.assigned_technicians || []).length === 0 && (
                <span className="text-sm text-slate-400">Keine Techniker zugewiesen</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeTechs
                .filter(t => !(form.assigned_technicians || []).includes(t.id))
                .map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleTechnician(t.id)}
                    className="text-xs px-2 py-1 border border-slate-200 rounded-md bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-700 transition-colors"
                  >
                    + {t.first_name} {t.last_name}
                  </button>
                ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Beschreibung</Label>
            <Textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          {/* Internal Notes */}
          <div className="space-y-1">
            <Label>Interne Notizen</Label>
            <Textarea rows={2} value={form.internal_notes} onChange={e => setForm(p => ({ ...p, internal_notes: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}