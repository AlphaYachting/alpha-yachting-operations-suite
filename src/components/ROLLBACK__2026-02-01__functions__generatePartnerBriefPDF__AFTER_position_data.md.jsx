# AFTER SNAPSHOT: functions/generatePartnerBriefPDF.js (Data Binding Fixed)
## Date: 2026-02-01
## Changes: Correct field mapping + assigned team array

```javascript
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
``