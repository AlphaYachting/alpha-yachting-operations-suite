import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, MicOff, Send, Camera, X, Loader2, Zap, CheckCircle2, Edit2, AlertCircle, User, Ship, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  material_entry:   { label: 'Material / Parts',   color: 'bg-amber-100 text-amber-800' },
  tool_tracking:    { label: 'Tool / Equipment',   color: 'bg-blue-100 text-blue-800' },
  task_candidate:   { label: 'Task Candidate',     color: 'bg-orange-100 text-orange-800' },
  customer_request: { label: 'Customer Request',   color: 'bg-purple-100 text-purple-800' },
  project_intake:   { label: 'Project Intake',     color: 'bg-green-100 text-green-800' },
  internal_note:    { label: 'Internal Note',      color: 'bg-slate-100 text-slate-700' },
};

// Fuzzy name match: returns best customer match + confidence
function matchCustomer(customers, extractedName) {
  if (!extractedName) return null;
  const needle = extractedName.toLowerCase().trim();
  let best = null;
  let bestScore = 0;
  for (const c of customers) {
    const names = [
      c.company_name,
      c.last_name,
      c.first_name,
      `${c.first_name || ''} ${c.last_name || ''}`.trim(),
    ].filter(Boolean).map(n => n.toLowerCase());
    for (const name of names) {
      if (name === needle) { return { customer: c, confidence: 'high' }; }
      if (name.includes(needle) || needle.includes(name)) {
        const score = Math.min(name.length, needle.length) / Math.max(name.length, needle.length);
        if (score > bestScore) { bestScore = score; best = c; }
      }
    }
  }
  if (best && bestScore > 0.6) return { customer: best, confidence: bestScore > 0.85 ? 'high' : 'medium' };
  return null;
}

function matchBoat(boats, extractedName, customerId) {
  if (!extractedName) return null;
  const needle = extractedName.toLowerCase().trim();
  const pool = customerId ? boats.filter(b => b.customer_id === customerId) : boats;
  for (const b of pool) {
    const name = (b.vessel_name || '').toLowerCase();
    if (name === needle) return { boat: b, confidence: 'high' };
    if (name.includes(needle) || needle.includes(name)) return { boat: b, confidence: 'medium' };
  }
  return null;
}

