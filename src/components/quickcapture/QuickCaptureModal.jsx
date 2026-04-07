import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Send, Camera, X, Loader2, Zap, CheckCircle2, Edit2, AlertCircle, User, Ship, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  material_entry:   { label: 'Material / Parts',   color: 'bg-amber-100 text-amber-800' },
  tool_tracking:    { label: 'Tool / Equipment',   color: 'bg-blue-100 text-blue-800' },
  task_candidate:   { label: 'Task Candidate',     color: 'bg-orange-100 text-orange-800' },
  customer_request: { label: 'Customer Request',   color: 'bg-purple-100 text-purple-800' },
  project_intake:   { label: 'Project Intake',     color: 'bg-green-100 text-green-800' },
  internal_note:    { label: 'Internal Note',      color: 'bg-slate-100 text-slate-700' },
};

const VOICE_STATES = {
  idle: null,
  listening: 'Listening... speak now',
  ended: 'Voice ended — continue typing or restart',
  error: 'Voice error — type or try again',
};

// ── Searchable Customer Picker ─────────────────────────────────────────────
function CustomerPicker({ customers, value, onChange, label = 'Customer', confidenceBadge }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = customers.find(c => c.id === value);
  const displayName = (c) =>
    c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.last_name || '').toLowerCase().includes(q) ||
      (c.first_name || '').toLowerCase().includes(q) ||
      displayName(c).toLowerCase().includes(q)
    );
  }).slice(0, 30);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (c) => {
    onChange(c ? c.id : '');
    setSearch('');
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {confidenceBadge}
      </div>

      <div ref={containerRef} className="relative">
        {/* Current selection / trigger */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-md bg-white hover:bg-slate-50 text-left"
        >
          <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
            {selected ? displayName(selected) : 'None — tap to search'}
          </span>
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b">
              <Input
                autoFocus
                placeholder="Search customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="w-full px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 text-left"
              >
                — Clear / None
              </button>
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-400">No results</p>
              )}
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={`w-full px-3 py-3 text-sm text-left hover:bg-amber-50 ${value === c.id ? 'bg-amber-50 font-medium' : ''}`}
                >
                  {displayName(c)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fuzzy matching helpers ─────────────────────────────────────────────────
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
      if (name === needle) return { customer: c, confidence: 'high' };
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

// ── STEP 1: Input ──────────────────────────────────────────────────────────
function InputStep({ onParsed, customers, boats }) {
  const [text, setText] = useState('');
  const [voiceState, setVoiceState] = useState('idle'); // idle | listening | ended | error
  const [interim, setInterim] = useState('');
  const [processing, setProcessing] = useState(false);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const committedTextRef = useRef('');

  const voiceSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startRecording = () => {
    if (!voiceSupported) { toast.error('Voice not supported in this browser'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'de-DE';
    r.continuous = true;          // keep open as long as possible
    r.interimResults = true;      // show partial results live

    r.onstart = () => { setVoiceState('listening'); setInterim(''); };

    r.onresult = (e) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalChunk += e.results[i][0].transcript;
        } else {
          interimChunk += e.results[i][0].transcript;
        }
      }
      if (finalChunk) {
        committedTextRef.current = committedTextRef.current
          ? committedTextRef.current + ' ' + finalChunk.trim()
          : finalChunk.trim();
        setText(committedTextRef.current);
        setInterim('');
      } else {
        setInterim(interimChunk);
      }
    };

    r.onerror = (e) => {
      // Preserve everything committed so far
      setInterim('');
      setVoiceState('error');
      recognitionRef.current = null;
      // no toast — state message is enough
    };

    r.onend = () => {
      // Flush any remaining interim into committed text
      setInterim(prev => {
        if (prev.trim()) {
          committedTextRef.current = committedTextRef.current
            ? committedTextRef.current + ' ' + prev.trim()
            : prev.trim();
          setText(committedTextRef.current);
        }
        return '';
      });
      if (voiceState === 'listening') setVoiceState('ended');
      recognitionRef.current = null;
    };

    committedTextRef.current = text; // start from existing text
    recognitionRef.current = r;
    r.start();
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setVoiceState('ended');
  };

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
    // Stop voice if still running
    recognitionRef.current?.stop();
    setProcessing(true);
    try {
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

Extract: customer_name (surname preferred), boat_name, location (marina/city), item_names (list), work_hints (list), urgency (low/normal/high/urgent), billable (true/false), short_summary (1 sentence), suggested_target (where should this end up operationally, in one short phrase).`,
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
      } catch { /* AI unavailable */ }

      const customerMatch = aiResult?.customer_name
        ? matchCustomer(customers, aiResult.customer_name)
        : null;
      const boatMatch = aiResult?.boat_name
        ? matchBoat(boats, aiResult.boat_name, customerMatch?.customer?.id)
        : null;

      onParsed({
        rawText: text,
        photoUrls,
        inputMethod: 'text',
        aiResult,
        customerMatch,
        boatMatch,
      });
    } finally {
      setProcessing(false);
    }
  };

  const voiceMsg = VOICE_STATES[voiceState];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Textarea
          placeholder='Was ist passiert? z.B. "Blümel, Hochdruckreiniger in Vrsar gelassen" oder "Kunde möchte nächste Woche Politur"...'
          value={text + (interim ? ' ' + interim : '')}
          onChange={(e) => {
            committedTextRef.current = e.target.value;
            setText(e.target.value);
            setInterim('');
          }}
          rows={5}
          className="resize-none text-base min-h-[120px]"
          autoFocus
        />
        {interim && (
          <div className="absolute bottom-2 right-2 text-xs text-slate-400 bg-white/80 px-1 rounded">
            …
          </div>
        )}
      </div>

      {/* Voice state hint */}
      {voiceMsg && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded border ${
          voiceState === 'listening' ? 'bg-red-50 border-red-200 text-red-700' :
          voiceState === 'error' ? 'bg-amber-50 border-amber-200 text-amber-700' :
          'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          {voiceState === 'listening' && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
          {voiceMsg}
        </div>
      )}

      <div className="flex items-center gap-3">
        {voiceSupported && (
          <button
            type="button"
            onClick={voiceState === 'listening' ? stopRecording : startRecording}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 text-sm font-medium transition-colors ${
              voiceState === 'listening'
                ? 'border-red-400 bg-red-50 text-red-600 animate-pulse'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {voiceState === 'listening'
              ? <><MicOff className="h-6 w-6" /><span>Stop</span></>
              : <><Mic className="h-6 w-6" /><span>{voiceState === 'ended' || voiceState === 'error' ? 'Nochmal' : 'Sprache'}</span></>
            }
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 text-sm font-medium"
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          <span>Foto{photoUrls.length > 0 ? ` (${photoUrls.length})` : ''}</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
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

      <Button onClick={handleProcess} disabled={processing || !text.trim()}
        className="bg-amber-500 hover:bg-amber-600 text-white w-full h-12 text-base">
        {processing
          ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Analysieren...</>
          : <><Zap className="h-5 w-5 mr-2" />Analysieren &amp; Prüfen</>}
      </Button>
    </div>
  );
}

// ── STEP 2: Result Card ────────────────────────────────────────────────────
function ResultStep({ parsed, customers, boats, onConfirm, onEdit }) {
  const { rawText, photoUrls, inputMethod, aiResult, customerMatch, boatMatch } = parsed;
  const [overrideCustomerId, setOverrideCustomerId] = useState(customerMatch?.customer?.id || '');
  const [overrideBoatId, setOverrideBoatId] = useState(boatMatch?.boat?.id || '');
  const [overrideType, setOverrideType] = useState(aiResult?.entry_type || '');
  const [saving, setSaving] = useState(false);

  const availableBoats = overrideCustomerId
    ? boats.filter(b => b.customer_id === overrideCustomerId)
    : boats;

  const handleConfirm = async () => {
    setSaving(true);
    try {
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

  const confidenceBadge = customerMatch ? (
    <Badge className={customerMatch.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
      {customerMatch.confidence} match
    </Badge>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-50 rounded-lg border text-sm text-slate-700 italic">
        "{rawText}"
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 divide-y divide-amber-100">
        {/* Header */}
        <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Parsed Result</span>
          <div className="flex items-center gap-2 flex-wrap">
            {overrideType && <Badge className={typeConf.color}>{typeConf.label}</Badge>}
            {aiResult?.urgency && aiResult.urgency !== 'normal' && (
              <Badge className="bg-red-100 text-red-700">{aiResult.urgency}</Badge>
            )}
          </div>
        </div>

        {aiResult?.short_summary && (
          <div className="p-3">
            <p className="text-sm text-slate-800">{aiResult.short_summary}</p>
          </div>
        )}

        {/* Customer — searchable */}
        <div className="p-3 bg-white">
          <CustomerPicker
            customers={customers}
            value={overrideCustomerId}
            onChange={(id) => { setOverrideCustomerId(id); setOverrideBoatId(''); }}
            label="Customer"
            confidenceBadge={confidenceBadge}
          />
          {customerMatch && (
            <p className="text-xs text-slate-400 mt-1 ml-6">
              Auto-detected: "{aiResult?.customer_name}" → {customerMatch.confidence} confidence
            </p>
          )}
        </div>

        {/* Boat */}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Ship className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Boat</span>
            {boatMatch && (
              <Badge className={boatMatch.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                {boatMatch.confidence} match
              </Badge>
            )}
          </div>
          <Select value={overrideBoatId} onValueChange={setOverrideBoatId}>
            <SelectTrigger className="h-8 text-sm bg-white">
              <SelectValue placeholder={boatMatch ? `Auto: ${boatMatch.boat.vessel_name}` : 'Select boat (optional)'} />
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

        {/* Classification */}
        <div className="p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Classification</p>
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

        {aiResult?.suggested_target && (
          <div className="p-3">
            <p className="text-xs text-amber-700">→ Suggested destination: {aiResult.suggested_target}</p>
          </div>
        )}
      </div>

      {!aiResult && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          AI unavailable — entry saved unclassified for manual review.
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
        <Button variant="outline" onClick={onEdit} className="flex-1 h-12">
          <Edit2 className="h-4 w-4 mr-1" /> Text bearbeiten
        </Button>
        <Button onClick={handleConfirm} disabled={saving} className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white text-base">
          {saving
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <CheckCircle2 className="h-4 w-4 mr-1" />}
          Speichern
        </Button>
      </div>
    </div>
  );
}

// ── MAIN MODAL ─────────────────────────────────────────────────────────────
export default function QuickCaptureModal({ open, onClose, onOpenChange, customers = [], boats = [] }) {
  const handleClose = onOpenChange || onClose;
  const [step, setStep] = useState('input');
  const [parsed, setParsed] = useState(null);

  useEffect(() => {
    if (open) { setStep('input'); setParsed(null); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        className="
          sm:max-w-lg sm:w-full sm:mx-4 sm:max-h-[90vh] sm:rounded-lg
          max-sm:!fixed max-sm:!left-0 max-sm:!right-0 max-sm:!bottom-0 max-sm:!top-auto
          max-sm:![transform:none] max-sm:!translate-x-0 max-sm:!translate-y-0
          max-sm:!w-full max-sm:!max-w-none
          max-sm:rounded-t-2xl max-sm:rounded-b-none
          max-sm:max-h-[92vh] overflow-y-auto
        ">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Quick Capture
            {step === 'result' && <span className="text-sm font-normal text-slate-500 ml-1">— Review Result</span>}
          </DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <InputStep customers={customers} boats={boats}
            onParsed={(p) => { setParsed(p); setStep('result'); }} />
        )}
        {step === 'result' && parsed && (
          <ResultStep parsed={parsed} customers={customers} boats={boats}
            onConfirm={() => handleClose(false)} onEdit={() => setStep('input')} />
        )}
      </DialogContent>
    </Dialog>
  );
}