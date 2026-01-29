import { base44 } from '@/api/base44Client';

// Default fallback units in case database is not initialized
const DEFAULT_UNITS = [
  { value: 'Hour', display: 'hrs', label: 'Hours' },
  { value: 'Piece', display: 'pcs', label: 'Pieces' },
  { value: 'Square Meter', display: 'm²', label: 'Square Meters' },
  { value: 'Linear Meter', display: 'm', label: 'Meters' },
  { value: 'Liter', display: 'L', label: 'Liters' },
  { value: 'Kilogram', display: 'kg', label: 'Kilograms' },
  { value: 'Set', display: 'set', label: 'Sets' },
  { value: 'Lump Sum', display: 'job', label: 'Lump Sum' },
];

let cachedUnits = null;
let unitsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getUnitOptions = async () => {
  try {
    // Check if cache is still valid
    if (cachedUnits && Date.now() - unitsCacheTime < CACHE_DURATION) {
      return cachedUnits;
    }

    const units = await base44.entities.UnitSettings.list();
    const activeUnits = units.filter(u => u.active);
    
    if (activeUnits.length > 0) {
      cachedUnits = activeUnits;
      unitsCacheTime = Date.now();
      return activeUnits;
    }
  } catch (error) {
    console.warn('Failed to fetch units from database, using defaults:', error);
  }

  return DEFAULT_UNITS;
};

export const getUnitDisplay = async (unitValue) => {
  const units = await getUnitOptions();
  const unit = units.find(u => u.value === unitValue);
  return unit ? unit.display : unitValue;
};

export const getUnitLabel = async (unitValue) => {
  const units = await getUnitOptions();
  const unit = units.find(u => u.value === unitValue);
  return unit ? unit.label : unitValue;
};

export const UNIT_OPTIONS = DEFAULT_UNITS;