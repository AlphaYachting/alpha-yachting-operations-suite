// PDF generation for Partner Brief using jsPDF
import { jsPDF } from 'npm:jspdf@4.0.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { workOrderId, teamOrderId, templateData } = body;
    
    if (!workOrderId || !teamOrderId) {
      return Response.json({ 
        success: false, 
        error: 'Missing workOrderId or teamOrderId'
      }, { status: 400 });
    }

    // Fetch all data
    const [workOrder, teamOrder, jobs, customers, boats, locations, tasks, technicians] = await Promise.all([
      base44.asServiceRole.entities.WorkOrder.get(workOrderId),
      base44.asServiceRole.entities.TeamOrder.get(teamOrderId),
      base44.asServiceRole.entities.Job.list(),
      base44.asServiceRole.entities.Customer.list(),
      base44.asServiceRole.entities.Boat.list(),
      base44.asServiceRole.entities.Location.list(),
      base44.asServiceRole.entities.Task.filter({ work_order_id: workOrderId }),
      base44.asServiceRole.entities.Technician.list()
    ]);

    if (!workOrder || !teamOrder) {
      return Response.json({ 
        success: false,
        error: 'Work order or team order not found'
      }, { status: 404 });
    }

    const job = jobs.find(j => j.id === workOrder.job_id);
    const customer = customers.find(c => c.id === job?.customer_id);
    const boat = boats.find(b => b.id === job?.boat_id);
    const location = locations.find(l => l.id === job?.location_id);
    const assignedTechs = technicians.filter(t => workOrder.assigned_technicians?.includes(t.id));
    const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown';

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setTextColor(65, 191, 200);
    doc.text('PARTNER BRIEFING', 15, y);
    
    y += 15;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);

    // Work Order Info
    doc.text(`Work Order: ${workOrder.work_order_number || workOrder.id.slice(-6)}`, 15, y);
    y += 7;
    doc.text(`Title: ${workOrder.title}`, 15, y);
    y += 7;
    doc.text(`Status: ${workOrder.status}`, 15, y);
    y += 7;
    doc.text(`Scheduled: ${workOrder.scheduled_date ? formatDate(workOrder.scheduled_date) : 'TBD'}`, 15, y);
    y += 7;
    doc.text(`Duration: ${workOrder.estimated_duration_hours ? workOrder.estimated_duration_hours + 'h' : '-'}`, 15, y);

    // Customer & Vessel
    y += 15;
    doc.setFontSize(14);
    doc.setTextColor(65, 191, 200);
    doc.text('CUSTOMER & VESSEL', 15, y);
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Customer: ${customerName}`, 15, y);
    y += 7;
    doc.text(`Vessel: ${boat?.vessel_name || 'Unknown'}`, 15, y);
    y += 7;
    doc.text(`Type: ${boat?.vessel_type || '-'}`, 15, y);
    y += 7;
    doc.text(`Length: ${boat?.length_m ? boat.length_m + 'm' : '-'}`, 15, y);

    // Location
    y += 15;
    doc.setFontSize(14);
    doc.setTextColor(65, 191, 200);
    doc.text('LOCATION', 15, y);
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Location: ${location?.name || 'Unknown'}`, 15, y);
    y += 7;
    if (location?.address) {
      doc.text(`Address: ${location.address}`, 15, y);
      y += 7;
    }

    // Budget
    y += 15;
    doc.setFontSize(14);
    doc.setTextColor(65, 191, 200);
    doc.text('BUDGET', 15, y);
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Budget: €${(teamOrder.approved_budget_total || 0).toFixed(2)}`, 15, y);
    y += 7;
    doc.text(`Labor: €${(teamOrder.labor_budget || 0).toFixed(2)}`, 15, y);
    y += 7;
    doc.text(`Travel: €${(teamOrder.travel_budget || 0).toFixed(2)}`, 15, y);

    // Tasks
    if (tasks.length > 0) {
      y += 15;
      doc.setFontSize(14);
      doc.setTextColor(65, 191, 200);
      doc.text('TASKS', 15, y);
      y += 7;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      tasks.forEach((task, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const taskText = `${idx + 1}. ${task.title}`;
        doc.text(taskText, 15, y);
        y += 6;
      });
    }

    // Assigned Team
    if (assignedTechs.length > 0) {
      y += 15;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(65, 191, 200);
      doc.text('ASSIGNED TEAM', 15, y);
      y += 7;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      assignedTechs.forEach(tech => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${tech.first_name} ${tech.last_name} - ${tech.phone || 'N/A'}`, 15, y);
        y += 6;
      });
    }

    // Generate PDF base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];

    return Response.json({
      success: true,
      pdf: pdfBase64,
      fileName: `partner-brief-${workOrder.work_order_number || workOrderId}.pdf`
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});