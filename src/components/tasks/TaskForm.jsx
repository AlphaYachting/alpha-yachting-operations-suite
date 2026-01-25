import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function TaskForm({ task, workOrderId, technicians, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    work_order_id: workOrderId,
    title: '',
    description: '',
    status: 'Not Started',
    estimated_minutes: '',
    sequence_order: 0,
    notes: '',
    issue_notes: '',
    requires_approval: false,
    ...task
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    
    setSaving(true);
    
    const payload = {
      ...formData,
      estimated_minutes: formData.estimated_minutes ? parseInt(formData.estimated_minutes) : null,
      sequence_order: formData.sequence_order ? parseInt(formData.sequence_order) : 0,
    };
    
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Task title"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detailed task description"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Not Possible">Not Possible</SelectItem>
              <SelectItem value="Needs Approval">Needs Approval</SelectItem>
              <SelectItem value="Skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="estimated_minutes">Estimated Time (minutes)</Label>
          <Input
            id="estimated_minutes"
            type="number"
            value={formData.estimated_minutes || ''}
            onChange={(e) => setFormData({ ...formData, estimated_minutes: e.target.value })}
            placeholder="60"
            min="0"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="sequence_order">Sequence Order</Label>
        <Input
          id="sequence_order"
          type="number"
          value={formData.sequence_order}
          onChange={(e) => setFormData({ ...formData, sequence_order: e.target.value })}
          placeholder="0"
          min="0"
        />
        <p className="text-xs text-slate-500 mt-1">Order in which tasks should be performed</p>
      </div>

      <div>
        <Label htmlFor="notes">Execution Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Notes about task execution"
          rows={2}
        />
      </div>

      <div>
        <Label htmlFor="issue_notes">Issue Notes</Label>
        <Textarea
          id="issue_notes"
          value={formData.issue_notes || ''}
          onChange={(e) => setFormData({ ...formData, issue_notes: e.target.value })}
          placeholder="If task couldn't be completed, explain why"
          rows={2}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="requires_approval"
          checked={formData.requires_approval}
          onChange={(e) => setFormData({ ...formData, requires_approval: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300"
        />
        <Label htmlFor="requires_approval" className="cursor-pointer">
          Requires Approval
        </Label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
          {saving ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}