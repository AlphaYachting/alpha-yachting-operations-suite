import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function buildPartnerBriefHTML(workOrder, teamOrder, job, customer, boat, location, tasks, technicians) {
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

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }
    @page { size: A4; margin: 20mm; }
    h1 { color: #582c87; font-size: 24pt; margin: 20px 0; }
    h2 { color: #582c87; font-size: 14pt; margin: 15px 0 8px 0; border-bottom: 2px solid #582c87; padding-bottom: 4px; }
    .section { margin-bottom: 15px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px; }
    .field { margin-bottom: 8px; }
    .label { font-weight: bold; color: #582c87; font-size: 9pt; }
    .value { font-size: 11pt; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 6px; border: 1px solid #ccc; text-align: left; font-size: 10pt; }
    th { background-color: #582c87; color: white; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    ul { margin-left: 20px; margin-top: 5px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 8pt; color: #666; text-align: center; }
  </style>
</head>
<body>
  <h1>PARTNER BRIEFING</h1>
  <p style="color: #999; font-size: 9pt;">Generated: ${new Date().toLocaleString()}</p>

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
    <div class="field">
      <div class="label">Estimated Duration</div>
      <div class="value">${workOrder.estimated_duration_hours ? workOrder.estimated_duration_hours + 'h' : 'TBD'}</div>
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
        <div class="value">${boat?.length_m ? boat.length_m + 'm' : 'Unknown'}</div>
      </div>
    </div>
  </div>

  <h2>LOCATION & ACCESS</h2>
  <div class="section">
    <div class="field">
      <div class="label">Location</div>
      <div class="value">${location?.name || 'Unknown'}</div>
    </div>
    <div class="field">
      <div class="label">Address</div>
      <div class="value">${location?.address || '-'}</div>
    </div>
    <div class="field">
      <div class="label">Access Notes</div>
      <div class="value">${location?.access_notes || 'None'}</div>
    </div>
  </div>

  ${workOrder.description ? `<h2>WORK DESCRIPTION</h2>
  <div class="section">
    <div class="value" style="white-space: pre-wrap;">${workOrder.description}</div>
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
      <tr><td>Labor Budget</td><td>€${(teamOrder.labor_budget || 0).toFixed(2)}</td></tr>
      <tr><td>Travel Budget</td><td>€${(teamOrder.travel_budget || 0).toFixed(2)}</td></tr>
      <tr><td>Accommodation Budget</td><td>€${(teamOrder.accommodation_budget || 0).toFixed(2)}</td></tr>
      <tr><td>Per Diem Budget</td><td>€${(teamOrder.per_diem_budget || 0).toFixed(2)}</td></tr>
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
    <div class="value" style="white-space: pre-wrap;">${teamOrder.partner_notes}</div>
  </div>` : ''}

  <div class="footer">
    This briefing is confidential and intended for the assigned partner.
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workOrderId, teamOrderId } = await req.json();

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
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const workOrder = workOrders[0];
    const teamOrder = teamOrders[0];
    const job = jobs.find(j => j.id === workOrder.job_id);
    const customer = customers.find(c => c.id === job?.customer_id);
    const boat = boats.find(b => b.id === job?.boat_id);
    const location = locations.find(l => l.id === job?.location_id);

    const html = buildPartnerBriefHTML(workOrder, teamOrder, job, customer, boat, location, tasks, technicians);
    
    // Return HTML as data URL (browser will convert to PDF on download)
    const base64Html = btoa(unescape(encodeURIComponent(html)));
    const htmlDataUrl = `data:text/html;base64,${base64Html}`;

    return Response.json({
      success: true,
      html: html,
      fileName: `partner-brief-${workOrder.work_order_number || workOrderId}.pdf`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});