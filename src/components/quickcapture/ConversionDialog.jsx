import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_LABELS = {
  material_entry:   { label: 'Material Entry',   target: 'CustomerMaterialEntry', targetLabel: 'Customer Material Entry' },
  tool_tracking:    { label: 'Tool Tracking',     target: 'Note',                 targetLabel: 'Note (Tool Tracking)' },
  task_candidate:   { label: 'Task Candidate',    target: 'Lead',                 targetLabel: 'Lead' },
  customer_request: { label: 'Customer Request',  target: 'Lead',                 targetLabel: 'Lead' },
  project_intake:   { label: 'Project Intake',    target: 'Lead',                 targetLabel: 'Lead' },
  internal_note:    { label: 'Internal Note',     target: 'Note',                 targetLabel: 'Note' },
};

function displayName(c) {
  return c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
}

export default function ConversionDialog({ entry, customers, boats, onSuccess, onCancel }) {
  const typeInfo = TYPE_LABELS[entry.suggested_type] || TYPE_LABELS.internal_note;

  // Pre-fill from entry
  const [customerId, setCustomerId] = useState(entry.customer_id || '');
  const [boatId, setBoatId] = useState(entry.boat_id || '');
  const [title, setTitle] = useState(entry.suggested_summary || entry.raw_input?.slice(0, 80) || '');
  const [description, setDescription] = useState(entry.raw_input || '');
  const [notes, setNotes] = useState('');
  const [billable, setBillable] = useState(entry.ai_billable_hint ?? true);
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);

  const availableBoats = customerId
    ? boats.filter(b => b.customer_id === customerId)
    : boats;

  const handleConvert = async () => {
    if (!title.trim()) { toast.error('Title / description is required'); return; }
    setSaving(true);
    try {
      const user = await base44.auth.me();
      let recordId = null;
      let recordType = typeInfo.target;

      if (entry.suggested_type === 'material_entry') {
        const record = await base44.entities.CustomerMaterialEntry.create({
          customer_id: customerId || null,
          source_type: 'manual',
          item_title: title.trim(),
          item_description: description.trim() || null,
          quantity: parseFloat(quantity) || 1,
          unit: 'Piece',
          notes: notes.trim() || null,
        });
        recordId = record.id;

      } else if (entry.suggested_type === 'tool_tracking') {
        const noteText = `[TOOL TRACKING] ${title.trim()}\n\n${description.trim()}${notes.trim() ? '\n\nNotes: ' + notes.trim() : ''}${entry.location_text ? '\nLocation: ' + entry.location_text : ''}`;
        const record = await base44.entities.Note.create({
          text: noteText.slice(0, 300),
          reference_type: customerId ? 'Customer' : 'None',
          reference_id: customerId || null,
          completed: false,
        });
        recordId = record.id;

      } else if (['task_candidate', 'customer_request', 'project_intake'].includes(entry.suggested_type)) {
        const record = await base44.entities.Lead.create({
          name: title.trim(),
          customer_id: customerId || null,
          boat_id: boatId || null,
          description: description.trim() || null,
          notes: notes.trim() || null,
          status: 'New',
          intake_source: 'Drive-In',
          priority: entry.ai_urgency_hint === 'urgent' ? 'Urgent' :
                    entry.ai_urgency_hint === 'high' ? 'High' : 'Normal',
        });
        recordId = record.id;

      } else {
        // internal_note
        const noteText = `${title.trim()}${description.trim() && description.trim() !== title.trim() ? '\n\n' + description.trim() : ''}${notes.trim() ? '\n\nNotes: ' + notes.trim() : ''}`;
        const record = await base44.entities.Note.create({
          text: noteText.slice(0, 300),
          reference_type: customerId ? 'Customer' : 'None',
          reference_id: customerId || null,
          completed: false,
        });
        recordId = record.id;
      }

      // Update the QuickCaptureEntry with routing info
      await base44.entities.QuickCaptureEntry.update(entry.id, {
        review_status: 'routed',
        routed_record_type: recordType,
        routed_record_id: recordId,
        routed_at: new Date().toISOString(),
        routed_by: user?.email || null,
        reviewed_by: user?.email || null,
        reviewed_at: new Date().toISOString(),
      });

      toast.success(`Created ${typeInfo.targetLabel} successfully`);
      onSuccess({ recordType, recordId });
    } catch (err) {
      toast.error('Conversion failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRight className="h-4 w-4 text-amber-500" />
            Convert to {typeInfo.targetLabel}
          </DialogTitle>
        </DialogHeader>

        {/* Source quote */}
        <div className="p-3 bg-slate-50 rounded-lg border text-sm text-slate-600 italic">
          "{entry.raw_input?.slice(0, 150)}{entry.raw_input?.length > 150 ? '…' : ''}"
        </div>

        <div className="space-y-4">
          {/* Customer */}
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setBoatId(''); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select customer (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>— None —</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Boat — only if not internal_note */}
          {entry.suggested_type !== 'internal_note' && (
            <div>
              <Label>Boat</Label>
              <Select value={boatId} onValueChange={setBoatId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select boat (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— None —</SelectItem>
                  {availableBoats.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.vessel_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title / item description */}
          <div>
            <Label>
              {entry.suggested_type === 'material_entry' ? 'Item Description *' :
               entry.suggested_type === 'tool_tracking' ? 'Tool / Equipment *' :
               entry.suggested_type === 'internal_note' ? 'Note Text *' :
               'Title *'}
            </Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="mt-1"
              placeholder="Required"
            />
          </div>

          {/* Quantity — only for material_entry */}
          {entry.suggested_type === 'material_entry' && (
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="mt-1 w-24"
                min="0.01"
                step="0.01"
              />
            </div>
          )}

          {/* Description — not for internal_note (title IS the note) */}
          {entry.suggested_type !== 'internal_note' && (
            <div>
              <Label>Description / Details</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="mt-1"
              placeholder="Optional"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleConvert}
              disabled={saving || !title.trim()}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Creating...</>
                : <><ArrowRight className="h-4 w-4 mr-1" />Create {typeInfo.targetLabel}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}