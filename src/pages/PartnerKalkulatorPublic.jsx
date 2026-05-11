import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Calculator, Info } from 'lucide-react';

// ─── PREISDATEN ────────────────────────────────────────────────────────────────
const RUMPF_PREISE = [
  ['9-10 m',   130, 160, 255, 50,  180, 190,  310, 160],
  ['10-11 m',  145, 170, 285, 50,  205, 205,  340, 160],
  ['11-12 m',  160, 180, 300, 50,  225, 230,  370, 160],
  ['12-13 m',  175, 210, 355, 50,  245, 260,  420, 160],
  ['13-14 m',  190, 230, 395, 50,  270, 295,  470, 160],
  ['14-15 m',  215, 250, 420, 50,  305, 330,  530, 160],
  ['15-16 m',  240, 285, 475, 50,  340, 375,  595, 160],
  ['16-17 m',  255, 305, 495, 50,  365, 415,  650, 240],
  ['17-18 m',  285, 320, 520, 70,  405, 470,  750, 240],
  ['18-19 m',  320, 340, 550, 70,  450, 520,  830, 240],
  ['19-20 m',  350, 360, 595, 70,  500, 595,  950, 240],
  ['20-21 m',  460, 390, 630, 70,  650, 660, 1060, 240],
  ['21-22 m', null,null,null,null,  750, 920, 1472, 315],
  ['22-23 m', null,null,null,null,  850,1056, 1692, 315],
  ['23-24 m', null,null,null,null,  950,1212, 1940, 315],
  ['24-25 m', null,null,null,null, 1050,1392, 2248, 315],
  ['25+ m',   null,null,null,null, null,null, null, null],
];

const REINIGUNGS_PREISE = [
  ['9-10 m',   105, 205,  55, 110,  180,  615],
  ['10-11 m',  120, 220,  65, 130,  525,  680],
  ['11-12 m',  130, 230,  75, 150,  570,  730],
  ['12-13 m',  140, 240,  80, 160,  615,  785],
  ['13-14 m',  155, 255,  90, 180,  665,  840],
  ['14-15 m',  170, 270, 100, 200,  725,  900],
  ['15-16 m',  190, 290, 120, 220,  900, 1100],
  ['16-17 m',  210, 310, 140, 240, 1100, 1300],
  ['17-18 m',  230, 330, 160, 260, 1300, 1500],
  ['18-19 m',  250, 350, 180, 280, 1500, 1700],
  ['19-20 m',  270, 370, 200, 300, 1700, 1900],
  ['20-21 m',  290, 390, 220, 320, 1900, 2100],
  ['21-22 m',  310, 410, 240, 340, 2100, 2300],
  ['22-23 m',  330, 430, 260, 360, 2300, 2500],
  ['23-24 m',  350, 450, 280, 380, 2500, 2700],
  ['24-25 m',  370, 470, 300, 400, 2700, 2900],
  ['25+ m',   null,null,null,null, null, null],
];

const LENGTH_BANDS = RUMPF_PREISE.map(r => r[0]);

const SERVICES = {
  aussenwasche_normal:     { label: 'Außenwäsche normal', category: 'reinigung', boatTypes: ['SY','MY'], notes: ['reinigungsmittel_inkludiert'] },
  aussenwasche_teak:       { label: 'Außenwäsche mit Teak Cleaner + Brightener', category: 'reinigung', boatTypes: ['SY','MY'], notes: ['reinigungsmittel_inkludiert', 'teakschutz_separat'] },
  innen_normal:            { label: 'Innenreinigung normal', category: 'reinigung', boatTypes: ['SY','MY'], notes: [] },
  innen_ausserordentlich:  { label: 'Innenreinigung außergewöhnlicher Zustand', category: 'reinigung', boatTypes: ['SY','MY'], notes: [] },
  politur:                 { label: 'Politur', category: 'reinigung', boatTypes: ['SY','MY'], notes: ['politur_richtpreis'] },
  politur_metallic:        { label: 'Politur Metallic-Lack', category: 'reinigung', boatTypes: ['SY','MY'], notes: ['politur_richtpreis'] },
  sy_vorbereitung:         { label: 'Yachtvorbereitung Segelyacht', category: 'unterwasser', boatTypes: ['SY'], notes: ['material_nicht_inkludiert'] },
  sy_erster_anstrich:      { label: 'Erster Anstrich Segelyacht', category: 'unterwasser', boatTypes: ['SY'], notes: ['material_nicht_inkludiert'] },
  sy_zweiter_anstrich:     { label: 'Zweiter Anstrich Segelyacht', category: 'unterwasser', boatTypes: ['SY'], notes: ['material_nicht_inkludiert'] },
  sy_shaft:                { label: 'Basis + Antifouling Shaft/Propeller Segelyacht', category: 'unterwasser', boatTypes: ['SY'], notes: ['material_nicht_inkludiert'] },
  my_vorbereitung:         { label: 'Yachtvorbereitung Motoryacht', category: 'unterwasser', boatTypes: ['MY'], notes: ['material_nicht_inkludiert'] },
  my_erster_anstrich:      { label: 'Erster Anstrich Motoryacht', category: 'unterwasser', boatTypes: ['MY'], notes: ['material_nicht_inkludiert'] },
  my_zweiter_anstrich:     { label: 'Zweiter Anstrich Motoryacht', category: 'unterwasser', boatTypes: ['MY'], notes: ['material_nicht_inkludiert'] },
  my_shaft_flaps:          { label: 'Basis + Antifouling Shaft/Propeller/Flaps/Z-Drive Motoryacht', category: 'unterwasser', boatTypes: ['MY'], notes: ['material_nicht_inkludiert'] },
};

