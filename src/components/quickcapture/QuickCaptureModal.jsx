import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Camera, X, Loader2, Zap, CheckCircle2, Edit2, AlertCircle, User, Ship, MapPin, Search, Receipt, UserPlus, Clock } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  material_entry: { label: 'Material / Parts', color: 'bg-amber-100 text-amber-800' },
  tool_tracking: { label: 'Tool / Equipment', color: 'bg-blue-100 text-blue-800' },
  task_candidate: { label: 'Task Candidate', color: 'bg-orange-100 text-orange-800' },
  customer_request: { label: 'Customer Request', color: 'bg-purple-100 text-purple-800' },
  project_intake: { label: 'Project Intake', color: 'bg-green-100 text-green-800' },
  internal_note: { label: 'Internal Note', color: 'bg-slate-100 text-slate-700' }
};

const VOICE_STATES = {
  idle: null,
  listening: 'Listening... speak now',
  ended: 'Voice ended — continue typing or restart',
  error: 'Voice error — type or try again'
};

// ── Searchable Customer Picker ─────────────────────────────────────────────
function CustomerPicker({ customers, value, onChange, label = 'Customer', confidenceBadge }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = customers.find((c) => c.id === value);
  const displayName = (c) =>
  c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.last_name || '').toLowerCase().includes(q) ||
      (c.first_name || '').toLowerCase().includes(q) ||
      displayName(c).toLowerCase().includes(q));

  });

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
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-md bg-white hover:bg-slate-50 text-left">
          
          <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
            {selected ? displayName(selected) : 'None — tap to search'}
          </span>
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
        </button>

        {open &&
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b">
              <Input
              autoFocus
              placeholder="Search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm" />
            
            </div>
            <div className="max-h-56 overflow-y-auto">
              <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 text-left">
              
                — Clear / None
              </button>
              {filtered.length === 0 &&
            <p className="px-3 py-2 text-sm text-slate-400">No results</p>
            }
              {filtered.map((c) =>
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className={`w-full px-3 py-3 text-sm text-left hover:bg-amber-50 ${value === c.id ? 'bg-amber-50 font-medium' : ''}`}>
              
                  {displayName(c)}
                </button>
            )}
            </div>
          </div>
        }
      </div>
    </div>);

}

// ── Searchable Boat Picker ─────────────────────────────────────────────
function BoatPicker({ boats, value, onChange, customerId, label = 'Boat' }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = boats.find((b) => b.id === value);
  const pool = customerId ? boats.filter((b) => b.customer_id === customerId) : boats;

  const filtered = pool.filter((b) => {
    const q = search.toLowerCase();
    return (b.vessel_name || '').toLowerCase().includes(q) ||
           (b.manufacturer || '').toLowerCase().includes(q) ||
           (b.model || '').toLowerCase().includes(q);
  });

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (b) => {
    onChange(b ? b.id : '');
    setSearch('');
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Ship className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>

      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-md bg-white hover:bg-slate-50 text-left">
          <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
            {selected ? selected.vessel_name : 'None — tap to search'}
          </span>
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
        </button>

        {open &&
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b">
              <Input
              autoFocus
              placeholder="Search boat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm" />
            </div>
            <div className="max-h-56 overflow-y-auto">
              <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 text-left">
                — Clear / None
              </button>
              {filtered.length === 0 &&
            <p className="px-3 py-2 text-sm text-slate-400">No results</p>
            }
              {filtered.map((b) =>
            <button
              key={b.id}
              type="button"
              onClick={() => handleSelect(b)}
              className={`w-full px-3 py-3 text-sm text-left hover:bg-amber-50 ${value === b.id ? 'bg-amber-50 font-medium' : ''}`}>
                  {b.vessel_name}
                </button>
            )}
            </div>
          </div>
        }
      </div>
    </div>);
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
    `${c.first_name || ''} ${c.last_name || ''}`.trim()].
    filter(Boolean).map((n) => n.toLowerCase());
    for (const name of names) {
      if (name === needle) return { customer: c, confidence: 'high' };
      if (name.includes(needle) || needle.includes(name)) {
        const score = Math.min(name.length, needle.length) / Math.max(name.length, needle.length);
        if (score > bestScore) {bestScore = score;best = c;}
      }
    }
  }
  if (best && bestScore > 0.6) return { customer: best, confidence: bestScore > 0.85 ? 'high' : 'medium' };
  return null;
}

