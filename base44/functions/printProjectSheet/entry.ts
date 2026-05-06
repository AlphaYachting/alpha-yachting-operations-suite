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
    status: {
      'Draft': 'Entwurf',
      'Scheduled': 'Geplant',
      'Dispatched': 'Versandt',
      'In Transit': 'Unterwegs',
      'In Progress': 'In Arbeit',
      'Paused': 'Pausiert',
      'Waiting for Parts': 'Wartet auf Teile',
      'Waiting for Approval': 'Wartet auf Genehmigung',
      'Completed': 'Abgeschlossen',
      'Cancelled': 'Storniert',
    }
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
    status: {}
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
    status: {
      'Draft': 'Osnutek',
      'Scheduled': 'Nacrtovano',
      'In Progress': 'V teku',
      'Completed': 'Zakljuceno',
      'Cancelled': 'Preklicano',
    }
  }
};

// Strip non-Latin1 characters to prevent jsPDF encoding artifacts.
// jsPDF default font (Helvetica) is Latin-1 only.
function safe(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\u00e4/g, 'ae').replace(/\u00f6/g, 'oe').replace(/\u00fc/g, 'ue')
    .replace(/\u00c4/g, 'Ae').replace(/\u00d6/g, 'Oe').replace(/\u00dc/g, 'Ue')
    .replace(/\u00df/g, 'ss')
    .replace(/\u010d/g, 'c').replace(/\u0161/g, 's').replace(/\u017e/g, 'z')
    .replace(/\u010c/g, 'C').replace(/\u0160/g, 'S').replace(/\u017d/g, 'Z')
    .replace(/\u2019|\u2018/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '>')
    .replace(/[^\x00-\xFF]/g, '?');
}

// New logo — white background PNG, no transparency issues
const LOGO_URL = 'https://media.base44.com/images/public/6972766f1bd9af32693610c1/317ec2229_alpha-yachting-logo-dunkelblau-ohnepremiumsolutions.png';

