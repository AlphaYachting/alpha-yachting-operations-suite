import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Fetch bounded data for this project only
    const [jobs, workOrders, tasks, technicians, customers, boats, locations] = await Promise.all([
      base44.entities.Job.filter({ id: job_id }),
      base44.entities.WorkOrder.filter({ job_id }),
      base44.entities.Task.list(),
      base44.entities.Technician.list(),
      base44.entities.Customer.list(),
      base44.entities.Boat.list(),
      base44.entities.Location.list()
    ]);

    const job = jobs[0];
    if (!job) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const customer = customers.find(c => c.id === job.customer_id);
    const boat = boats.find(b => b.id === job.boat_id);
    const location = locations.find(l => l.id === job.location_id);
    const leadTech = technicians.find(t => t.id === job.lead_technician_id);

    // Sort work orders by sort_index
    const sortedWOs = workOrders.sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));

    // Filter tasks for these work orders
    const woIds = workOrders.map(wo => wo.id);
    const projectTasks = tasks.filter(t => woIds.includes(t.work_order_id));

    // Date/time formatters (P5 fix: consistent formatting)
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formatDateTime = (dateStr, timeStr) => {
      if (!dateStr) return '';
      const dateFormatted = formatDate(dateStr);
      if (!timeStr) return dateFormatted;
      return `${dateFormatted} ${timeStr}`;
    };

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // Helper to check if we need a new page
    const checkPageBreak = (neededSpace) => {
      if (y + neededSpace > pageHeight - margin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // Header - Alpha Yachting
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('ALPHA YACHTING', margin, y);
    y += 10;

    doc.setFontSize(16);
    doc.text('Project Work Sheet', margin, y);
    y += 10;

    // Project info
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Project: ${job.title}`, margin, y);
    y += 5;
    doc.text(`Project #: ${job.job_number || 'N/A'}`, margin, y);
    y += 8;

    // Context block
    checkPageBreak(40);
    doc.setFont(undefined, 'bold');
    doc.text('PROJECT CONTEXT', margin, y);
    y += 6;
    doc.setFont(undefined, 'normal');

    if (customer) {
      const customerName = customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      doc.text(`Customer: ${customerName}`, margin, y);
      y += 5;
    }

    if (boat) {
      doc.text(`Boat: ${boat.vessel_name}`, margin, y);
      y += 5;
    }

    if (location) {
      doc.text(`Location: ${location.name}`, margin, y);
      y += 5;
    }

    if (job.requested_date) {
      doc.text(`Due Date: ${new Date(job.requested_date).toLocaleDateString('en-GB')}`, margin, y);
      y += 5;
    }

    if (leadTech) {
      doc.text(`Lead Technician: ${leadTech.first_name} ${leadTech.last_name}`, margin, y);
      y += 5;
    }

    y += 5;

    // Work list
    checkPageBreak(40);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('WORK TO DO', margin, y);
    y += 8;

    for (const wo of sortedWOs) {
      checkPageBreak(30);
      
      // Work Order header
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`${wo.work_order_number || 'WO'}: ${wo.title}`, margin, y);
      y += 6;

      // Work order details
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');

      if (wo.scheduled_date) {
        const scheduleText = `Scheduled: ${formatDateTime(wo.scheduled_date, wo.scheduled_start_time)}`;
        doc.text(scheduleText, margin + 3, y);
        y += 4;
      }

      // Assigned technicians
      if (wo.assigned_technicians && wo.assigned_technicians.length > 0) {
        const techNames = wo.assigned_technicians
          .map(techId => {
            const tech = technicians.find(t => t.id === techId);
            return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
          })
          .join(', ');
        doc.text(`Assigned: ${techNames}`, margin + 3, y);
        y += 4;
      }

      if (wo.estimated_duration_hours) {
        doc.text(`Est. Hours: ${wo.estimated_duration_hours} h`, margin + 3, y);
        y += 4;
      }

      y += 2;

      // Tasks for this work order
      const woTasks = projectTasks
        .filter(t => t.work_order_id === wo.id)
        .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));

      if (woTasks.length > 0) {
        checkPageBreak(woTasks.length * 5 + 10);
        doc.setFont(undefined, 'italic');
        doc.text('Tasks:', margin + 3, y);
        y += 5;

        for (const task of woTasks) {
          checkPageBreak(5);
          doc.setFont(undefined, 'normal');
          const taskText = `☐ ${task.title} — ${task.status}`;
          doc.text(taskText, margin + 6, y);
          y += 4;
        }
      }

      y += 5;
    }

    // Footer
    checkPageBreak(15);
    y = pageHeight - margin - 10;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, margin, y);
    doc.text(`Page 1 of ${doc.getNumberOfPages()}`, pageWidth - margin - 30, y);

    // Update page numbers on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 30, pageHeight - margin - 10);
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Project_${job.job_number || job.id}_WorkSheet.pdf"`
      }
    });
  } catch (error) {
    console.error('Error generating project sheet:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});