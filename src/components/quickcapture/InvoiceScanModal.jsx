/**
 * InvoiceScanModal — Vereinfachter Flow:
 * Foto aufnehmen + optionale Notiz → QuickCaptureEntry (material_entry) → ab in Review-Queue
 * Kein direkter Materialimport mehr. Der Admin entscheidet in der Review-Queue.
 */
import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Loader2, Receipt, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function InvoiceScanModal({ open, onOpenChange }) {
  const fileInputRef = useRef(null);

  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhotoUrl('');
      setNote('');
    }
  }, [open]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch {
      toast.error('Foto-Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!photoUrl) { toast.error('Bitte zuerst ein Foto aufnehmen'); return; }
    setSaving(true);
    try {
      await base44.entities.QuickCaptureEntry.create({
        raw_input: note.trim() || 'Rechnung / Lieferschein (Foto)',
        input_method: 'text',
        photo_urls: [photoUrl],
        suggested_type: 'material_entry',
        suggested_summary: note.trim() || 'Rechnung eingescannen — bitte in Materialimport übertragen',
        review_status: 'new',
      });
      toast.success('Rechnung gesichert — liegt jetzt im Quick Capture Review');
      onOpenChange(false);
    } catch {
      toast.error('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Rechnung scannen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Foto der Rechnung aufnehmen — landet im Quick Capture Review zur weiteren Bearbeitung.
          </p>

          {/* Photo upload */}
          {!photoUrl ? (
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
          ) : (
            <div className="relative">
              <img src={photoUrl} alt="" className="w-full max-h-48 object-contain rounded-lg border" />
              <button
                onClick={() => setPhotoUrl('')}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border text-slate-500 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />

          {/* Optional note */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Notiz (optional)</label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder='z.B. "Victron-Rechnung für Blümel, Marina Vrsar"'
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !photoUrl}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <CheckCircle2 className="h-4 w-4 mr-2" />
              }
              In Review ablegen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}