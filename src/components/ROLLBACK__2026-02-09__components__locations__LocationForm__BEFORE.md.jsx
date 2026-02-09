# ROLLBACK SNAPSHOT - components/locations/LocationForm.jsx BEFORE

Date: 2026-02-09
Purpose: Add Marina Fees / Working Permit UI section

```jsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function LocationForm({ location, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    location_type: location?.location_type || 'Marina',
    region: location?.region || 'Istria',
    address: location?.address || '',
    city: location?.city || '',
    country: location?.country || '',
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    access_notes: location?.access_notes || '',
    contact_person: location?.contact_person || '',
    contact_phone: location?.contact_phone || '',
    opening_hours: location?.opening_hours || '',
    is_partner: location?.is_partner || false,
    status: location?.status || 'Active'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Location Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., Marina Novigrad"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Location Type</Label>
          <Select value={formData.location_type} onValueChange={(v) => updateField('location_type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Marina">Marina</SelectItem>
              <SelectItem value="Dry Marina">Dry Marina</SelectItem>
              <SelectItem value="Anchorage">Anchorage</SelectItem>
              <SelectItem value="Yard">Yard</SelectItem>
              <SelectItem value="Alpha Base">Alpha Base</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Region & Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Region</Label>
          <Select value={formData.region} onValueChange={(v) => updateField('region', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Istria">Istria</SelectItem>
              <SelectItem value="Slovenia">Slovenia</SelectItem>
              <SelectItem value="North Italy">North Italy</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label>Address</Label>
        <Input
          value={formData.address}
          onChange={(e) => updateField('address', e.target.value)}
          placeholder="Street address"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>City</Label>
          <Input
            value={formData.city}
            onChange={(e) => updateField('city', e.target.value)}
            placeholder="City"
          />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <Input
            value={formData.country}
            onChange={(e) => updateField('country', e.target.value)}
            placeholder="Country"
          />
        </div>
      </div>

      {/* Coordinates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input
            type="number"
            step="0.000001"
            value={formData.latitude}
            onChange={(e) => updateField('latitude', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="45.123456"
          />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input
            type="number"
            step="0.000001"
            value={formData.longitude}
            onChange={(e) => updateField('longitude', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="13.654321"
          />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Contact Person</Label>
          <Input
            value={formData.contact_person}
            onChange={(e) => updateField('contact_person', e.target.value)}
            placeholder="Name"
          />
        </div>
        <div className="space-y-2">
          <Label>Contact Phone</Label>
          <Input
            value={formData.contact_phone}
            onChange={(e) => updateField('contact_phone', e.target.value)}
            placeholder="+385 ..."
          />
        </div>
      </div>

      {/* Opening Hours */}
      <div className="space-y-2">
        <Label>Opening Hours</Label>
        <Input
          value={formData.opening_hours}
          onChange={(e) => updateField('opening_hours', e.target.value)}
          placeholder="e.g., Mon-Fri 8:00-17:00"
        />
      </div>

      {/* Access Notes */}
      <div className="space-y-2">
        <Label>Access Notes</Label>
        <Textarea
          value={formData.access_notes}
          onChange={(e) => updateField('access_notes', e.target.value)}
          placeholder="Gate codes, parking info, access restrictions..."
          rows={3}
        />
      </div>

      {/* Partner */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Partner Marina</Label>
          <p className="text-sm text-slate-500">Mark as preferred partner location</p>
        </div>
        <Switch
          checked={formData.is_partner}
          onCheckedChange={(v) => updateField('is_partner', v)}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (location ? 'Update Location' : 'Add Location')}
        </Button>
      </div>
    </form>
  );
}
``