const NOTE_TEXTS = {
  reinigungsmittel_inkludiert: 'Reinigungsmittel inkludiert.',
  teakschutz_separat: 'Teakschutz / Teaköl gesondert zu verrechnen.',
  politur_richtpreis: 'Richtpreis – exakter Preis abhängig vom Zustand des Bootes.',
  material_nicht_inkludiert: 'Materialkosten nicht inkludiert.',
};

function getPrice(serviceKey, lengthBand) {
  const colMap = {
    sy_vorbereitung: 1, sy_erster_anstrich: 2, sy_zweiter_anstrich: 3, sy_shaft: 4,
    my_vorbereitung: 5, my_erster_anstrich: 6, my_zweiter_anstrich: 7, my_shaft_flaps: 8,
  };
  const reinigungMap = {
    aussenwasche_normal: 1, aussenwasche_teak: 2, innen_normal: 3,
    innen_ausserordentlich: 4, politur: 5, politur_metallic: 6,
  };
  if (colMap[serviceKey] !== undefined) {
    const row = RUMPF_PREISE.find(r => r[0] === lengthBand);
    if (!row) return null;
    const val = row[colMap[serviceKey]];
    return val === null ? 'request_only' : val;
  }
  if (reinigungMap[serviceKey] !== undefined) {
    const row = REINIGUNGS_PREISE.find(r => r[0] === lengthBand);
    if (!row) return null;
    const val = row[reinigungMap[serviceKey]];
    return val === null ? 'request_only' : val;
  }
  return null;
}

