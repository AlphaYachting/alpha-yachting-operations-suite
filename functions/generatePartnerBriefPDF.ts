// PDF Template generation for Partner Brief
// Uses generatePDFWithJsPDF for consistent PDF styling with letterhead support

import { generatePDFWithJsPDF } from './jsPDFGeneratorWrapper.js';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function buildPartnerBriefDocument(workOrder, teamOrder, job, customer, boat, location, tasks, technicians) {
  const assignedTechs = technicians.filter(t => workOrder.assigned_technicians?.includes(t.id));
  const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown';
  
  const costPolicies = [];
  if (teamOrder.accommodation_paid) {
    costPolicies.push(`Accommodation: up to €${teamOrder.accommodation_max_per_night || 'TBD'}/night`);
  }
  if (teamOrder.meals_per_diem_paid) {
    costPolicies.push(`Per Diem: €${teamOrder.per_diem_rate_per_day || 'TBD'}/day`);
  }
  if (teamOrder.mileage_paid) {
    costPolicies.push(`Mileage: €${teamOrder.mileage_rate_per_km || '0.35'}/km (cap: €${teamOrder.mileage_cap_total || 'TBD'})`);
  }
  if (teamOrder.travel_time_paid) {
    costPolicies.push(`Travel Time: €${teamOrder.travel_time_rate_per_hour || 'TBD'}/hour`);
  }

  return {
    document_type: 'PartnerBrief',
    document_number: workOrder.work_order_number || `BRIEF-${workOrder.id.slice(-6)}`,
    work_order_number: workOrder.work_order_number || `BRIEF-${workOrder.id.slice(-6)}`,
    status: workOrder.status,
    customer_name: customerName,
    boat_name: boat?.vessel_name || null,
    location_name: location?.name || null,
    issue_date: new Date().toISOString().split('T')[0],
    
    // Partner brief specific fields
    work_order_id: workOrder.id,
    work_order_title: workOrder.title,
    work_order_description: workOrder.description,
    work_order_status: workOrder.status,
    scheduled_date: workOrder.scheduled_date,
    estimated_duration: workOrder.estimated_duration_hours,
    
    // Vessel details - use null instead of undefined to prevent "|| '-'" fallback when value exists
    boat_type: boat?.vessel_type || null,
    boat_length: boat?.length_m || null,
    
    // Location details
    location_address: location?.address || null,
    location_access_notes: location?.access_notes || null,
    
    // Team order / budget - preserve actual values, use 0 only if truly missing
    approved_budget: teamOrder?.approved_budget_total ?? 0,
    labor_budget: teamOrder?.labor_budget ?? 0,
    travel_budget: teamOrder?.travel_budget ?? 0,
    accommodation_budget: teamOrder?.accommodation_budget ?? 0,
    per_diem_budget: teamOrder?.per_diem_budget ?? 0,
    cost_policies: costPolicies,
    requires_preapproval: teamOrder.requires_preapproval_over,
    budget_exceed_requires_approval: teamOrder.budget_exceed_requires_approval,
    partner_notes: teamOrder.partner_notes,
    safety_notes: workOrder.safety_notes,
    
    // Assigned team for template
    assigned_team: assignedTechs.map(t => ({
      name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
      phone: t.phone || null,
      email: t.email || null
    })),
    
    // Additional fields
    tasks_count: tasks.length,
    assigned_techs_count: assignedTechs.length
  };
}

function buildPartnerBriefLineItems(tasks, teamOrder) {
  // Build line items for the partner brief
  const items = [];
  
  // Add tasks as line items
  tasks.forEach((task, idx) => {
    items.push({
      sort_order: idx,
      title: task.title,
      description: task.description || '',
      quantity: 1,
      unit: 'item',
      unit_price: 0,
      tax_rate: 0,
      total_net: 0,
      total_tax: 0,
      total_gross: 0,
      is_task: true,
      estimated_time: task.estimated_minutes ? Math.round(task.estimated_minutes / 60) + 'h' : '-'
    });
  });
  
  // Add budget breakdown as line items
  items.push({
    sort_order: tasks.length,
    title: 'Total Approved Budget',
    description: '',
    quantity: 1,
    unit: 'EUR',
    unit_price: teamOrder.approved_budget_total || 0,
    tax_rate: 0,
    total_net: teamOrder.approved_budget_total || 0,
    total_tax: 0,
    total_gross: teamOrder.approved_budget_total || 0,
    is_budget: true
  });
  
  return items;
}

function buildPartnerBriefHTML(workOrder, teamOrder, job, customer, boat, location, tasks, technicians, template) {
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
  
  return `<html><head><style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 11pt; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .logo { max-width: 150px; }
    .logo img { max-width: 100%; height: auto; }
    .company-info { text-align: right; font-size: 9pt; }
    .company-name { font-weight: bold; color: #0099cc; font-size: 12pt; }
    h1.doc-type { color: #0099cc; border-bottom: 2px solid #0099cc; padding-bottom: 8px; font-size: 18pt; margin: 20px 0; }
    h2.section-title { color: #0099cc; border-bottom: 1px solid #0099cc; padding-bottom: 5px; margin-top: 15px; font-size: 12pt; }
    .meta-info { font-size: 9pt; color: #666; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px; }
    .info-field { margin-bottom: 8px; }
    .info-label { font-weight: bold; font-size: 10pt; color: #0099cc; }
    .info-value { margin-top: 2px; }
    .section-content { margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background-color: #00bcd4; color: white; padding: 6px; text-align: left; font-weight: bold; }
    td { padding: 6px; border-bottom: 1px solid #ddd; }
    ul { margin: 10px 0; padding-left: 20px; }
    li { margin: 5px 0; }
    .notes-box { background-color: #f5f5f5; border-left: 4px solid #0099cc; padding: 10px; margin: 10px 0; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9pt; text-align: center; }
    .footer-graphic { max-width: 100%; max-height: 30px; margin-bottom: 5px; }
  </style></head><body>
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
  </body>
</html>`;
}
}

Deno.serve(async (req) => {
  const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.6');
  const { generatePDFWithJsPDF } = await import('./jsPDFGenerator.js');
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

    // Build document and line items for jsPDF
    const document = buildPartnerBriefDocument(workOrder, teamOrder, job, customer, boat, location, tasks, technicians);
    const lineItems = buildPartnerBriefLineItems(tasks, teamOrder);
    
    // Generate PDF using jsPDF
    const doc = await generatePDFWithJsPDF(document, lineItems, templateData);
    const pdfBuffer = doc.output('arraybuffer');
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
    
    return Response.json({
      success: true,
      pdf: base64Pdf,
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