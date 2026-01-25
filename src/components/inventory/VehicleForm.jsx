import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function VehicleForm({ vehicle, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: vehicle?.name || '',
    description: vehicle?.description || '',
    category: 'Vehicles',
    quantity_mode: 'unique',
    status: vehicle?.status || 'Active',
    license_plate: vehicle?.license_plate || '',
    vin: vehicle?.vin || '',
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    year: vehicle?.year || '',
    vehicle_type: vehicle?.vehicle_type || 'Van',
    fuel_type: vehicle?.fuel_type || '',
    capacity_notes: vehicle?.capacity_notes || '',
    insurance_expiry: vehicle?.insurance_expiry || '',
    maintenance_due_date: vehicle?.maintenance_due_date || '',
    location_base: vehicle?.location_base || 'Novigrad',
    notes: vehicle?.notes || ''
  });
  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name / Identifier *</Label>
          <Input
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., Van 1"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>License Plate</Label>
          <Input
            value={formData.license_plate}
            onChange={(e) => updateField('license_plate', e.target.value)}
            placeholder="e.g., ZG-1234-AB"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Make</Label>
          <Input
            value={formData.make}
            onChange={(e) => updateField('make', e.target.value)}
            placeholder="e.g., Mercedes"
          />
        </div>
        <div className="space-y-2">
          <Label>Model</Label>
          <Input
            value={formData.model}
            onChange={(e) => updateField('model', e.target.value)}
            placeholder="e.g., Sprinter"
          />
        </div>
        <div className="space-y-2">
          <Label>Year</Label>
          <Input
            type="number"
            value={formData.year}
            onChange={(e) => updateField('year', e.target.value)}
            placeholder="e.g., 2022"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Vehicle Type</Label>
          <Select value={formData.vehicle_type} onValueChange={(v) => updateField('vehicle_type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Van">Van</SelectItem>
              <SelectItem value="Car">Car</SelectItem>
              <SelectItem value="Truck">Truck</SelectItem>
              <SelectItem value="Trailer">Trailer</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fuel Type</Label>
          <Select value={formData.fuel_type} onValueChange={(v) => updateField('fuel_type', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select fuel type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Not specified</SelectItem>
              <SelectItem value="Diesel">Diesel</SelectItem>
              <SelectItem value="Petrol">Petrol</SelectItem>
              <SelectItem value="Electric">Electric</SelectItem>
              <SelectItem value="Hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Maintenance">Maintenance</SelectItem>
              <SelectItem value="Retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Insurance Expiry</Label>
          <Input
            type="date"
            value={formData.insurance_expiry}
            onChange={(e) => updateField('insurance_expiry', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Maintenance Due</Label>
          <Input
            type="date"
            value={formData.maintenance_due_date}
            onChange={(e) => updateField('maintenance_due_date', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>VIN (Vehicle Identification Number)</Label>
        <Input
          value={formData.vin}
          onChange={(e) => updateField('vin', e.target.value)}
          placeholder="17-character VIN"
        />
      </div>

      <div className="space-y-2">
        <Label>Base Location</Label>
        <Input
          value={formData.location_base}
          onChange={(e) => updateField('location_base', e.target.value)}
          placeholder="e.g., Novigrad"
        />
      </div>

      <div className="space-y-2">
        <Label>Capacity Notes</Label>
        <Textarea
          value={formData.capacity_notes}
          onChange={(e) => updateField('capacity_notes', e.target.value)}
          placeholder="Load capacity, passenger capacity, special equipment..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Description / Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (vehicle ? 'Update Vehicle' : 'Create Vehicle')}
        </Button>
      </div>
    </form>
  );
}