function matchBoat(boats, extractedName, customerId) {
  if (!extractedName) return null;
  const needle = extractedName.toLowerCase().trim();
  const pool = customerId ? boats.filter((b) => b.customer_id === customerId) : boats;
  for (const b of pool) {
    const name = (b.vessel_name || '').toLowerCase();
    if (name === needle) return { boat: b, confidence: 'high' };
    if (name.includes(needle) || needle.includes(name)) return { boat: b, confidence: 'medium' };
  }
  return null;
}

// ── STEP 1: Input ──────────────────────────────────────────────────────────
function InputStep({ onParsed, customers, boats, invoiceMode = false }) {
  const [text, setText] = useState('');
  const [voiceState, setVoiceState] = useState('idle'); // idle | listening | ended | error
  const [interim, setInterim] = useState('');
  const [processing, setProcessing] = useState(false);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [invoiceUrls, setInvoiceUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [mode, setMode] = useState(invoiceMode ? 'invoice' : 'text'); // 'text' | 'invoice'
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const invoiceInputRef = useRef(null);
  const committedTextRef = useRef('');
  const voiceUsedRef = useRef(false);
  const recordingActiveRef = useRef(false); // true = user wants to keep recording

  const voiceSupported = typeof window !== 'undefined' && (
  'SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const createRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'de-DE';
    r.continuous = true;
    r.interimResults = true;

    r.onstart = () => {setVoiceState('listening');setInterim('');voiceUsedRef.current = true;};

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
        committedTextRef.current = committedTextRef.current ?
        committedTextRef.current + ' ' + finalChunk.trim() :
        finalChunk.trim();
        setText(committedTextRef.current);
        setInterim('');
      } else {
        setInterim(interimChunk);
      }
    };

    r.onerror = (e) => {
      // 'no-speech' and 'aborted' are harmless — auto-restart on Android
      if (e.error === 'no-speech' || e.error === 'aborted') {
        // Don't show error, just wait for onend to auto-restart
        return;
      }
      if (e.error === 'not-allowed') {
        setVoiceState('error');
        recordingActiveRef.current = false;
        toast.error('Mikrofon-Zugriff verweigert');
        return;
      }
      if (e.error === 'network') {
        setVoiceState('error');
        recordingActiveRef.current = false;
        toast.error('Netzwerkfehler – bitte später versuchen');
        return;
      }
      // Fallback for other errors
      setInterim('');
      setVoiceState('error');
      recordingActiveRef.current = false;
    };

    r.onend = () => {
      // Flush any remaining interim into committed text
      setInterim((prev) => {
        if (prev.trim()) {
          committedTextRef.current = committedTextRef.current ?
          committedTextRef.current + ' ' + prev.trim() :
          prev.trim();
          setText(committedTextRef.current);
        }
        return '';
      });

      // Auto-restart on Android: if user didn't manually stop, create a new recognition
      if (recordingActiveRef.current) {
        // Small delay to avoid rapid restart loops on some Android versions
        setTimeout(() => {
          if (recordingActiveRef.current) {
            try {
              const newR = createRecognition();
              recognitionRef.current = newR;
              newR.start();
            } catch {
              // Silent fail — Android sometimes blocks rapid restarts
              setVoiceState('ended');
              recordingActiveRef.current = false;
            }
          }
        }, 300);
      } else {
        setVoiceState('ended');
      }
      recognitionRef.current = null;
    };

    return r;
  };

  const startRecording = () => {
    if (!voiceSupported) {toast.error('Spracheingabe nicht unterstützt');return;}
    recordingActiveRef.current = true;
    committedTextRef.current = text;
    const r = createRecognition();
    recognitionRef.current = r;
    r.start();
  };

  const stopRecording = () => {
    recordingActiveRef.current = false;
    recognitionRef.current?.stop();
    setVoiceState('ended');
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrls((prev) => [...prev, file_url]);
    } catch {toast.error('Photo upload failed');} finally
    {setUploading(false);}
  };

  const handleInvoiceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInvoice(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setInvoiceUrls((prev) => [...prev, file_url]);
    } catch {toast.error('Rechnung-Upload fehlgeschlagen');} finally
    {setUploadingInvoice(false);}
  };

  const handleProcess = async () => {
    if (!text.trim() && mode !== 'invoice') {toast.error('Bitte zuerst Text eingeben');return;}
    if (mode === 'invoice' && invoiceUrls.length === 0) {toast.error('Bitte zuerst eine Rechnung hochladen');return;}
    // Stop voice if still running
    recognitionRef.current?.stop();
    setProcessing(true);

    // Invoice mode: save directly as material_entry without AI analysis
    if (mode === 'invoice') {
      const allPhotos = [...invoiceUrls, ...photoUrls];
      onParsed({
        rawText: text.trim() || 'Rechnung / Lieferschein (Foto)',
        photoUrls: allPhotos,
        inputMethod: 'text',
        aiResult: {
          entry_type: 'material_entry',
          short_summary: text.trim() || 'Rechnung eingescannen — bitte in Materialimport übertragen',
          suggested_target: 'Material Import Review',
          urgency: 'normal',
          billable: true,
        },
        customerMatch: null,
        boatMatch: null,
        isInvoice: true,
      });
      setProcessing(false);
      return;
    }

    try {
      let aiResult = null;
      try {
        aiResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an operational classifier for a marine yacht service company (Alpha Yachting).

          Parse this field note and extract ALL relevant information:
          "${text}"

          CLASSIFICATION TYPES:
          - material_entry: consumables/parts/materials left at customer
          - tool_tracking: company equipment/machines/tools left on site
          - task_candidate: work that needs to be done (cleaning, repair, inspection)
          - customer_request: customer asked for new service
          - project_intake: site visit/inspection with multiple work areas
          - internal_note: informational only
          - new_customer: user wants to create a new customer record
          - daily_report: mechanic describes their work day across multiple boats/customers with hours worked ("war heute bei...", "5 Stunden...", "dann bei...")

          IMPORTANT daily_report detection: If the text describes multiple visits to different customers/boats with hours worked for each, set entry_type to "daily_report". Extract each visit into the visits array.

          Extract: customer_name, boat_name, location, item_names, work_hints, urgency (low/normal/high/urgent), billable, short_summary (1 sentence), suggested_target.
          For new_customer: intent_new_customer, new_customer_phone, new_customer_email, new_customer_boat.

          For daily_report, fill the visits array. Each visit object has:
          - customer_name: "Müller" or similar
          - boat_name: "Bavaria 38" or similar
          - work_description: "Motor repariert" or similar (short, in the language of the input)
          - hours: number of hours worked (e.g. 5, 2.5). If "Viertelstunde" ≈ 0.25, "halbe Stunde" ≈ 0.5, "dreiviertel Stunde" ≈ 0.75.
          - location: marina or city if mentioned`,
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
              intent_new_customer: { type: 'boolean' },
              new_customer_phone: { type: 'string' },
              new_customer_email: { type: 'string' },
              new_customer_boat: { type: 'string' },
              visits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    customer_name: { type: 'string' },
                    boat_name: { type: 'string' },
                    work_description: { type: 'string' },
                    hours: { type: 'number' },
                    location: { type: 'string' }
                  }
                }
              }
            }
          }
        });
      } catch {/* AI unavailable */}

      const customerMatch = aiResult?.customer_name ?
      matchCustomer(customers, aiResult.customer_name) :
      null;
      const boatMatch = aiResult?.boat_name ?
      matchBoat(boats, aiResult.boat_name, customerMatch?.customer?.id) :
      null;

      onParsed({
        rawText: text,
        photoUrls,
        inputMethod: voiceUsedRef.current ? 'voice' : 'text',
        aiResult,
        customerMatch,
        boatMatch
      });
    } finally {
      setProcessing(false);
    }
  };

  const voiceMsg = VOICE_STATES[voiceState];
  const canSubmit = mode === 'invoice' ? invoiceUrls.length > 0 : text.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        {voiceSupported && (
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
              mode !== 'invoice'
                ? 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Mic className="h-5 w-5" />
            <span>Text / Sprache</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => { setMode('text'); fileInputRef.current?.click(); }}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
            mode !== 'invoice'
              ? 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          <span>Foto{photoUrls.length > 0 ? ` (${photoUrls.length})` : ''}</span>
        </button>
        <button
          type="button"
          onClick={() => { setMode('invoice'); invoiceInputRef.current?.click(); }}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
            mode === 'invoice'
              ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          {uploadingInvoice ? <Loader2 className="h-5 w-5 animate-spin" /> : <Receipt className="h-5 w-5" />}
          <span>Rechnung{invoiceUrls.length > 0 ? ` (${invoiceUrls.length})` : ''}</span>
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
      <input ref={invoiceInputRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleInvoiceUpload} />

      {/* Invoice preview */}
      {mode === 'invoice' && invoiceUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {invoiceUrls.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg border-2 border-emerald-300" />
              <button onClick={() => setInvoiceUrls(p => p.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 bg-white rounded-full border p-0.5 shadow">
                <X className="h-3 w-3 text-slate-500" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => invoiceInputRef.current?.click()}
            className="h-20 w-20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 text-xs gap-1"
          >
            <Receipt className="h-5 w-5" />
            <span>+</span>
          </button>
        </div>
      )}

      {/* Invoice upload CTA when none uploaded yet */}
      {mode === 'invoice' && invoiceUrls.length === 0 && (
        <button
          type="button"
          onClick={() => invoiceInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-emerald-300 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-colors"
        >
          {uploadingInvoice ? <Loader2 className="h-8 w-8 animate-spin" /> : <Receipt className="h-8 w-8" />}
          <span className="text-sm font-medium">{uploadingInvoice ? 'Wird hochgeladen…' : 'Rechnung / Lieferschein fotografieren'}</span>
        </button>
      )}

      {/* Text area — always visible */}
      <div className="relative">
        <Textarea
          placeholder={mode === 'invoice'
            ? 'Optionale Notiz zur Rechnung, z.B. "Victron-Rechnung für Blümel, Marina Vrsar"…'
            : 'Was ist passiert? z.B. "Blümel, Hochdruckreiniger in Vrsar gelassen"…'
          }
          value={text + (interim ? ' ' + interim : '')}
          onChange={(e) => {
            committedTextRef.current = e.target.value;
            setText(e.target.value);
            setInterim('');
          }}
          rows={mode === 'invoice' ? 2 : 5}
          className="resize-none text-base"
        />
        {interim && (
          <div className="absolute bottom-2 right-2 text-xs text-slate-400 bg-white/80 px-1 rounded">…</div>
        )}
      </div>

      {/* Voice controls — only in text mode */}
      {mode !== 'invoice' && voiceSupported && (
        <>
          {voiceMsg && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded border ${
              voiceState === 'listening' ? 'bg-red-50 border-red-200 text-red-700' :
              voiceState === 'error' ? 'bg-amber-50 border-amber-200 text-amber-700' :
              'bg-slate-50 border-slate-200 text-slate-600'}`}>
              {voiceState === 'listening' && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              {voiceMsg}
            </div>
          )}
          <button
            type="button"
            onClick={voiceState === 'listening' ? stopRecording : startRecording}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
              voiceState === 'listening'
                ? 'border-red-400 bg-red-50 text-red-600 animate-pulse'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {voiceState === 'listening'
              ? <><MicOff className="h-5 w-5" /><span>Aufnahme stoppen</span></>
              : <><Mic className="h-5 w-5" /><span>{voiceState === 'ended' || voiceState === 'error' ? 'Erneut aufnehmen' : 'Spracheingabe starten'}</span></>
            }
          </button>
        </>
      )}

      {/* Attached photos preview (non-invoice mode) */}
      {mode !== 'invoice' && photoUrls.length > 0 && (
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

      <Button
        onClick={handleProcess}
        disabled={processing || !canSubmit}
        className={`w-full h-12 text-base ${mode === 'invoice' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'} text-white`}
      >
        {processing
          ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Verarbeite…</>
          : mode === 'invoice'
            ? <><Receipt className="h-5 w-5 mr-2" />In Review ablegen</>
            : <><Zap className="h-5 w-5 mr-2" />Analysieren &amp; Prüfen</>
        }
      </Button>
    </div>);

}

