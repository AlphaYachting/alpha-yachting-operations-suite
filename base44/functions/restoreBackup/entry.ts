import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { backup_url, mode } = await req.json();

    // Fetch backup file
    const response = await fetch(backup_url);
    const backup = await response.json();

    const results = {
      mode,
      restored: {},
      errors: []
    };

    // Restore each entity
    for (const [entityName, records] of Object.entries(backup.entities)) {
      if (!Array.isArray(records)) {
        results.errors.push(`${entityName}: Invalid data format`);
        continue;
      }

      try {
        if (mode === 'replace') {
          // Delete all existing records
          const existing = await base44.asServiceRole.entities[entityName].list();
          for (const record of existing) {
            await base44.asServiceRole.entities[entityName].delete(record.id);
          }
        }

        // Create records from backup
        let created = 0;
        for (const record of records) {
          try {
            // Remove system fields
            const { id, created_date, updated_date, created_by, created_by_id, ...data } = record;
            await base44.asServiceRole.entities[entityName].create(data);
            created++;
          } catch (error) {
            results.errors.push(`${entityName} record: ${error.message}`);
          }
        }

        results.restored[entityName] = created;

      } catch (error) {
        results.errors.push(`${entityName}: ${error.message}`);
      }
    }

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});