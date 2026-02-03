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

    // Export each entity
    for (const entityName of entities) {
      try {
        const data = await base44.asServiceRole.entities[entityName].list();
        backup.entities[entityName] = data;
      } catch (error) {
        console.error(`Error backing up ${entityName}:`, error.message);
        backup.entities[entityName] = { error: error.message };
      }
    }

    // Create backup file
    const backupJson = JSON.stringify(backup, null, 2);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const file = new File([blob], `backup-${Date.now()}.json`, { type: 'application/json' });

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