/**
 * Normalizes any unit label found in text/PDF (DE / EN / HR / IT) to a valid
 * OfferTask unit_type enum value.
 */
export const VALID_UNIT_TYPES = [
  'Hour', 'Piece', 'Square Meter', 'Linear Meter', 'Liter', 'Kilogram',
  'Set', 'Lump Sum', 'km', 'day', 'month', 'season', 'flat',
];

const ALIASES = {
  Hour: ['hour', 'hours', 'hr', 'hrs', 'h', 'std', 'stunde', 'stunden', 'akh', 'sat', 'sata', 'ora', 'ore', 'manhour', 'arbeitsstunde', 'arbeitsstunden'],
  Piece: ['piece', 'pieces', 'pc', 'pcs', 'pce', 'ea', 'each', 'stk', 'stck', 'stück', 'stueck', 'st', 'kom', 'kom.', 'komad', 'pz', 'unit', 'units'],
  'Square Meter': ['square meter', 'square meters', 'sqm', 'm2', 'm²', 'qm', 'quadratmeter'],
  'Linear Meter': ['linear meter', 'linear meters', 'meter', 'meters', 'metre', 'm', 'lfm', 'lm', 'laufmeter', 'metar', 'metri'],
  Liter: ['liter', 'liters', 'litre', 'litres', 'l', 'ltr', 'lit', 'litra'],
  Kilogram: ['kilogram', 'kilograms', 'kg', 'kilo', 'kgs'],
  Set: ['set', 'sets', 'satz', 'garnitur', 'kit', 'garnitura'],
  'Lump Sum': ['lump sum', 'lumpsum', 'pauschal', 'pauschale', 'pausch', 'psch', 'pau', 'paušal', 'pausal', 'forfait', 'job'],
  km: ['km', 'kilometer', 'kilometers', 'kilometre'],
  day: ['day', 'days', 'tag', 'tage', 'td', 'dan', 'dana', 'giorno'],
  month: ['month', 'months', 'monat', 'monate', 'mon', 'mjesec'],
  season: ['season', 'saison', 'sezona'],
  flat: ['flat', 'flat rate', 'fix', 'fixpreis'],
};

const LOOKUP = {};
VALID_UNIT_TYPES.forEach(v => { LOOKUP[v.toLowerCase()] = v; });
Object.entries(ALIASES).forEach(([canonical, list]) => {
  list.forEach(a => { LOOKUP[a] = canonical; });
});

/**
 * @param {string} raw - unit label from extraction/AI
 * @param {string} itemType - 'Labor' | 'Material' | 'Chapter' (used for fallback)
 */
export function normalizeUnitType(raw, itemType = 'Labor') {
  const cleaned = String(raw || '')
    .toLowerCase()
    .replace(/[().]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned && LOOKUP[cleaned]) return LOOKUP[cleaned];

  // try first word (e.g. "Stk gesamt", "kom / paušal")
  const firstToken = cleaned.split(/[\s/,-]+/)[0];
  if (firstToken && LOOKUP[firstToken]) return LOOKUP[firstToken];

  return itemType === 'Material' ? 'Piece' : 'Hour';
}