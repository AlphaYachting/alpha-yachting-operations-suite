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
      config: config?.importMode || 'unknown'
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

    console.log('[IMPORT_TASKS] Mapping:', mapping);
    console.log('[IMPORT_TASKS] Sample row:', data[0]);

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
    const workOrdersByCustomer = {};

    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      try {
        const row = data[rowIdx];
        const customerName = row[reverseMapping.customerName];
        const taskTitle = row[reverseMapping.taskId];
        const taskDescription = row[reverseMapping.taskDescription];
        const serviceArea = row[reverseMapping.serviceArea];

        if (!customerName || !taskTitle) {
          errors.push(`Row ${rowIdx + 1}: Missing customer name or task title`);
          continue;
        }

        // Get or create job for customer
        if (!jobsByCustomer[customerName]) {
          try {
            const jobTitle = row[reverseMapping.projectName] || `${customerName} - Imported Tasks`;
            const newJob = await base44.entities.Job.create({
              customer_id: customerMap[customerName],
              boat_id: Object.values(boatMap)[0],
              title: jobTitle,
              description: serviceArea || 'Imported from task list',
              status: config?.defaultJobStatus || 'New',
              intake_date: new Date().toISOString()
            });
            jobsByCustomer[customerName] = newJob.id;
            createdJobs.push(newJob);
          } catch (err) {
            errors.push(`Failed to create job for customer "${customerName}": ${err.message}`);
            continue;
          }
        }

        // Get or create work order for customer
        if (!workOrdersByCustomer[customerName]) {
          try {
            const woTitle = `Work Order - ${customerName}`;
            const newWorkOrder = await base44.entities.WorkOrder.create({
              job_id: jobsByCustomer[customerName],
              title: woTitle,
              description: 'Imported from task list',
              scheduled_date: config?.workOrderScheduledDate || new Date().toISOString().split('T')[0],
              status: config?.defaultWorkOrderStatus || 'Draft'
            });
            workOrdersByCustomer[customerName] = newWorkOrder.id;
          } catch (err) {
            errors.push(`Failed to create work order for customer "${customerName}": ${err.message}`);
            continue;
          }
        }

        // Create task linked to work order
        try {
          const newTask = await base44.entities.Task.create({
            work_order_id: workOrdersByCustomer[customerName],
            title: taskTitle,
            description: taskDescription || '',
            status: config?.defaultTaskStatus || 'Not Started',
            estimated_minutes: (row[reverseMapping['Time Required (hrs)']] || 0) * 60
          });
          createdTasks.push(newTask);
        } catch (err) {
          errors.push(`Row ${rowIdx + 1}: Failed to create task "${taskTitle}": ${err.message}`);
        }
      } catch (err) {
        errors.push(`Row ${rowIdx + 1}: ${err.message}`);
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