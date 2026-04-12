import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    if (event?.type !== 'update' || !data || !old_data) {
      return Response.json({ success: false, reason: 'Not an update event' });
    }

    // Only proceed if scheduled_date actually changed
    if (data.scheduled_date === old_data.scheduled_date) {
      return Response.json({ success: true, message: 'Date unchanged, no notification' });
    }

    const oldDate = old_data.scheduled_date || 'not set';
    const newDate = data.scheduled_date || 'not set';

    const formatDate = (d) => {
      if (!d || d === 'not set') return 'nicht gesetzt';
      return new Date(d).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Fetch job, boat, location for context
    const job = data.job_id
      ? await base44.asServiceRole.entities.Job.get(data.job_id).catch(() => null)
      : null;
    const boat = job?.boat_id
      ? await base44.asServiceRole.entities.Boat.get(job.boat_id).catch(() => null)
      : null;
    const location = (data.location_id || job?.location_id)
      ? await base44.asServiceRole.entities.Location.get(data.location_id || job.location_id).catch(() => null)
      : null;

    // Get all technician IDs to notify
    const techIds = [...new Set([
      ...(data.assigned_technicians || []),
      data.lead_technician_id
    ].filter(Boolean))];

    if (techIds.length === 0) {
      return Response.json({ success: true, message: 'No technicians assigned' });
    }

    const technicians = await Promise.all(
      techIds.map(id => base44.asServiceRole.entities.Technician.get(id).catch(() => null))
    );
    const validTechs = technicians.filter(t => t?.email);

    if (validTechs.length === 0) {
      return Response.json({ success: true, message: 'No technician emails found' });
    }

    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://app26.base44.app';
    const woUrl = `${appDomain}/WorkOrderDetail?id=${event?.entity_id || data.id}`;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_ADDRESS = Deno.env.get('CUSTOM_EMAIL_FROM') || 'info@alpha-yachting.hr';
    const FROM_NAME = Deno.env.get('EMAIL_ENGINE_FROM_NAME') || 'Alpha Yachting';

    const emailBody = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d97706; border-bottom: 2px solid #fde68a; padding-bottom: 10px;">
          ⚠️ Terminänderung – Work Order
        </h2>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 6px 0;"><strong>Work Order:</strong> ${data.title}</p>
          ${boat ? `<p style="margin: 6px 0;"><strong>Boot / Schiff:</strong> ${boat.vessel_name}${boat.manufacturer ? ' (' + boat.manufacturer + (boat.model ? ' ' + boat.model : '') + ')' : ''}</p>` : ''}
          ${job ? `<p style="margin: 6px 0;"><strong>Projekt:</strong> ${job.title}</p>` : ''}
          ${location ? `<p style="margin: 6px 0;"><strong>Ort:</strong> ${location.name}</p>` : ''}
          <p style="margin: 6px 0;"><strong>Alter Termin:</strong> <span style="color: #dc2626;">${formatDate(oldDate)}</span></p>
          <p style="margin: 6px 0;"><strong>Neuer Termin:</strong> <span style="color: #16a34a; font-weight: bold;">${formatDate(newDate)}</span></p>
        </div>
        <p style="margin-top: 25px; text-align: center;">
          <a href="${woUrl}"
             style="background-color: #d97706; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">
            → Work Order öffnen
          </a>
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
          Automatische Benachrichtigung von Alpha Yachting Service Management.
        </p>
      </div>
    `;

    const results = [];
    for (const tech of validTechs) {
      // In-app notification
      const contextParts = [boat?.vessel_name, job?.title, location?.name].filter(Boolean);
      const contextStr = contextParts.length ? ` | ${contextParts.join(' · ')}` : '';
      await base44.asServiceRole.entities.Notification.create({
        user_email: tech.email,
        type: 'work_order_assignment',
        title: 'Terminänderung',
        message: `Work Order "${data.title}"${contextStr} – verschoben auf ${formatDate(newDate)} (war: ${formatDate(oldDate)})`,
        related_work_order_id: data.id,
        is_read: false,
        email_sent: false
      });

      // Email via Resend
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_ADDRESS}>`,
            to: [tech.email],
            subject: `[Terminänderung] ${data.title}`,
            html: emailBody
          })
        });
        results.push({ email: tech.email, sent: true });
      } catch (e) {
        results.push({ email: tech.email, sent: false, error: e.message });
      }
    }

    return Response.json({ success: true, notifications_sent: results.length, results });

  } catch (error) {
    console.error('Error in notifyScheduleDateChange:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});