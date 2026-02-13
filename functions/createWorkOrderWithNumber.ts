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

    const MAX_ATTEMPTS = 10;
    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_ATTEMPTS) {
      attempt++;

      try {
        // STEP 1: Allocate candidate number
        const allocationResponse = await base44.functions.invoke('allocateWorkOrderNumber', {});
        const { work_order_number } = allocationResponse.data;

        if (!work_order_number) {
          throw new Error('Allocation returned no work_order_number');
        }

        // STEP 2: Create deterministic lock record
        const lockId = `workorder_number:${work_order_number}`;
        
        try {
          // Attempt to create lock with deterministic ID
          await base44.asServiceRole.entities.WorkOrderNumberLock.create({
            id: lockId,
            work_order_number: work_order_number,
            expires_at: new Date(Date.now() + 300000).toISOString(), // 5 min expiry
            notes: `Allocated by ${user.email} on attempt ${attempt}`
          });
        } catch (lockError) {
          // Lock already exists (collision) - retry with next number
          console.warn(`Lock collision for ${work_order_number}, retrying... (attempt ${attempt})`);
          continue;
        }

        // STEP 3: Create WorkOrder immediately after lock acquired
        try {
          const workOrder = await base44.entities.WorkOrder.create({
            ...workOrderData,
            work_order_number: work_order_number
          });

          return Response.json({
            success: true,
            work_order: workOrder,
            lock_id: lockId,
            attempts: attempt,
            timestamp: new Date().toISOString()
          });

        } catch (createError) {
          // WorkOrder creation failed after lock - keep lock as audit trail
          await base44.asServiceRole.entities.WorkOrderNumberLock.update(lockId, {
            notes: `Lock acquired but WO creation failed: ${createError.message}`
          });
          
          return Response.json({ 
            error: 'WorkOrder creation failed after lock acquired',
            details: createError.message,
            lock_id: lockId
          }, { status: 500 });
        }

      } catch (attemptError) {
        lastError = attemptError;
        console.error(`Attempt ${attempt} failed:`, attemptError.message);
        // Continue to next attempt
      }
    }

    // Exceeded max attempts
    return Response.json({ 
      error: 'WO_NUMBER_ALLOCATION_FAILED',
      message: `Unable to allocate unique WorkOrder number after ${MAX_ATTEMPTS} attempts`,
      last_error: lastError?.message
    }, { status: 500 });

  } catch (error) {
    console.error('Error in createWorkOrderWithNumber:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});