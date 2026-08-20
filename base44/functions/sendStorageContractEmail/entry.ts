import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { repair_order_id } = await req.json();
    if (!repair_order_id) return Response.json({ error: 'repair_order_id fehlt' }, { status: 400 });

    const order = await base44.entities.RepairOrder.get(repair_order_id);
    if (!order) return Response.json({ error: 'Einlagerungsvertrag nicht gefunden' }, { status: 404 });
    if (!order.customer_email) return Response.json({ error: 'Keine E-Mail-Adresse beim Kunden hinterlegt' }, { status: 400 });
    if (!order.contract_pdf_url) return Response.json({ error: 'Vertrag ist noch nicht gespeichert' }, { status: 400 });

    const boatLabel = [order.boat_name, order.boat_type_model].filter(Boolean).join(' – ') || 'Ihr Boot';
    const subject = `Einlagerungsvertrag ${order.order_number ? order.order_number + ' ' : ''}– ${boatLabel}`;

    const period = [order.storage_start_date, order.storage_end_date].filter(Boolean).join(' bis ');

    const body = [
      `Sehr geehrte Damen und Herren,`,
      ``,
      `im Anhang bzw. über den untenstehenden Link erhalten Sie den Einlagerungsvertrag für ${boatLabel}.`,
      period ? `Vereinbarter Lagerzeitraum: ${period}.` : null,
      order.storage_location ? `Lagerort: ${order.storage_location}.` : null,
      order.storage_price != null && order.storage_price !== ''
        ? `Vereinbarter Preis: ${order.storage_price} EUR${order.storage_billing_type ? ' (' + order.storage_billing_type + ')' : ''}.`
        : null,
      ``,
      `Bitte prüfen Sie den Vertrag, unterzeichnen Sie ihn und senden Sie uns ein unterschriebenes Exemplar zurück. Für Rückfragen oder Anpassungen stehen wir Ihnen gerne zur Verfügung.`,
      ``,
      `Vertrag als PDF: ${order.contract_pdf_url}`,
      ``,
      `Mit freundlichen Grüßen`,
      `Alpha Yachting`,
      `AQS GROUP d.o.o., Bužinija 32A, 52466 Novigrad, Kroatien`
    ].filter((l) => l !== null).join('\n');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: order.customer_email,
      subject,
      body,
      from_name: 'Alpha Yachting'
    });

    await base44.entities.RepairOrder.update(repair_order_id, {
      contract_sent_at: new Date().toISOString()
    });

    return Response.json({ success: true, to: order.customer_email, subject });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});