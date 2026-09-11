import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText, Image, Scan } from 'lucide-react';

const SCHEMA = {
  type: 'object',
  properties: {
    owner: {
      type: 'object',
      description: 'Owner / Eigentümer / Halter data from the document',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        company_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        billing_address: { type: 'string', description: 'Street and number' },
        billing_postal_code: { type: 'string' },
        billing_city: { type: 'string' },
        billing_country: { type: 'string' },
        vat_number: { type: 'string', description: 'OIB / VAT-ID / Steuernummer' }
      }
    },
    boat: {
      type: 'object',
      description: 'Vessel data / Bootsdaten (Seebrief, Zulassungsschein)',
      properties: {
        vessel_name: { type: 'string' },
        vessel_type: { type: 'string', enum: ['Sailboat', 'Motorboat', 'Yacht', 'Catamaran', 'RIB', 'Other'] },
        manufacturer: { type: 'string' },
        model: { type: 'string' },
        year: { type: 'number' },
        length_m: { type: 'number' },
        beam_m: { type: 'number' },
        draft_m: { type: 'number' },
        hull_material: { type: 'string', enum: ['GRP/Fiberglass', 'Aluminum', 'Steel', 'Wood', 'Carbon', 'Other'] },
        engine_type: { type: 'string', enum: ['Inboard Diesel', 'Inboard Petrol', 'Outboard', 'Electric', 'Sail Only', 'Hybrid'] },
        engine_manufacturer: { type: 'string' },
        engine_model: { type: 'string' },
        engine_number: { type: 'string' },
        registration_number: { type: 'string' },
        flag_country: { type: 'string' }
      }
    }
  }
};

const LABELS = {
  first_name: 'Vorname', last_name: 'Nachname', company_name: 'Firma', email: 'E-Mail', phone: 'Telefon',
  billing_address: 'Adresse', billing_postal_code: 'PLZ', billing_city: 'Ort', billing_country: 'Land', vat_number: 'OIB / VAT',
  vessel_name: 'Schiffsname', vessel_type: 'Typ', manufacturer: 'Hersteller', model: 'Modell', year: 'Baujahr',
  length_m: 'Länge (m)', beam_m: 'Breite (m)', draft_m: 'Tiefgang (m)', hull_material: 'Rumpfmaterial',
  engine_type: 'Motorart', engine_manufacturer: 'Motorhersteller', engine_model: 'Motormodell',
  engine_number: 'Motornummer', registration_number: 'Zulassungsnummer', flag_country: 'Flaggenstaat'
};

const filled = (obj) => Object.entries(obj || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');

export default function ScanDocumentDialog({ open, onOpenChange, onDataExtracted }) {
  const [step, setStep] = useState('upload');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.type)) {
      setError('Nur JPG, PNG oder PDF erlaubt.');
      return;
    }
    setError(null);
    setStep('extracting');
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: SCHEMA });
    if (result.status !== 'success' || !result.output) {
      setError('KI konnte keine Daten extrahieren. Bitte ein klareres Foto oder PDF versuchen.');
      setStep('upload');
      return;
    }
    const out = Array.isArray(result.output) ? result.output[0] : result.output;
    setData(out);
    setStep('review');
  };

  const close = () => {
    onOpenChange(false);
    setStep('upload');
    setData(null);
    setError(null);
  };

  const ownerFields = filled(data?.owner);
  const boatFields = filled(data?.boat);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-blue-600" />
            Dokument scannen (Seebrief / Zulassungsschein)
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Foto oder PDF hochladen — die KI liest Eigentümer- und Bootsdaten aus und füllt den Wizard automatisch aus.
            </p>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex justify-center gap-3 mb-3">
                <Image className="h-8 w-8 text-slate-300" />
                <FileText className="h-8 w-8 text-slate-300" />
                <Upload className="h-8 w-8 text-slate-300" />
              </div>
              <p className="font-medium text-slate-700">Datei hier ablegen oder klicken</p>
              <p className="text-xs text-slate-400 mt-1">JPG · PNG · PDF</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>
          </div>
        )}

        {step === 'extracting' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
            <p className="font-medium text-slate-700">KI liest das Dokument aus…</p>
            <p className="text-xs text-slate-400">Das dauert meist 5–10 Sekunden</p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                {ownerFields.length} Kontakt- und {boatFields.length} Bootsfelder erkannt
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3">
              {[['Kontakt', ownerFields], ['Boot', boatFields]].map(([title, fields]) => fields.length > 0 && (
                <div key={title}>
                  <p className="text-xs font-semibold text-slate-500 mb-1">{title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {fields.map(([k, v]) => (
                      <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-400">{LABELS[k] || k}</p>
                        <p className="text-sm font-medium text-slate-800 truncate">{String(v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {ownerFields.length === 0 && boatFields.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Keine verwertbaren Daten gefunden. Bitte ein besseres Bild versuchen.</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('upload')}>Anderes Dokument</Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={ownerFields.length === 0 && boatFields.length === 0}
                onClick={() => { onDataExtracted(data); close(); }}
              >
                Daten übernehmen →
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}