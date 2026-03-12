import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STAGES } from './stageConfig';

const SOURCES = ['Phone', 'Email', 'Website', 'Referral', 'Other'];

export default function OpportunityForm({ opportunity, customers = [], boats = [], users = [], onSave, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    customer_id: '',
    boat_id: '',
    expected_value: '',
    probability: 50,
    stage: 'New Lead',
    source: 'Other',
    assigned_user_id: '',
    next_action_date: '',
    expected_close_date: '',
    notes: '',
    lost_reason: '',
    ...(opportunity || {}),
  });
  const [saving, setSaving] = useState(false);

  const filteredBoats = form.customer_id
    ? boats.filter(b => b.customer_id === form.customer_id)
    : boats;

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const payload = {
      ...form,
      expected_value: form.expected_value !== '' ? parseFloat(form.expected_value) : null,
      probability: form.probability !== '' ? parseInt(form.probability) : 50,
    };
    if (opportunity?.id) {
      await base44.entities.Opportunity.update(opportunity.id, payload);
    } else {
      await base44.entities.Opportunity.create(payload);
    }
    setSaving(false);
    onSave?.();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Title *</Label>
        <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Deal title" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Stage</Label>
          <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.id}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Source</Label>
          <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Customer</Label>
          <Select value={form.customer_id || ''} onValueChange={v => setForm({ ...form, customer_id: v, boat_id: '' })}>
            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.company_name || c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Boat</Label>
          <Select value={form.boat_id || ''} onValueChange={v => setForm({ ...form, boat_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select boat" /></SelectTrigger>
            <SelectContent>
              {filteredBoats.map(b => <SelectItem key={b.id} value={b.id}>{b.vessel_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Expected Value (€)</Label>
          <Input type="number" value={form.expected_value} onChange={e => setForm({ ...form, expected_value: e.target.value })} placeholder="0" />
        </div>
        <div>
          <Label>Win Probability (%)</Label>
          <Input type="number" min="0" max="100" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Next Action Date</Label>
          <Input type="date" value={form.next_action_date || ''} onChange={e => setForm({ ...form, next_action_date: e.target.value })} />
        </div>
        <div>
          <Label>Expected Close Date</Label>
          <Input type="date" value={form.expected_close_date || ''} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
      </div>

      {form.stage === 'Lost' && (
        <div>
          <Label>Lost Reason</Label>
          <Input value={form.lost_reason || ''} onChange={e => setForm({ ...form, lost_reason: e.target.value })} placeholder="Why was this deal lost?" />
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !form.title}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}