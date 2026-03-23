import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { lead_id, assigned_user_email } = await req.json();

        if (!lead_id || !assigned_user_email) {
            return Response.json({ error: 'Missing lead_id or assigned_user_email' }, { status: 400 });
        }

        const lead = await base44.asServiceRole.entities.Lead.get(lead_id);
        if (!lead) {
            return Response.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Use APP_DOMAIN secret for the correct production URL
        const appDomain = Deno.env.get('APP_DOMAIN') || 'https://app26.base44.app';
        const leadUrl = `${appDomain}/LeadDetail?id=${lead_id}`;

        const leadIdentifier = lead.name || 'Unbekannter Lead';
        const leadDetails = lead.boat_name ? ` (${lead.boat_name})` : '';

        await base44.asServiceRole.integrations.Core.SendEmail({
            to: assigned_user_email,
            subject: `[Alpha Yachting] Neuer Lead zugewiesen: ${leadIdentifier}`,
            body: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 10px;">
                        Neuer Lead wurde Ihnen zugewiesen
                    </h2>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 6px 0;"><strong>Lead:</strong> ${leadIdentifier}${leadDetails}</p>
                        <p style="margin: 6px 0;"><strong>Anfrageart:</strong> ${lead.inquiry_type || 'Nicht angegeben'}</p>
                        <p style="margin: 6px 0;"><strong>Priorität:</strong> ${lead.priority || 'Medium'}</p>
                        <p style="margin: 6px 0;"><strong>Status:</strong> ${lead.status || 'Pending'}</p>
                        ${lead.phone ? `<p style="margin: 6px 0;"><strong>Telefon:</strong> ${lead.phone}</p>` : ''}
                        ${lead.email ? `<p style="margin: 6px 0;"><strong>E-Mail:</strong> ${lead.email}</p>` : ''}
                        ${lead.location ? `<p style="margin: 6px 0;"><strong>Standort:</strong> ${lead.location}</p>` : ''}
                        ${lead.notes ? `<p style="margin: 6px 0;"><strong>Notizen:</strong> ${lead.notes}</p>` : ''}
                    </div>
                    <p style="margin-top: 25px; text-align: center;">
                        <a href="${leadUrl}"
                           style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">
                            → Lead Details öffnen
                        </a>
                    </p>
                    <p style="margin-top: 15px; font-size: 12px; color: #999; text-align: center;">
                        Bitte melden Sie sich zuerst in der App an, falls Sie noch nicht eingeloggt sind.<br>
                        Direktlink: <a href="${leadUrl}" style="color: #2563eb;">${leadUrl}</a>
                    </p>
                    <p style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
                        Automatische Benachrichtigung von Alpha Yachting Service Management.
                    </p>
                </div>
            `
        });

        // Also create in-app notification
        await base44.asServiceRole.entities.Notification.create({
            user_email: assigned_user_email,
            type: 'work_order_assignment',
            title: 'Neuer Lead zugewiesen',
            message: `Lead "${leadIdentifier}${leadDetails}" wurde Ihnen zugewiesen`,
            related_work_order_id: null,
            related_task_id: null,
            is_read: false,
            email_sent: true
        });

        return Response.json({ success: true });

    } catch (error) {
        console.error('Error in notifyLeadAssignment:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});