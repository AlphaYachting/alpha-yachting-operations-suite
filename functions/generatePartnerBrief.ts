import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workOrderId, teamOrderId } = await req.json();

    if (!workOrderId || !teamOrderId) {
      return Response.json({ 
        error: 'Missing required parameters: workOrderId, teamOrderId' 
      }, { status: 400 });
    }

    // Fetch all required data
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
      return Response.json({ error: 'Work Order or Team Order not found' }, { status: 404 });
    }

    const workOrder = workOrders[0];
    const teamOrder = teamOrders[0];
    const job = jobs.find(j => j.id === workOrder.job_id);
    const customer = customers.find(c => c.id === job?.customer_id);
    const boat = boats.find(b => b.id === job?.boat_id);
    const location = locations.find(l => l.id === job?.location_id);
    const assignedTechs = technicians.filter(t => workOrder.assigned_technicians?.includes(t.id));

    // Create PDF
    const doc = new jsPDF();
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(88, 28, 135); // Purple color
    doc.text('PARTNER BRIEFING', margin, yPos);
    yPos += 12;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 10;

    doc.setDrawColor(180, 140, 220);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Work Order Details Section
    doc.setFontSize(12);
    doc.setTextColor(88, 28, 135);
    doc.text('WORK ORDER INFORMATION', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    
    const workOrderDetails = [
      ['Work Order #:', workOrder.work_order_number || workOrder.id.slice(-6)],
      ['Title:', workOrder.title],
      ['Status:', workOrder.status],
      ['Scheduled Date:', workOrder.scheduled_date || 'TBD'],
      ['Duration (est):', workOrder.estimated_duration_hours ? `${workOrder.estimated_duration_hours}h` : 'TBD']
    ];

    workOrderDetails.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, margin, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(String(value), margin + 50, yPos);
      yPos += 6;
    });

    yPos += 4;

    // Customer & Boat Info
    doc.setFontSize(12);
    doc.setTextColor(88, 28, 135);
    doc.text('CUSTOMER & VESSEL INFORMATION', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown';
    const customerDetails = [
      ['Customer:', customerName],
      ['Vessel:', boat?.vessel_name || 'Unknown'],
      ['Type:', boat?.vessel_type || 'Unknown'],
      ['Length:', boat?.length_m ? `${boat.length_m}m` : 'Unknown']
    ];

    customerDetails.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, margin, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(String(value), margin + 50, yPos);
      yPos += 6;
    });

    yPos += 4;

    // Location & Access
    doc.setFontSize(12);
    doc.setTextColor(88, 28, 135);
    doc.text('LOCATION & ACCESS', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    const locationDetails = [
      ['Location:', location?.name || 'Unknown'],
      ['Address:', location?.address || ''],
      ['Access Notes:', location?.access_notes || 'None']
    ];

    locationDetails.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, margin, yPos);
      doc.setFont(undefined, 'normal');
      const wrappedText = doc.splitTextToSize(String(value), contentWidth - 50);
      wrappedText.forEach((line, idx) => {
        doc.text(line, margin + 50, yPos + (idx * 5));
      });
      yPos += wrappedText.length * 5 + 1;
    });

    yPos += 4;

    // Work Description
    if (workOrder.description) {
      doc.setFontSize(12);
      doc.setTextColor(88, 28, 135);
      doc.text('WORK DESCRIPTION', margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      const descLines = doc.splitTextToSize(workOrder.description, contentWidth);
      descLines.forEach((line) => {
        doc.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 4;
    }

    // Tasks
    if (tasks.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(88, 28, 135);
      doc.text('TASKS & CHECKLIST', margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      tasks.forEach((task, idx) => {
        doc.text(`${idx + 1}. ${task.title}`, margin + 5, yPos);
        yPos += 5;
        if (task.description && yPos < 280) {
          const taskDescLines = doc.splitTextToSize(task.description, contentWidth - 10);
          taskDescLines.forEach((line) => {
            doc.text(line, margin + 10, yPos);
            yPos += 4;
          });
        }
      });
      yPos += 4;
    }

    // Page break for cost/budget details
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // Team Order & Budget Information
    doc.setFontSize(12);
    doc.setTextColor(88, 28, 135);
    doc.text('COST COVERAGE & BUDGET', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    const budgetDetails = [
      ['Total Approved Budget:', `€${(teamOrder.approved_budget_total || 0).toFixed(2)}`],
      ['Labor Budget:', `€${(teamOrder.labor_budget || 0).toFixed(2)}`],
      ['Travel Budget:', `€${(teamOrder.travel_budget || 0).toFixed(2)}`],
      ['Accommodation Budget:', `€${(teamOrder.accommodation_budget || 0).toFixed(2)}`],
      ['Per Diem Budget:', `€${(teamOrder.per_diem_budget || 0).toFixed(2)}`]
    ];

    budgetDetails.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, margin, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(String(value), margin + 90, yPos);
      yPos += 6;
    });

    yPos += 4;

    // Cost Coverage Policies
    doc.setFontSize(10);
    doc.setTextColor(88, 28, 135);
    doc.setFont(undefined, 'bold');
    doc.text('COVERED COSTS:', margin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.setFont(undefined, 'normal');

    const costPolicies = [];
    if (teamOrder.accommodation_paid) {
      costPolicies.push(`• Accommodation: up to €${teamOrder.accommodation_max_per_night || 'TBD'}/night`);
    }
    if (teamOrder.meals_per_diem_paid) {
      costPolicies.push(`• Per Diem: €${teamOrder.per_diem_rate_per_day || 'TBD'}/day`);
    }
    if (teamOrder.mileage_paid) {
      costPolicies.push(`• Mileage: €${teamOrder.mileage_rate_per_km || '0.35'}/km (cap: €${teamOrder.mileage_cap_total || 'TBD'})`);
    }
    if (teamOrder.travel_time_paid) {
      costPolicies.push(`• Travel Time: €${teamOrder.travel_time_rate_per_hour || 'TBD'}/hour`);
    }

    if (costPolicies.length > 0) {
      costPolicies.forEach(policy => {
        doc.text(policy, margin + 5, yPos);
        yPos += 5;
      });
    } else {
      doc.text('No additional costs covered', margin + 5, yPos);
      yPos += 5;
    }

    if (teamOrder.other_reimbursables_allowed) {
      yPos += 2;
      doc.text('• Other reimbursables allowed (pre-approval required)', margin + 5, yPos);
      yPos += 5;
    }

    yPos += 6;

    // Approval Requirements
    if (teamOrder.requires_preapproval_over > 0 || teamOrder.budget_exceed_requires_approval) {
      doc.setFontSize(10);
      doc.setTextColor(88, 28, 135);
      doc.setFont(undefined, 'bold');
      doc.text('APPROVAL REQUIREMENTS:', margin, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.setFont(undefined, 'normal');

      if (teamOrder.requires_preapproval_over > 0) {
        doc.text(`• Purchases over €${teamOrder.requires_preapproval_over} require pre-approval`, margin + 5, yPos);
        yPos += 5;
      }
      if (teamOrder.budget_exceed_requires_approval) {
        doc.text('• Budget overages require approval before proceeding', margin + 5, yPos);
        yPos += 5;
      }
    }

    yPos += 6;

    // Contact Information
    doc.setFontSize(10);
    doc.setTextColor(88, 28, 135);
    doc.setFont(undefined, 'bold');
    doc.text('ASSIGNED TEAM', margin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.setFont(undefined, 'normal');

    if (assignedTechs.length > 0) {
      assignedTechs.forEach(tech => {
        doc.text(`${tech.first_name} ${tech.last_name}`, margin + 5, yPos);
        if (tech.phone) {
          doc.text(`Phone: ${tech.phone}`, margin + 10, yPos + 4);
          yPos += 8;
        } else {
          yPos += 4;
        }
      });
    } else {
      doc.text('No technicians assigned', margin + 5, yPos);
      yPos += 5;
    }

    // Partner Notes if exists
    if (teamOrder.partner_notes) {
      yPos += 6;
      doc.setFontSize(10);
      doc.setTextColor(88, 28, 135);
      doc.setFont(undefined, 'bold');
      doc.text('SPECIAL NOTES:', margin, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.setFont(undefined, 'normal');
      const notesLines = doc.splitTextToSize(teamOrder.partner_notes, contentWidth);
      notesLines.forEach((line) => {
        doc.text(line, margin, yPos);
        yPos += 5;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This briefing is confidential and intended for the assigned partner.', margin, 280);

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="partner-brief-${workOrder.work_order_number || workOrderId}.pdf"`
      }
    });
  } catch (error) {
    console.error('Error generating partner brief:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});