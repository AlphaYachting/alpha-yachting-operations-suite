import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Phone, Mail, Calendar, FileText, Bell, Plus } from 'lucide-react';

const ACTIVITY_TYPES = [
  { id: 'call',      label: 'Call',      Icon: Phone,    cls: 'bg-blue-100 text-blue-700' },
  { id: 'email',     label: 'Email',     Icon: Mail,     cls: 'bg-indigo-100 text-indigo-700' },
  { id: 'meeting',   label: 'Meeting',   Icon: Calendar, cls: 'bg-emerald-100 text-emerald-700' },
  { id: 'note',      label: 'Note',      Icon: FileText, cls: 'bg-slate-100 text-slate-700' },
  { id: 'follow-up', label: 'Follow-up', Icon: Bell,     cls: 'bg-orange-100 text-orange-700' },
];
const TYPE_MAP = Object.fromEntries(ACTIVITY_TYPES.map(a => [a.id, a]));

export default function ActivityPanel({ opportunityId }) {
  const [activities, setActivities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ activity_type: 'note', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (opportunityId) load(); }, [opportunityId]);

  const load = async () => {
    const data = await base44.entities.OpportunityActivity.filter({ opportunity_id: opportunityId }, '-activity_date');
    setActivities(data);
  };

  const handleAdd = async () => {
    if (!draft.description) return;
    setSaving(true);
    await base44.entities.OpportunityActivity.create({
      opportunity_id: opportunityId,
      activity_type: draft.activity_type,
      activity_date: new Date().toISOString(),
      description: draft.description,
    });
    setDraft({ activity_type: 'note', description: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Activity Log</h4>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
          <Select value={draft.activity_type} onValueChange={v => setDraft({ ...draft, activity_type: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea
            value={draft.description}
            onChange={e => setDraft({ ...draft, description: e.target.value })}
            placeholder="Describe the activity…"
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !draft.description}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {activities.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">No activities yet</p>
        )}
        {activities.map(a => {
          const t = TYPE_MAP[a.activity_type] || TYPE_MAP['note'];
          return (
            <div key={a.id} className="flex gap-2 text-sm">
              <div className={`flex-shrink-0 p-1.5 rounded-full self-start ${t.cls}`}>
                <t.Icon className="h-3 w-3" />
              </div>
              <div>
                <p className="text-slate-700 leading-snug">{a.description}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {format(new Date(a.activity_date), 'dd.MM.yyyy HH:mm')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}