# BEFORE SNAPSHOT: functions/generatePartnerBriefPDF.js (Data Binding Fix)
## Date: 2026-02-01
## Purpose: Fix data mapping for correct field values

```javascript
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
    status: workOrder.status,
    customer_name: customerName,
    boat_name: boat?.vessel_name,
    location_name: location?.name,
    issue_date: new Date().toISOString().split('T')[0],
    
    // Partner brief specific fields
    work_order_id: workOrder.id,
    work_order_title: workOrder.title,
    work_order_description: workOrder.description,
    work_order_status: workOrder.status,
    scheduled_date: workOrder.scheduled_date,
    estimated_duration: workOrder.estimated_duration_hours,
    
    // Vessel details
    boat_type: boat?.vessel_type,
    boat_length: boat?.length_m,
    
    // Location details
    location_address: location?.address,
    location_access_notes: location?.access_notes,
    
    // Team order / budget
    approved_budget: teamOrder.approved_budget_total || 0,
    labor_budget: teamOrder.labor_budget || 0,
    travel_budget: teamOrder.travel_budget || 0,
    accommodation_budget: teamOrder.accommodation_budget || 0,
    per_diem_budget: teamOrder.per_diem_budget || 0,
    cost_policies: costPolicies,
    requires_preapproval: teamOrder.requires_preapproval_over,
    budget_exceed_requires_approval: teamOrder.budget_exceed_requires_approval,
    partner_notes: teamOrder.partner_notes,
    safety_notes: workOrder.safety_notes,
    
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

// ... rest of file (buildPartnerBriefHTML and Deno.serve) ...
``