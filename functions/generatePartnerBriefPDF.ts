// PDF Template generation for Partner Brief
// Mirrors the same logic as generateOfferPDF.js but adapted for Partner Brief data

function buildPartnerBriefHTML(workOrder, teamOrder, job, customer, boat, location, tasks, technicians, template) {
  const margins = {
    top: template.margin_top_mm || 20,
    right: template.margin_right_mm || 20,
    bottom: template.margin_bottom_mm || 20,
    left: template.margin_left_mm || 20
  };

  const fontFamily = template.font_family || 'Arial';
  const fontSizeBody = template.font_size_body || 11;
  const fontSizeHeading = template.font_size_heading || 18;
  const fontSizeCompanyName = template.font_size_company_name || 20;
  const lineSpacing = template.line_spacing || 1.5;
  const paragraphSpacing = template.paragraph_spacing || 15;

  const assignedTechs = technicians.filter(t => workOrder.assigned_technicians?.includes(t.id));
  const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown';
  
  const costPolicies = [];
  if (teamOrder.accommodation_paid) {
    costPolicies.push(`<li>Accommodation: up to €${teamOrder.accommodation_max_per_night || 'TBD'}/night</li>`);
  }
  if (teamOrder.meals_per_diem_paid) {
    costPolicies.push(`<li>Per Diem: €${teamOrder.per_diem_rate_per_day || 'TBD'}/day</li>`);
  }
  if (teamOrder.mileage_paid) {
    costPolicies.push(`<li>Mileage: €${teamOrder.mileage_rate_per_km || '0.35'}/km (cap: €${teamOrder.mileage_cap_total || 'TBD'})</li>`);
  }
  if (teamOrder.travel_time_paid) {
    costPolicies.push(`<li>Travel Time: €${teamOrder.travel_time_rate_per_hour || 'TBD'}/hour</li>`);
  }

  const watermarkHTML = template.watermark_enabled
    ? `<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(${template.watermark_angle ?? -45}deg); font-size: 72pt; font-weight: bold; color: #ccc; opacity: ${template.watermark_opacity ?? 0.1}; pointer-events: none; white-space: nowrap; z-index: 0;">${template.watermark_text || 'DRAFT'}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Partner Brief - ${workOrder.work_order_number || workOrder.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { width: 100%; height: 100%; background: white; font-family: ${fontFamily}, sans-serif; font-size: ${fontSizeBody}pt; line-height: ${lineSpacing}; color: #333; }
    @page { size: A4; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
    .document { width: 100%; background: white; }
    .header { margin-bottom: ${paragraphSpacing}pt; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    .logo img { height: ${template.logo_height_mm || 20}mm; object-fit: contain; }
    .company-name { font-size: ${fontSizeCompanyName}pt; font-weight: bold; color: ${template.primary_color || '#2563eb'}; margin-bottom: 5px; }
    .company-details { font-size: ${fontSizeBody - 2}pt; color: #555; }
    .doc-type { font-size: ${fontSizeHeading}pt; color: ${template.primary_color || '#2563eb'}; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; }
    .meta-info { color: #999; font-size: ${fontSizeBody - 3}pt; margin-bottom: ${paragraphSpacing}pt; }
    .section-title { font-size: ${fontSizeBody + 2}pt; color: ${template.primary_color || '#2563eb'}; font-weight: bold; margin: ${paragraphSpacing}pt 0 ${paragraphSpacing / 2}pt 0; border-bottom: 2px solid ${template.primary_color || '#2563eb'}; padding-bottom: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: ${paragraphSpacing}pt; }
    .info-field { margin-bottom: 10px; }
    .info-label { font-size: ${fontSizeBody - 2}pt; color: #666; font-weight: bold; margin-bottom: 3px; }
    .info-value { font-size: ${fontSizeBody}pt; color: #333; }
    .section-content { margin-bottom: ${paragraphSpacing}pt; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; margin: ${paragraphSpacing / 2}pt 0; font-size: ${fontSizeBody - 1}pt; }
    thead { background-color: ${template.primary_color || '#2563eb'}; color: white; }
    th, td { padding: 8px 6px; border: 1px solid #ddd; text-align: left; }
    th { font-weight: bold; }
    tbody tr:nth-child(even) { background-color: #f9f9f9; }
    ul { margin-left: 20px; margin-top: 8px; }
    ul li { margin-bottom: 6px; }
    .notes-box { padding: 12px; background-color: #f5f5f5; border-left: 3px solid ${template.primary_color || '#2563eb'}; margin-bottom: ${paragraphSpacing}pt; white-space: pre-wrap; }
    .footer { margin-top: ${paragraphSpacing * 2}pt; padding-top: 15px; border-top: 1px solid ${template.primary_color || '#2563eb'}; font-size: ${fontSizeBody - 3}pt; color: #666; text-align: center; }
    .footer-graphic { max-width: 100%; height: ${template.footer_graphic_height_mm || 25}mm; margin-bottom: 12px; }
  </style>
</head>
<body>
  ${watermarkHTML}
  <div class="document">
    <div class="header">
      <div class="logo">${template.logo_url ? `<img src="${template.logo_url}" alt="Logo">` : ''}</div>
      <div class="company-info">
        <div class="company-name">${template.company_name || 'Alpha Yachting'}</div>
        <div class="company-details">
          ${template.company_address ? `<div>${template.company_address}</div>` : ''}
          ${template.company_vat ? `<div>VAT: ${template.company_vat}</div>` : ''}
        </div>
      </div>
    </div>

    <h1 class="doc-type">PARTNER BRIEFING</h1>
    <div class="meta-info">Generated: ${new Date().toLocaleString('de-DE')}</div>

    <h2 class="section-title">WORK ORDER INFORMATION</h2>
    <div class="info-grid">
      <div class="info-field">
        <div class="info-label">Work Order #</div>
        <div class="info-value">${workOrder.work_order_number || workOrder.id.slice(-6)}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Status</div>
        <div class="info-value">${workOrder.status}</div>
      </div>
    </div>
    <div class="info-field">
      <div class="info-label">Title</div>
      <div class="info-value">${workOrder.title}</div>
    </div>
    <div class="info-grid">
      <div class="info-field">
        <div class="info-label">Scheduled Date</div>
        <div class="info-value">${workOrder.scheduled_date ? formatDate(workOrder.scheduled_date) : 'TBD'}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Estimated Duration</div>
        <div class="info-value">${workOrder.estimated_duration_hours ? workOrder.estimated_duration_hours + 'h' : '-'}</div>
      </div>
    </div>

    <h2 class="section-title">CUSTOMER & VESSEL</h2>
    <div class="info-grid">
      <div class="info-field">
        <div class="info-label">Customer</div>
        <div class="info-value">${customerName}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Vessel</div>
        <div class="info-value">${boat?.vessel_name || 'Unknown'}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Type</div>
        <div class="info-value">${boat?.vessel_type || '-'}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Length</div>
        <div class="info-value">${boat?.length_m ? boat.length_m + 'm' : '-'}</div>
      </div>
    </div>

    <h2 class="section-title">LOCATION & ACCESS</h2>
    <div class="info-grid">
      <div class="info-field">
        <div class="info-label">Location</div>
        <div class="info-value">${location?.name || 'Unknown'}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Address</div>
        <div class="info-value">${location?.address || '-'}</div>
      </div>
    </div>
    ${location?.access_notes ? `<div class="info-field">
      <div class="info-label">Access Notes</div>
      <div class="info-value">${location.access_notes}</div>
    </div>` : ''}

    ${workOrder.description ? `<h2 class="section-title">WORK DESCRIPTION</h2>
    <div class="section-content">${workOrder.description}</div>` : ''}

    ${tasks.length > 0 ? `<h2 class="section-title">TASKS & CHECKLIST</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 8%; text-align: center;">#</th>
          <th style="width: 70%;">Task</th>
          <th style="width: 22%; text-align: right;">Est. Time</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map((t, idx) => `<tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${t.title}${t.description ? `<div style="font-size: ${fontSizeBody - 2}pt; color: #666; margin-top: 3px;">${t.description}</div>` : ''}</td>
          <td style="text-align: right;">${t.estimated_minutes ? Math.round(t.estimated_minutes / 60) + 'h' : '-'}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}

    <h2 class="section-title">COST COVERAGE & BUDGET</h2>
    <table>
      <thead>
        <tr>
          <th>Budget Category</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Total Approved Budget</td><td style="text-align: right;">€${(teamOrder.approved_budget_total || 0).toFixed(2)}</td></tr>
        <tr><td>Labor</td><td style="text-align: right;">€${(teamOrder.labor_budget || 0).toFixed(2)}</td></tr>
        <tr><td>Travel</td><td style="text-align: right;">€${(teamOrder.travel_budget || 0).toFixed(2)}</td></tr>
        <tr><td>Accommodation</td><td style="text-align: right;">€${(teamOrder.accommodation_budget || 0).toFixed(2)}</td></tr>
        <tr><td>Per Diem</td><td style="text-align: right;">€${(teamOrder.per_diem_budget || 0).toFixed(2)}</td></tr>
      </tbody>
    </table>

    ${costPolicies.length > 0 ? `<h2 class="section-title">COVERED COSTS</h2>
    <ul>${costPolicies.join('')}${teamOrder.other_reimbursables_allowed ? '<li>Other reimbursables allowed (pre-approval required)</li>' : ''}</ul>` : ''}

    ${teamOrder.requires_preapproval_over > 0 || teamOrder.budget_exceed_requires_approval ? `<h2 class="section-title">APPROVAL REQUIREMENTS</h2>
    <ul>
      ${teamOrder.requires_preapproval_over > 0 ? `<li>Purchases over €${teamOrder.requires_preapproval_over} require pre-approval</li>` : ''}
      ${teamOrder.budget_exceed_requires_approval ? '<li>Budget overages require approval before proceeding</li>' : ''}
    </ul>` : ''}

    ${assignedTechs.length > 0 ? `<h2 class="section-title">ASSIGNED TEAM</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
        ${assignedTechs.map(t => `<tr>
          <td>${t.first_name} ${t.last_name}</td>
          <td>${t.phone || '-'}</td>
          <td style="font-size: ${fontSizeBody - 2}pt;">${t.email || '-'}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}

    ${teamOrder.partner_notes ? `<h2 class="section-title">SPECIAL NOTES</h2>
    <div class="notes-box">${teamOrder.partner_notes}</div>` : ''}

    ${workOrder.safety_notes ? `<h2 class="section-title">SAFETY NOTES</h2>
    <div class="notes-box" style="background-color: #fff3cd; border-left-color: #ffc107;">${workOrder.safety_notes}</div>` : ''}

    <div class="footer">
      ${template.footer_graphic_url ? `<img src="${template.footer_graphic_url}" alt="Footer" class="footer-graphic">` : ''}
      <div>${template.company_name || 'Alpha Yachting'} | This briefing is confidential and intended for the assigned partner.</div>
      ${template.footer_text ? `<div style="margin-top: 8px;">${template.footer_text}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

Deno.serve(async (req) => {
  const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.6');
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const workOrderId = body.workOrderId;
    const teamOrderId = body.teamOrderId;
    const templateData = body.templateData;
    
    if (!workOrderId || !teamOrderId) {
      return Response.json({ 
        success: false, 
        error: 'Missing workOrderId or teamOrderId',
        received: body
      }, { status: 400 });
    }

    const [workOrders, teamOrders, jobs, customers, boats, locations, tasks, technicians] = await Promise.all([
      base44.entities.WorkOrder.filter({ id: workOrderId }),
      base44.entities.TeamOrder.filter({ id: teamOrderId }),
      base44.entities.Job.list(),
      base44.entities.Customer.list(),
      base44.entities.Boat.list(),
      base44.entities.Location.list(),
      base44.entities.Task.filter({ work_order_id: workOrderId }),
      base44.entities.Technician.list()
    ]);

    if (workOrders.length === 0 || teamOrders.length === 0) {
      return Response.json({ 
        success: false,
        error: 'Work order or team order not found',
        workOrderFound: workOrders.length > 0,
        teamOrderFound: teamOrders.length > 0
      }, { status: 404 });
    }

    const workOrder = workOrders[0];
    const teamOrder = teamOrders[0];
    const job = jobs.find(j => j.id === workOrder.job_id);
    const customer = customers.find(c => c.id === job?.customer_id);
    const boat = boats.find(b => b.id === job?.boat_id);
    const location = locations.find(l => l.id === job?.location_id);

    const html = buildPartnerBriefHTML(workOrder, teamOrder, job, customer, boat, location, tasks, technicians, templateData);
    
    return Response.json({
      success: true,
      html: html,
      fileName: `partner-brief-${workOrder.work_order_number || workOrderId}.pdf`
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: `Server error: ${error.message}`,
      stack: error.stack
    }, { status: 500 });
  }
});