async function loadLogoAsJpegDataUrl() {
  try {
    const resp = await fetch(LOGO_URL);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } catch (e) {
    console.error('Logo load error:', e);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id, language = 'de' } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const t = TRANSLATIONS[language] || TRANSLATIONS['de'];

    const [jobs, workOrders, allTasks, technicians, customers, boats, locations, logoDataUrl] = await Promise.all([
      base44.entities.Job.filter({ id: job_id }),
      base44.entities.WorkOrder.filter({ job_id }),
      base44.entities.Task.list(),
      base44.entities.Technician.list(),
      base44.entities.Customer.list(),
      base44.entities.Boat.list(),
      base44.entities.Location.list(),
      loadLogoAsJpegDataUrl()
    ]);

    const job = jobs[0];
    if (!job) return Response.json({ error: 'Project not found' }, { status: 404 });

    const customer = customers.find(c => c.id === job.customer_id);
    const boat = boats.find(b => b.id === job.boat_id);
    const location = locations.find(l => l.id === job.location_id);
    const leadTech = technicians.find(tech => tech.id === job.lead_technician_id);

    const sortedWOs = workOrders.sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0));
    const woIds = workOrders.map(wo => wo.id);
    const projectTasks = allTasks.filter(task => woIds.includes(task.work_order_id));

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const formatDateTime = (dateStr, timeStr) => {
      if (!dateStr) return '';
      return timeStr ? `${formatDate(dateStr)} ${timeStr}` : formatDate(dateStr);
    };

    const translateStatus = (status) => {
      if (!status) return '';
      return t.status[status] || safe(status);
    };

    // ---- PDF GENERATION ----
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const M = 15;
    let y = M;

    const checkPageBreak = (needed) => {
      if (y + needed > PH - M - 10) {
        doc.addPage();
        y = M;
        return true;
      }
      return false;
    };

    // ---- LOGO (top-right, fixed 70x24mm, right-aligned) ----
    const LOGO_W = 70;
    const LOGO_H = 24;
    const logoX = PW - M - LOGO_W;
    const logoY = M - 4;
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', logoX, logoY, LOGO_W, LOGO_H);
      } catch (_) { /* skip logo silently */ }
    }

    // ---- HEADER (left side, vertically aligned with logo) ----
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(25, 55, 95);
    doc.text('ALPHA YACHTING', M, y + 5);
    y += 11;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(t.title, M, y);
    // Ensure y clears the logo height before the divider
    y = Math.max(y + 8, logoY + LOGO_H + 2);

    // Divider
    doc.setDrawColor(25, 55, 95);
    doc.setLineWidth(0.7);
    doc.line(M, y, PW - M, y);
    y += 6;

    // Project info row
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text(`${t.project}: ${safe(job.title)}`, M, y);
    doc.text(`${t.projectNo}: ${safe(job.job_number || 'N/A')}`, PW / 2, y);
    y += 10;

    // ---- CONTEXT BLOCK ----
    checkPageBreak(44);
    doc.setFillColor(242, 246, 255);
    doc.roundedRect(M, y - 2, PW - M * 2, 42, 2, 2, 'F');

    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(25, 55, 95);
    doc.text(t.projectContext, M + 3, y + 5);

    doc.setFont(undefined, 'normal');
    doc.setTextColor(50, 50, 50);
    const col2 = PW / 2;
    let cy = y + 13;

    if (customer) {
      const name = safe(customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim());
      doc.text(`${t.customer}: ${name}`, M + 3, cy);
    }
    if (boat) doc.text(`${t.boat}: ${safe(boat.vessel_name)}`, col2, cy);
    cy += 7;

    if (location) doc.text(`${t.location}: ${safe(location.name)}`, M + 3, cy);
    if (job.requested_date) doc.text(`${t.dueDate}: ${formatDate(job.requested_date)}`, col2, cy);
    cy += 7;

    if (leadTech) doc.text(`${t.leadTech}: ${safe(leadTech.first_name)} ${safe(leadTech.last_name)}`, M + 3, cy);

    y += 48;

    // ---- WORK ORDERS TITLE ----
    checkPageBreak(16);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(25, 55, 95);
    doc.text(t.workToDo, M, y);
    doc.setDrawColor(25, 55, 95);
    doc.setLineWidth(0.5);
    doc.line(M, y + 2, PW - M, y + 2);
    y += 11;

    // ---- WORK ORDERS LOOP ----
    for (const wo of sortedWOs) {
      checkPageBreak(26);

      // WO header bar
      doc.setFillColor(230, 237, 250);
      doc.roundedRect(M, y - 4, PW - M * 2, 13, 1.5, 1.5, 'F');

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(20, 40, 80);

      const statusText = translateStatus(wo.status);
      const statusWidth = doc.getTextWidth(statusText) + 4;
      const maxTitleWidth = PW - M * 2 - statusWidth - 8;

      let woLabel = safe(`${wo.work_order_number || 'WO'}: ${wo.title}`);
      while (doc.getTextWidth(woLabel) > maxTitleWidth && woLabel.length > 10) {
        woLabel = woLabel.slice(0, -1);
      }
      if (doc.getTextWidth(safe(`${wo.work_order_number || 'WO'}: ${wo.title}`)) > maxTitleWidth) {
        woLabel += '...';
      }
      doc.text(woLabel, M + 3, y + 4);

      // Status right-aligned
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(statusText, PW - M - 2, y + 4, { align: 'right' });
      y += 14;

      // WO meta lines
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(70, 70, 70);

      if (wo.scheduled_date) {
        doc.text(`${t.scheduled}: ${formatDateTime(wo.scheduled_date, wo.scheduled_start_time)}`, M + 4, y);
        y += 4.5;
      }

      if (wo.assigned_technicians && wo.assigned_technicians.length > 0) {
        const techNames = wo.assigned_technicians
          .map(id => {
            const tech = technicians.find(tech => tech.id === id);
            return tech ? safe(`${tech.first_name} ${tech.last_name}`) : '?';
          })
          .join(', ');
        doc.text(`${t.assigned}: ${techNames}`, M + 4, y);
        y += 4.5;
      }

      if (wo.estimated_duration_hours) {
        doc.text(`${t.estHours}: ${wo.estimated_duration_hours} h`, M + 4, y);
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
        doc.text(`${t.tasks}:`, M + 4, y);
        y += 5;

        for (const task of woTasks) {
          checkPageBreak(6);
          const isCompleted = task.status === 'Completed';
          const taskLabel = safe(`- ${task.title}`);

          doc.setFont(undefined, 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(isCompleted ? 150 : 45, isCompleted ? 150 : 45, isCompleted ? 150 : 45);
          doc.text(taskLabel, M + 7, y);

          if (isCompleted) {
            const tw = doc.getTextWidth(taskLabel);
            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(0.35);
            doc.line(M + 7, y - 1.2, M + 7 + tw, y - 1.2);
          }

          y += 5;
        }
      }

      // WO separator
      y += 3;
      doc.setDrawColor(200, 212, 232);
      doc.setLineWidth(0.25);
      doc.line(M, y, PW - M, y);
      y += 5;
    }

    // ---- FOOTER on all pages ----
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
      doc.line(M, PH - M - 6, PW - M, PH - M - 6);
      doc.text(`${t.generated}: ${ts}`, M, PH - M - 2);
      doc.text(`${t.page} ${i} ${t.of} ${totalPages}`, PW - M, PH - M - 2, { align: 'right' });
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
    console.error('printProjectSheet error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});