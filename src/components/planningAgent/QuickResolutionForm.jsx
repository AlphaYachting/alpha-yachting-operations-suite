import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function QuickResolutionForm({ item, technicians = [], onSave }) {
  const { workOrder, job } = item;
  const [loading, setLoading] = useState(false);
  const [showOrgConfirm, setShowOrgConfirm] = useState(null); // null | 'create' | 'not_needed'

  // Form state
  const [formData, setFormData] = useState({
    scheduled_date: workOrder.scheduled_date || '',
    estimated_duration_hours: workOrder.estimated_duration_hours || '',
    lead_technician_id: workOrder.lead_technician_id || '',
    access_confirmed: workOrder.access_confirmed || false,
    org_action: '', // 'create' | 'not_needed' | ''
  });

  const handleDateChange = (e) => setFormData(d => ({ ...d, scheduled_date: e.target.value }));
  const handleDurationChange = (e) => {
    const val = e.target.value;
    setFormData(d => ({ ...d, estimated_duration_hours: val ? parseFloat(val) : '' }));
  };
  const handleTechnicianChange = (val) => setFormData(d => ({ ...d, lead_technician_id: val }));
  const handleAccessChange = (checked) => setFormData(d => ({ ...d, access_confirmed: checked }));
  const handleOrgAction = (action) => setFormData(d => ({ ...d, org_action: action }));

  const handleSave = async () => {
    if (!workOrder.id) return;

    setLoading(true);
    try {
      const updates = {};

      // Start date
      if (formData.scheduled_date !== workOrder.scheduled_date) {
        updates.scheduled_date = formData.scheduled_date;
      }

      // Duration
      if (formData.estimated_duration_hours !== (workOrder.estimated_duration_hours || '')) {
        updates.estimated_duration_hours = formData.estimated_duration_hours ? parseFloat(formData.estimated_duration_hours) : null;
      }

      // Execution owner
      if (formData.lead_technician_id !== (workOrder.lead_technician_id || '')) {
        updates.lead_technician_id = formData.lead_technician_id || null;
      }

      // Access confirmed
      if (formData.access_confirmed !== workOrder.access_confirmed) {
        updates.access_confirmed = formData.access_confirmed;
      }

      // Org task actions
      if (formData.org_action === 'not_needed' && !workOrder.org_tasks_not_needed) {
        updates.org_tasks_not_needed = true;
      }

      // Apply updates to WorkOrder
      if (Object.keys(updates).length > 0) {
        await base44.entities.WorkOrder.update(workOrder.id, updates);
        toast.success('Work order updated');
      }

      // Create org task if needed
      if (formData.org_action === 'create') {
        await base44.entities.Task.create({
          work_order_id: workOrder.id,
          title: '[ORG] Project coordination',
          task_stream: 'ORGANIZATION',
          status: 'Not Started',
        });
        toast.success('Organization task created');
      }

      // Trigger planner re-eval
      onSave?.();
    } catch (error) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const activeFilter = technicians.filter(t => t.status === 'Active');

  return (
    <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Planning Actions</p>

      {/* Start Date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-600">Start Date</label>
        <Input
          type="date"
          value={formData.scheduled_date}
          onChange={handleDateChange}
          className="text-sm"
        />
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-600">Duration (hours)</label>
        <Input
          type="number"
          min="0"
          step="0.5"
          value={formData.estimated_duration_hours}
          onChange={handleDurationChange}
          placeholder="e.g., 6"
          className="text-sm"
        />
      </div>

      {/* Execution Owner */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-600">Execution Owner</label>
        <Select value={formData.lead_technician_id} onValueChange={handleTechnicianChange}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select technician" />
          </SelectTrigger>
          <SelectContent>
            {activeFilter.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.first_name} {t.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Access Confirmed */}
      <div className="flex items-center gap-3 p-2 rounded bg-slate-50 border border-slate-100">
        <Checkbox
          id="access_confirmed"
          checked={formData.access_confirmed}
          onCheckedChange={handleAccessChange}
        />
        <label htmlFor="access_confirmed" className="text-xs font-medium text-slate-700 cursor-pointer flex-1">
          Access confirmed
        </label>
      </div>

      {/* Org Tasks */}
      <div className="flex flex-col gap-2 p-2 rounded bg-slate-50 border border-slate-100">
        <p className="text-xs font-medium text-slate-700">Organization Tasks</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleOrgAction(formData.org_action === 'create' ? '' : 'create')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              formData.org_action === 'create'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-300'
            }`}
          >
            Create org task
          </button>
          <button
            onClick={() => handleOrgAction(formData.org_action === 'not_needed' ? '' : 'not_needed')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              formData.org_action === 'not_needed'
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-white border border-slate-300 text-slate-600 hover:border-green-300'
            }`}
          >
            Not needed
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={loading}
          size="sm"
          className="flex-1"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
          Save Changes
        </Button>
      </div>

      {/* Org Confirmation Dialog */}
      <AlertDialog open={showOrgConfirm !== null} onOpenChange={() => setShowOrgConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {showOrgConfirm === 'create' ? 'Create Organization Task' : 'Mark Org Task Not Needed'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {showOrgConfirm === 'create'
              ? 'This will create a new ORGANIZATION task for project coordination. Proceed?'
              : 'This confirms that no organizational prep is needed for this work order. Proceed?'}
          </AlertDialogDescription>
          <div className="flex gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowOrgConfirm(null); handleSave(); }}>
              Confirm
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}