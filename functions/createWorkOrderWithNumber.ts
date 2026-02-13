import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
        // Allocate candidate number
        const allocationResponse = await base44.functions.invoke('allocateWorkOrderNumber', {});
        const { work_order_number } = allocationResponse.data;

        if (!work_order_number) {
          throw new Error('Allocation returned no work_order_number');
        }

        // Immediately create WorkOrder with allocated number
        const workOrder = await base44.entities.WorkOrder.create({
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