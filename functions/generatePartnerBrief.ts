function buildPartnerBriefHTML(workOrder, teamOrder, job, customer, boat, location, tasks, technicians, template) {
  const margins = {
    top: template?.margin_top_mm || 20,
    right: template?.margin_right_mm || 20,
    bottom: template?.margin_bottom_mm || 20,
    left: template?.margin_left_mm || 20
  };

  const fontFamily = template?.font_family || 'Arial';
  const fontSizeBody = template?.font_size_body || 11;
  const fontSizeHeading = template?.font_size_heading || 18;
  const fontSizeCompanyName = template?.font_size_company_name || 20;
  const lineSpacing = template?.line_spacing || 1.5;
  const paragraphSpacing = template?.paragraph_spacing || 15;
  const primaryColor = template?.primary_color || '#2563eb';
  const letterheadBg = template?.letterhead_enabled && template?.letterhead_url 
    ? `url('${template.letterhead_url}')` 
    : 'none';
  
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

  const watermarkHTML = template?.watermark_enabled
    ? `<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(${template.watermark_angle ?? -45}deg); font-size: 72pt; font-weight: bold; color: rgba(0,0,0,${template.watermark_opacity ?? 0.1}); pointer-events: none; white-space: nowrap; z-index: 0;">${template.watermark_text || 'DRAFT'}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { width: 100%; height: 100%; background: white; font-family: ${fontFamily}, sans-serif; font-size: ${fontSizeBody}pt; line-height: 1.5; color: #333; }
    @page { size: A4; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
    .document { 
      width: 100%; 
      background: white;
      background-image: ${letterheadBg};
      background-size: cover;
      background-attachment: fixed;
    }
    .header { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    .logo img { height: ${template?.logo_height_mm || 20}mm; object-fit: contain; }
    .company-name { font-size: ${fontSizeCompanyName}pt; font-weight: bold; color: ${primaryColor}; margin-bottom: 5px; }
    .company-details { font-size: ${fontSizeBody - 2}pt; color: #555; }
    h1 { color: ${primaryColor}; font-size: ${fontSizeHeading}pt; margin: 20px 0 10px 0; border-bottom: 2px solid ${primaryColor}; padding-bottom: 6px; }
    h2 { color: ${primaryColor}; font-size: 12pt; margin: 15px 0 8px 0; border-bottom: 1px solid ${primaryColor}; padding-bottom: 4px; }
    .section { margin-bottom: 12px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px; }
    .field { margin-bottom: 6px; }
    .label { font-weight: bold; color: ${primaryColor}; font-size: 8pt; }
    .value { font-size: ${fontSizeBody}pt; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9pt; page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    th, td { padding: 6px; border: 1px solid #ddd; text-align: left; }
    th { background-color: ${primaryColor}; color: white; font-weight: bold; }
    tbody tr:nth-child(even) { background-color: #f9f9f9; }
    ul { margin-left: 20px; margin-top: 5px; font-size: ${fontSizeBody}pt; }
    .meta { color: #999; font-size: 8pt; margin-bottom: 15px; }
    h2 { page-break-after: avoid; }
    .section { page-break-inside: avoid; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 8pt; color: #666; text-align: center; page-break-inside: avoid; }
  </style>
</head>
<body>
  ${watermarkHTML}
  <div class="document">
    <div class="header">
      ${template?.logo_url ? `<div class="logo"><img src="${template.logo_url}" alt="Logo"></div>` : ''}
      <div>
        <div class="company-name">${template?.company_name || 'Alpha Yachting'}</div>
        <div class="company-details">
          ${template?.company_address ? `<div>${template.company_address}</div>` : ''}
        </div>
      </div>
    </div>

    <h1>PARTNER BRIEFING</h1>
    <div class="meta">Generated: ${new Date().toLocaleString('de-DE')}</div>

    <h2>WORK ORDER INFORMATION</h2>
    <div class="section">
      <div class="field">
        <div class="label">Work Order #</div>
        <div class="value">${workOrder.work_order_number || workOrder.id.slice(-6)}</div>
      </div>
      <div class="field">
        <div class="label">Title</div>
        <div class="value">${workOrder.title}</div>
      </div>
      <div class="row">
        <div class="field">
          <div class="label">Status</div>
          <div class="value">${workOrder.status}</div>
        </div>
        <div class="field">
          <div class="label">Scheduled Date</div>
          <div class="value">${workOrder.scheduled_date || 'TBD'}</div>
        </div>
      </div>
    </div>

    <h2>CUSTOMER & VESSEL</h2>
    <div class="section">
      <div class="row">
        <div class="field">
          <div class="label">Customer</div>
          <div class="value">${customerName}</div>
        </div>
        <div class="field">
          <div class="label">Vessel</div>
          <div class="value">${boat?.vessel_name || 'Unknown'}</div>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <div class="label">Type</div>
          <div class="value">${boat?.vessel_type || 'Unknown'}</div>
        </div>
        <div class="field">
          <div class="label">Length</div>
          <div class="value">${boat?.length_m ? boat.length_m + ' m' : 'Unknown'}</div>
        </div>
      </div>
    </div>

    <h2>LOCATION & ACCESS</h2>
    <div class="section">
      <div class="row">
        <div class="field">
          <div class="label">Location</div>
          <div class="value">${location?.name || 'Unknown'}</div>
        </div>
        <div class="field">
          <div class="label">Address</div>
          <div class="value">${location?.address || '-'}</div>
        </div>
      </div>
      <div class="field">
        <div class="label">Access Notes</div>
        <div class="value">${location?.access_notes || '-'}</div>
      </div>
    </div>

    ${workOrder.description ? `<h2>WORK DESCRIPTION</h2>
    <div class="section">
      <div class="value" style="white-space: pre-wrap; font-size: ${fontSizeBody - 1}pt;">${workOrder.description}</div>
    </div>` : ''}

    ${tasks.length > 0 ? `<h2>TASKS & CHECKLIST</h2>
    <div class="section">
      <table>
        <tr><th>#</th><th>Task</th><th>Est. Time</th></tr>
        ${tasks.map((t, idx) => `<tr><td>${idx + 1}</td><td>${t.title}</td><td>${t.estimated_minutes ? Math.round(t.estimated_minutes / 60) + 'h' : '-'}</td></tr>`).join('')}
      </table>
    </div>` : ''}

    <h2>COST COVERAGE & BUDGET</h2>
    <div class="section">
      <table>
        <tr><th>Budget Category</th><th>Amount</th></tr>
        <tr><td>Total Approved Budget</td><td>€${(teamOrder.approved_budget_total || 0).toFixed(2)}</td></tr>
        <tr><td>Labor</td><td>€${(teamOrder.labor_budget || 0).toFixed(2)}</td></tr>
        <tr><td>Travel</td><td>€${(teamOrder.travel_budget || 0).toFixed(2)}</td></tr>
        <tr><td>Accommodation</td><td>€${(teamOrder.accommodation_budget || 0).toFixed(2)}</td></tr>
        <tr><td>Per Diem</td><td>€${(teamOrder.per_diem_budget || 0).toFixed(2)}</td></tr>
      </table>
    </div>

    <h2>COVERED COSTS</h2>
    <div class="section">
      ${costPolicies.length > 0 ? `<ul>${costPolicies.join('')}${teamOrder.other_reimbursables_allowed ? '<li>Other reimbursables allowed (pre-approval required)</li>' : ''}</ul>` : '<p>No additional costs covered</p>'}
    </div>

    ${teamOrder.requires_preapproval_over > 0 || teamOrder.budget_exceed_requires_approval ? `<h2>APPROVAL REQUIREMENTS</h2>
    <div class="section">
      <ul>
        ${teamOrder.requires_preapproval_over > 0 ? `<li>Purchases over €${teamOrder.requires_preapproval_over} require pre-approval</li>` : ''}
        ${teamOrder.budget_exceed_requires_approval ? '<li>Budget overages require approval before proceeding</li>' : ''}
      </ul>
    </div>` : ''}

    <h2>ASSIGNED TEAM</h2>
    <div class="section">
      ${assignedTechs.length > 0 ? `<table>
        <tr><th>Name</th><th>Phone</th></tr>
        ${assignedTechs.map(t => `<tr><td>${t.first_name} ${t.last_name}</td><td>${t.phone || '-'}</td></tr>`).join('')}
      </table>` : '<p>No technicians assigned</p>'}
    </div>

    ${teamOrder.partner_notes ? `<h2>SPECIAL NOTES</h2>
    <div class="section">
      <div class="value" style="white-space: pre-wrap; font-size: ${fontSizeBody - 1}pt;">${teamOrder.partner_notes}</div>
    </div>` : ''}

    <div class="footer">
      ${template?.company_name || 'Alpha Yachting'} | This briefing is confidential and intended for the assigned partner.
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { workOrderId, teamOrderId } = body;
    
    if (!workOrderId || !teamOrderId) {
      return Response.json({ 
        success: false, 
        error: 'Missing workOrderId or teamOrderId' 
      }, { status: 400 });
    }
    
    const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.6');
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: fetch WO + TeamOrder + Templates in parallel
    const [workOrders, teamOrders, templates] = await Promise.all([
      base44.entities.WorkOrder.filter({ id: workOrderId }),
      base44.entities.TeamOrder.filter({ id: teamOrderId }),
      base44.entities.PDFTemplate.list()
    ]);

    if (workOrders.length === 0 || teamOrders.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const workOrder = workOrders[0];
    const teamOrder = teamOrders[0];
    const template = templates.find(t => t.is_default) || templates[0];

    // Step 2: fetch Job + Tasks using known IDs
    const [jobArr, tasks] = await Promise.all([
      workOrder.job_id ? base44.entities.Job.filter({ id: workOrder.job_id }) : Promise.resolve([]),
      base44.entities.Task.filter({ work_order_id: workOrderId }),
    ]);
    const job = jobArr[0] || null;

    // Step 3: fetch Customer / Boat / Location / Technicians by specific IDs
    const [customerArr, boatArr, locationArr, technicians] = await Promise.all([
      job?.customer_id ? base44.entities.Customer.filter({ id: job.customer_id }) : Promise.resolve([]),
      job?.boat_id ? base44.entities.Boat.filter({ id: job.boat_id }) : Promise.resolve([]),
      job?.location_id ? base44.entities.Location.filter({ id: job.location_id }) : Promise.resolve([]),
      workOrder.assigned_technicians?.length > 0 ? base44.entities.Technician.list() : Promise.resolve([]),
    ]);
    const customer = customerArr[0] || null;
    const boat = boatArr[0] || null;
    const location = locationArr[0] || null;

    const html = buildPartnerBriefHTML(workOrder, teamOrder, job, customer, boat, location, tasks, technicians, template);

    // Puppeteer doesn't work reliably in Deno Deploy - return HTML for client-side conversion
    return Response.json({
      success: true,
      html: html,
      fileName: `partner-brief-${workOrder.work_order_number || workOrderId}.pdf`
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 400 });
  }
});