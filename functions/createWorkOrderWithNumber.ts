import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate user (verify admin role for service-level creation)
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Parse work order data from request
    const workOrderData = await req.json();

    // Validate required fields
    if (!workOrderData.job_id || !workOrderData.title || !workOrderData.scheduled_date) {
      return Response.json({ 
        error: 'Missing required fields: job_id, title, scheduled_date' 
      }, { status: 400 });
    }

    const MAX_ATTEMPTS = 3;
    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_ATTEMPTS) {
      attempt++;

      try {
        // Allocate candidate number inline (avoid function invoke permission issues)
        const recentWorkOrders = await base44.asServiceRole.entities.WorkOrder.list('-created_date', 50);
        const validNumbers = recentWorkOrders
          .map(wo => wo.work_order_number)
          .filter(num => num && /^WO\d{5}$/.test(num))
          .map(num => parseInt(num.substring(2), 10))
          .filter(num => !isNaN(num));
        
        const maxNumber = validNumbers.length > 0 ? Math.max(...validNumbers) : 0;
        const nextNumber = maxNumber + attempt; // Increment by attempt for uniqueness
        const work_order_number = `WO${String(nextNumber).padStart(5, '0')}`;

        if (!work_order_number) {
          throw new Error('Allocation returned no work_order_number');
        }

        // Immediately create WorkOrder with allocated number (use service role for creation)
        const workOrder = await base44.asServiceRole.entities.WorkOrder.create({
          ...workOrderData,
          work_order_number: work_order_number
        });

        return Response.json({
          success: true,
          work_order: workOrder,
          work_order_number: work_order_number,
          attempts: attempt,
          timestamp: new Date().toISOString()
        });

      } catch (attemptError) {
        lastError = attemptError;
        console.error(`Attempt ${attempt} failed:`, attemptError.message);
        
        // If it's the last attempt, give up
        if (attempt >= MAX_ATTEMPTS) {
          break;
        }
        
        // Otherwise retry (brief delay to allow DB propagation)
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Exceeded max attempts
    return Response.json({ 
      error: 'WO_NUMBER_ALLOCATION_FAILED',
      message: `Unable to create WorkOrder after ${MAX_ATTEMPTS} attempts`,
      last_error: lastError?.message
    }, { status: 500 });

  } catch (error) {
    console.error('Error in createWorkOrderWithNumber:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});