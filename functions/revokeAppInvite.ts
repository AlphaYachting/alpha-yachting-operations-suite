import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { invite_id } = await req.json();

    if (!invite_id) {
      return Response.json({ error: 'invite_id is required' }, { status: 400 });
    }

    // Update invite status to REVOKED
    await base44.asServiceRole.entities.AppInvite.update(invite_id, {
      status: 'REVOKED'
    });

    return Response.json({ 
      success: true,
      message: 'Invite revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking invite:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});