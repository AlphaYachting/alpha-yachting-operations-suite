import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function JobForm({ job, customers, boats, locations, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    customer_id: job?.customer_id || '',
    boat_id: job?.boat_id || '',
    location_id: job?.location_id || '',
    title: job?.title || '',
    description: job?.description || '',
    job_type: job?.job_type || 'Mobile Service',
    service_category: job?.service_category || 'General Service',
    priority: job?.priority || 'Normal',
    status: job?.status || 'New',
    intake_source: job?.intake_source || 'Phone',
    intake_date: job?.intake_date || new Date().toISOString().split('T')[0],
    requested_date: job?.requested_date || '',
    estimated_hours: job?.estimated_hours || '',
    quote_amount: job?.quote_amount || '',
    internal_notes: job?.internal_notes || '',
    customer_notes: job?.customer_notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEstimatedHoursTouched, setIsEstimatedHoursTouched] = useState(false);
  const [isQuoteAmountTouched, setIsQuoteAmountTouched] = useState(false);

  const customerBoats = useMemo(() => {
    if (!formData.customer_id) return [];
    return boats.filter(b => b.customer_id === formData.customer_id);
  }, [formData.customer_id, boats]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Mark fields as touched to show red border if empty
    setIsEstimatedHoursTouched(true);
    setIsQuoteAmountTouched(true);

    // Validate required fields
    if (!formData.customer_id) {
      setError('Customer is required');
      return;
    }
    if (!formData.boat_id) {
      setError('Boat is required');
      return;
    }
    if (!formData.title?.trim()) {
      setError('Job title is required');
      return;
    }
    if (!formData.estimated_hours && !formData.quote_amount) {
      setError('Please provide either Estimated Hours or Quote Amount');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      setSaving(false);
    } catch (err) {
      setError(err.message || 'Failed to save job. Please try again.');
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'customer_id') {
      setFormData(prev => ({ ...prev, boat_id: '' }));
    }
  };

  const getCustomerDisplayName = (customer) => {
    if (customer.company_name) return customer.company_name;
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Customer & Boat Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Customer *</Label>
          <Select value={formData.customer_id} onValueChange={(v) => updateField('customer_id', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map(customer => (
                <SelectItem key={customer.id} value={customer.id}>
                  {getCustomerDisplayName(customer)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Boat *</Label>
          <Select 
            value={formData.boat_id} 
            onValueChange={(v) => updateField('boat_id', v)}
            disabled={!formData.customer_id}
          >
            <SelectTrigger>
              <SelectValue placeholder={formData.customer_id ? "Select boat" : "Select customer first"} />
            </SelectTrigger>
            <SelectContent>
              {customerBoats.map(boat => (
                <SelectItem key={boat.id} value={boat.id}>
                  {boat.vessel_name} {boat.model && `(${boat.model})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label>Location</Label>
        <Select value={formData.location_id} onValueChange={(v) => updateField('location_id', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select location (optional)" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(location => (
              <SelectItem key={location.id} value={location.id}>
                {location.name} - {location.region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Job Title */}
      <div className="space-y-2">
        <Label>Job Title *</Label>
        <Input
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Brief description of the work needed"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Detailed Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Detailed problem description, customer request..."
          rows={4}
        />
      </div>

      {/* Job Classification */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Job Type</Label>
          <Select value={formData.job_type} onValueChange={(v) => updateField('job_type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mobile Service">Mobile Service</SelectItem>
              <SelectItem value="Dry Marina Work">Dry Marina Work</SelectItem>
              <SelectItem value="Drive-In Express">Drive-In Express</SelectItem>
              <SelectItem value="Scheduled Maintenance">Scheduled Maintenance</SelectItem>
              <SelectItem value="Emergency">Emergency</SelectItem>
              <SelectItem value="Refit Project">Refit Project</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Service Category</Label>
          <Select value={formData.service_category} onValueChange={(v) => updateField('service_category', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="General Service">General Service</SelectItem>
              <SelectItem value="Mechanical">Mechanical</SelectItem>
              <SelectItem value="Electrical">Electrical</SelectItem>
              <SelectItem value="Electronics">Electronics</SelectItem>
              <SelectItem value="GRP/Bodywork">GRP/Bodywork</SelectItem>
              <SelectItem value="Sealing">Sealing</SelectItem>
              <SelectItem value="HVAC">HVAC</SelectItem>
              <SelectItem value="Rigging">Rigging</SelectItem>
              <SelectItem value="Plumbing">Plumbing</SelectItem>
              <SelectItem value="Installation">Installation</SelectItem>
              <SelectItem value="Diagnostics">Diagnostics</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={formData.priority} onValueChange={(v) => updateField('priority', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
              <SelectItem value="Express">Express</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status and Intake */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Quoted">Quoted</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Scheduled">Scheduled</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Waiting for Parts">Waiting for Parts</SelectItem>
              <SelectItem value="On Hold">On Hold</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Invoiced">Invoiced</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Intake Source</Label>
          <Select value={formData.intake_source} onValueChange={(v) => updateField('intake_source', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Phone">Phone</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Drive-In">Drive-In</SelectItem>
              <SelectItem value="Referral">Referral</SelectItem>
              <SelectItem value="Return Customer">Return Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Intake Date</Label>
          <Input
            type="date"
            value={formData.intake_date}
            onChange={(e) => updateField('intake_date', e.target.value)}
          />
        </div>
      </div>

      {/* Job Due Date and Estimates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Job Due Date</Label>
          <Input
            type="date"
            value={formData.requested_date}
            onChange={(e) => updateField('requested_date', e.target.value)}
            placeholder="When should the job be completed?"
          />
        </div>
        <div className="space-y-2">
          <Label>Estimated Hours</Label>
          <Input
            type="number"
            step="0.5"
            value={formData.estimated_hours}
            onChange={(e) => updateField('estimated_hours', parseFloat(e.target.value) || '')}
            onBlur={() => setIsEstimatedHoursTouched(true)}
            className={cn(
              isEstimatedHoursTouched && !formData.estimated_hours && !formData.quote_amount && "border-red-500"
            )}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Quote Amount (€)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.quote_amount}
            onChange={(e) => updateField('quote_amount', parseFloat(e.target.value) || '')}
            onBlur={() => setIsQuoteAmountTouched(true)}
            className={cn(
              isQuoteAmountTouched && !formData.quote_amount && !formData.estimated_hours && "border-red-500"
            )}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Internal Notes</Label>
          <Textarea
            value={formData.internal_notes}
            onChange={(e) => updateField('internal_notes', e.target.value)}
            placeholder="Notes for technicians..."
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Customer-Facing Notes</Label>
          <Textarea
            value={formData.customer_notes}
            onChange={(e) => updateField('customer_notes', e.target.value)}
            placeholder="Notes visible to customer..."
            rows={3}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (job ? 'Update Job' : 'Create Job')}
        </Button>
      </div>
    </form>
  );
}