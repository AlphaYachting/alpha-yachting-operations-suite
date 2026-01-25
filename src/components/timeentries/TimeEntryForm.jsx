import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

export default function TimeEntryForm({ 
  timeEntry, 
  workOrderId, 
  tasks, 
  technicians, 
  onSave, 
  onCancel,
  lastSelectedTechId,
  lastSelectedDate
}) {
  const [formData, setFormData] = useState({
    work_order_id: workOrderId,
    task_id: timeEntry?.task_id || '',
    technician_id: timeEntry?.technician_id || lastSelectedTechId || '',
    entry_date: timeEntry?.entry_date || lastSelectedDate || format(new Date(), 'yyyy-MM-dd'),
    start_time: timeEntry?.start_time || '',
    duration_hours: timeEntry ? Math.floor(timeEntry.duration_minutes / 60) : '',
    duration_minutes: timeEntry ? timeEntry.duration_minutes % 60 : '',
    notes: timeEntry?.notes || '',
    is_billable: timeEntry?.is_billable !== false
  });
  const [saving, setSaving] = useState(false);
  const [addAnother, setAddAnother] = useState(false);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const totalMinutes = (parseInt(formData.duration_hours) || 0) * 60 + (parseInt(formData.duration_minutes) || 0);
    
    if (totalMinutes <= 0) {
      alert('Duration must be greater than 0');
      return;
    }

    if (!formData.technician_id) {
      alert('Please select a technician');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        work_order_id: formData.work_order_id,
        task_id: formData.task_id || null,
        technician_id: formData.technician_id,
        entry_date: formData.entry_date,
        start_time: formData.start_time || null,
        duration_minutes: totalMinutes,
        notes: formData.notes || null,
        is_billable: formData.is_billable,
        is_locked: timeEntry?.is_locked || false
      };
      
      await onSave(payload, addAnother);
      
      if (addAnother) {
        // Reset form but keep technician and date
        setFormData({
          work_order_id: workOrderId,
          task_id: '',
          technician_id: formData.technician_id,
          entry_date: formData.entry_date,
          start_time: '',
          duration_hours: '',
          duration_minutes: '',
          notes: '',
          is_billable: true
        });
      }
    } catch (error) {
      console.error('Error saving time entry:', error);
      alert('Failed to save time entry');
    } finally {
      setSaving(false);
    }
  };

  const activeTechs = technicians.filter(t => t.status === 'Active');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date *</Label>
          <Input
            type="date"
            value={formData.entry_date}
            onChange={(e) => updateField('entry_date', e.target.value)}
            max={format(new Date(), 'yyyy-MM-dd')}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input
            type="time"
            value={formData.start_time}
            onChange={(e) => updateField('start_time', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Technician *</Label>
        <Select value={formData.technician_id} onValueChange={(v) => updateField('technician_id', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select technician" />
          </SelectTrigger>
          <SelectContent>
            {activeTechs.map(tech => (
              <SelectItem key={tech.id} value={tech.id}>
                {tech.first_name} {tech.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tasks.length > 0 && (
        <div className="space-y-2">
          <Label>Task (Optional)</Label>
          <Select value={formData.task_id} onValueChange={(v) => updateField('task_id', v)}>
            <SelectTrigger>
              <SelectValue placeholder="General work (no specific task)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>General work (no specific task)</SelectItem>
              {tasks.map(task => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Duration *</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              type="number"
              min="0"
              value={formData.duration_hours}
              onChange={(e) => updateField('duration_hours', e.target.value)}
              placeholder="Hours"
            />
            <p className="text-xs text-slate-500 mt-1">Hours</p>
          </div>
          <div>
            <Input
              type="number"
              min="0"
              max="59"
              value={formData.duration_minutes}
              onChange={(e) => updateField('duration_minutes', e.target.value)}
              placeholder="Minutes"
            />
            <p className="text-xs text-slate-500 mt-1">Minutes</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Details about the work performed..."
          rows={3}
        />
      </div>

      <div className="flex items-center gap-3">
        <Checkbox
          checked={formData.is_billable}
          onCheckedChange={(v) => updateField('is_billable', v)}
        />
        <Label>Billable time</Label>
      </div>

      {!timeEntry && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Checkbox
            checked={addAnother}
            onCheckedChange={setAddAnother}
          />
          <Label className="cursor-pointer">Add another entry after saving</Label>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (timeEntry ? 'Update Entry' : 'Add Entry')}
        </Button>
      </div>
    </form>
  );
}