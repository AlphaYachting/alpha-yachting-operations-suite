import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LeadStatusChange({ lead, onStatusChange }) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === lead.status) return;

    // Validation: Pending → Contacted requires tasks
    if (lead.status === 'Pending' && newStatus === 'Contacted') {
      setLoading(true);
      try {
        const tasks = await base44.entities.LeadTask.filter({ lead_id: lead.id });

        if (tasks.length === 0) {
          toast.error('Generate AI tasks first', {
            description: 'Click "Tasks & Notes" and generate tasks before contacting the lead.',
          });
          setLoading(false);
          return;
        }

        const inProgressOrDone = tasks.filter(
          t => t.status === 'In Progress' || t.status === 'Completed'
        );

        if (inProgressOrDone.length === 0) {
          toast.error('Start working on tasks first', {
            description: `${tasks.length} task(s) created, but none have been started yet.`,
          });
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error checking tasks:', error);
        setLoading(false);
        return;
      }
    }

    // Update lead status
    setLoading(true);
    try {
      await base44.entities.Lead.update(lead.id, { status: newStatus });
      toast.success(`Lead moved to ${newStatus}`);
      await onStatusChange();
    } catch (error) {
      console.error('Error updating lead status:', error);
      toast.error('Failed to update lead status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select value={lead.status} onValueChange={handleStatusChange} disabled={loading}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="Pending">
          <span className="flex items-center gap-2">
            Pending
          </span>
        </SelectItem>
        <SelectItem value="Contacted">
          <span className="flex items-center gap-2">
            Contacted
          </span>
        </SelectItem>
        <SelectItem value="Converted">
          <span className="flex items-center gap-2">
            Converted
          </span>
        </SelectItem>
        <SelectItem value="Rejected">
          <span className="flex items-center gap-2">
            Rejected
          </span>
        </SelectItem>
        <SelectItem value="Lost">
          <span className="flex items-center gap-2">
            Lost
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}