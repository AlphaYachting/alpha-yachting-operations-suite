import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if units already exist
    const existingUnits = await base44.entities.UnitSettings.list();
    if (existingUnits.length > 0) {
      return Response.json({ message: 'Units already initialized', count: existingUnits.length });
    }

    // Default units to create
    const defaultUnits = [
      { value: 'Hour', display: 'hrs', label: 'Hours', category: 'Time', active: true },
      { value: 'Piece', display: 'pcs', label: 'Pieces', category: 'Quantity', active: true },
      { value: 'Square Meter', display: 'm²', label: 'Square Meters', category: 'Dimension', active: true },
      { value: 'Linear Meter', display: 'm', label: 'Meters', category: 'Dimension', active: true },
      { value: 'Liter', display: 'L', label: 'Liters', category: 'Volume', active: true },
      { value: 'Kilogram', display: 'kg', label: 'Kilograms', category: 'Weight', active: true },
      { value: 'Set', display: 'set', label: 'Sets', category: 'Quantity', active: true },
      { value: 'Lump Sum', display: 'job', label: 'Lump Sum', category: 'Other', active: true },
    ];

    // Create all units
    const created = await base44.entities.UnitSettings.bulkCreate(defaultUnits);

    return Response.json({ message: 'Default units initialized', count: created.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});