// ── STEP 2: Result Card ────────────────────────────────────────────────────
function ResultStep({ parsed, customers, boats, onConfirm, onEdit, workOrderContext = null }) {
  const { rawText, photoUrls, inputMethod, aiResult, customerMatch, boatMatch } = parsed;
  const [overrideCustomerId, setOverrideCustomerId] = useState(customerMatch?.customer?.id || '');
  const [overrideBoatId, setOverrideBoatId] = useState(boatMatch?.boat?.id || '');
  const [overrideType, setOverrideType] = useState(aiResult?.entry_type || '');
  const [saving, setSaving] = useState(false);

  // New customer fields
  const isNewCustomer = aiResult?.intent_new_customer && !customerMatch;
  const [newCustName, setNewCustName] = useState(aiResult?.customer_name || '');
  const [newCustPhone, setNewCustPhone] = useState(aiResult?.new_customer_phone || '');
  const [newCustEmail, setNewCustEmail] = useState(aiResult?.new_customer_email || '');
  const [newCustBoat, setNewCustBoat] = useState(aiResult?.new_customer_boat || aiResult?.boat_name || '');
  const [newCustCreated, setNewCustCreated] = useState(false);
  const [creatingCust, setCreatingCust] = useState(false);

  // Daily report — multiple visits
  const isDailyReport = aiResult?.entry_type === 'daily_report' && aiResult?.visits?.length > 0;
  const [visitOverrides, setVisitOverrides] = useState(() => {
    if (!aiResult?.visits) return [];
    return aiResult.visits.map(v => {
      const cm = matchCustomer(customers, v.customer_name);
      const bm = matchBoat(boats, v.boat_name, cm?.customer?.id);
      return {
        customerId: cm?.customer?.id || '',
        boatId: bm?.boat?.id || '',
        customer_name: v.customer_name || '',
        boat_name: v.boat_name || '',
        workDescription: v.work_description || '',
        hours: v.hours || 0,
        location: v.location || '',
      };
    });
  });

  const availableBoats = overrideCustomerId ?
  boats.filter((b) => b.customer_id === overrideCustomerId) :
  boats;

  const handleCreateNewCustomer = async () => {
    if (!newCustName.trim()) { toast.error('Name ist erforderlich'); return; }
    setCreatingCust(true);
    try {
      const nameParts = newCustName.trim().split(' ');
      const lastName = nameParts.pop();
      const firstName = nameParts.join(' ');
      const customer = await base44.entities.Customer.create({
        first_name: firstName || undefined,
        last_name: lastName,
        phone: newCustPhone.trim() || undefined,
        email: newCustEmail.trim() || undefined,
        status: 'Active',
      });
      // Optionally create a boat
      if (newCustBoat.trim()) {
        await base44.entities.Boat.create({
          customer_id: customer.id,
          vessel_name: newCustBoat.trim(),
        });
      }
      setOverrideCustomerId(customer.id);
      setNewCustCreated(true);
      toast.success(`Kunde "${newCustName.trim()}" angelegt!`);
    } catch (err) {
      toast.error('Fehler beim Anlegen: ' + err.message);
    } finally {
      setCreatingCust(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // ── Daily report: create one entry per visit ──
      if (isDailyReport && visitOverrides.length > 0) {
        const entries = visitOverrides.map((vo) => {
          const custName = vo.customerId ? customers.find(c => c.id === vo.customerId) : null;
          const boatName = vo.boatId ? boats.find(b => b.id === vo.boatId) : null;
          return {
            raw_input: rawText,
            input_method: inputMethod,
            customer_id: vo.customerId || null,
            boat_id: vo.boatId || null,
            location_text: vo.location || aiResult?.location || null,
            photo_urls: photoUrls?.length > 0 ? photoUrls : null,
            suggested_type: 'task_candidate',
            suggested_summary: `${vo.workDescription} (${vo.hours}h) — ${custName ? (custName.company_name || `${custName.first_name||''} ${custName.last_name||''}`.trim()) : ''} / ${boatName?.vessel_name || ''}`.trim(),
            suggested_target: 'Time Entry',
            ai_extracted_customer_name: vo.customerId ? null : (vo.customer_name || null),
            ai_extracted_boat_name: vo.boatId ? null : (vo.boat_name || null),
            ai_urgency_hint: aiResult?.urgency || null,
            ai_billable_hint: aiResult?.billable ?? true,
            review_status: 'new',
            review_notes: `DAILY REPORT VISIT | ${vo.workDescription} | ${vo.hours} Stunden | Ort: ${vo.location || aiResult?.location || '—'}`,
          };
        });
        await Promise.all(entries.map(e => base44.entities.QuickCaptureEntry.create(e)));
        onConfirm();
        toast.success(`${entries.length} Einträge gespeichert`);
        setSaving(false);
        return;
      }

      // ── Single entry (existing logic) ──
      const entry = {
        raw_input: rawText,
        input_method: inputMethod,
        customer_id: overrideCustomerId || null,
        boat_id: overrideBoatId || null,
        work_order_id: workOrderContext?.work_order_id || null,
        job_id: workOrderContext?.job_id || null,
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
        review_notes: aiResult?.secondary_signals?.length > 0 ?
        `Secondary signals: ${aiResult.secondary_signals.join(', ')}` :
        null
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

  const confidenceBadge = customerMatch ?
  <Badge className={customerMatch.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
      {customerMatch.confidence} match
    </Badge> :
  null;

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
            {aiResult?.urgency && aiResult.urgency !== 'normal' &&
            <Badge className="bg-red-100 text-red-700">{aiResult.urgency}</Badge>
            }
          </div>
        </div>

        {aiResult?.short_summary &&
        <div className="p-3">
            <p className="text-sm text-slate-800">{aiResult.short_summary}</p>
          </div>
        }

        {/* ── Daily Report: Multi-Visit Cards ── */}
        {isDailyReport && (
          <div className="p-3 border-t bg-blue-50/50">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Tagesbericht · {visitOverrides.length} {visitOverrides.length === 1 ? 'Besuch' : 'Besuche'}
              </span>
            </div>
            <div className="space-y-3">
              {visitOverrides.map((vo, idx) => {
                return (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-blue-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center">{idx + 1}</span>
                      <span className="text-xs text-blue-700 font-medium">Besuch {idx + 1}</span>
                    </div>

                    {/* Hours + Work */}
                    <div className="flex gap-2">
                      <div className="w-20 flex-shrink-0">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Stunden</label>
                        <Input
                          type="number"
                          step="0.25"
                          min="0"
                          value={vo.hours || ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            setVisitOverrides(prev => prev.map((p, i) => i === idx ? { ...p, hours: v } : p));
                          }}
                          className="h-7 text-sm text-center"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Arbeit</label>
                        <Input
                          value={vo.workDescription}
                          onChange={e => setVisitOverrides(prev => prev.map((p, i) => i === idx ? { ...p, workDescription: e.target.value } : p))}
                          className="h-7 text-sm"
                          placeholder="Was wurde gemacht?"
                        />
                      </div>
                    </div>

                    {/* Customer — eigene Zeile */}
                    <CustomerPicker
                      customers={customers}
                      value={vo.customerId}
                      onChange={id => setVisitOverrides(prev => prev.map((p, i) => i === idx ? { ...p, customerId: id, boatId: '' } : p))}
                      label="Kunde"
                    />

                    {/* Boat — eigene Zeile mit Suchfeld */}
                    <BoatPicker
                      boats={boats}
                      value={vo.boatId}
                      onChange={id => setVisitOverrides(prev => prev.map((p, i) => i === idx ? { ...p, boatId: id } : p))}
                      customerId={vo.customerId}
                      label="Boot"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Standard single-visit fields (hidden for daily_report) ── */}
        {!isDailyReport && (<>

        {/* ── New Customer Banner ── */}
        {isNewCustomer && (
          <div className={`p-3 border-t ${newCustCreated ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className={`h-4 w-4 ${newCustCreated ? 'text-green-600' : 'text-blue-600'}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${newCustCreated ? 'text-green-700' : 'text-blue-700'}`}>
                {newCustCreated ? '✓ Kunde angelegt' : 'Neuen Kunden anlegen'}
              </span>
            </div>
            {!newCustCreated ? (
              <div className="space-y-2">
                <Input
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="Name *"
                  className="h-8 text-sm bg-white"
                />
                <Input
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="Telefon"
                  className="h-8 text-sm bg-white"
                />
                <Input
                  value={newCustEmail}
                  onChange={e => setNewCustEmail(e.target.value)}
                  placeholder="E-Mail"
                  className="h-8 text-sm bg-white"
                />
                <Input
                  value={newCustBoat}
                  onChange={e => setNewCustBoat(e.target.value)}
                  placeholder="Boot (optional)"
                  className="h-8 text-sm bg-white"
                />
                <Button
                  onClick={handleCreateNewCustomer}
                  disabled={creatingCust || !newCustName.trim()}
                  className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {creatingCust ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
                  {creatingCust ? 'Wird angelegt…' : 'Kunden jetzt anlegen'}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-green-700">Kunde wurde angelegt und verknüpft.</p>
            )}
          </div>
        )}

        {/* Customer — searchable */}
        <div className="p-3 bg-white">
          <CustomerPicker
            customers={customers}
            value={overrideCustomerId}
            onChange={(id) => {setOverrideCustomerId(id);setOverrideBoatId('');}}
            label="Customer"
            confidenceBadge={confidenceBadge} />
          
          {customerMatch &&
          <p className="text-xs text-slate-400 mt-1 ml-6">
              Auto-detected: "{aiResult?.customer_name}" → {customerMatch.confidence} confidence
            </p>
          }
        </div>

        {/* Boat */}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Ship className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Boat</span>
            {boatMatch &&
            <Badge className={boatMatch.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                {boatMatch.confidence} match
              </Badge>
            }
          </div>
          <Select value={overrideBoatId} onValueChange={setOverrideBoatId}>
            <SelectTrigger className="h-8 text-sm bg-white">
              <SelectValue placeholder={boatMatch ? `Auto: ${boatMatch.boat.vessel_name}` : 'Select boat (optional)'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None / Not matched</SelectItem>
              {availableBoats.map((b) =>
              <SelectItem key={b.id} value={b.id}>{b.vessel_name}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        {aiResult?.location &&
        <div className="p-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-700">{aiResult.location}</span>
          </div>
        }

        {/* Secondary signals */}
        {aiResult?.secondary_signals?.length > 0 &&
        <div className="p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚡ Multiple signals detected:</p>
            <div className="flex flex-wrap gap-1">
              {aiResult.secondary_signals.map((s, i) =>
            <Badge key={i} className="bg-slate-100 text-slate-600 text-xs">{s}</Badge>
            )}
            </div>
          </div>
        }

        {/* Classification */}
        <div className="p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Classification</p>
          <Select value={overrideType} onValueChange={setOverrideType}>
            <SelectTrigger className="h-8 text-sm bg-white">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_CONFIG).map(([key, conf]) =>
              <SelectItem key={key} value={key}>{conf.label}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {aiResult?.suggested_target &&
        <div className="p-3">
            <p className="text-xs text-amber-700">→ Suggested destination: {aiResult.suggested_target}</p>
          </div>
        }

        </> )}
      </div>

      {!aiResult &&
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          AI unavailable — entry saved unclassified for manual review.
        </div>
      }

      {photoUrls?.length > 0 &&
      <div className="flex flex-wrap gap-2">
          {photoUrls.map((url, i) =>
        <img key={i} src={url} alt="" className="h-14 w-14 object-cover rounded border" />
        )}
        </div>
      }

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onEdit} className="flex-1 h-12">
          <Edit2 className="h-4 w-4 mr-1" /> Text bearbeiten
        </Button>
        <Button onClick={handleConfirm} disabled={saving} className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white text-base">
          {saving ?
          <Loader2 className="h-4 w-4 mr-1 animate-spin" /> :
          <CheckCircle2 className="h-4 w-4 mr-1" />}
          Speichern
        </Button>
      </div>
    </div>);

}

// ── MAIN MODAL ─────────────────────────────────────────────────────────────
// workOrderContext: optional { work_order_id, job_id, display_label } — passed when launched from TeamWorkOrderDetail
export default function QuickCaptureModal({ open, onClose, onOpenChange, customers: customersProp = [], boats: boatsProp = [], workOrderContext = null }) {
  const handleClose = onOpenChange || onClose;
  const [step, setStep] = useState('input');
  const [parsed, setParsed] = useState(null);
  const [customers, setCustomers] = useState(customersProp);
  const [boats, setBoats] = useState(boatsProp);

  useEffect(() => {
    if (open) {
      setStep('input');
      setParsed(null);
      // Always fetch fresh full customer/boat list when modal opens
      Promise.all([
      base44.entities.Customer.list('-last_name', 2000),
      base44.entities.Boat.list('-created_date', 2000)]
      ).then(([c, b]) => {
        setCustomers(c || []);
        setBoats(b || []);
      }).catch(() => {
        // fallback to props if fetch fails
        setCustomers(customersProp);
        setBoats(boatsProp);
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        className="
          sm:max-w-lg sm:w-full sm:mx-4 sm:max-h-[90vh] sm:rounded-lg
          max-sm:!fixed max-sm:!left-0 max-sm:!right-0 max-sm:!top-0 max-sm:!bottom-auto
          max-sm:![transform:none] max-sm:!translate-x-0 max-sm:!translate-y-0
          max-sm:!w-full max-sm:!max-w-none
          max-sm:rounded-b-2xl max-sm:rounded-t-none
          max-sm:max-h-[92vh] overflow-y-auto
        ">






        
        <DialogHeader>
          <DialogTitle className="py-3 text-lg font-semibold tracking-tight leading-none flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Quick Capture
            {step === 'result' && <span className="text-sm font-normal text-slate-500 ml-1">— Review Result</span>}
          </DialogTitle>
        </DialogHeader>

        {/* WO context banner — only shown when launched from a Work Order */}
        {workOrderContext?.work_order_id && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 mb-1">
            <Zap className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <span>Linked to: <strong>{workOrderContext.display_label || `WO ${workOrderContext.work_order_id.slice(-6)}`}</strong></span>
          </div>
        )}

        {step === 'input' && (
          <InputStep customers={customers} boats={boats}
            onParsed={(p) => { setParsed(p); setStep('result'); }} />
        )}
        {step === 'result' && parsed &&
          <ResultStep parsed={parsed} customers={customers} boats={boats}
            workOrderContext={workOrderContext}
            onConfirm={() => handleClose(false)} onEdit={() => setStep('input')} />
        }
      </DialogContent>
    </Dialog>);

}