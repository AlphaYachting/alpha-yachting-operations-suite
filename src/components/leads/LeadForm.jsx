import React, { useState } from 'react';
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
import { AlertCircle } from 'lucide-react';

export default function LeadForm({ lead, locations, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: lead?.name || '',
    phone: lead?.phone || '',
    email: lead?.email || '',
    boat_name: lead?.boat_name || '',
    boat_details: lead?.boat_details || '',
    location: lead?.location || '',
    location_id: lead?.location_id || '',
    contact_method: lead?.contact_method || 'Phone',
    inquiry_type: lead?.inquiry_type || 'Service Inquiry',
    notes: lead?.notes || '',
    description: lead?.description || '',
    priority: lead?.priority || 'Medium',
    status: lead?.status || 'Pending'
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name?.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.phone?.trim()) {
      setError('Phone number is required');
      return;
    }

    try {
      setSaving(true);
      await onSave(formData);
    } catch (err) {
      console.error('Error saving lead:', err);
      setError(err?.message || 'Failed to save lead. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Contact person name"
          />
        </div>

        <div className="space-y-2">
          <Label>Phone *</Label>
          <Input
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+43 123 456"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="name@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label>Contact Method</Label>
          <Select value={formData.contact_method} onValueChange={(v) => setFormData({ ...formData, contact_method: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Phone">Phone</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Referral">Referral</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Boat Name</Label>
          <Input
            value={formData.boat_name || ''}
            onChange={(e) => setFormData({ ...formData, boat_name: e.target.value })}
            placeholder="e.g., Blue Horizon"
          />
        </div>

        <div className="space-y-2">
          <Label>Boat Details</Label>
          <Input
            value={formData.boat_details || ''}
            onChange={(e) => setFormData({ ...formData, boat_details: e.target.value })}
            placeholder="Type, length, engine..."
          />
        </div>

        <div className="space-y-2">
          <Label>Location</Label>
          {locations?.length > 0 ? (
            <Select value={formData.location_id || ''} onValueChange={(v) => {
              const loc = locations.find(l => l.id === v);
              setFormData({ ...formData, location_id: v, location: loc?.name || '' });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select marina" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Marina or anchorage"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Inquiry Type</Label>
          <Select value={formData.inquiry_type} onValueChange={(v) => setFormData({ ...formData, inquiry_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Service Inquiry">Service Inquiry</SelectItem>
              <SelectItem value="Parts Request">Parts Request</SelectItem>
              <SelectItem value="Maintenance">Maintenance</SelectItem>
              <SelectItem value="Emergency">Emergency</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Email / Transcript / Description</Label>
        <Textarea
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Paste the customer email, phone transcript, or detailed inquiry here. This will be used to generate task checklist."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Additional Notes</Label>
        <Textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any other information..."
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
          {saving ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
        </Button>
      </div>
    </form>
  );
}