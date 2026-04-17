import { jsPDF } from 'jspdf';

export async function generateWorkerBriefPDF(briefingContext, template) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const margins = {
    top: 20,
    right: 15,
    bottom: 20,
    left: 15
  };
  
  const contentWidth = pageWidth - margins.left - margins.right;
  let yPos = margins.top;
  
  const tealColor = { r: 0, g: 188, b: 212 }; // #00bcd4 - teal for headers/tables
  const fontFamily = 'helvetica';
  
  // HEADER LAYOUT CONSTANTS
  const HEADER_TOP_Y = margins.top;
  const LOGO_BOX = {
    x: margins.left,
    y: HEADER_TOP_Y,
    w: 104,
    h: 58
  };
  const HEADER_TEXT_START_Y = LOGO_BOX.y + LOGO_BOX.h + 6;
  
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 188, b: 212 };
  }
  
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  
  // Section header: teal text with thin underline
  function drawSectionHeader(title, y) {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
    doc.text(title, margins.left, y);
    y += 1;
    doc.setLineWidth(0.3);
    doc.setDrawColor(tealColor.r, tealColor.g, tealColor.b);
    doc.line(margins.left, y, pageWidth - margins.right, y);
    return y + 4;
  }
  
  // Two-column grid for key-value pairs
  function drawTwoColGrid(rows, y) {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    
    rows.forEach(([label1, value1, label2, value2]) => {
      // Left column
      doc.setFont(fontFamily, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(label1, margins.left, y);
      doc.setFont(fontFamily, 'normal');
      const val1 = value1 || '-';
      doc.text(val1.toString(), margins.left + 28, y);
      
      // Right column (if provided)
      if (label2) {
        doc.setFont(fontFamily, 'bold');
        doc.text(label2, margins.left + contentWidth / 2, y);
        doc.setFont(fontFamily, 'normal');
        const val2 = value2 || '-';
        doc.text(val2.toString(), margins.left + contentWidth / 2 + 28, y);
      }
      
      y += 4.5;
    });
    
    return y;
  }
  
  // === HEADER SECTION ===
  if (template.logo_url) {
    try {
      await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const naturalW = img.naturalWidth;
          const naturalH = img.naturalHeight;
          const maxH = LOGO_BOX.h;
          const maxW = LOGO_BOX.w;
          let drawH = maxH;
          let drawW = (naturalW / naturalH) * drawH;
          if (drawW > maxW) {
            drawW = maxW;
            drawH = (naturalH / naturalW) * drawW;
          }
          try {
            doc.addImage(img, 'PNG', LOGO_BOX.x, LOGO_BOX.y, drawW, drawH, undefined, 'FAST');
          } catch (e) {
            console.log('Logo render error', e);
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = template.logo_url;
      });
    } catch (e) {
      console.log('Logo not loaded');
    }
  }
  
  // Company name (right aligned, teal)
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
  doc.text(template.company_name || 'Alpha Yachting', pageWidth - margins.right, HEADER_TOP_Y + 5, { align: 'right' });
  
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (template.company_address) {
    doc.text(template.company_address, pageWidth - margins.right, HEADER_TOP_Y + 10, { align: 'right' });
  }
  
  // Move yPos to start of content area
  yPos = HEADER_TEXT_START_Y;
  
  // EXTERNAL WORKER BRIEF header - teal
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
  doc.text('EXTERNAL WORKER BRIEF', margins.left, yPos);
  yPos += 1;
  doc.setLineWidth(0.3);
  doc.setDrawColor(tealColor.r, tealColor.g, tealColor.b);
  doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
  yPos += 4;
  
  // Generated timestamp
  const timestamp = new Date().toLocaleDateString('de-DE', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${timestamp}`, margins.left, yPos);
  yPos += 6;

  // Footer helper
  const drawFooter = () => {
    const footerY = pageHeight - margins.bottom - 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont(fontFamily, 'normal');
    doc.text(
      [template.company_name || 'Alpha Yachting', template.company_address, template.company_registration || template.company_vat, template.contact_email, template.contact_phone].filter(Boolean).join('  ·  '),
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
  };

  // Page break check
  const checkPageBreak = (needed = 10) => {
    if (yPos + needed > pageHeight - margins.bottom - 20) {
      drawFooter();
      doc.addPage();
      yPos = margins.top;
    }
  };

  // === PROJECT IDENTIFICATION ===
  yPos = drawSectionHeader('PROJECT IDENTIFICATION', yPos);
  const idRows = [
    ['Work Order #', briefingContext.work_order.number || 'N/A', 'Status', briefingContext.work_order.status || 'N/A'],
    ['Date', formatDate(briefingContext.work_order.scheduled_date) || 'N/A', 'Customer', briefingContext.customer.name || 'N/A'],
    ['Vessel', briefingContext.boat.name || 'N/A', 'Location', briefingContext.location.name || 'N/A']
  ];
  yPos = drawTwoColGrid(idRows, yPos);
  yPos += 2;

  // === PROJECT DESCRIPTION (Bilingual) ===
  checkPageBreak(30);
  yPos = drawSectionHeader('PROJECT DESCRIPTION / PROJEKTBESCHREIBUNG', yPos);
  
  // Generate project description
  const projectDesc = buildProjectDescription(briefingContext);
  
  // English section
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
  doc.text('English:', margins.left + 2, yPos);
  yPos += 4;
  
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  const enLines = doc.splitTextToSize(projectDesc.en, contentWidth - 4);
  enLines.forEach(line => {
    checkPageBreak(5);
    doc.text(line, margins.left + 2, yPos);
    yPos += 4.5;
  });
  yPos += 4;
  
  // German section
  checkPageBreak(20);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
  doc.text('Deutsch:', margins.left + 2, yPos);
  yPos += 4;
  
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  const deLines = doc.splitTextToSize(projectDesc.de, contentWidth - 4);
  deLines.forEach(line => {
    checkPageBreak(5);
    doc.text(line, margins.left + 2, yPos);
    yPos += 4.5;
  });
  yPos += 4;

  // === ASSIGNED EXTERNAL WORKER ===
  if (briefingContext.external_worker.name) {
    checkPageBreak(15);
    yPos = drawSectionHeader('ASSIGNED EXTERNAL WORKER', yPos);
    yPos = drawTwoColGrid([
      ['Name', briefingContext.external_worker.name || 'N/A', 'Role', briefingContext.external_worker.role || 'N/A'],
      ['Contact', briefingContext.external_worker.contact || 'N/A', 'Email', briefingContext.external_worker.email || 'N/A']
    ], yPos);
    yPos += 2;
  }

  // === TASKS & CHECKLIST ===
  if (briefingContext.tasks && briefingContext.tasks.length > 0) {
    checkPageBreak(20);
    yPos = drawSectionHeader('TASKS & CHECKLIST', yPos);
    
    // Table header - teal background
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(tealColor.r, tealColor.g, tealColor.b);
    doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
    doc.text('#', margins.left + 2, yPos);
    doc.text('Task', margins.left + 12, yPos);
    doc.text('Est. Time', pageWidth - margins.right - 2, yPos, { align: 'right' });
    yPos += 6;
    
    // Table rows
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    briefingContext.tasks.forEach((task, idx) => {
      checkPageBreak(7);
      doc.text((idx + 1).toString(), margins.left + 2, yPos);
      const taskLines = doc.splitTextToSize(task.title || 'N/A', contentWidth - 40);
      doc.text(taskLines, margins.left + 12, yPos);
      const estTime = task.estimated_minutes ? `${Math.round(task.estimated_minutes / 60)}h` : '-';
      doc.text(estTime, pageWidth - margins.right - 2, yPos, { align: 'right' });
      yPos += Math.max(taskLines.length * 4, 4.5);
      doc.setDrawColor(220, 220, 220);
      doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
    });
    yPos += 2;
  }

  // === SAFETY NOTES ===
  if (briefingContext.work_order.safety_notes) {
    checkPageBreak(15);
    yPos = drawSectionHeader('SAFETY NOTES', yPos);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const safetyLines = doc.splitTextToSize(briefingContext.work_order.safety_notes, contentWidth - 4);
    safetyLines.forEach(line => {
      checkPageBreak(5);
      doc.text(line, margins.left + 2, yPos);
      yPos += 4.5;
    });
    yPos += 4;
  }

  // === LOCATION & ACCESS ===
  checkPageBreak(15);
  yPos = drawSectionHeader('LOCATION & ACCESS', yPos);
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  
  const locData = [
    ['Address:', briefingContext.location.address || '-'],
    ['City:', briefingContext.location.city || '-'],
    ['Access Notes:', briefingContext.location.access_notes || 'None']
  ];
  
  locData.forEach(([label, value]) => {
    doc.setFont(fontFamily, 'bold');
    doc.text(label, margins.left + 2, yPos);
    doc.setFont(fontFamily, 'normal');
    const lines = doc.splitTextToSize(value, contentWidth - 30);
    lines.forEach((line, idx) => {
      doc.text(line, margins.left + 28, yPos + (idx * 4.5));
    });
    yPos += Math.max(lines.length * 4.5, 4.5) + 2;
  });
  yPos += 2;

  // === DOCUMENTATION & PAYMENT REQUIREMENTS ===
  checkPageBreak(20);
  yPos = drawSectionHeader('DOCUMENTATION & PAYMENT REQUIREMENTS', yPos);
  
  // Draw highlighted notice box
  doc.setFillColor(255, 243, 224); // Light orange background
  doc.setDrawColor(255, 152, 0); // Orange border
  doc.setLineWidth(0.5);
  doc.rect(margins.left - 2, yPos - 4, contentWidth + 4, 60, 'FD');
  
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 87, 34); // Deep orange text
  doc.text('IMPORTANT NOTICE:', margins.left + 2, yPos);
  yPos += 5;
  
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  
  // English notice
  const enNotice = 'Payment for this project requires proper documentation. After completion of the project, clear photo documentation of the performed work must be submitted. For projects lasting multiple days, we additionally expect a short daily progress report so that we can forward the progress to the customer.';
  const enNoticeLines = doc.splitTextToSize(enNotice, contentWidth - 8);
  enNoticeLines.forEach(line => {
    doc.text(line, margins.left + 4, yPos);
    yPos += 3.5;
  });
  
  yPos += 2;
  
  // German notice
  const deNotice = 'Die Bezahlung dieses Projekts setzt eine genaue Dokumentation voraus. Nach Abschluss des Projekts sind aussagekräftige Fotos der durchgeführten Arbeiten zu übermitteln. Bei Projekten, die mehrere Tage dauern, erwarten wir zusätzlich einen kurzen täglichen Fortschrittsbericht, damit wir diesen an den Kunden weiterleiten können.';
  const deNoticeLines = doc.splitTextToSize(deNotice, contentWidth - 8);
  deNoticeLines.forEach(line => {
    doc.text(line, margins.left + 4, yPos);
    yPos += 3.5;
  });

  // === BUDGET INFORMATION (if available) ===
  if (briefingContext.budget_policy.approved_budget_total > 0) {
    checkPageBreak(30);
    yPos = drawSectionHeader('BUDGET & COST COVERAGE', yPos);
    
    // Table header
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(tealColor.r, tealColor.g, tealColor.b);
    doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
    doc.text('Budget Category', margins.left + 2, yPos);
    doc.text('Amount', pageWidth - margins.right - 2, yPos, { align: 'right' });
    yPos += 6;
    
    // Budget rows
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    
    const budgetRows = [
      ['Total Approved Budget', `€${briefingContext.budget_policy.approved_budget_total?.toFixed(2) || '0.00'}`],
      ['Labor', `€${briefingContext.budget_policy.labor_budget?.toFixed(2) || '0.00'}`],
      ['Travel', `€${briefingContext.budget_policy.travel_budget?.toFixed(2) || '0.00'}`],
      ['Accommodation', `€${briefingContext.budget_policy.accommodation_budget?.toFixed(2) || '0.00'}`],
      ['Per Diem', `€${briefingContext.budget_policy.per_diem_budget?.toFixed(2) || '0.00'}`]
    ];
    
    budgetRows.forEach(([label, amount]) => {
      doc.text(label, margins.left + 2, yPos);
      doc.text(amount, pageWidth - margins.right - 2, yPos, { align: 'right' });
      yPos += 4.5;
      doc.setDrawColor(220, 220, 220);
      doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
    });
    yPos += 2;
  }

  // Draw footer on last page
  drawFooter();

  return doc;
}

// Build bilingual project description from briefing context
function buildProjectDescription(briefingContext) {
  const wo = briefingContext.work_order;
  const job = briefingContext.job;
  const tasks = briefingContext.tasks || [];
  const scope = briefingContext.external_notes?.scope_summary || '';
  const partnerNotes = briefingContext.external_notes?.partner_notes || '';
  
  // English version
  let en = '';
  if (scope) {
    en += scope + '\n\n';
  }
  if (wo.description) {
    en += `Work: ${wo.description}\n\n`;
  }
  if (job.description) {
    en += `Project Context: ${job.description}\n\n`;
  }
  if (tasks.length > 0) {
    en += 'Main Tasks:\n';
    tasks.slice(0, 5).forEach((t, i) => {
      en += `${i + 1}. ${t.title}${t.description ? ': ' + t.description : ''}\n`;
    });
    if (tasks.length > 5) en += `...and ${tasks.length - 5} more tasks.\n`;
    en += '\n';
  }
  if (partnerNotes) {
    en += `Special Notes: ${partnerNotes}\n`;
  }
  if (!en.trim()) {
    en = 'Work order scheduled. See tasks and schedule details below.';
  }
  
  // German version (keep as-is from original context if available)
  let de = '';
  if (scope) {
    de += scope + '\n\n';
  }
  if (wo.description) {
    de += `Arbeitsumfang: ${wo.description}\n\n`;
  }
  if (job.description) {
    de += `Projektkontext: ${job.description}\n\n`;
  }
  if (tasks.length > 0) {
    de += 'Hauptaufgaben:\n';
    tasks.slice(0, 5).forEach((t, i) => {
      de += `${i + 1}. ${t.title}${t.description ? ': ' + t.description : ''}\n`;
    });
    if (tasks.length > 5) de += `...und ${tasks.length - 5} weitere Aufgaben.\n`;
    de += '\n';
  }
  if (partnerNotes) {
    de += `Besondere Hinweise: ${partnerNotes}\n`;
  }
  if (!de.trim()) {
    de = 'Arbeitsauftrag geplant. Weitere Details finden Sie in den Aufgaben und dem Zeitplan unten.';
  }
  
  return { en: en.trim(), de: de.trim() };
}