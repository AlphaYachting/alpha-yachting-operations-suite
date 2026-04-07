// PDF generation for Partner Brief using jsPDF
import { jsPDF } from 'npm:jspdf@4.0.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// Fetch image URL and return base64 string for jsPDF
async function fetchImageBase64(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  } catch (e) {
    console.warn('Failed to fetch image:', url, e.message);
    return null;
  }
}

// Detect image format from URL
function getImageFormat(url) {
  if (!url) return 'JPEG';
  const lower = url.toLowerCase();
  if (lower.includes('.png')) return 'PNG';
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'JPEG';
  if (lower.includes('.webp')) return 'WEBP';
  return 'JPEG';
}

// Parse hex color to RGB array [r, g, b]
function hexToRgb(hex) {
  if (!hex) return [37, 99, 235]; // default blue
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [37, 99, 235];
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
      return Response.json({ success: false, error: 'Missing workOrderId or teamOrderId' }, { status: 400 });
    }

    // Step 1: fetch workOrder + teamOrder first
    const [workOrder, teamOrder] = await Promise.all([
      base44.asServiceRole.entities.WorkOrder.get(workOrderId),
      base44.asServiceRole.entities.TeamOrder.get(teamOrderId),
    ]);

    if (!workOrder || !teamOrder) {
      return Response.json({ success: false, error: 'Work order or team order not found' }, { status: 404 });
    }

    // Step 2: fetch related data using specific IDs (no full list() calls)
    const [jobArr, tasks] = await Promise.all([
      workOrder.job_id ? base44.asServiceRole.entities.Job.filter({ id: workOrder.job_id }) : Promise.resolve([]),
      base44.asServiceRole.entities.Task.filter({ work_order_id: workOrderId }),
    ]);
    const job = jobArr[0] || null;

    // Step 3: fetch customer/boat/location by specific IDs
    const [customerArr, boatArr, locationArr, technicians] = await Promise.all([
      job?.customer_id ? base44.asServiceRole.entities.Customer.filter({ id: job.customer_id }) : Promise.resolve([]),
      job?.boat_id ? base44.asServiceRole.entities.Boat.filter({ id: job.boat_id }) : Promise.resolve([]),
      job?.location_id ? base44.asServiceRole.entities.Location.filter({ id: job.location_id }) : Promise.resolve([]),
      workOrder.assigned_technicians?.length > 0 ? base44.asServiceRole.entities.Technician.list() : Promise.resolve([]),
    ]);
    const customer = customerArr[0] || null;
    const boat = boatArr[0] || null;
    const location = locationArr[0] || null;
    const assignedTechs = technicians.filter(t => workOrder.assigned_technicians?.includes(t.id));
    const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 'Unknown';

    // Template config
    const tpl = templateData || {};
    const primaryColor = hexToRgb(tpl.primary_color || '#2563eb');
    const companyName = tpl.company_name || 'Alpha Yachting';
    const marginLeft = tpl.margin_left_mm || 15;
    const marginRight = tpl.margin_right_mm || 15;
    const marginTop = tpl.margin_top_mm || 20;

    // Pre-fetch images in parallel
    const [letterheadBase64, logoBase64, footerBase64] = await Promise.all([
      (tpl.letterhead_enabled && tpl.letterhead_url) ? fetchImageBase64(tpl.letterhead_url) : Promise.resolve(null),
      tpl.logo_url ? fetchImageBase64(tpl.logo_url) : Promise.resolve(null),
      tpl.footer_graphic_url ? fetchImageBase64(tpl.footer_graphic_url) : Promise.resolve(null)
    ]);

    // Create PDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();   // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const contentWidth = pageWidth - marginLeft - marginRight;

    // Helper: add letterhead background to current page
    const addLetterhead = () => {
      if (letterheadBase64) {
        doc.addImage(letterheadBase64, getImageFormat(tpl.letterhead_url), 0, 0, 210, 297);
      }
    };

    // Helper: add footer graphic to current page
    const addFooter = (pageNum, totalPages) => {
      const footerH = tpl.footer_graphic_height_mm || 25;
      if (footerBase64) {
        doc.addImage(footerBase64, getImageFormat(tpl.footer_graphic_url), 0, pageHeight - footerH, 210, footerH);
      }
      // Page number
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - marginRight, pageHeight - 8, { align: 'right' });
    };

    // Helper: draw horizontal rule
    const drawHR = (yPos, color = [220, 220, 220]) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
    };

    // Helper: section heading
    const sectionHeading = (text, yPos) => {
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryColor);
      doc.text(text.toUpperCase(), marginLeft, yPos);
      drawHR(yPos + 2, primaryColor);
      doc.setTextColor(0, 0, 0);
      return yPos + 8;
    };

    // Helper: key/value row
    const kvRow = (label, value, yPos, labelWidth = 45) => {
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text(label, marginLeft, yPos);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(String(value || '—'), marginLeft + labelWidth, yPos);
      return yPos + 5.5;
    };

    // Check page break helper
    const footerH = tpl.footer_graphic_height_mm || (footerBase64 ? 25 : 10);
    const checkBreak = (yPos, needed) => {
      if (yPos + needed > pageHeight - footerH - 10) {
        doc.addPage();
        addLetterhead();
        return marginTop;
      }
      return yPos;
    };

    // === PAGE 1 ===
    addLetterhead();

    let y = marginTop;

    // --- LOGO + HEADER ---
    if (logoBase64) {
      const logoH = tpl.logo_height_mm || 18;
      const logoW = logoH * 3; // approximate aspect ratio
      doc.addImage(logoBase64, getImageFormat(tpl.logo_url), marginLeft, y, logoW, logoH);
      y += logoH + 6;
    } else {
      // Company name as text fallback
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryColor);
      doc.text(companyName, marginLeft, y + 8);
      y += 16;
    }

    // Document title block
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('PARTNER BRIEFING', marginLeft, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    const docNumber = workOrder.work_order_number || workOrder.id.slice(-6);
    doc.text(`Document: ${docNumber}  ·  Date: ${formatDate(new Date().toISOString())}  ·  Status: ${workOrder.status}`, marginLeft, y);
    y += 2;
    drawHR(y, primaryColor);
    y += 8;

    // --- WORK ORDER SECTION ---
    y = sectionHeading('Work Order Details', y);
    y = kvRow('Work Order #:', workOrder.work_order_number || '—', y);
    y = kvRow('Title:', workOrder.title, y);
    y = kvRow('Scheduled:', workOrder.scheduled_date ? formatDate(workOrder.scheduled_date) : 'TBD', y);
    if (workOrder.scheduled_start_time) {
      y = kvRow('Start Time:', workOrder.scheduled_start_time + (workOrder.scheduled_end_time ? ` – ${workOrder.scheduled_end_time}` : ''), y);
    }
    y = kvRow('Duration:', workOrder.estimated_duration_hours ? workOrder.estimated_duration_hours + ' h' : '—', y);
    if (workOrder.service_area) {
      y = kvRow('Service Area:', workOrder.service_area, y);
    }
    y += 4;

    // --- CUSTOMER & VESSEL ---
    y = checkBreak(y, 40);
    y = sectionHeading('Customer & Vessel', y);
    y = kvRow('Customer:', customerName, y);
    if (customer?.email) y = kvRow('Email:', customer.email, y);
    if (customer?.phone) y = kvRow('Phone:', customer.phone, y);
    if (boat) {
      y = kvRow('Vessel:', boat.vessel_name, y);
      if (boat.berth_number) y = kvRow('Berth / Stecknr.:', boat.berth_number, y);
      y = kvRow('Type:', boat.vessel_type || '—', y);
      if (boat.length_m) y = kvRow('Length:', boat.length_m + ' m', y);
      if (boat.manufacturer) y = kvRow('Make/Model:', `${boat.manufacturer || ''} ${boat.model || ''}`.trim(), y);
    }
    y += 4;

    // --- LOCATION ---
    if (location) {
      y = checkBreak(y, 30);
      y = sectionHeading('Location', y);
      y = kvRow('Marina/Location:', location.name, y);
      if (location.address) y = kvRow('Address:', location.address, y);
      if (location.city) y = kvRow('City:', location.city, y);
      if (location.access_notes) {
        y = kvRow('Access Notes:', '', y - 5.5);
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        const wrapped = doc.splitTextToSize(location.access_notes, contentWidth - 45);
        doc.text(wrapped, marginLeft + 45, y);
        y += wrapped.length * 4.5 + 2;
      }
      y += 4;
    }

    // --- PARTNER NOTES (after location) ---
    if (teamOrder.partner_notes) {
      y = checkBreak(y, 20);
      y = sectionHeading('Partner Notes', y);
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      const lines = doc.splitTextToSize(teamOrder.partner_notes, contentWidth);
      lines.forEach(line => {
        y = checkBreak(y, 5);
        doc.text(line, marginLeft, y);
        y += 4.5;
      });
      y += 4;
    }

    // --- BUDGET ---
    y = checkBreak(y, 35);
    y = sectionHeading('Budget', y);
    y = kvRow('Total Budget:', `€${(teamOrder.approved_budget_total || 0).toFixed(2)}`, y);
    y = kvRow('Labor:', `€${(teamOrder.labor_budget || 0).toFixed(2)}`, y);
    y = kvRow('Travel:', `€${(teamOrder.travel_budget || 0).toFixed(2)}`, y);
    if (teamOrder.requires_preapproval_over) {
      y = kvRow('Pre-approval over:', `€${teamOrder.requires_preapproval_over}`, y);
    }
    y += 4;

    // Cost policies
    const costPolicies = [];
    if (teamOrder.accommodation_paid) costPolicies.push(`Accommodation: up to €${teamOrder.accommodation_max_per_night || 'TBD'}/night`);
    if (teamOrder.meals_per_diem_paid) costPolicies.push(`Per Diem: €${teamOrder.per_diem_rate_per_day || 'TBD'}/day`);
    if (teamOrder.mileage_paid) costPolicies.push(`Mileage: €${teamOrder.mileage_rate_per_km || '0.35'}/km`);
    if (teamOrder.travel_time_paid) costPolicies.push(`Travel Time: €${teamOrder.travel_time_rate_per_hour || 'TBD'}/hr`);
    if (costPolicies.length > 0) {
      y = checkBreak(y, costPolicies.length * 6 + 12);
      y = sectionHeading('Covered Costs', y);
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      costPolicies.forEach(p => {
        doc.text(`• ${p}`, marginLeft + 3, y);
        y += 5;
      });
      y += 4;
    }

    // --- ASSIGNED TEAM ---
    if (assignedTechs.length > 0) {
      y = checkBreak(y, assignedTechs.length * 6 + 14);
      y = sectionHeading('Assigned Team', y);
      assignedTechs.forEach(tech => {
        y = checkBreak(y, 6);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`${tech.first_name} ${tech.last_name}`, marginLeft + 3, y);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(80, 80, 80);
        const details = [tech.role, tech.phone].filter(Boolean).join(' · ');
        if (details) doc.text(details, marginLeft + 55, y);
        y += 5.5;
      });
      y += 4;
    }

    // --- TASKS ---
    if (tasks.length > 0) {
      y = checkBreak(y, 20);
      y = sectionHeading(`Tasks (${tasks.length})`, y);

      const sortedTasks = tasks.slice().sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));

      sortedTasks.forEach((task, idx) => {
        y = checkBreak(y, 8);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`${idx + 1}.`, marginLeft + 3, y);
        doc.setFont(undefined, 'normal');
        const titleLines = doc.splitTextToSize(task.title, contentWidth - 12);
        doc.text(titleLines, marginLeft + 10, y);
        y += titleLines.length * 4.5;
        if (task.estimated_minutes) {
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(8);
          doc.text(`Est. ${Math.round(task.estimated_minutes / 60 * 10) / 10} h`, marginLeft + 10, y);
          y += 4;
          doc.setTextColor(0, 0, 0);
        }
        y += 1;
      });
      y += 4;
    }

    // --- NOTES ---
    if (workOrder.description || teamOrder.partner_notes || workOrder.safety_notes) {
      y = checkBreak(y, 20);
      y = sectionHeading('Notes', y);
      doc.setFontSize(9);

      if (workOrder.description) {
        doc.setFont(undefined, 'bold');
        doc.text('Scope of Work:', marginLeft, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(workOrder.description, contentWidth);
        lines.forEach(line => {
          y = checkBreak(y, 5);
          doc.text(line, marginLeft, y);
          y += 4.5;
        });
        y += 3;
      }

      if (teamOrder.partner_notes) {
        y = checkBreak(y, 10);
        doc.setFont(undefined, 'bold');
        doc.text('Partner Notes:', marginLeft, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(teamOrder.partner_notes, contentWidth);
        lines.forEach(line => {
          y = checkBreak(y, 5);
          doc.text(line, marginLeft, y);
          y += 4.5;
        });
        y += 3;
      }

      if (workOrder.safety_notes) {
        y = checkBreak(y, 10);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(200, 50, 50);
        doc.text('⚠ Safety Notes:', marginLeft, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(workOrder.safety_notes, contentWidth);
        lines.forEach(line => {
          y = checkBreak(y, 5);
          doc.text(line, marginLeft, y);
          y += 4.5;
        });
      }
    }

    // --- FOOTER on all pages ---
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i, totalPages);

      // Company contact footer line (above footer graphic)
      const footerY = footerBase64 ? pageHeight - footerH - 5 : pageHeight - 10;
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      const contactParts = [companyName, tpl.company_address, tpl.company_registration || tpl.company_vat, tpl.contact_email, tpl.contact_phone, tpl.contact_website].filter(Boolean);
      if (contactParts.length > 0) {
        doc.text(contactParts.join('  ·  '), marginLeft, footerY);
      }
    }

    // Generate base64 output
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