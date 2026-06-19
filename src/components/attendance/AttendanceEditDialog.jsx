import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, MapPin, Calendar, Trash2, AlertCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function AttendanceEditDialog({ open, onOpenChange, record, technicians, onSaved, onDeleted }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({
        technician_id: record.technician_id || '',
        record_type: record.record_type || 'clock_in',
        work_date: record.work_date || '',
        work_start_time: record.work_start_time || (record.clock_in ? format(parseISO(record.clock_in), 'HH:mm') : ''),
        work_end_time: record.work_end_time || (record.clock_out ? format(parseISO(record.clock_out), 'HH:mm') : ''),
        break_minutes: record.break_minutes || 0,
        duration_minutes: record.duration_minutes || 0,
        notes: record.notes || '',
        clock_in_address: record.clock_in_address || '',
      });
    }
  }, [record]);

  const isNew = !record?.id;

  const handleDelete = async () => {
    if (!window.confirm('Eintrag wirklich löschen?')) return;
    try {
      await base44.entities.AttendanceRecord.delete(record.id);
      toast.success('Eintrag gelöscht');
      onOpenChange(false);
      if (onDeleted) onDeleted();
    } catch (e) {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let duration = 0;
      if (form.record_type === 'manual_entry' && form.work_start_time && form.work_end_time) {
        const [sh, sm] = form.work_start_time.split(':').map(Number);
        const [eh, em] = form.work_end_time.split(':').map(Number);
        duration = (eh * 60 + em) - (sh * 60 + sm) - (form.break_minutes || 0);
        if (duration < 0) {
          toast.error('Endzeit muss nach Startzeit liegen');
          setSaving(false);
          return;
        }
      }

      if (form.record_type === 'vacation' || form.record_type === 'sick_leave') {
        duration = form.duration_minutes || 480; // default 8h for vacation/sick
      }

      const payload = {
        technician_id: form.technician_id,
        work_date: form.work_date,
        record_type: form.record_type,
        duration_minutes: duration,
        work_start_time: form.record_type === 'manual_entry' ? form.work_start_time : undefined,
        work_end_time: form.record_type === 'manual_entry' ? form.work_end_time : undefined,
        break_minutes: form.record_type === 'manual_entry' ? (form.break_minutes || 0) : undefined,
        notes: form.notes || undefined,
      };

      // Get technician name
      const tech = technicians?.find(t => t.id === form.technician_id);
      if (tech) {
        payload.technician_name = `${tech.first_name} ${tech.last_name}`;
      }

      if (isNew) {
        await base44.entities.AttendanceRecord.create(payload);
        toast.success('Eintrag erstellt');
      } else {
        await base44.entities.AttendanceRecord.update(record.id, payload);
        toast.success('Eintrag gespeichert');
      }
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (e) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const isReadonlyClockIn = form.record_type === 'clock_in' && !isNew;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            {isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}
          </DialogTitle>
          <DialogDescription>
            {isNew ? 'Manuelle Zeiterfassung oder Urlaub eintragen' : 'Zeiten und Typ anpassen'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Record Type */}
          <div>
            <Label>Typ</Label>
            <Select value={form.record_type} onValueChange={(v) => setForm({ ...form, record_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clock_in">Kommen/Gehen (GPS)</SelectItem>
                <SelectItem value="manual_entry">Manuelle Eingabe</SelectItem>
                <SelectItem value="vacation">Urlaub</SelectItem>
                <SelectItem value="sick_leave">Krankheit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Technician */}
          <div>
            <Label>Mitarbeiter</Label>
            <Select
              value={form.technician_id}
              onValueChange={(v) => setForm({ ...form, technician_id: v })}
              disabled={!isNew}
            >
              <SelectTrigger>
                <SelectValue placeholder="Mitarbeiter wählen" />
              </SelectTrigger>
              <SelectContent>
                {(technicians || []).map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div>
            <Label>Datum</Label>
            <Input
              type="date"
              value={form.work_date}
              onChange={(e) => setForm({ ...form, work_date: e.target.value })}
            />
          </div>

          {/* Manual Entry Fields */}
          {form.record_type === 'manual_entry' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Von</Label>
                  <Input
                    type="time"
                    value={form.work_start_time}
                    onChange={(e) => setForm({ ...form, work_start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bis</Label>
                  <Input
                    type="time"
                    value={form.work_end_time}
                    onChange={(e) => setForm({ ...form, work_end_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Pause (min)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.break_minutes}
                    onChange={(e) => setForm({ ...form, break_minutes: Number(e.target.value) })}
                  />
                </div>
              </div>
              {form.work_start_time && form.work_end_time && (
                <p className="text-xs text-slate-500">
                  Arbeitszeit:{' '}
                  {(() => {
                    const [sh, sm] = form.work_start_time.split(':').map(Number);
                    const [eh, em] = form.work_end_time.split(':').map(Number);
                    let mins = (eh * 60 + em) - (sh * 60 + sm) - (form.break_minutes || 0);
                    if (mins < 0) mins = 0;
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return `${h}h ${m}min`;
                  })()}
                </p>
              )}
            </>
          )}

          {/* Vacation / Sick Leave */}
          {(form.record_type === 'vacation' || form.record_type === 'sick_leave') && (
            <div>
              <Label>Stunden</Label>
              <Input
                type="number"
                min="0"
                max="24"
                value={form.duration_minutes ? form.duration_minutes / 60 : 8}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) * 60 })}
              />
              <p className="text-xs text-slate-500 mt-1">Standard: 8 Stunden pro Tag</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notizen</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="z.B. Grund für Urlaub / Korrektur"
            />
          </div>

          {/* Read-only clock-in info */}
          {isReadonlyClockIn && (
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span>{record.clock_in_address || 'Keine Adresse'}</span>
              </div>
              {record.clock_in && <p>Kommen: {format(parseISO(record.clock_in), 'dd.MM.yyyy HH:mm')} Uhr</p>}
              {record.clock_out && <p>Gehen: {format(parseISO(record.clock_out), 'dd.MM.yyyy HH:mm')} Uhr</p>}
              <p className="text-slate-400 italic">GPS-Daten können nicht manuell geändert werden. Um Zeiten zu korrigieren, wechsle auf "Manuelle Eingabe".</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isNew && (
            <Button variant="destructive" size="sm" onClick={handleDelete} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-1" /> Löschen
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving || !form.technician_id || !form.work_date}>
            {saving ? 'Speichere...' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}