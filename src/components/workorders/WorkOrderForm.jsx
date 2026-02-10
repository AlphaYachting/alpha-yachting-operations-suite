import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import TemplateFromCreation from './TemplateFromCreation';
import AITaskSuggestions from './AITaskSuggestions';

export default function WorkOrderForm({ workOrder, jobs, technicians, customers, boats, preselectedJobId, onSave, onCancel }) {
  const [formData, setFormData] = useState({
     job_id: workOrder?.job_id || preselectedJobId || '',
     title: workOrder?.title || '',
     description: workOrder?.description || '',
     scheduled_date: workOrder?.scheduled_date || '',
     scheduled_end_date: workOrder?.scheduled_end_date || '',
     scheduled_start_time: workOrder?.scheduled_start_time || '08:00',
     scheduled_end_time: workOrder?.scheduled_end_time || '',
    estimated_duration_hours: workOrder?.estimated_duration_hours || '',
    assigned_technicians: workOrder?.assigned_technicians || [],
    status: workOrder?.status || 'Draft',
    safety_notes: workOrder?.safety_notes || '',
    internal_notes: workOrder?.internal_notes || '',
    billable: workOrder?.billable !== false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [suggestedTasks, setSuggestedTasks] = useState([]);

  const getProjectLabel = (project) => {
    const customer = customers.find(c => c.id === project.customer_id);
    const boat = boats.find(b => b.id === project.boat_id);
    const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim();
    return `${project.title} (${customerName} - ${boat?.vessel_name || 'Unknown'})`;
  };

  const activeTechnicians = technicians.filter(t => t.status === 'Active');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    
    try {
      // Validate required fields
      const errors = {};
      if (!formData.job_id) {
        errors.job_id = 'Required';
      }
      if (!formData.title?.trim()) {
        errors.title = 'Required';
      }
      if (!formData.scheduled_date) {
        errors.scheduled_date = 'Required';
      }

      // Validate time fields - must be 15-minute steps
      if (formData.scheduled_start_time) {
        const [hours, minutes] = formData.scheduled_start_time.split(':').map(Number);
        if (![0, 15, 30, 45].includes(minutes)) {
          errors.scheduled_start_time = 'Time must be in 15-minute steps (:00, :15, :30, :45)';
        }
      }
      if (formData.scheduled_end_time) {
        const [hours, minutes] = formData.scheduled_end_time.split(':').map(Number);
        if (![0, 15, 30, 45].includes(minutes)) {
          errors.scheduled_end_time = 'Time must be in 15-minute steps (:00, :15, :30, :45)';
        }
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError('Please correct highlighted fields.');
        setSaving(false);
        return;
      }
      
      console.log('Submitting work order:', { formData, selectedTemplateId, suggestedTasks });
      
      // Add timeout wrapper (30 seconds)
      const saveWithTimeout = Promise.race([
        onSave(formData, selectedTemplateId, suggestedTasks),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Save operation timed out. Please try again.')), 30000)
        )
      ]);
      
      await saveWithTimeout;
       toast.success('Work order saved successfully');
       // onSave will close the dialog if successful
      } catch (err) {
       console.error('Work order save error:', err);
       const errorMsg = err.message || 'Failed to save work order. Please check all required fields.';
       setError(errorMsg);
       toast.error(errorMsg);
       setSaving(false);
      }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSuggestedTasks = (tasks) => {
    setSuggestedTasks(tasks);
  };

  const handleNotesUpdate = (field, value) => {
    updateField(field, value);
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
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Creation Mode - Only show for new work orders */}
      {!workOrder && (
        <TemplateFromCreation
          onTemplateChange={setSelectedTemplateId}
          selectedTemplateId={selectedTemplateId}
          setTitle={(title) => updateField('title', title)}
        />
      )}

      {/* Project Selection */}
       <div className="space-y-2">
         <Label>Parent Project *</Label>
         <Select value={formData.job_id || ''} onValueChange={(v) => updateField('job_id', v)}>
           <SelectTrigger className={fieldErrors.job_id ? 'border-red-500' : ''}>
             <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {jobs.filter(j => !['Completed', 'Invoiced', 'Cancelled'].includes(j.status)).map(project => (
              <SelectItem key={project.id} value={project.id}>
                {getProjectLabel(project)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.job_id && <p className="text-xs text-red-600">{fieldErrors.job_id}</p>}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label>Work Order Title *</Label>
        <Input
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="What work will be done in this visit"
          className={fieldErrors.title ? 'border-red-500' : ''}
          required
        />
        {fieldErrors.title && <p className="text-xs text-red-600">{fieldErrors.title}</p>}
      </div>

      {/* Description & AI Suggestions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Description</Label>
          {!workOrder && formData.job_id && (
            <AITaskSuggestions
              formData={formData}
              jobs={jobs}
              boats={boats}
              customers={customers}
              onTasksAdd={handleAddSuggestedTasks}
              onNotesUpdate={handleNotesUpdate}
            />
          )}
        </div>
        <Textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Detailed instructions for technicians..."
          rows={3}
        />
        {!workOrder && formData.job_id && (!formData.description || formData.description.split(/\s+/).filter(word => word.length > 0).length < 5) && (
          <p className="text-xs text-slate-500">💡 Add at least 5 words in description to enable AI task suggestions</p>
        )}
      </div>

      {/* Schedule - Start Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date *</Label>
          <Input
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => updateField('scheduled_date', e.target.value)}
            className={fieldErrors.scheduled_date ? 'border-red-500' : ''}
            required
          />
          {fieldErrors.scheduled_date && <p className="text-xs text-red-600">{fieldErrors.scheduled_date}</p>}
        </div>
        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input
            type="time"
            step="900"
            value={formData.scheduled_start_time}
            onChange={(e) => updateField('scheduled_start_time', e.target.value)}
            className={fieldErrors.scheduled_start_time ? 'border-red-500' : ''}
          />
          {fieldErrors.scheduled_start_time && <p className="text-xs text-red-600">{fieldErrors.scheduled_start_time}</p>}
        </div>
      </div>

      {/* Schedule - End Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input
            type="date"
            value={formData.scheduled_end_date}
            onChange={(e) => updateField('scheduled_end_date', e.target.value)}
            min={formData.scheduled_date}
          />
        </div>
        <div className="space-y-2">
          <Label>End Time</Label>
          <Input
            type="time"
            step="900"
            value={formData.scheduled_end_time}
            onChange={(e) => updateField('scheduled_end_time', e.target.value)}
            className={fieldErrors.scheduled_end_time ? 'border-red-500' : ''}
          />
          {fieldErrors.scheduled_end_time && <p className="text-xs text-red-600">{fieldErrors.scheduled_end_time}</p>}
        </div>
      </div>

      {/* Duration - Free Input */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Est. Duration (hours)</Label>
          <Input
            type="number"
            step="0.25"
            value={formData.estimated_duration_hours}
            onChange={(e) => updateField('estimated_duration_hours', parseFloat(e.target.value) || '')}
            placeholder="0"
          />
        </div>
      </div>

      {/* Status */}
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

      {/* Technician Assignment */}
      <div className="space-y-3">
        <Label>Assigned Technicians</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {activeTechnicians.map(tech => (
            <label 
              key={tech.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                formData.assigned_technicians?.includes(tech.id) 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Checkbox
                checked={formData.assigned_technicians?.includes(tech.id)}
                onCheckedChange={() => toggleTechnician(tech.id)}
              />
              <div>
                <p className="font-medium text-sm">{tech.first_name} {tech.last_name}</p>
                <p className="text-xs text-slate-500">{tech.role}</p>
              </div>
            </label>
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

      {/* Suggested Tasks Preview */}
      {suggestedTasks.length > 0 && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="font-medium text-purple-900 mb-2">
            📋 {suggestedTasks.length} tasks will be added after creation
          </p>
          <ul className="space-y-1">
            {suggestedTasks.map((task, idx) => (
              <li key={idx} className="text-sm text-purple-800">
                • {task.title}
              </li>
            ))}
          </ul>
        </div>
      )}

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