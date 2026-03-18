import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

const TRANSLATIONS = {
  de: {
    title: 'Projektarbeitsblatt',
    projectContext: 'PROJEKTÜBERSICHT',
    customer: 'Kunde',
    boat: 'Boot',
    location: 'Standort',
    dueDate: 'Fälligkeitsdatum',
    leadTech: 'Haupttechniker',
    workToDo: 'ARBEITSAUFTRÄGE',
    scheduled: 'Geplant',
    assigned: 'Zugewiesen',
    estHours: 'Gesch. Stunden',
    tasks: 'Aufgaben',
    project: 'Projekt',
    projectNo: 'Projektnr.',
    generated: 'Erstellt',
    page: 'Seite',
    of: 'von',
    status_completed: '[Erledigt]',
  },
  en: {
    title: 'Project Work Sheet',
    projectContext: 'PROJECT CONTEXT',
    customer: 'Customer',
    boat: 'Boat',
    location: 'Location',
    dueDate: 'Due Date',
    leadTech: 'Lead Technician',
    workToDo: 'WORK ORDERS',
    scheduled: 'Scheduled',
    assigned: 'Assigned',
    estHours: 'Est. Hours',
    tasks: 'Tasks',
    project: 'Project',
    projectNo: 'Project #',
    generated: 'Generated',
    page: 'Page',
    of: 'of',
    status_completed: '[Done]',
  },
  si: {
    title: 'Projektni delovni list',
    projectContext: 'PREGLED PROJEKTA',
    customer: 'Stranka',
    boat: 'Čoln',
    location: 'Lokacija',
    dueDate: 'Rok izvedbe',
    leadTech: 'Vodilni tehnik',
    workToDo: 'DELOVNI NALOGI',
    scheduled: 'Načrtovano',
    assigned: 'Dodeljeno',
    estHours: 'Ocenj. ure',
    tasks: 'Naloge',
    project: 'Projekt',
    projectNo: 'Št. projekta',
    generated: 'Ustvarjeno',
    page: 'Stran',
    of: 'od',
    status_completed: '[Opravljeno]',
  }
};

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id, language = 'de' } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'job_id is required' }, { status: 400 });
    }

    const t = TRANSLATIONS[language] || TRANSLATIONS['de'];

    // Fetch data
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

    const sortedWOs = workOrders.sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
    const woIds = workOrders.map(wo => wo.id);
    const projectTasks = tasks.filter(t => woIds.includes(t.work_order_id));

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const formatDateTime = (dateStr, timeStr) => {
      if (!dateStr) return '';
      const dateFormatted = formatDate(dateStr);
      return timeStr ? `${dateFormatted} ${timeStr}` : dateFormatted;
    };

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    const checkPageBreak = (neededSpace) => {
      if (y + neededSpace > pageHeight - margin - 10) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // Try to load logo
    let logoLoaded = false;
    try {
      const logoResp = await fetch(LOGO_URL);
      if (logoResp.ok) {
        const logoBuffer = await logoResp.arrayBuffer();
        const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoBuffer)));
        // Place logo top-right, max height 18mm
        const logoWidth = 45;
        const logoHeight = 18;
        doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight);
        logoLoaded = true;
      }
    } catch (_) { /* logo optional */ }

    // Header text
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 60, 100);
    doc.text('ALPHA YACHTING', margin, y + 4);
    y += 10;

    doc.setFontSize(13);
    doc.setTextColor(60, 60, 60);
    doc.text(t.title, margin, y);
    y += logoLoaded ? 8 : 8;

    // Horizontal rule
    doc.setDrawColor(30, 60, 100);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Project info row
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`${t.project}: ${job.title}`, margin, y);
    doc.text(`${t.projectNo}: ${job.job_number || 'N/A'}`, pageWidth / 2, y);
    y += 8;

    // Context block with light background
    checkPageBreak(40);
    doc.setFillColor(245, 248, 255);
    doc.roundedRect(margin, y - 2, pageWidth - margin * 2, 38, 2, 2, 'F');

    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 60, 100);
    doc.text(t.projectContext, margin + 3, y + 4);

    doc.setFont(undefined, 'normal');
    doc.setTextColor(50, 50, 50);
    let contextY = y + 11;
    const col2X = pageWidth / 2;

    if (customer) {
      const customerName = customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      doc.text(`${t.customer}: ${customerName}`, margin + 3, contextY);
    }
    if (boat) doc.text(`${t.boat}: ${boat.vessel_name}`, col2X, contextY);
    contextY += 6;

    if (location) doc.text(`${t.location}: ${location.name}`, margin + 3, contextY);
    if (job.requested_date) doc.text(`${t.dueDate}: ${formatDate(job.requested_date)}`, col2X, contextY);
    contextY += 6;

    if (leadTech) doc.text(`${t.leadTech}: ${leadTech.first_name} ${leadTech.last_name}`, margin + 3, contextY);

    y += 42;

    // Work Orders title
    checkPageBreak(20);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 60, 100);
    doc.text(t.workToDo, margin, y);
    doc.setDrawColor(30, 60, 100);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 2, pageWidth - margin, y + 2);
    y += 10;

    for (const wo of sortedWOs) {
      checkPageBreak(28);

      // WO header bar
      doc.setFillColor(235, 240, 250);
      doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 14, 1.5, 1.5, 'F');

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(20, 40, 80);
      const woNumber = wo.work_order_number || 'WO';
      const woTitle = `${woNumber}: ${wo.title}`;
      doc.text(woTitle, margin + 3, y + 4);

      // Status badge right side
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(wo.status || '', pageWidth - margin - 3, y + 4, { align: 'right' });
      y += 14;

      // WO meta details
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(80, 80, 80);

      if (wo.scheduled_date) {
        doc.text(`${t.scheduled}: ${formatDateTime(wo.scheduled_date, wo.scheduled_start_time)}`, margin + 4, y);
        y += 4;
      }

      if (wo.assigned_technicians && wo.assigned_technicians.length > 0) {
        const techNames = wo.assigned_technicians
          .map(techId => {
            const tech = technicians.find(t => t.id === techId);
            return tech ? `${tech.first_name} ${tech.last_name}` : '?';
          })
          .join(', ');
        doc.text(`${t.assigned}: ${techNames}`, margin + 4, y);
        y += 4;
      }

      if (wo.estimated_duration_hours) {
        doc.text(`${t.estHours}: ${wo.estimated_duration_hours} h`, margin + 4, y);
        y += 4;
      }

      y += 2;

      // Tasks
      const woTasks = projectTasks
        .filter(task => task.work_order_id === wo.id)
        .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));

      if (woTasks.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(`${t.tasks}:`, margin + 4, y);
        y += 5;

        for (const task of woTasks) {
          checkPageBreak(6);
          const isCompleted = task.status === 'Completed';
          const taskText = `• ${task.title}`;

          doc.setFont(undefined, isCompleted ? 'italic' : 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(isCompleted ? 140 : 40, isCompleted ? 140 : 40, isCompleted ? 140 : 40);

          doc.text(taskText, margin + 7, y);

          // Strikethrough for completed tasks
          if (isCompleted) {
            const textWidth = doc.getTextWidth(taskText);
            doc.setDrawColor(140, 140, 140);
            doc.setLineWidth(0.3);
            doc.line(margin + 7, y - 1, margin + 7 + textWidth, y - 1);
          }

          y += 5;
        }
      }

      // Divider between work orders
      y += 3;
      doc.setDrawColor(200, 210, 230);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(150, 150, 150);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - margin - 6, pageWidth - margin, pageHeight - margin - 6);
      doc.text(`${t.generated}: ${timestamp}`, margin, pageHeight - margin - 2);
      doc.text(`${t.page} ${i} ${t.of} ${totalPages}`, pageWidth - margin, pageHeight - margin - 2, { align: 'right' });
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