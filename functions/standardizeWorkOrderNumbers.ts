import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user - admin only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all work orders
    const allWorkOrders = await base44.asServiceRole.entities.WorkOrder.list('-created_date', 5000);
    
    // Find work orders with non-standard numbers
    const nonStandardWorkOrders = allWorkOrders.filter(wo => {
      if (!wo.work_order_number) return true;
      // Check if it's not in WO00000 format (5 digits)
      return !/^WO\d{5}$/.test(wo.work_order_number);
    });

    if (nonStandardWorkOrders.length === 0) {
      return Response.json({ 
        message: 'All work order numbers are already standardized',
        updated: 0
      });
    }

    // Sort by creation date to maintain order
    nonStandardWorkOrders.sort((a, b) => 
      (a.created_date || '').localeCompare(b.created_date || '')
    );

    // Find the highest existing standard number
    const standardNumbers = allWorkOrders
      .map(wo => wo.work_order_number)
      .filter(num => num && /^WO\d{5}$/.test(num))
      .map(num => parseInt(num.replace('WO', ''), 10))
      .filter(num => !isNaN(num));
    
    let nextNumber = standardNumbers.length > 0 ? Math.max(...standardNumbers) + 1 : 1;
    
    // Update each non-standard work order
    const updates = [];
    for (const wo of nonStandardWorkOrders) {
      const newNumber = `WO${String(nextNumber).padStart(5, '0')}`;
      updates.push({
        id: wo.id,
        old_number: wo.work_order_number,
        new_number: newNumber
      });
      
      await base44.asServiceRole.entities.WorkOrder.update(wo.id, {
        work_order_number: newNumber
      });
      
      nextNumber++;
    }

    return Response.json({ 
      message: `Standardized ${updates.length} work order numbers`,
      updated: updates.length,
      updates: updates
    });
  } catch (error) {
    console.error('Error standardizing work order numbers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});