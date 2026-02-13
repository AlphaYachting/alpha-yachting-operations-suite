import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // STEP 1: Optimized query - fetch limited recent work orders
    // Limit to 50 most recent to balance performance vs capturing max number
    const recentWorkOrders = await base44.entities.WorkOrder.list('-created_date', 50);

    // Extract and validate numbers matching canonical format WO00001
    const validNumbers = recentWorkOrders
      .map(wo => wo.work_order_number)
      .filter(num => num && /^WO\d{5}$/.test(num)) // Strict: WO + exactly 5 digits, no hyphen
      .map(num => parseInt(num.substring(2), 10)) // Extract numeric part after "WO"
      .filter(num => !isNaN(num));

    // STEP 2: Compute max number from recent records
    const maxNumber = validNumbers.length > 0 ? Math.max(...validNumbers) : 0;
    let nextNumber = maxNumber + 1;

    // STEP 3: Collision check loop with retry
    const MAX_RETRIES = 5;
    let attempt = 0;
    let candidate = '';

    while (attempt < MAX_RETRIES) {
      // Format candidate with zero-padding
      candidate = `WO${String(nextNumber).padStart(5, '0')}`;

      // Re-query DB to check if candidate exists (concurrency-safe check)
      const collision = await base44.entities.WorkOrder.filter({ 
        work_order_number: candidate 
      });

      // If no collision, candidate is safe to use
      if (collision.length === 0) {
        return Response.json({
          work_order_number: candidate,
          allocated_number: nextNumber,
          max_existing: maxNumber,
          retries: attempt,
          timestamp: new Date().toISOString()
        });
      }

      // Collision detected, increment and retry
      console.warn(`Collision detected for ${candidate}, retrying...`);
      nextNumber++;
      attempt++;
    }

    // Failed after max retries
    return Response.json({ 
      error: `Unable to allocate unique WorkOrder number after ${MAX_RETRIES} retries`,
      last_attempt: candidate
    }, { status: 500 });

  } catch (error) {
    console.error('Error allocating work order number:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});