// Unit mapping for consistent display across offer UI and PDF
export const UNIT_OPTIONS = [
  { value: 'Hour', display: 'hrs', label: 'Hours' },
  { value: 'Piece', display: 'pcs', label: 'Pieces' },
  { value: 'Square Meter', display: 'm²', label: 'Square Meters' },
  { value: 'Linear Meter', display: 'm', label: 'Meters' },
  { value: 'Liter', display: 'L', label: 'Liters' },
  { value: 'Kilogram', display: 'kg', label: 'Kilograms' },
  { value: 'Set', display: 'set', label: 'Sets' },
  { value: 'Lump Sum', display: 'job', label: 'Lump Sum' },
];

export const getUnitDisplay = (unitValue) => {
  const unit = UNIT_OPTIONS.find(u => u.value === unitValue);
  return unit ? unit.display : unitValue;
};

export const getUnitLabel = (unitValue) => {
  const unit = UNIT_OPTIONS.find(u => u.value === unitValue);
  return unit ? unit.label : unitValue;
};