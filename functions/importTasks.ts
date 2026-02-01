import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { data, mapping, config } = body;

    console.log('[IMPORT_TASKS] Request received:', {
      rows: data?.length || 0,
      mappedFields: Object.keys(mapping || {}).length,
      importMode: config?.importMode,
      config
    });

    // Validation
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('[IMPORT_TASKS] No data provided');
      return Response.json({ error: 'No data to import' }, { status: 400 });
    }

    if (!mapping || Object.keys(mapping).length === 0) {
      console.error('[IMPORT_TASKS] No field mapping provided');
      return Response.json({ error: 'No field mapping provided' }, { status: 400 });
    }

    console.log('[IMPORT_TASKS] Full Mapping:', mapping);
    console.log('[IMPORT_TASKS] Sample row:', data[0]);
    console.log('[IMPORT_TASKS] Sample row keys:', Object.keys(data[0] || {}));

    // Create reverse mapping (Excel header -> system field)
    const reverseMapping = {};
    for (const [excelCol, systemField] of Object.entries(mapping)) {
      reverseMapping[systemField] = excelCol;
    }

    const createdCustomers = [];
    const createdBoats = [];
    const createdJobs = [];
    const createdTasks = [];
    const errors = [];
    const customerMap = {}; // Map customer names to IDs
    const boatMap = {}; // Map boat names to IDs

    // Step 1: Create/find customers and boats
    const uniqueCustomers = new Set();
    const uniqueBoats = new Set();
    
    for (const row of data) {
      const customerName = row[reverseMapping.customerName];
      if (customerName) uniqueCustomers.add(customerName);
      const boatName = row[reverseMapping['Boat Type / Yacht Model']] || `${customerName}'s Boat`;
      if (boatName) uniqueBoats.add(boatName);
    }

    // Create customers
    for (const customerName of uniqueCustomers) {
      try {
        const existingCustomer = await base44.entities.Customer.filter({ last_name: customerName });
        if (existingCustomer.length > 0) {
          customerMap[customerName] = existingCustomer[0].id;
        } else {
          const newCustomer = await base44.entities.Customer.create({
            last_name: customerName,
            email: `${customerName.toLowerCase().replace(/\s+/g, '.')}@imported.local`
          });
          customerMap[customerName] = newCustomer.id;
          createdCustomers.push(newCustomer);
        }
      } catch (err) {
        errors.push(`Failed to create customer "${customerName}": ${err.message}`);
      }
    }

    // Create boats
    for (const boatName of uniqueBoats) {
      try {
        const existingBoat = await base44.entities.Boat.filter({ vessel_name: boatName });
        if (existingBoat.length > 0) {
          boatMap[boatName] = existingBoat[0].id;
        } else {
          // Find first customer to attach to boat
          const firstCustomerId = Object.values(customerMap)[0];
          if (firstCustomerId) {
            const newBoat = await base44.entities.Boat.create({
              customer_id: firstCustomerId,
              vessel_name: boatName
            });
            boatMap[boatName] = newBoat.id;
            createdBoats.push(newBoat);
          }
        }
      } catch (err) {
        errors.push(`Failed to create boat "${boatName}": ${err.message}`);
      }
    }

    // Step 2: Create jobs and work orders
    const jobsByCustomer = {};
    const jobsByServiceArea = {}; // For service area mode: customer_serviceArea -> job_id
    const workOrdersByCustomer = {};
    const workOrdersByServiceArea = {}; // For service area mode

    console.log('[IMPORT_TASKS] Starting job/task creation');
    console.log('[IMPORT_TASKS] Reverse mapping:', reverseMapping);
    console.log('[IMPORT_TASKS] Service area field mapped to:', reverseMapping.serviceArea);

    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      try {
        const row = data[rowIdx];
        const customerName = row[reverseMapping.customerName];
        const taskTitle = row[reverseMapping.taskTitle] || row[reverseMapping.taskId];
        const taskDescription = row[reverseMapping.taskDescription];
        
        // Find service area column - search mapping like validation engine does
        let serviceAreaCol = null;
        const serviceAreaEntry = Object.entries(mapping).find(([_, v]) => v === 'serviceArea' || v === 'service_category');
        if (serviceAreaEntry) {
          serviceAreaCol = serviceAreaEntry[0];
        }
        const serviceArea = serviceAreaCol ? row[serviceAreaCol] : undefined;

        console.log(`[IMPORT_TASKS] Row ${rowIdx + 1} Details:`, {
          customerName,
          taskTitle,
          serviceArea,
          serviceAreaCol,
          allMappingEntries: Object.entries(mapping).map(([k, v]) => `${k}->${v}`),
          customerMapped: !!customerMap[customerName],
          importMode: config?.importMode
        });

        if (!customerName) {
          errors.push(`Row ${rowIdx + 1}: Missing customer name`);
          continue;
        }

        if (!taskTitle) {
          errors.push(`Row ${rowIdx + 1}: Missing task title`);
          continue;
        }

        if (!customerMap[customerName]) {
          errors.push(`Row ${rowIdx + 1}: Customer "${customerName}" not found in customerMap`);
          continue;
        }

        let jobId;

        if (config?.importMode === 'work-orders-by-service-area') {
          // Create a separate JOB for each service area per customer
          const jobKey = `${customerName}_${serviceArea}`;
          console.log(`[IMPORT_TASKS] Service area mode - jobKey: ${jobKey}, exists: ${!!jobsByServiceArea[jobKey]}`);
          if (!jobsByServiceArea[jobKey]) {
            try {
              const jobTitle = `${serviceArea || 'Uncategorized'} - ${customerName}`;
              const boatId = Object.values(boatMap)[0];
              
              console.log(`[IMPORT_TASKS] Creating job for service area ${serviceArea}:`, {
                customerId: customerMap[customerName],
                boatId
              });

              const newJob = await base44.entities.Job.create({
                customer_id: customerMap[customerName],
                boat_id: boatId,
                title: jobTitle,
                description: `Service Area: ${serviceArea || 'Uncategorized'}`,
                status: config?.defaultJobStatus || 'New',
                intake_date: new Date().toISOString()
              });
              jobsByServiceArea[jobKey] = newJob.id;
              createdJobs.push(newJob);
              console.log(`[IMPORT_TASKS] Created job for service area: ${newJob.id}`);
            } catch (err) {
              errors.push(`Failed to create job for service area "${serviceArea}": ${err.message}`);
              console.error(`[IMPORT_TASKS] Job creation failed:`, err);
              continue;
            }
          }
          jobId = jobsByServiceArea[jobKey];
        } else {
          // Original behavior: one job per customer
          if (!jobsByCustomer[customerName]) {
            try {
              const jobTitle = row[reverseMapping.projectName] || `${customerName} - Imported Tasks`;
              const boatId = Object.values(boatMap)[0];
              
              console.log(`[IMPORT_TASKS] Creating job for ${customerName}:`, {
                customerId: customerMap[customerName],
                boatId
              });

              const newJob = await base44.entities.Job.create({
                customer_id: customerMap[customerName],
                boat_id: boatId,
                title: jobTitle,
                description: 'Imported from task list',
                status: config?.defaultJobStatus || 'New',
                intake_date: new Date().toISOString()
              });
              jobsByCustomer[customerName] = newJob.id;
              createdJobs.push(newJob);
              console.log(`[IMPORT_TASKS] Created job: ${newJob.id}`);
            } catch (err) {
              errors.push(`Failed to create job for customer "${customerName}": ${err.message}`);
              console.error(`[IMPORT_TASKS] Job creation failed:`, err);
              continue;
            }
          }
          jobId = jobsByCustomer[customerName];
        }

        // Get or create work order based on import mode
        let workOrderId;
        
        if (config?.importMode === 'work-orders-by-service-area') {
          // Create a work order per service area (one WO per service area job)
          const workOrderKey = `${customerName}_${serviceArea}`;
          if (!workOrdersByServiceArea[workOrderKey]) {
            try {
              const woTitle = `${serviceArea || 'Uncategorized'} - ${customerName}`;
              const scheduledDate = config?.workOrderScheduledDate || new Date().toISOString().split('T')[0];
              
              console.log(`[IMPORT_TASKS] Creating work order for service area ${serviceArea}:`, {
                jobId,
                scheduledDate
              });

              const newWorkOrder = await base44.entities.WorkOrder.create({
                job_id: jobId,
                title: woTitle,
                description: `Service Area: ${serviceArea || 'Uncategorized'}`,
                scheduled_date: scheduledDate,
                status: 'Draft'
              });
              workOrdersByServiceArea[workOrderKey] = newWorkOrder.id;
              console.log(`[IMPORT_TASKS] Created work order by service area: ${newWorkOrder.id}`);
            } catch (err) {
              errors.push(`Failed to create work order for "${serviceArea}": ${err.message}`);
              console.error(`[IMPORT_TASKS] Work order creation failed:`, err);
              continue;
            }
          }
          workOrderId = workOrdersByServiceArea[workOrderKey];
        } else {
          // Original behavior: work order per customer
          if (!workOrdersByCustomer[customerName]) {
            try {
              const woTitle = `Work Order - ${customerName}`;
              const scheduledDate = config?.workOrderScheduledDate || new Date().toISOString().split('T')[0];
              
              console.log(`[IMPORT_TASKS] Creating work order for ${customerName}:`, {
                jobId,
                scheduledDate
              });

              const newWorkOrder = await base44.entities.WorkOrder.create({
                job_id: jobId,
                title: woTitle,
                description: 'Imported from task list',
                scheduled_date: scheduledDate,
                status: 'Draft'
              });
              workOrdersByCustomer[customerName] = newWorkOrder.id;
              console.log(`[IMPORT_TASKS] Created work order: ${newWorkOrder.id}`);
            } catch (err) {
              errors.push(`Failed to create work order for customer "${customerName}": ${err.message}`);
              console.error(`[IMPORT_TASKS] Work order creation failed:`, err);
              continue;
            }
          }
          workOrderId = workOrdersByCustomer[customerName];
        }

        // Create task linked to work order
        try {
          const estMinutes = (row[reverseMapping.estimatedHours] || 0) * 60;
          
          console.log(`[IMPORT_TASKS] Creating task: ${taskTitle}`, {
            workOrderId,
            estimatedMinutes: estMinutes
          });

          const newTask = await base44.entities.Task.create({
            work_order_id: workOrderId,
            title: taskTitle,
            description: taskDescription || '',
            status: 'Not Started',
            estimated_minutes: estMinutes
          });
          createdTasks.push(newTask);
          console.log(`[IMPORT_TASKS] Created task: ${newTask.id}`);
        } catch (err) {
          errors.push(`Row ${rowIdx + 1}: Failed to create task "${taskTitle}": ${err.message}`);
          console.error(`[IMPORT_TASKS] Task creation failed:`, err);
        }
      } catch (err) {
        errors.push(`Row ${rowIdx + 1}: ${err.message}`);
        console.error(`[IMPORT_TASKS] Row error:`, err);
      }
    }

    return Response.json({
      success: true,
      message: 'Import completed',
      importedCount: createdTasks.length,
      createdCustomers,
      createdBoats,
      createdJobs,
      createdTasks,
      errors
    });

  } catch (error) {
    console.error('[IMPORT_TASKS] Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    return Response.json({
      error: error.message || 'Import failed',
      details: error.stack
    }, { status: 500 });
  }
});