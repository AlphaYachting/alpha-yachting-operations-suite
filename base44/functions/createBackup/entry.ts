import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { entities } = await req.json();

    const backup = {
      created_at: new Date().toISOString(),
      created_by: user.email,
      version: '1.0',
      entities: {}
    };

    // Export each entity - get ALL records without limit
    for (const entityName of entities) {
      try {
        // Use filter with empty query to get all records, explicitly request large limit
        const data = await base44.asServiceRole.entities[entityName].filter({}, null, 10000);
        backup.entities[entityName] = data;
        console.log(`Backed up ${entityName}: ${data.length} records`);
      } catch (error) {
        console.error(`Error backing up ${entityName}:`, error.message);
        backup.entities[entityName] = { error: error.message };
      }
    }

    // Create backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupJson = JSON.stringify(backup, null, 2);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const file = new File([blob], `database-backup-${timestamp}.json`, { type: 'application/json' });

    // Upload to storage
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    return Response.json({
      success: true,
      backup_url: file_url,
      entity_count: Object.keys(backup.entities).length,
      total_records: Object.values(backup.entities).reduce((sum, data) => 
        sum + (Array.isArray(data) ? data.length : 0), 0
      )
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});