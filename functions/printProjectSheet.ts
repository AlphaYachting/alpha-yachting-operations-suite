import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

const TRANSLATIONS = {
  de: {
    title: 'Projektarbeitsblatt',
    projectContext: 'PROJEKTUEBERSICHT',
    customer: 'Kunde',
    boat: 'Boot',
    location: 'Standort',
    dueDate: 'Faelligkeitsdatum',
    leadTech: 'Haupttechniker',
    workToDo: 'ARBEITSAUFTRAEGE',
    scheduled: 'Geplant',
    assigned: 'Zugewiesen',
    estHours: 'Gesch. Stunden',
    tasks: 'Aufgaben',
    project: 'Projekt',
    projectNo: 'Projektnr.',
    generated: 'Erstellt',
    page: 'Seite',
    of: 'von',
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
  },
  si: {
    title: 'Projektni delovni list',
    projectContext: 'PREGLED PROJEKTA',
    customer: 'Stranka',
    boat: 'Coln',
    location: 'Lokacija',
    dueDate: 'Rok izvedbe',
    leadTech: 'Vodilni tehnik',
    workToDo: 'DELOVNI NALOGI',
    scheduled: 'Nacrtovano',
    assigned: 'Dodeljeno',
    estHours: 'Ocenj. ure',
    tasks: 'Naloge',
    project: 'Projekt',
    projectNo: 'St. projekta',
    generated: 'Ustvarjeno',
    page: 'Stran',
    of: 'od',
  }
};

