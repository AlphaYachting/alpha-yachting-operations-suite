import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all existing work orders
    const allWorkOrders = await base44.entities.WorkOrder.list('-created_date', 5000);
    
    // Extract numeric parts from existing WO numbers
    const existingNumbers = allWorkOrders
      .map(wo => wo.work_order_number)
      .filter(num => num && /^WO\d+$/i.test(num)) // Match WO followed by digits
      .map(num => parseInt(num.replace(/^WO/i, ''), 10))
      .filter(num => !isNaN(num));
    
    // Find the highest number
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    
    // Generate next number with 5-digit padding
    const nextNumber = maxNumber + 1;
    const formattedNumber = `WO${String(nextNumber).padStart(5, '0')}`;
    
    return Response.json({ 
      work_order_number: formattedNumber,
      next_number: nextNumber,
      max_existing: maxNumber
    });
  } catch (error) {
    console.error('Error generating work order number:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});