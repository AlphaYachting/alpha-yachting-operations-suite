import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const SERVICE_AREA_OPTIONS = [
  'General Service', 'Mechanical', 'Electrical', 'Electronics',
  'GRP/Bodywork', 'Sealing', 'HVAC', 'Rigging', 'Plumbing',
  'Installation', 'Diagnostics', 'Other',
];

// Returns human label for action type
const ACTION_LABEL = {
  MISSING_DURATION: 'Set duration',
  NO_TECHNICIAN:    'Assign technician',
  MISSING_LOCATION: 'Set location',
  NO_SERVICE_AREA:  'Set service area',
};

export default function QuickActionEditor({ blockerId, workOrder, job, technicians, locations, onSaved, onCancel }) {
  const [value, setValue] = useState(() => {
    if (blockerId === 'MISSING_DURATION') return workOrder.estimated_duration_hours || '';
    if (blockerId === 'NO_TECHNICIAN')    return workOrder.assigned_technicians || [];
    if (blockerId === 'MISSING_LOCATION') return job?.location_id || '';
    if (blockerId === 'NO_SERVICE_AREA')  return workOrder.service_area || '';
    return '';
  });
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (blockerId === 'MISSING_DURATION') {
        await base44.entities.WorkOrder.update(workOrder.id, { estimated_duration_hours: parseFloat(value) });
      } else if (blockerId === 'NO_TECHNICIAN') {
        await base44.entities.WorkOrder.update(workOrder.id, { assigned_technicians: value });
      } else if (blockerId === 'MISSING_LOCATION') {
        await base44.entities.Job.update(job.id, { location_id: value });
      } else if (blockerId === 'NO_SERVICE_AREA') {
        await base44.entities.WorkOrder.update(workOrder.id, { service_area: value });
      }
      setSaved(true);
      setTimeout(() => onSaved(), 1200);
    } catch (e) {
      setError(e.message || 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 mt-2 px-1">
        <CheckCircle2 className="h-4 w-4" />
        {ACTION_LABEL[blockerId]} saved successfully.
      </div>
    );
  }

  const isValid = () => {
    if (blockerId === 'MISSING_DURATION') return value !== '' && !isNaN(parseFloat(value)) && parseFloat(value) > 0;
    if (blockerId === 'NO_TECHNICIAN')    return Array.isArray(value) && value.length > 0;
    if (blockerId === 'MISSING_LOCATION') return !!value;
    if (blockerId === 'NO_SERVICE_AREA')  return !!value;
    return false;
  };

  return (
    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
      {/* Input area */}
      {blockerId === 'MISSING_DURATION' && (
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Estimated duration (hours)</label>
          <Input
            type="number"
            min="0.5"
            step="0.5"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. 3"
            className="text-sm h-8 w-32"
          />
        </div>
      )}

      {blockerId === 'NO_TECHNICIAN' && (
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Select technician(s)</label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {technicians.filter(t => t.status === 'Active').map(t => {
              const checked = value.includes(t.id);
              return (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setValue(prev =>
                      checked ? prev.filter(id => id !== t.id) : [...prev, t.id]
                    )}
                    className="rounded"
                  />
                  <span className="text-slate-700">{t.first_name} {t.last_name}</span>
                  <span className="text-xs text-slate-400">{t.role}</span>
                </label>
              );
            })}
            {technicians.filter(t => t.status === 'Active').length === 0 && (
              <p className="text-xs text-slate-400 px-2">No active technicians found.</p>
            )}
          </div>
        </div>
      )}

      {blockerId === 'MISSING_LOCATION' && (
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Select location</label>
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— choose location —</option>
            {locations.filter(l => l.status === 'Active').map(l => (
              <option key={l.id} value={l.id}>{l.name} ({l.location_type})</option>
            ))}
          </select>
        </div>
      )}

      {blockerId === 'NO_SERVICE_AREA' && (
        <div>
          <label className="text-xs text-slate-600 mb-1 block">Select service area</label>
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— choose service area —</option>
            {SERVICE_AREA_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Confirm step */}
      {!confirming ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" className="h-7 text-xs" disabled={!isValid()} onClick={() => setConfirming(true)}>
            Apply change
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        </div>
      ) : (
        <div className="p-2 bg-white border border-orange-200 rounded-md">
          <p className="text-xs text-slate-700 font-medium mb-2">Apply this change?</p>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirming(false)} disabled={saving}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}