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
  'General Service',
  'Sail Making',
  'Tent Making',
  'Cushion Making',
  'Carpentry',
  'Woodworking',
  'Steel Work',
  'Antifouling',
  'Polish'
];

const ROLE_TENDENCIES = ['LEAD', 'EXECUTION', 'SUPPORT', 'SPECIALIST', 'FINISHING_QC'];

const ROLE_TENDENCY_LABELS = {
  LEAD: 'Lead',
  EXECUTION: 'Execution',
  SUPPORT: 'Support',
  SPECIALIST: 'Specialist',
  FINISHING_QC: 'Finishing / QC'
};

const LANGUAGES = ['German', 'English', 'Italian', 'Slovenian', 'Croatian'];

const COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#ef4444', label: 'Red' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#f97316', label: 'Orange' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#475569', label: 'Dark Slate' },
  { value: '#84cc16', label: 'Lime' }
];

export default function TechnicianForm({ technician, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    first_name: technician?.first_name || '',
    last_name: technician?.last_name || '',
    email: technician?.email || '',
    phone: technician?.phone || '',
    role: technician?.role || 'Technician',
    is_external: technician?.is_external || false,
    color: technician?.color || '#3b82f6',
    skills: technician?.skills || [],
    languages: technician?.languages || ['German'],
    certifications: technician?.certifications || [],
    home_base: technician?.home_base || 'Novigrad',
    assigned_vehicle: technician?.assigned_vehicle || '',
    hourly_rate_internal: technician?.hourly_rate_internal || '',
    hourly_rate_billable: technician?.hourly_rate_billable || '',
    availability_status: technician?.availability_status || 'Available',
    notes: technician?.notes || '',
    status: technician?.status || 'Active',
    team_type: technician?.team_type || '',
    availability_class: technician?.availability_class || '',
    primary_role_tendency: technician?.primary_role_tendency || '',
    secondary_role_tendencies: technician?.secondary_role_tendencies || [],
    quick_response_mode: technician?.quick_response_mode || '',
    extended_skill_notes: technician?.extended_skill_notes || '',
    planning_notes: technician?.planning_notes || ''
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

  const toggleSecondaryRole = (role) => {
    setFormData(prev => {
      const current = prev.secondary_role_tendencies || [];
      if (current.includes(role)) {
        return { ...prev, secondary_role_tendencies: current.filter(r => r !== role) };
      } else {
        return { ...prev, secondary_role_tendencies: [...current, role] };
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

      {/* External Technician */}
      <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
        <Checkbox
          id="is_external"
          checked={formData.is_external}
          onCheckedChange={(checked) => updateField('is_external', checked)}
        />
        <Label htmlFor="is_external" className="cursor-pointer flex-1 m-0">
          <span className="font-medium">External Technician</span>
          <p className="text-xs text-slate-500">Mark if this person is not part of your main team</p>
        </Label>
      </div>

      {/* Schedule Color */}
      <div className="space-y-2">
        <Label>Schedule Color</Label>
        <p className="text-xs text-slate-500 mb-2">Choose a color to easily identify this technician in schedule views</p>
        <div className="grid grid-cols-5 gap-3">
          {COLORS.map(color => (
            <button
              key={color.value}
              type="button"
              onClick={() => updateField('color', color.value)}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                formData.color === color.value
                  ? 'border-slate-900 shadow-md scale-105'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div
                className="w-8 h-8 rounded-full"
                style={{ backgroundColor: color.value }}
              />
              <span className="text-xs font-medium">{color.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-3">
        <Label>Skills</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SKILLS.map(skill => (
            <label 
              key={skill}
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                formData.skills?.includes(skill) 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Checkbox
                checked={formData.skills?.includes(skill)}
                onCheckedChange={(checked) => {
                  toggleSkill(skill);
                }}
              />
              <span className="text-sm">{skill}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div className="space-y-3">
        <Label>Languages</Label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => (
            <label 
              key={lang}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                formData.languages?.includes(lang) 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Checkbox
                checked={formData.languages?.includes(lang)}
                onCheckedChange={(checked) => {
                  toggleLanguage(lang);
                }}
              />
              <span className="text-sm">{lang}</span>
            </label>
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

      {/* Planning Profile */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Planning Profile</h3>
          <p className="text-xs text-slate-500 mt-0.5">Used by the Planning Agent for resource proposals</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Team Type</Label>
            <Select value={formData.team_type} onValueChange={(v) => updateField('team_type', v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Core">Core</SelectItem>
                <SelectItem value="External">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Availability Class</Label>
            <Select value={formData.availability_class} onValueChange={(v) => updateField('availability_class', v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CORE_PREFERRED">Core — Preferred</SelectItem>
                <SelectItem value="CORE_LIMITED">Core — Limited</SelectItem>
                <SelectItem value="EXTERNAL_REGULAR">External — Regular</SelectItem>
                <SelectItem value="EXTERNAL_SPECIALIST">External — Specialist only</SelectItem>
                <SelectItem value="EXTERNAL_ON_REQUEST">External — On request</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Primary Role Tendency</Label>
            <Select value={formData.primary_role_tendency} onValueChange={(v) => updateField('primary_role_tendency', v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {ROLE_TENDENCIES.map(r => (
                  <SelectItem key={r} value={r}>{ROLE_TENDENCY_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quick Response Mode</Label>
            <Select value={formData.quick_response_mode} onValueChange={(v) => updateField('quick_response_mode', v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="same_day">Same day</SelectItem>
                <SelectItem value="next_day">Next day</SelectItem>
                <SelectItem value="2_3_days">2–3 days</SelectItem>
                <SelectItem value="by_arrangement">By arrangement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Secondary Role Tendencies</Label>
          <div className="flex flex-wrap gap-2">
            {ROLE_TENDENCIES.map(role => (
              <label
                key={role}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                  formData.secondary_role_tendencies?.includes(role)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Checkbox
                  checked={formData.secondary_role_tendencies?.includes(role)}
                  onCheckedChange={() => toggleSecondaryRole(role)}
                />
                <span className="text-sm">{ROLE_TENDENCY_LABELS[role]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Extended Skill Notes</Label>
          <Textarea
            value={formData.extended_skill_notes}
            onChange={(e) => updateField('extended_skill_notes', e.target.value)}
            placeholder="Qualitative description: strengths, working style, special capabilities..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Planning Notes <span className="text-slate-400 font-normal">(internal)</span></Label>
          <Textarea
            value={formData.planning_notes}
            onChange={(e) => updateField('planning_notes', e.target.value)}
            placeholder="Internal planning notes for operations..."
            rows={2}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>General Notes</Label>
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