// Strip non-latin1 characters to prevent jsPDF encoding artifacts
function safe(str) {
  if (!str) return '';
  return String(str)
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x00-\xFF]/g, '?');
}

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/a2e80b763_Bildschirmfoto2026-01-28um222024.png';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id, language = 'de' } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const t = TRANSLATIONS[language] || TRANSLATIONS['de'];

    const [jobs, workOrders, allTasks, technicians, customers, boats, locations] = await Promise.all([
      base44.entities.Job.filter({ id: job_id }),
      base44.entities.WorkOrder.filter({ job_id }),
      base44.entities.Task.list(),
      base44.entities.Technician.list(),
      base44.entities.Customer.list(),
      base44.entities.Boat.list(),
      base44.entities.Location.list()
    ]);

    const job = jobs[0];
    if (!job) return Response.json({ error: 'Project not found' }, { status: 404 });

    const customer = customers.find(c => c.id === job.customer_id);
    const boat = boats.find(b => b.id === job.boat_id);
    const location = locations.find(l => l.id === job.location_id);
    const leadTech = technicians.find(t => t.id === job.lead_technician_id);

    const sortedWOs = workOrders.sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
    const woIds = workOrders.map(wo => wo.id);
    const projectTasks = allTasks.filter(t => woIds.includes(t.work_order_id));

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const formatDateTime = (dateStr, timeStr) => {
      if (!dateStr) return '';
      return timeStr ? `${formatDate(dateStr)} ${timeStr}` : formatDate(dateStr);
    };

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    const checkPageBreak = (needed) => {
      if (y + needed > pageHeight - margin - 10) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // --- LOGO ---
    let logoLoaded = false;
    try {
      const logoResp = await fetch(LOGO_URL);
      if (logoResp.ok) {
        const buffer = await logoResp.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        // Convert to binary string for btoa
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        doc.addImage(`data:image/png;base64,${b64}`, 'PNG', pageWidth - margin - 50, margin - 5, 50, 20);
        logoLoaded = true;
      }
    } catch (_) { /* logo is optional */ }

    // --- HEADER ---
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(25, 55, 95);
    doc.text('ALPHA YACHTING', margin, y + 5);
    y += 11;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(safe(t.title), margin, y);
    y += 8;

    // Horizontal rule
    doc.setDrawColor(25, 55, 95);
    doc.setLineWidth(0.7);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Project info
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text(`${t.project}: ${safe(job.title)}`, margin, y);
    doc.text(`${t.projectNo}: ${safe(job.job_number || 'N/A')}`, pageWidth / 2, y);
    y += 10;

    // --- CONTEXT BLOCK ---
    checkPageBreak(42);
    doc.setFillColor(242, 246, 255);
    doc.roundedRect(margin, y - 2, pageWidth - margin * 2, 40, 2, 2, 'F');

    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(25, 55, 95);
    doc.text(safe(t.projectContext), margin + 3, y + 5);

    doc.setFont(undefined, 'normal');
    doc.setTextColor(50, 50, 50);
    const col2 = pageWidth / 2;
    let cy = y + 13;

    if (customer) {
      const name = safe(customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim());
      doc.text(`${t.customer}: ${name}`, margin + 3, cy);
    }
    if (boat) doc.text(`${t.boat}: ${safe(boat.vessel_name)}`, col2, cy);
    cy += 7;

    if (location) doc.text(`${t.location}: ${safe(location.name)}`, margin + 3, cy);
    if (job.requested_date) doc.text(`${t.dueDate}: ${formatDate(job.requested_date)}`, col2, cy);
    cy += 7;

    if (leadTech) doc.text(`${t.leadTech}: ${safe(leadTech.first_name)} ${safe(leadTech.last_name)}`, margin + 3, cy);

    y += 46;

    // --- WORK ORDERS TITLE ---
    checkPageBreak(16);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(25, 55, 95);
    doc.text(safe(t.workToDo), margin, y);
    doc.setDrawColor(25, 55, 95);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 2, pageWidth - margin, y + 2);
    y += 11;

    // --- WORK ORDERS ---
    for (const wo of sortedWOs) {
      checkPageBreak(26);

      // WO header bar
      doc.setFillColor(230, 237, 250);
      doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 13, 1.5, 1.5, 'F');

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(20, 40, 80);
      const woLabel = safe(`${wo.work_order_number || 'WO'}: ${wo.title}`);
      // Truncate if too long
      const maxW = pageWidth - margin * 2 - 35;
      let displayLabel = woLabel;
      while (doc.getTextWidth(displayLabel) > maxW && displayLabel.length > 10) {
        displayLabel = displayLabel.slice(0, -1);
      }
      if (displayLabel !== woLabel) displayLabel += '...';
      doc.text(displayLabel, margin + 3, y + 4);

      // Status right aligned
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(safe(wo.status || ''), pageWidth - margin - 2, y + 4, { align: 'right' });
      y += 14;

      // WO meta
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(70, 70, 70);

      if (wo.scheduled_date) {
        doc.text(`${t.scheduled}: ${formatDateTime(wo.scheduled_date, wo.scheduled_start_time)}`, margin + 4, y);
        y += 4.5;
      }

      if (wo.assigned_technicians && wo.assigned_technicians.length > 0) {
        const techNames = wo.assigned_technicians
          .map(id => {
            const tech = technicians.find(t => t.id === id);
            return tech ? safe(`${tech.first_name} ${tech.last_name}`) : '?';
          })
          .join(', ');
        doc.text(`${t.assigned}: ${techNames}`, margin + 4, y);
        y += 4.5;
      }

      if (wo.estimated_duration_hours) {
        doc.text(`${t.estHours}: ${wo.estimated_duration_hours} h`, margin + 4, y);
        y += 4.5;
      }

      y += 2;

      // Tasks
      const woTasks = projectTasks
        .filter(task => task.work_order_id === wo.id)
        .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));

      if (woTasks.length > 0) {
        checkPageBreak(8);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 50);
        doc.text(`${t.tasks}:`, margin + 4, y);
        y += 5;

        for (const task of woTasks) {
          checkPageBreak(6);
          const isCompleted = task.status === 'Completed';
          const taskLabel = safe(`- ${task.title}`);

          doc.setFont(undefined, 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(isCompleted ? 150 : 45, isCompleted ? 150 : 45, isCompleted ? 150 : 45);
          doc.text(taskLabel, margin + 7, y);

          // Strikethrough line for completed tasks
          if (isCompleted) {
            const tw = doc.getTextWidth(taskLabel);
            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(0.35);
            doc.line(margin + 7, y - 1.2, margin + 7 + tw, y - 1.2);
          }

          y += 5;
        }
      }

      // WO separator
      y += 3;
      doc.setDrawColor(200, 212, 232);
      doc.setLineWidth(0.25);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    }

    // --- FOOTER on all pages ---
    const totalPages = doc.getNumberOfPages();
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(160, 160, 160);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.25);
      doc.line(margin, pageHeight - margin - 6, pageWidth - margin, pageHeight - margin - 6);
      doc.text(`${t.generated}: ${ts}`, margin, pageHeight - margin - 2);
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