// ── STEP 1: Input ─────────────────────────────────────────────────────────
function InputStep({ onParsed, customers, boats }) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  const voiceSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startRecording = () => {
    if (!voiceSupported) { toast.error('Voice not supported in this browser'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'de-DE';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => setText(prev => (prev ? prev + ' ' : '') + e.results[0][0].transcript);
    r.onerror = () => { setIsRecording(false); toast.error('Voice error — type the text instead'); };
    r.onend = () => setIsRecording(false);
    recognitionRef.current = r;
    r.start();
    setIsRecording(true);
  };

  const stopRecording = () => { recognitionRef.current?.stop(); setIsRecording(false); };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrls(prev => [...prev, file_url]);
    } catch { toast.error('Photo upload failed'); }
    finally { setUploading(false); }
  };

  const handleProcess = async () => {
    if (!text.trim()) { toast.error('Please enter some text first'); return; }
    setProcessing(true);
    try {
      // AI parse
      let aiResult = null;
      try {
        aiResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an operational classifier for a marine yacht service company (Alpha Yachting).

Parse this field note and extract ALL relevant information:
"${text}"

CLASSIFICATION TYPES:
- material_entry: consumables/parts/materials left at customer (filter, sandpaper, paint, primer, oil)
- tool_tracking: company equipment/machines/tools left on site (pressure washer, drill, polishing machine)
- task_candidate: work that needs to be done (cleaning, repair, inspection, checking)
- customer_request: customer asked for new service (wants polishing, wants storage, wants antifouling)
- project_intake: site visit/inspection with multiple work areas identified
- internal_note: informational only

Detect the PRIMARY type. If multiple signals exist, list them as secondary_signals.

Extract: customer_name (surname preferred), boat_name, location (marina/city), item_names (list), work_hints (list), urgency (low/normal/high/urgent), billable (true/false), short_summary (1 sentence).`,
          response_json_schema: {
            type: 'object',
            properties: {
              entry_type: { type: 'string' },
              short_summary: { type: 'string' },
              suggested_target: { type: 'string' },
              customer_name: { type: 'string' },
              boat_name: { type: 'string' },
              location: { type: 'string' },
              item_names: { type: 'array', items: { type: 'string' } },
              work_hints: { type: 'array', items: { type: 'string' } },
              urgency: { type: 'string' },
              billable: { type: 'boolean' },
              secondary_signals: { type: 'array', items: { type: 'string' } },
            }
          }
        });
      } catch { /* AI unavailable — proceed with manual */ }

      // Entity matching
      const customerMatch = aiResult?.customer_name
        ? matchCustomer(customers, aiResult.customer_name)
        : null;
      const boatMatch = aiResult?.boat_name
        ? matchBoat(boats, aiResult.boat_name, customerMatch?.customer?.id)
        : null;

      onParsed({
        rawText: text,
        photoUrls,
        inputMethod: isRecording ? 'voice' : 'text',
        aiResult,
        customerMatch,
        boatMatch,
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Textarea
        placeholder='What happened? e.g. "Blümel, pressure washer left in Vrsar" or "Customer wants polishing next week"...'
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="resize-none text-base"
        autoFocus
      />

      <div className="flex items-center gap-2 flex-wrap">
        {voiceSupported && (
          <Button variant="outline" size="sm" type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={isRecording ? 'border-red-400 text-red-600 animate-pulse' : ''}>
            {isRecording ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
            {isRecording ? 'Stop' : 'Voice'}
          </Button>
        )}
        <Button variant="outline" size="sm" type="button"
          onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
          Photo
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        {photoUrls.length > 0 && (
          <span className="text-xs text-slate-500">{photoUrls.length} photo(s) attached</span>
        )}
      </div>

      {photoUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photoUrls.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="h-14 w-14 object-cover rounded border" />
              <button onClick={() => setPhotoUrls(p => p.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 bg-white rounded-full border p-0.5">
                <X className="h-3 w-3 text-slate-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={handleProcess} disabled={processing || !text.trim()}
          className="bg-amber-500 hover:bg-amber-600 text-white w-full">
          {processing
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Parsing...</>
            : <><Zap className="h-4 w-4 mr-2" />Parse & Review</>}
        </Button>
      </div>
    </div>
  );
}

// ── STEP 2: Review Result Card ────────────────────────────────────────────
function ResultStep({ parsed, customers, boats, onConfirm, onEdit }) {
  const { rawText, photoUrls, inputMethod, aiResult, customerMatch, boatMatch } = parsed;
  const [overrideCustomerId, setOverrideCustomerId] = useState(customerMatch?.customer?.id || '');
  const [overrideBoatId, setOverrideBoatId] = useState(boatMatch?.boat?.id || '');
  const [overrideType, setOverrideType] = useState(aiResult?.entry_type || '');
  const [saving, setSaving] = useState(false);

  const selectedCustomer = customers.find(c => c.id === overrideCustomerId);
  const availableBoats = overrideCustomerId
    ? boats.filter(b => b.customer_id === overrideCustomerId)
    : boats;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const entry = {
        raw_input: rawText,
        input_method: inputMethod,
        customer_id: overrideCustomerId || null,
        boat_id: overrideBoatId || null,
        location_text: aiResult?.location || null,
        photo_urls: photoUrls?.length > 0 ? photoUrls : null,
        suggested_type: overrideType || aiResult?.entry_type || null,
        suggested_summary: aiResult?.short_summary || null,
        suggested_target: aiResult?.suggested_target || null,
        ai_extracted_customer_name: aiResult?.customer_name || null,
        ai_extracted_boat_name: aiResult?.boat_name || null,
        ai_urgency_hint: aiResult?.urgency || null,
        ai_billable_hint: aiResult?.billable ?? null,
        review_status: 'new',
        review_notes: aiResult?.secondary_signals?.length > 0
          ? `Secondary signals: ${aiResult.secondary_signals.join(', ')}`
          : null,
      };
      await base44.entities.QuickCaptureEntry.create(entry);
      onConfirm();
      toast.success('Captured and added to Review Queue');
    } catch {
      toast.error('Failed to save capture');
    } finally {
      setSaving(false);
    }
  };

  const typeConf = TYPE_CONFIG[overrideType] || TYPE_CONFIG.internal_note;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-50 rounded-lg border text-sm text-slate-700 italic">
        "{rawText}"
      </div>

      {/* Parsed result card */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 divide-y divide-amber-100">
        <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Parsed Result</span>
          <div className="flex items-center gap-2 flex-wrap">
            {overrideType && <Badge className={typeConf.color}>{typeConf.label}</Badge>}
            {aiResult?.urgency && aiResult.urgency !== 'normal' && (
              <Badge className="bg-red-100 text-red-700">{aiResult.urgency}</Badge>
            )}
            {aiResult?.billable && <Badge className="bg-green-100 text-green-700">billable hint</Badge>}
          </div>
        </div>

        {aiResult?.short_summary && (
          <div className="p-3">
            <p className="text-sm text-slate-800">{aiResult.short_summary}</p>
          </div>
        )}

        {/* Matched customer */}
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Customer</span>
              {customerMatch && (
                <Badge className={customerMatch.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                  {customerMatch.confidence} match
                </Badge>
              )}
            </div>
          </div>
          {customerMatch && !overrideCustomerId ? (
            <div className="text-sm text-slate-800 font-medium">
              {customerMatch.customer.company_name || `${customerMatch.customer.first_name || ''} ${customerMatch.customer.last_name || ''}`.trim()}
              <span className="text-xs text-slate-400 ml-2">(from text: "{aiResult?.customer_name}")</span>
            </div>
          ) : null}
          <Select value={overrideCustomerId} onValueChange={(v) => { setOverrideCustomerId(v); setOverrideBoatId(''); }}>
            <SelectTrigger className="h-8 text-sm bg-white">
              <SelectValue placeholder={customerMatch ? 'Override match...' : 'Select customer (optional)'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None / Not matched</SelectItem>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Matched boat */}
        <div className="p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Boat</span>
            {boatMatch && (
              <Badge className={boatMatch.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                {boatMatch.confidence} match
              </Badge>
            )}
          </div>
          {boatMatch && !overrideBoatId ? (
            <p className="text-sm text-slate-800 font-medium">
              {boatMatch.boat.vessel_name}
              <span className="text-xs text-slate-400 ml-2">(from text: "{aiResult?.boat_name}")</span>
            </p>
          ) : null}
          <Select value={overrideBoatId} onValueChange={setOverrideBoatId}>
            <SelectTrigger className="h-8 text-sm bg-white">
              <SelectValue placeholder={boatMatch ? 'Override match...' : 'Select boat (optional)'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None / Not matched</SelectItem>
              {availableBoats.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.vessel_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        {aiResult?.location && (
          <div className="p-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-700">{aiResult.location}</span>
          </div>
        )}

        {/* Secondary signals */}
        {aiResult?.secondary_signals?.length > 0 && (
          <div className="p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚡ Multiple signals detected:</p>
            <div className="flex flex-wrap gap-1">
              {aiResult.secondary_signals.map((s, i) => (
                <Badge key={i} className="bg-slate-100 text-slate-600 text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Classification override */}
        <div className="p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-700">Classification</p>
          <Select value={overrideType} onValueChange={setOverrideType}>
            <SelectTrigger className="h-8 text-sm bg-white">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_CONFIG).map(([key, conf]) => (
                <SelectItem key={key} value={key}>{conf.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Suggested routing */}
        {aiResult?.suggested_target && (
          <div className="p-3">
            <p className="text-xs text-amber-700">→ Suggested: {aiResult.suggested_target}</p>
          </div>
        )}
      </div>

      {/* No AI warning */}
      {!aiResult && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          AI classification unavailable — entry will be saved unclassified for manual review.
        </div>
      )}

      {photoUrls?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photoUrls.map((url, i) => (
            <img key={i} src={url} alt="" className="h-14 w-14 object-cover rounded border" />
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onEdit} className="flex-1">
          <Edit2 className="h-4 w-4 mr-1" /> Edit Text
        </Button>
        <Button onClick={handleConfirm} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
          {saving
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <CheckCircle2 className="h-4 w-4 mr-1" />}
          Confirm & Queue
        </Button>
      </div>
    </div>
  );
}

// ── MAIN MODAL ─────────────────────────────────────────────────────────────
export default function QuickCaptureModal({ open, onClose, customers = [], boats = [] }) {
  const [step, setStep] = useState('input'); // 'input' | 'result'
  const [parsed, setParsed] = useState(null);

  useEffect(() => {
    if (open) { setStep('input'); setParsed(null); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Quick Capture
            {step === 'result' && <span className="text-sm font-normal text-slate-500 ml-1">— Review Result</span>}
          </DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <InputStep
            customers={customers}
            boats={boats}
            onParsed={(p) => { setParsed(p); setStep('result'); }}
          />
        )}

        {step === 'result' && parsed && (
          <ResultStep
            parsed={parsed}
            customers={customers}
            boats={boats}
            onConfirm={onClose}
            onEdit={() => setStep('input')}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}