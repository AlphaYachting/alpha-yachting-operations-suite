import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[RESET] Starting database reset...');

    // Delete in dependency order (children before parents)
    const deletionOrder = [
      'WorkOrderComment',
      'WorkOrderPhoto',
      'MaterialUsage',
      'TimeEntry',
      'Task',
      'WorkOrderAccessLog',
      'InventoryReservation',
      'InventoryAssignment',
      'TeamOrder',
      'WorkOrder',
      'OfferTask',
      'Offer',
      'Job',
      'Boat',
      'Customer'
    ];

    const results = {};

    for (const entity of deletionOrder) {
      try {
        // Fetch all records for this entity
        const records = await base44.asServiceRole.entities[entity].list('', 10000);
        if (records && records.length > 0) {
          // Delete each record
          for (const record of records) {
            await base44.asServiceRole.entities[entity].delete(record.id);
          }
          results[entity] = `Deleted ${records.length} records`;
          console.log(`[RESET] ${entity}: Deleted ${records.length} records`);
        } else {
          results[entity] = 'No records found';
        }
      } catch (err) {
        console.log(`[RESET] ${entity}: Skip or error - ${err.message}`);
        results[entity] = `Skipped or error: ${err.message}`;
      }
    }

    console.log('[RESET] Database reset complete');
    return Response.json({
      success: true,
      message: 'Database reset completed',
      results
    });
  } catch (error) {
    console.error('[RESET] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});