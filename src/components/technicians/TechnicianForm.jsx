import React, { useState } from 'react';
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

const SKILLS = [
  'Mechanics',
  'Electronics', 
  'GRP/Gelcoat',
  'Rigging',
  'Plumbing',
  'HVAC',
  'Sealing',
  'Diagnostics',
  'Installations',
  'General Service'
];

const LANGUAGES = ['German', 'English', 'Italian', 'Slovenian', 'Croatian'];

export default function TechnicianForm({ technician, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    first_name: technician?.first_name || '',
    last_name: technician?.last_name || '',
    email: technician?.email || '',
    phone: technician?.phone || '',
    role: technician?.role || 'Technician',
    skills: technician?.skills || [],
    languages: technician?.languages || ['German'],
    certifications: technician?.certifications || [],
    home_base: technician?.home_base || 'Novigrad',
    assigned_vehicle: technician?.assigned_vehicle || '',
    hourly_rate_internal: technician?.hourly_rate_internal || '',
    hourly_rate_billable: technician?.hourly_rate_billable || '',
    availability_status: technician?.availability_status || 'Available',
    notes: technician?.notes || '',
    status: technician?.status || 'Active'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSkill = (skill) => {
    setFormData(prev => {
      const current = prev.skills || [];
      if (current.includes(skill)) {
        return { ...prev, skills: current.filter(s => s !== skill) };
      } else {
        return { ...prev, skills: [...current, skill] };
      }
    });
  };

  const toggleLanguage = (lang) => {
    setFormData(prev => {
      const current = prev.languages || [];
      if (current.includes(lang)) {
        return { ...prev, languages: current.filter(l => l !== lang) };
      } else {
        return { ...prev, languages: [...current, lang] };
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First Name *</Label>
          <Input
            value={formData.first_name}
            onChange={(e) => updateField('first_name', e.target.value)}
            placeholder="First name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Last Name *</Label>
          <Input
            value={formData.last_name}
            onChange={(e) => updateField('last_name', e.target.value)}
            placeholder="Last name"
            required
          />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={formData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+43 ..."
          />
        </div>
      </div>

      {/* Role & Status */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={formData.role} onValueChange={(v) => updateField('role', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Lead Technician">Lead Technician</SelectItem>
              <SelectItem value="Technician">Technician</SelectItem>
              <SelectItem value="Assistant">Assistant</SelectItem>
              <SelectItem value="Apprentice">Apprentice</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Availability</Label>
          <Select value={formData.availability_status} onValueChange={(v) => updateField('availability_status', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Available">Available</SelectItem>
              <SelectItem value="On Job">On Job</SelectItem>
              <SelectItem value="Off Duty">Off Duty</SelectItem>
              <SelectItem value="Vacation">Vacation</SelectItem>
              <SelectItem value="Sick">Sick</SelectItem>
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

      {/* Skills */}
      <div className="space-y-3">
        <Label>Skills</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SKILLS.map(skill => (
            <div 
              key={skill}
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                formData.skills?.includes(skill) 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => toggleSkill(skill)}
            >
              <Checkbox
                checked={formData.skills?.includes(skill)}
                onCheckedChange={() => toggleSkill(skill)}
              />
              <span className="text-sm">{skill}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div className="space-y-3">
        <Label>Languages</Label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => (
            <div 
              key={lang}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                formData.languages?.includes(lang) 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => toggleLanguage(lang)}
            >
              <Checkbox
                checked={formData.languages?.includes(lang)}
                onCheckedChange={() => toggleLanguage(lang)}
              />
              <span className="text-sm">{lang}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Assignment */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Home Base</Label>
          <Input
            value={formData.home_base}
            onChange={(e) => updateField('home_base', e.target.value)}
            placeholder="e.g., Novigrad"
          />
        </div>
        <div className="space-y-2">
          <Label>Assigned Vehicle</Label>
          <Input
            value={formData.assigned_vehicle}
            onChange={(e) => updateField('assigned_vehicle', e.target.value)}
            placeholder="e.g., Van 1"
          />
        </div>
      </div>

      {/* Rates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Internal Rate (€/h)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.hourly_rate_internal}
            onChange={(e) => updateField('hourly_rate_internal', parseFloat(e.target.value) || '')}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label>Billable Rate (€/h)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.hourly_rate_billable}
            onChange={(e) => updateField('hourly_rate_billable', parseFloat(e.target.value) || '')}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : (technician ? 'Update Technician' : 'Add Technician')}
        </Button>
      </div>
    </form>
  );
}