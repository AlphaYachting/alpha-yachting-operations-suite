import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText, Image, Scan } from 'lucide-react';

const BOAT_SCHEMA = {
  type: 'object',
  properties: {
    vessel_name: { type: 'string', description: 'Name of the vessel / Schiffsname' },
    vessel_type: { type: 'string', enum: ['Sailboat', 'Motorboat', 'Yacht', 'Catamaran', 'RIB', 'Other'], description: 'Type of vessel' },
    manufacturer: { type: 'string', description: 'Manufacturer / Hersteller / Marke' },
    model: { type: 'string', description: 'Model name / Modell' },
    year: { type: 'number', description: 'Year of manufacture / Baujahr' },
    length_m: { type: 'number', description: 'Length in meters / Länge in Metern' },
    beam_m: { type: 'number', description: 'Beam/width in meters / Breite in Metern' },
    draft_m: { type: 'number', description: 'Draft in meters / Tiefgang' },
    hull_material: { type: 'string', enum: ['GRP/Fiberglass', 'Aluminum', 'Steel', 'Wood', 'Carbon', 'Other'], description: 'Hull material' },
    engine_type: { type: 'string', enum: ['Inboard Diesel', 'Inboard Petrol', 'Outboard', 'Electric', 'Sail Only', 'Hybrid'], description: 'Engine type / Motorart' },
    engine_manufacturer: { type: 'string', description: 'Engine manufacturer / Motorenhersteller' },
    engine_model: { type: 'string', description: 'Engine model / Motormodell' },
    engine_number: { type: 'string', description: 'Engine serial number / Motorennummer' },
    registration_number: { type: 'string', description: 'Registration / Zulassungsnummer / Kennzeichen' },
    flag_country: { type: 'string', description: 'Flag country / Flaggenstaat' },
  }
};

const FIELD_LABELS = {
  vessel_name: 'Schiffsname',
  vessel_type: 'Typ',
  manufacturer: 'Hersteller',
  model: 'Modell',
  year: 'Baujahr',
  length_m: 'Länge (m)',
  beam_m: 'Breite (m)',
  draft_m: 'Tiefgang (m)',
  hull_material: 'Rumpfmaterial',
  engine_type: 'Motorart',
  engine_manufacturer: 'Motorenhersteller',
  engine_model: 'Motormodell',
  engine_number: 'Motorennummer',
  registration_number: 'Zulassungsnummer',
  flag_country: 'Flaggenstaat',
};

export default function BoatFromRegistrationDialog({ open, onOpenChange, onDataExtracted }) {
  const [step, setStep] = useState('upload'); // upload | extracting | review
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setError('Nur JPG, PNG oder PDF erlaubt.');
      return;
    }

    setError(null);
    setStep('extracting');

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: BOAT_SCHEMA,
    });

    if (result.status !== 'success' || !result.output) {
      setError('KI konnte keine Daten extrahieren. Bitte ein klareres Foto oder PDF versuchen.');
      setStep('upload');
      return;
    }

    const data = Array.isArray(result.output) ? result.output[0] : result.output;
    setExtractedData(data);
    setStep('review');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUseData = () => {
    onDataExtracted(extractedData);
    onOpenChange(false);
    setStep('upload');
    setExtractedData(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('upload');
    setExtractedData(null);
    setError(null);
  };

  const nonEmptyFields = extractedData
    ? Object.entries(extractedData).filter(([_, v]) => v !== null && v !== undefined && v !== '')
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-blue-600" />
            Zulassungsschein einlesen
          </DialogTitle>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Lade ein Foto oder PDF des Zulassungsscheins hoch — die KI liest die Bootsdaten automatisch aus.
            </p>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex justify-center gap-3 mb-3">
                <Image className="h-8 w-8 text-slate-300" />
                <FileText className="h-8 w-8 text-slate-300" />
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

        {/* STEP: EXTRACTING */}
        {step === 'extracting' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
            <p className="font-medium text-slate-700">KI liest Zulassungsschein aus…</p>
            <p className="text-xs text-slate-400">Das dauert meist 5–10 Sekunden</p>
          </div>
        )}

        {/* STEP: REVIEW */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">{nonEmptyFields.length} Felder erkannt</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {nonEmptyFields.map(([key, value]) => (
                <div key={key} className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-400">{FIELD_LABELS[key] || key}</p>
                  <p className="text-sm font-medium text-slate-800 truncate">{String(value)}</p>
                </div>
              ))}
            </div>

            {nonEmptyFields.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Keine verwertbaren Daten gefunden. Bitte ein besseres Bild versuchen.</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('upload')}>
                Anderes Foto
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleUseData}
                disabled={nonEmptyFields.length === 0}
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