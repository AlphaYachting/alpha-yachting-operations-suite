import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function WorkOrderForm({ workOrder, jobs, technicians, customers, boats, preselectedJobId, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    job_id: workOrder?.job_id || preselectedJobId || '',
    title: workOrder?.title || '',
    description: workOrder?.description || '',
    scheduled_date: workOrder?.scheduled_date || '',
    scheduled_start_time: workOrder?.scheduled_start_time || '',
    scheduled_end_time: workOrder?.scheduled_end_time || '',
    estimated_duration_hours: workOrder?.estimated_duration_hours || '',
    assigned_technicians: workOrder?.assigned_technicians || [],
    lead_technician_id: workOrder?.lead_technician_id || '',
    status: workOrder?.status || 'Draft',
    safety_notes: workOrder?.safety_notes || '',
    internal_notes: workOrder?.internal_notes || '',
    billable: workOrder?.billable !== false
  });
  const [saving, setSaving] = useState(false);

  const getJobLabel = (job) => {
    const customer = customers.find(c => c.id === job.customer_id);
    const boat = boats.find(b => b.id === job.boat_id);
    const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim();
    return `${job.title} (${customerName} - ${boat?.vessel_name || 'Unknown'})`;
  };

  const activeTechnicians = technicians.filter(t => t.status === 'Active');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleTechnician = (techId) => {
    setFormData(prev => {
      const current = prev.assigned_technicians || [];
      if (current.includes(techId)) {
        return { ...prev, assigned_technicians: current.filter(id => id !== techId) };
      } else {
        return { ...prev, assigned_technicians: [...current, techId] };
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Job Selection */}
      <div className="space-y-2">
        <Label>Parent Job *</Label>
        <Select value={formData.job_id} onValueChange={(v) => updateField('job_id', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select job" />
          </SelectTrigger>
          <SelectContent>
            {jobs.filter(j => !['Completed', 'Invoiced', 'Cancelled'].includes(j.status)).map(job => (
              <SelectItem key={job.id} value={job.id}>
                {getJobLabel(job)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label>Work Order Title *</Label>
        <Input
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="What work will be done in this visit"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Detailed instructions for technicians..."
          rows={3}
        />
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Scheduled Date *</Label>
          <Input
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => updateField('scheduled_date', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input
            type="time"
            value={formData.scheduled_start_time}
            onChange={(e) => updateField('scheduled_start_time', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>End Time</Label>
          <Input
            type="time"
            value={formData.scheduled_end_time}
            onChange={(e) => updateField('scheduled_end_time', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Est. Duration (hours)</Label>
          <Input
            type="number"
            step="0.5"
            value={formData.estimated_duration_hours}
            onChange={(e) => updateField('estimated_duration_hours', parseFloat(e.target.value) || '')}
            placeholder="0"
          />
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Scheduled">Scheduled</SelectItem>
              <SelectItem value="Dispatched">Dispatched</SelectItem>
              <SelectItem value="In Transit">In Transit</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Paused">Paused</SelectItem>
              <SelectItem value="Waiting for Parts">Waiting for Parts</SelectItem>
              <SelectItem value="Waiting for Approval">Waiting for Approval</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Lead Technician</Label>
          <Select value={formData.lead_technician_id} onValueChange={(v) => updateField('lead_technician_id', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select lead" />
            </SelectTrigger>
            <SelectContent>
              {activeTechnicians.map(tech => (
                <SelectItem key={tech.id} value={tech.id}>
                  {tech.first_name} {tech.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Technician Assignment */}
      <div className="space-y-3">
        <Label>Assigned Technicians</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {activeTechnicians.map(tech => (
            <div 
              key={tech.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                formData.assigned_technicians?.includes(tech.id) 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => toggleTechnician(tech.id)}
            >
              <Checkbox
                checked={formData.assigned_technicians?.includes(tech.id)}
                onCheckedChange={() => toggleTechnician(tech.id)}
              />
              <div>
                <p className="font-medium text-sm">{tech.first_name} {tech.last_name}</p>
                <p className="text-xs text-slate-500">{tech.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Safety Notes</Label>
          <Textarea
            value={formData.safety_notes}
            onChange={(e) => updateField('safety_notes', e.target.value)}
            placeholder="Safety considerations for this work..."
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Internal Notes</Label>
          <Textarea
            value={formData.internal_notes}
            onChange={(e) => updateField('internal_notes', e.target.value)}
            placeholder="Internal notes for technicians..."
            rows={3}
          />
        </div>
      </div>

      {/* Billable */}
      <div className="flex items-center gap-3">
        <Checkbox
          checked={formData.billable}
          onCheckedChange={(v) => updateField('billable', v)}
        />
        <Label>Billable work order</Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (workOrder ? 'Update Work Order' : 'Create Work Order')}
        </Button>
      </div>
    </form>
  );
}