export default function PartnerKalkulatorPublic() {
  const [boatType, setBoatType] = useState('');
  const [lengthBand, setLengthBand] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedServices, setSelectedServices] = useState([]);
  const [showVat, setShowVat] = useState(true);
  const [showNotes, setShowNotes] = useState(true);

  const toggleService = (key) => {
    setSelectedServices(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const availableServices = useMemo(() => {
    if (!boatType) return [];
    return Object.entries(SERVICES).filter(([, svc]) => {
      const typeMatch = svc.boatTypes.includes(boatType);
      const catMatch = categoryFilter === 'all' || svc.category === categoryFilter;
      return typeMatch && catMatch;
    });
  }, [boatType, categoryFilter]);

  const handleBoatTypeChange = (val) => {
    setBoatType(val);
    setSelectedServices([]);
  };

  const calculation = useMemo(() => {
    if (!lengthBand || selectedServices.length === 0) return null;
    const lines = selectedServices.map(key => {
      const svc = SERVICES[key];
      const price = getPrice(key, lengthBand);
      return { key, label: svc.label, price, notes: svc.notes };
    });
    const hasRequestOnly = lines.some(l => l.price === 'request_only');
    const nettoTotal = hasRequestOnly
      ? null
      : lines.reduce((sum, l) => sum + (typeof l.price === 'number' ? l.price : 0), 0);
    const vat = nettoTotal !== null ? Math.round(nettoTotal * 0.25 * 100) / 100 : null;
    const brutto = nettoTotal !== null ? Math.round((nettoTotal + vat) * 100) / 100 : null;
    const allNoteKeys = [...new Set(lines.flatMap(l => l.notes))];
    return { lines, hasRequestOnly, nettoTotal, vat, brutto, allNoteKeys };
  }, [selectedServices, lengthBand]);

  const fmt = (n) => n !== null && n !== undefined
    ? `EUR ${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png"
            alt="Alpha Yachting"
            className="h-10 object-contain"
          />
          <div className="ml-2">
            <h1 className="text-xl font-bold text-slate-900">Schnellkalkulator – Kooperationspartner</h1>
            <p className="text-sm text-slate-500">Preisabschätzung · Keine kaufmännische Verbindlichkeit</p>
          </div>
        </div>

        {/* Konfiguration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Konfiguration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Bootstyp</Label>
                <Select value={boatType} onValueChange={handleBoatTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SY">Segelyacht</SelectItem>
                    <SelectItem value="MY">Motoryacht</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Längenklasse</Label>
                <Select value={lengthBand} onValueChange={setLengthBand} disabled={!boatType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {LENGTH_BANDS.map(lb => (
                      <SelectItem key={lb} value={lb}>{lb}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Leistungsbereich</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alles</SelectItem>
                    <SelectItem value="reinigung">Reinigung / Politur</SelectItem>
                    <SelectItem value="unterwasser">Unterwasserschiff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Checkbox id="showVat" checked={showVat} onCheckedChange={setShowVat} />
                <Label htmlFor="showVat" className="text-sm cursor-pointer">MwSt. anzeigen</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="showNotes" checked={showNotes} onCheckedChange={setShowNotes} />
                <Label htmlFor="showNotes" className="text-sm cursor-pointer">Hinweise anzeigen</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dienstleistungen */}
        {boatType && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dienstleistungen auswählen</CardTitle>
            </CardHeader>
            <CardContent>
              {availableServices.length === 0 ? (
                <p className="text-sm text-slate-400">Keine Leistungen für diese Kombination.</p>
              ) : (
                <div className="space-y-1">
                  {['reinigung', 'unterwasser'].map(cat => {
                    const catServices = availableServices.filter(([, s]) => s.category === cat);
                    if (catServices.length === 0) return null;
                    return (
                      <div key={cat} className="mb-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          {cat === 'reinigung' ? 'Reinigung / Politur' : 'Unterwasserschiff / Antifouling'}
                        </p>
                        <div className="space-y-2">
                          {catServices.map(([key, svc]) => {
                            const price = lengthBand ? getPrice(key, lengthBand) : null;
                            return (
                              <div
                                key={key}
                                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                  selectedServices.includes(key)
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                }`}
                                onClick={() => toggleService(key)}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Checkbox
                                    checked={selectedServices.includes(key)}
                                    onCheckedChange={() => toggleService(key)}
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <span className="text-sm font-medium text-slate-800">{svc.label}</span>
                                </div>
                                <div className="text-sm font-semibold text-slate-700 ml-2 whitespace-nowrap">
                                  {!lengthBand ? (
                                    <span className="text-slate-300 font-normal">— wähle Länge</span>
                                  ) : price === 'request_only' ? (
                                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Auf Anfrage</Badge>
                                  ) : price !== null ? (
                                    `EUR ${price.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
                                  ) : '—'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ergebnis */}
        {calculation && (
          <Card className="border-2 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                Kalkulation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="bg-slate-100 px-2 py-0.5 rounded">
                  {boatType === 'SY' ? 'Segelyacht' : 'Motoryacht'}
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded">{lengthBand}</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gewählte Leistungen</p>
                {calculation.lines.map(line => (
                  <div key={line.key} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-slate-700">{line.label}</span>
                    <span className="font-medium text-slate-900 ml-4 whitespace-nowrap">
                      {line.price === 'request_only'
                        ? <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Auf Anfrage</Badge>
                        : fmt(line.price)
                      }
                    </span>
                  </div>
                ))}
              </div>
              {calculation.hasRequestOnly ? (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Für mindestens eine gewählte Leistung liegt kein fixer Preis vor. <strong>Preis auf Anfrage.</strong>
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Zwischensumme netto</span>
                    <span className="font-medium">{fmt(calculation.nettoTotal)}</span>
                  </div>
                  {showVat && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">MwSt. 25 %</span>
                      <span className="font-medium">{fmt(calculation.vat)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-1">
                    <span>{showVat ? 'Gesamtsumme brutto' : 'Gesamtsumme netto'}</span>
                    <span className="text-blue-700">{fmt(showVat ? calculation.brutto : calculation.nettoTotal)}</span>
                  </div>
                </div>
              )}
              {showNotes && calculation.allNoteKeys.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Info className="h-3 w-3" /> Hinweise
                  </p>
                  <ul className="space-y-1">
                    {calculation.allNoteKeys.map(nk => (
                      <li key={nk} className="text-sm text-slate-600 flex items-start gap-1.5">
                        <span className="text-slate-400 mt-1">•</span>
                        {NOTE_TEXTS[nk]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-slate-400 pb-4">
          Nur zur Orientierung · Kein offizielles Angebot · Keine kaufmännische Verbindlichkeit · © Alpha Yachting
        </p>
      </div>
    </div>
  );
}