import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';

export default function ScheduleItemEditModal({ 
  open, 
  onClose, 
  workOrder, 
  technicians,
  onSave 
}) {
  const [formData, setFormData] = useState({
    lead_technician_id: '',
    assigned_technicians: [],
    scheduled_date: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
    estimated_duration_hours: 0
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workOrder && open) {
      setFormData({
        lead_technician_id: workOrder.lead_technician_id || '',
        assigned_technicians: workOrder.assigned_technicians || [],
        scheduled_date: workOrder.scheduled_date || '',
        scheduled_start_time: workOrder.scheduled_start_time || '09:00',
        scheduled_end_time: workOrder.scheduled_end_time || '',
        estimated_duration_hours: workOrder.estimated_duration_hours || 1
      });
      setError(null);
    }
  }, [workOrder, open]);

  const parseTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handleSave = async () => {
    setError(null);

    // Validation
    if (!formData.scheduled_start_time) {
      setError('Start time is required');
      return;
    }

    if (formData.scheduled_end_time) {
      const startMinutes = parseTime(formData.scheduled_start_time);
      const endMinutes = parseTime(formData.scheduled_end_time);
      
      if (endMinutes <= startMinutes) {
        setError('End time must be after start time');
        return;
      }

      // Minimum duration check (30 minutes)
      if (endMinutes - startMinutes < 30) {
        setError('Minimum duration is 30 minutes');
        return;
      }
    }

    if (!formData.lead_technician_id) {
      setError('Please select a technician');
      return;
    }

    try {
      setSaving(true);
      
      const updates = {
        lead_technician_id: formData.lead_technician_id,
        assigned_technicians: formData.assigned_technicians.includes(formData.lead_technician_id)
          ? formData.assigned_technicians
          : [...formData.assigned_technicians, formData.lead_technician_id],
        scheduled_date: formData.scheduled_date,
        scheduled_start_time: formData.scheduled_start_time
      };

      // Handle end time or duration
      if (formData.scheduled_end_time) {
        updates.scheduled_end_time = formData.scheduled_end_time;
      } else if (workOrder.scheduled_end_time === undefined && formData.estimated_duration_hours) {
        // If scheduled_end_time field doesn't exist, use duration
        updates.estimated_duration_hours = parseFloat(formData.estimated_duration_hours);
      }

      await base44.entities.WorkOrder.update(workOrder.id, updates);
      
      if (onSave) {
        await onSave();
      }
      
      onClose();
    } catch (err) {
      console.error('Failed to save:', err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTechnicianChange = (techId) => {
    setFormData(prev => ({
      ...prev,
      lead_technician_id: techId,
      assigned_technicians: prev.assigned_technicians.includes(techId)
        ? prev.assigned_technicians
        : [...prev.assigned_technicians, techId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Schedule</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Work Order</Label>
            <Input value={workOrder?.title || ''} disabled className="bg-slate-50" />
          </div>

          <div className="space-y-2">
            <Label>Technician</Label>
            <Select value={formData.lead_technician_id} onValueChange={handleTechnicianChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map(tech => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.first_name} {tech.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={formData.scheduled_date}
              onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={formData.scheduled_start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_start_time: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={formData.scheduled_end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_end_time: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          {!formData.scheduled_end_time && (
            <div className="space-y-2">
              <Label>Duration (hours)</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={formData.estimated_duration_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration_hours: e.target.value }))}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}