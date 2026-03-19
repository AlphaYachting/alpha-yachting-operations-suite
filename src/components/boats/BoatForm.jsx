import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function BoatForm({ boat, customers, locations, preselectedCustomerId, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    customer_id: boat?.customer_id || preselectedCustomerId || '',
    vessel_name: boat?.vessel_name || '',
    vessel_type: boat?.vessel_type || 'Sailboat',
    manufacturer: boat?.manufacturer || '',
    model: boat?.model || '',
    year: boat?.year || '',
    length_m: boat?.length_m || '',
    beam_m: boat?.beam_m || '',
    draft_m: boat?.draft_m || '',
    hull_material: boat?.hull_material || 'GRP/Fiberglass',
    engine_type: boat?.engine_type || 'Inboard Diesel',
    engine_manufacturer: boat?.engine_manufacturer || '',
    engine_model: boat?.engine_model || '',
    engine_number: boat?.engine_number || '',
    engine_hours: boat?.engine_hours || '',
    electrical_system: boat?.electrical_system || '12V',
    current_location_id: boat?.current_location_id || '',
    berth_number: boat?.berth_number || '',
    access_details: boat?.access_details || '',
    known_issues: boat?.known_issues || '',
    systems_notes: boat?.systems_notes || '',
    photo_url: boat?.photo_url || '',
    registration_number: boat?.registration_number || '',
    flag_country: boat?.flag_country || '',
    status: boat?.status || 'Active'
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      updateField('photo_url', file_url);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const getCustomerDisplayName = (customer) => {
    if (customer.company_name) return customer.company_name;
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Owner & Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Owner (Customer) *</Label>
          <Select value={formData.customer_id} onValueChange={(v) => updateField('customer_id', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select owner" />
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
          <Label>Vessel Name</Label>
          <Input
            value={formData.vessel_name || ''}
            onChange={(e) => updateField('vessel_name', e.target.value)}
            placeholder="Vessel name"
          />
        </div>
      </div>

      {/* Vessel Type & Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Vessel Type</Label>
          <Select value={formData.vessel_type} onValueChange={(v) => updateField('vessel_type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sailboat">Sailboat</SelectItem>
              <SelectItem value="Motorboat">Motorboat</SelectItem>
              <SelectItem value="Yacht">Yacht</SelectItem>
              <SelectItem value="Catamaran">Catamaran</SelectItem>
              <SelectItem value="RIB">RIB</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Manufacturer</Label>
          <Input
            value={formData.manufacturer || ''}
            onChange={(e) => updateField('manufacturer', e.target.value)}
            placeholder="e.g., Bavaria, Beneteau"
          />
        </div>
        <div className="space-y-2">
          <Label>Model</Label>
          <Input
            value={formData.model || ''}
            onChange={(e) => updateField('model', e.target.value)}
            placeholder="e.g., Cruiser 46"
          />
        </div>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Year</Label>
          <Input
            type="number"
            value={formData.year}
            onChange={(e) => updateField('year', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="2020"
          />
        </div>
        <div className="space-y-2">
          <Label>Length (m)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.length_m}
            onChange={(e) => updateField('length_m', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="12.5"
          />
        </div>
        <div className="space-y-2">
          <Label>Beam (m)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.beam_m}
            onChange={(e) => updateField('beam_m', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="4.2"
          />
        </div>
        <div className="space-y-2">
          <Label>Draft (m)</Label>
          <Input
            type="number"
            step="0.1"
            value={formData.draft_m}
            onChange={(e) => updateField('draft_m', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="2.1"
          />
        </div>
      </div>

      {/* Boat Image */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Boat Image</h3>
        {formData.photo_url ? (
          <div className="relative w-full h-48 rounded-lg overflow-hidden border border-slate-200">
            <img 
              src={formData.photo_url} 
              alt="Boat" 
              className="w-full h-full object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => updateField('photo_url', '')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="boat-image-upload"
              disabled={uploadingImage}
            />
            <label htmlFor="boat-image-upload" className="cursor-pointer">
              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">
                {uploadingImage ? 'Uploading...' : 'Click to upload boat image'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Max 10MB, JPG/PNG</p>
            </label>
          </div>
        )}
      </div>

      {/* Construction */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Hull Material</Label>
          <Select value={formData.hull_material} onValueChange={(v) => updateField('hull_material', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GRP/Fiberglass">GRP/Fiberglass</SelectItem>
              <SelectItem value="Aluminum">Aluminum</SelectItem>
              <SelectItem value="Steel">Steel</SelectItem>
              <SelectItem value="Wood">Wood</SelectItem>
              <SelectItem value="Carbon">Carbon</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Electrical System</Label>
          <Select value={formData.electrical_system} onValueChange={(v) => updateField('electrical_system', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12V">12V</SelectItem>
              <SelectItem value="24V">24V</SelectItem>
              <SelectItem value="12V/24V Combined">12V/24V Combined</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Engine */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Engine Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Engine Type</Label>
            <Select value={formData.engine_type} onValueChange={(v) => updateField('engine_type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inboard Diesel">Inboard Diesel</SelectItem>
                <SelectItem value="Inboard Petrol">Inboard Petrol</SelectItem>
                <SelectItem value="Outboard">Outboard</SelectItem>
                <SelectItem value="Electric">Electric</SelectItem>
                <SelectItem value="Sail Only">Sail Only</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Engine Make</Label>
            <Input
              value={formData.engine_manufacturer || ''}
              onChange={(e) => updateField('engine_manufacturer', e.target.value)}
              placeholder="e.g., Volvo"
            />
          </div>
          <div className="space-y-2">
            <Label>Engine Model</Label>
            <Input
              value={formData.engine_model || ''}
              onChange={(e) => updateField('engine_model', e.target.value)}
              placeholder="e.g., D2-40"
            />
          </div>
          <div className="space-y-2">
            <Label>Engine Hours</Label>
            <Input
              type="number"
              value={formData.engine_hours}
              onChange={(e) => updateField('engine_hours', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Engine Number</Label>
          <Input
            value={formData.engine_number || ''}
            onChange={(e) => updateField('engine_number', e.target.value.trim())}
            placeholder="Engine serial / engine number as found on the engine plate"
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-4">
        <h3 className="font-medium text-slate-900">Current Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Marina / Location</Label>
            <Select value={formData.current_location_id} onValueChange={(v) => updateField('current_location_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(location => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Berth Number</Label>
            <Input
              value={formData.berth_number || ''}
              onChange={(e) => updateField('berth_number', e.target.value)}
              placeholder="e.g., A-15"
            />
          </div>
        </div>
      </div>

      {/* Registration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Registration Number</Label>
          <Input
            value={formData.registration_number || ''}
            onChange={(e) => updateField('registration_number', e.target.value)}
            placeholder="Registration #"
          />
        </div>
        <div className="space-y-2">
          <Label>Flag Country</Label>
          <Input
            value={formData.flag_country || ''}
            onChange={(e) => updateField('flag_country', e.target.value)}
            placeholder="e.g., Austria"
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => updateField('status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="In Storage">In Storage</SelectItem>
              <SelectItem value="Sold">Sold</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Access Details</Label>
        <Textarea
          value={formData.access_details || ''}
          onChange={(e) => updateField('access_details', e.target.value)}
          placeholder="Keys location, lockbox code, contact person..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Known Issues / Recurring Problems</Label>
        <Textarea
          value={formData.known_issues || ''}
          onChange={(e) => updateField('known_issues', e.target.value)}
          placeholder="History of problems, weak spots..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Systems Notes</Label>
        <Textarea
          value={formData.systems_notes || ''}
          onChange={(e) => updateField('systems_notes', e.target.value)}
          placeholder="Installed systems, upgrades, special equipment..."
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (boat ? 'Update Boat' : 'Add Boat')}
        </Button>
      </div>
    </form>
  );
}