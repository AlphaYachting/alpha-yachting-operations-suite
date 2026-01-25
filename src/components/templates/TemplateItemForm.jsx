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

export default function TemplateItemForm({ item, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    default_estimated_hours: '',
    default_role: '',
    default_required_vehicle: false,
    required_tools_note: '',
    is_optional: false,
    requires_customer_approval: false,
    ...item
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    
    setSaving(true);

    try {
      const payload = {
        ...formData,
        default_estimated_hours: formData.default_estimated_hours ? parseFloat(formData.default_estimated_hours) : null
      };

      await onSave(payload);
    } catch (error) {
      console.error('Form submit error:', error);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Task Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Check engine oil level"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detailed instructions for this task"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="hours">Estimated Hours</Label>
          <Input
            id="hours"
            type="number"
            step="0.5"
            value={formData.default_estimated_hours || ''}
            onChange={(e) => setFormData({ ...formData, default_estimated_hours: e.target.value })}
            placeholder="0"
          />
        </div>

        <div>
          <Label htmlFor="role">Suggested Role</Label>
          <Select
            value={formData.default_role || ''}
            onValueChange={(v) => setFormData({ ...formData, default_role: v })}
          >
            <SelectTrigger id="role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Any</SelectItem>
              <SelectItem value="Mechanic">Mechanic</SelectItem>
              <SelectItem value="Electrician">Electrician</SelectItem>
              <SelectItem value="Electronics Tech">Electronics Tech</SelectItem>
              <SelectItem value="Rigging Specialist">Rigging Specialist</SelectItem>
              <SelectItem value="General Technician">General Technician</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="tools">Required Tools/Inventory</Label>
        <Textarea
          id="tools"
          value={formData.required_tools_note || ''}
          onChange={(e) => setFormData({ ...formData, required_tools_note: e.target.value })}
          placeholder="e.g., Torque wrench, oil filter, 4L engine oil"
          rows={2}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={formData.default_required_vehicle}
            onCheckedChange={(v) => setFormData({ ...formData, default_required_vehicle: v })}
          />
          <Label>Vehicle required</Label>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            checked={formData.is_optional}
            onCheckedChange={(v) => setFormData({ ...formData, is_optional: v })}
          />
          <Label>Optional task (can be skipped)</Label>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            checked={formData.requires_customer_approval}
            onCheckedChange={(v) => setFormData({ ...formData, requires_customer_approval: v })}
          />
          <Label>Requires customer approval</Label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? 'Saving...' : item ? 'Update Task' : 'Add Task'}
        </Button>
      </div>
    </form>
  );
}