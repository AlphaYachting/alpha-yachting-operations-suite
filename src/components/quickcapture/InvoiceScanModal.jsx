/**
 * InvoiceScanModal — Quick Capture: Rechnung scannen → ImportDocument erstellen
 * Completely isolated from existing QuickCaptureModal logic.
 * Flow: Foto aufnehmen → KI extrahiert → Kunde wählen → ImportDocument anlegen → Weiterleitung
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, X, Receipt, ChevronRight, Search, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// Simple customer picker (self-contained, no external deps)
function CustomerPicker({ customers, value, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = customers.find(c => c.id === value);
  const displayName = (c) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();

  const filtered = customers.filter(c => {
    if (!search) return false;
    return displayName(c).toLowerCase().includes(search.toLowerCase());
  }).slice(0, 8);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-blue-50 border-blue-200">
          <User className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="text-sm text-blue-800 flex-1">{displayName(selected)}</span>
          <button onClick={() => onChange('')} className="text-blue-400 hover:text-blue-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Kunde suchen…"
            className="pl-9"
          />
          {open && filtered.length > 0 && (
            <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg w-full max-h-48 overflow-y-auto">
              {filtered.map(c => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                  onMouseDown={e => { e.preventDefault(); onChange(c.id); setSearch(''); setOpen(false); }}
                >
                  {displayName(c)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InvoiceScanModal({ open, onOpenChange }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('capture'); // capture | extracting | review
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState(null); // { supplier_name, document_number, document_date, document_type }
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);

  // Load customers when modal opens
  useEffect(() => {
    if (open) {
      setStep('capture');
      setPhotoUrl('');
      setExtracted(null);
      setCustomerId('');
      base44.entities.Customer.list('-last_name', 500)
        .then(data => setCustomers(data || []))
        .catch(() => {});
    }
  }, [open]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
      // Auto-extract immediately after upload
      await handleExtract(file_url);
    } catch {
      toast.error('Foto-Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  const handleExtract = async (url) => {
    setStep('extracting');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a document parser. Extract header information from this supplier invoice or delivery note.
Return a JSON object with these exact fields:
{
  "document_type": "Invoice" or "Delivery Note" or "Other",
  "supplier_name": "string or null",
  "document_number": "string or null",
  "document_date": "YYYY-MM-DD or null"
}
Leave fields null if not clearly visible. Do not invent or guess values.`,
        file_urls: [url],
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            document_type: { type: 'string' },
            supplier_name: { type: 'string' },
            document_number: { type: 'string' },
            document_date: { type: 'string' },
          }
        }
      });
      setExtracted({
        document_type: result.document_type || 'Invoice',
        supplier_name: result.supplier_name || '',
        document_number: result.document_number || '',
        document_date: result.document_date || '',
      });
      setStep('review');
    } catch {
      toast.error('KI-Extraktion fehlgeschlagen');
      setStep('review');
      setExtracted({ document_type: 'Invoice', supplier_name: '', document_number: '', document_date: '' });
    }
  };

  const handleSave = async () => {
    if (!photoUrl) { toast.error('Bitte zuerst ein Foto aufnehmen'); return; }
    setSaving(true);
    try {
      const doc = await base44.entities.ImportDocument.create({
        document_type: extracted?.document_type || 'Invoice',
        supplier_name: extracted?.supplier_name || '',
        document_number: extracted?.document_number || '',
        document_date: extracted?.document_date || '',
        original_file_url: photoUrl,
        extraction_status: 'needs_review',
        selected_customer_id: customerId || null,
      });
      toast.success('Rechnung gesichert — jetzt Positionen prüfen');
      onOpenChange(false);
      navigate(`/MaterialImportDetail?id=${doc.id}`);
    } catch {
      toast.error('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Rechnung scannen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Step: capture */}
          {step === 'capture' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Foto der Rechnung aufnehmen — die KI extrahiert Lieferant, Nummer und Datum automatisch.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-slate-300 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
              >
                {uploading
                  ? <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                  : <Camera className="h-8 w-8 text-slate-400" />
                }
                <span className="text-sm font-medium text-slate-600">
                  {uploading ? 'Wird hochgeladen…' : 'Foto aufnehmen / auswählen'}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          )}

          {/* Step: extracting */}
          {step === 'extracting' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-slate-600">KI liest die Rechnung…</p>
              {photoUrl && (
                <img src={photoUrl} alt="" className="h-24 w-24 object-cover rounded-lg border opacity-60" />
              )}
            </div>
          )}

          {/* Step: review */}
          {step === 'review' && extracted && (
            <div className="space-y-4">
              {/* Photo preview */}
              {photoUrl && (
                <div className="flex items-center gap-3">
                  <img src={photoUrl} alt="" className="h-16 w-16 object-cover rounded-lg border flex-shrink-0" />
                  <div className="flex-1">
                    <Badge className="bg-emerald-100 text-emerald-700 mb-1">Foto gesichert</Badge>
                    <button
                      className="block text-xs text-blue-600 underline"
                      onClick={() => { setStep('capture'); setPhotoUrl(''); setExtracted(null); }}
                    >
                      Anderes Foto
                    </button>
                  </div>
                </div>
              )}

              {/* Extracted fields */}
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Erkannt (bitte prüfen)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Lieferant</label>
                    <Input
                      value={extracted.supplier_name}
                      onChange={e => setExtracted(p => ({ ...p, supplier_name: e.target.value }))}
                      placeholder="Lieferant…"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Belegnummer</label>
                    <Input
                      value={extracted.document_number}
                      onChange={e => setExtracted(p => ({ ...p, document_number: e.target.value }))}
                      placeholder="RE-12345…"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Datum</label>
                    <Input
                      type="date"
                      value={extracted.document_date}
                      onChange={e => setExtracted(p => ({ ...p, document_date: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Kunde (optional — kann später zugewiesen werden)</label>
                <CustomerPicker
                  customers={customers}
                  value={customerId}
                  onChange={setCustomerId}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Abbrechen
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <ChevronRight className="h-4 w-4 mr-2" />
                  }
                  Sichern & weiter
                </Button>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Die Positionen werden im nächsten Schritt mit KI extrahiert.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}