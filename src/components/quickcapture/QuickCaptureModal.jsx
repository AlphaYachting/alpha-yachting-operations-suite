import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, MicOff, Send, Camera, X, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_LABELS = {
  material_entry: { label: 'Material / Parts', color: 'bg-amber-100 text-amber-800' },
  tool_tracking: { label: 'Tool / Equipment', color: 'bg-blue-100 text-blue-800' },
  task_candidate: { label: 'Task Candidate', color: 'bg-orange-100 text-orange-800' },
  customer_request: { label: 'Customer Request', color: 'bg-purple-100 text-purple-800' },
  project_intake: { label: 'Project Intake', color: 'bg-green-100 text-green-800' },
  internal_note: { label: 'Internal Note', color: 'bg-slate-100 text-slate-700' },
};

export default function QuickCaptureModal({ open, onClose, customers = [], boats = [] }) {
  const [text, setText] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [boatId, setBoatId] = useState('');
  const [locationText, setLocationText] = useState('');
  const [photoUrls, setPhotoUrls] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [inputMethod, setInputMethod] = useState('text');
  const [classifying, setClassifying] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setText('');
      setCustomerId('');
      setBoatId('');
      setLocationText('');
      setPhotoUrls([]);
      setAiResult(null);
      setInputMethod('text');
    }
  }, [open]);

  const voiceSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startRecording = () => {
    if (!voiceSupported) { toast.error('Voice input not supported in this browser'); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText(prev => prev ? prev + ' ' + transcript : transcript);
      setInputMethod('voice');
    };
    recognition.onerror = () => { setIsRecording(false); toast.error('Voice recognition error'); };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const handleClassify = async () => {
    if (!text.trim()) return;
    setClassifying(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an operational classifier for a marine service company. Classify this field note:

"${text}"

Classify into exactly one type:
- material_entry: consumables, parts, materials left at customer
- tool_tracking: company equipment/tools left on site
- task_candidate: new work identified (cleaning, repair, inspection)
- customer_request: customer wants new service/work
- project_intake: site visit, project recording, multi-area inspection
- internal_note: informational only

Also extract:
- short_summary: 1 sentence max
- suggested_target: where this should be routed
- customer_name: if mentioned (or null)
- boat_name: if mentioned (or null)
- urgency: low/normal/high/urgent
- billable: true/false hint`,
        response_json_schema: {
          type: 'object',
          properties: {
            entry_type: { type: 'string' },
            short_summary: { type: 'string' },
            suggested_target: { type: 'string' },
            customer_name: { type: 'string' },
            boat_name: { type: 'string' },
            urgency: { type: 'string' },
            billable: { type: 'boolean' }
          }
        }
      });
      setAiResult(result);
    } catch (e) {
      toast.error('Classification failed — you can still save manually');
    } finally {
      setClassifying(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrls(prev => [...prev, file_url]);
    } catch {
      toast.error('Photo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!text.trim()) { toast.error('Please enter some text first'); return; }
    setSaving(true);
    try {
      const entry = {
        raw_input: text.trim(),
        input_method: inputMethod,
        customer_id: customerId || null,
        boat_id: boatId || null,
        location_text: locationText || null,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
        review_status: 'new',
        ...(aiResult && {
          suggested_type: aiResult.entry_type,
          suggested_summary: aiResult.short_summary,
          suggested_target: aiResult.suggested_target,
          ai_extracted_customer_name: aiResult.customer_name,
          ai_extracted_boat_name: aiResult.boat_name,
          ai_urgency_hint: aiResult.urgency,
          ai_billable_hint: aiResult.billable,
        })
      };
      await base44.entities.QuickCaptureEntry.create(entry);
      toast.success('Captured! Visible in Quick Capture Review Queue.');
      onClose();
    } catch {
      toast.error('Failed to save capture');
    } finally {
      setSaving(false);
    }
  };

  const filteredBoats = customerId
    ? boats.filter(b => b.customer_id === customerId)
    : boats;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Quick Capture
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main text input */}
          <div>
            <Textarea
              placeholder="What happened? e.g. 'Pressure washer left at customer Blümel in Vrsar' or 'Customer wants polishing next week'..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="resize-none text-base"
              autoFocus
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                {voiceSupported && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={isRecording ? 'border-red-400 text-red-600' : ''}
                  >
                    {isRecording ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
                    {isRecording ? 'Stop' : 'Voice'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
                  Photo
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleClassify}
                disabled={!text.trim() || classifying}
              >
                {classifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                {classifying ? 'Classifying...' : 'Classify'}
              </Button>
            </div>
          </div>

          {/* Photos preview */}
          {photoUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photoUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="h-16 w-16 object-cover rounded border" />
                  <button
                    onClick={() => setPhotoUrls(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 bg-white rounded-full border p-0.5"
                  >
                    <X className="h-3 w-3 text-slate-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* AI classification result */}
          {aiResult && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-amber-800">AI Suggestion:</span>
                <Badge className={TYPE_LABELS[aiResult.entry_type]?.color || 'bg-slate-100 text-slate-700'}>
                  {TYPE_LABELS[aiResult.entry_type]?.label || aiResult.entry_type}
                </Badge>
                {aiResult.urgency && aiResult.urgency !== 'normal' && (
                  <Badge className="bg-red-100 text-red-700">{aiResult.urgency}</Badge>
                )}
                {aiResult.billable && (
                  <Badge className="bg-green-100 text-green-700">billable</Badge>
                )}
              </div>
              {aiResult.short_summary && (
                <p className="text-xs text-amber-800">{aiResult.short_summary}</p>
              )}
              {aiResult.suggested_target && (
                <p className="text-xs text-amber-700">→ {aiResult.suggested_target}</p>
              )}
            </div>
          )}

          {/* Optional context fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Customer (optional)</label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setBoatId(''); }}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Boat (optional)</label>
              <Select value={boatId} onValueChange={setBoatId} disabled={filteredBoats.length === 0 && !boatId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select boat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {filteredBoats.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.vessel_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Location / Marina (optional)</label>
            <input
              type="text"
              placeholder="e.g. Vrsar, ACI Rovinj..."
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              className="w-full h-8 px-3 text-sm border border-input rounded-md bg-background"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !text.trim()} className="bg-amber-500 hover:bg-amber-600 text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Save to Queue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}