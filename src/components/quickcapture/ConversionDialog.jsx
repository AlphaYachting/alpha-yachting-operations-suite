import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

// forcedTarget overrides the default mapping for the entry type
// Supported forcedTargets: 'CustomerMaterialEntry' | 'Note' | 'Lead' | 'Offer'
const DEFAULT_TARGET = {
  material_entry:   'CustomerMaterialEntry',
  tool_tracking:    'Note',
  internal_note:    'Note',
  task_candidate:   'Note',
  customer_request: 'Lead',
  project_intake:   'Lead',
};

const TARGET_LABELS = {
  CustomerMaterialEntry: 'Customer Material Entry',
  Note:  'Customer Note',
  Lead:  'Lead',
  Offer: 'Offer Draft',
};

function displayName(c) {
  return c?.company_name || `${c?.first_name || ''} ${c?.last_name || ''}`.trim() || '—';
}

export default function ConversionDialog({ entry, customers, boats, forcedTarget, onSuccess, onCancel }) {
  const navigate = useNavigate();
  const target = forcedTarget || DEFAULT_TARGET[entry.suggested_type] || 'Note';
  const targetLabel = TARGET_LABELS[target] || target;

  const customer = useMemo(() => customers.find(c => c.id === entry.customer_id), [customers, entry.customer_id]);

  const [customerId, setCustomerId] = useState(entry.customer_id || '');
  const [boatId, setBoatId]         = useState(entry.boat_id || '');
  const [title, setTitle]           = useState(entry.suggested_summary || entry.raw_input?.slice(0, 80) || '');
  const [content, setContent]       = useState(entry.raw_input || '');
  const [notes, setNotes]           = useState('');
  const [quantity, setQuantity]     = useState('1');
  const [unitPrice, setUnitPrice]   = useState('');
  const [noteType, setNoteType]     = useState('internal');
  const [saving, setSaving]         = useState(false);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);
  const availableBoats   = customerId ? boats.filter(b => b.customer_id === customerId) : boats;

  const handleConvert = async () => {
    if (!title.trim()) { toast.error('Title / description is required'); return; }
    setSaving(true);
    try {
      const user = await base44.auth.me();
      let recordId   = null;
      let recordType = target;

      // ── A. Customer Material Entry ──────────────────────────────────────
      if (target === 'CustomerMaterialEntry') {
        const record = await base44.entities.CustomerMaterialEntry.create({
          customer_id:        customerId || null,
          source_type:        'manual',
          item_title:         title.trim(),
          item_description:   content.trim() || null,
          quantity:           parseFloat(quantity) || 1,
          unit:               'Piece',
          unit_purchase_price: unitPrice ? parseFloat(unitPrice) : null,
          total_purchase_price: (unitPrice && quantity)
            ? parseFloat(unitPrice) * parseFloat(quantity)
            : null,
          notes: notes.trim() || null,
        });
        recordId = record.id;
      }

      // ── B. Customer Note ────────────────────────────────────────────────
      else if (target === 'Note') {
        const noteText = [
          `[${noteType.toUpperCase().replace(/_/g, ' ')}] ${title.trim()}`,
          content.trim() && content.trim() !== title.trim() ? content.trim() : null,
          notes.trim() ? `Notes: ${notes.trim()}` : null,
          entry.location_text ? `Location: ${entry.location_text}` : null,
        ].filter(Boolean).join('\n\n').slice(0, 1000);

        const record = await base44.entities.Note.create({
          text:           noteText,
          reference_type: customerId ? 'Customer' : 'None',
          reference_id:   customerId || null,
          completed:      false,
        });
        recordId = record.id;
      }

      // ── C. Lead ─────────────────────────────────────────────────────────
      else if (target === 'Lead') {
        const cName  = selectedCustomer ? displayName(selectedCustomer) : title.trim();
        const cPhone = selectedCustomer?.phone || selectedCustomer?.phone_secondary || '—';
        const boat   = boats.find(b => b.id === boatId);
        const record = await base44.entities.Lead.create({
          name:           cName,
          phone:          cPhone,
          email:          selectedCustomer?.email || null,
          customer_id:    customerId || null,
          boat_name:      boat?.vessel_name || entry.ai_extracted_boat_name || null,
          description:    content.trim() || null,
          notes:          [notes.trim(), entry.location_text ? `Location: ${entry.location_text}` : null].filter(Boolean).join('\n') || null,
          status:         'Pending',
          contact_method: 'Other',
          inquiry_type:   entry.suggested_type === 'project_intake' ? 'Maintenance' : 'Service Inquiry',
          priority:       entry.ai_urgency_hint === 'urgent' ? 'Urgent' :
                          entry.ai_urgency_hint === 'high'   ? 'High'   : 'Medium',
        });
        recordId = record.id;
      }

      // ── D. Offer Draft ───────────────────────────────────────────────────
      else if (target === 'Offer') {
        const record = await base44.entities.Offer.create({
          customer_id: customerId || null,
          boat_id:     boatId || null,
          title:       title.trim(),
          description: content.trim() || null,
          notes:       notes.trim() || null,
          status:      'Draft',
          language:    'German',
        });
        recordId = record.id;
      }

      // ── Update QuickCaptureEntry ─────────────────────────────────────────
      await base44.entities.QuickCaptureEntry.update(entry.id, {
        review_status:      'routed',
        routed_record_type: recordType,
        routed_record_id:   recordId,
        routed_at:          new Date().toISOString(),
        routed_by:          user?.email || null,
        reviewed_by:        user?.email || null,
        reviewed_at:        new Date().toISOString(),
      });

      toast.success(`Created ${targetLabel} successfully`);

      // Navigate to Offer immediately after creation
      if (target === 'Offer' && recordId) {
        onSuccess({ recordType, recordId });
        navigate(createPageUrl('OfferDetail') + `?id=${recordId}`);
        return;
      }

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
            Convert to {targetLabel}
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
            <Select value={customerId || '__none__'} onValueChange={v => { setCustomerId(v === '__none__' ? '' : v); setBoatId(''); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select customer (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Boat */}
          {target !== 'Note' && (
            <div>
              <Label>Boat</Label>
              <Select value={boatId || '__none__'} onValueChange={v => setBoatId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select boat (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {availableBoats.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.vessel_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Note type — only for Note target */}
          {target === 'Note' && (
            <div>
              <Label>Note Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="equipment_on_site">Equipment Left on Site</SelectItem>
                  <SelectItem value="service_history">Service History</SelectItem>
                  <SelectItem value="follow_up">Follow-up Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div>
            <Label>
              {target === 'CustomerMaterialEntry' ? 'Item Description *' :
               target === 'Note'  ? 'Summary *' :
               target === 'Offer' ? 'Offer Title *' :
               'Title *'}
            </Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" placeholder="Required" />
          </div>

          {/* Quantity + Price — material only */}
          {target === 'CustomerMaterialEntry' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>Quantity</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1" min="0.01" step="0.01" />
              </div>
              <div className="flex-1">
                <Label>Unit Price (€)</Label>
                <Input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="mt-1" min="0" step="0.01" placeholder="Optional" />
              </div>
            </div>
          )}

          {/* Content / Description */}
          <div>
            <Label>
              {target === 'Note' ? 'Note Content' :
               target === 'Offer' ? 'Scope / Description' :
               'Description / Details'}
            </Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} rows={3} className="mt-1" />
          </div>

          {/* Notes */}
          <div>
            <Label>Additional Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1" placeholder="Optional" />
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button
              onClick={handleConvert}
              disabled={saving || !title.trim()}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Creating...</>
                : <><ArrowRight className="h-4 w-4 mr-1" />Create {targetLabel}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}