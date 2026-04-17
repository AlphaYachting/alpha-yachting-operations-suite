import { jsPDF } from 'jspdf';

/**
 * Render unified team order brief document to PDF
 * Uses the same briefDocument object built by buildTeamOrderBriefDocument
 */
export async function renderTeamOrderBriefToPDF(briefDocument, template) {
  if (!briefDocument) {
    throw new Error('No brief document provided');
  }

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
  
  const tealColor = { r: 0, g: 188, b: 212 };
  const fontFamily = 'helvetica';
  
  const LOGO_BOX = { x: margins.left, y: margins.top, w: 104, h: 58 };
  const HEADER_TEXT_START_Y = LOGO_BOX.y + LOGO_BOX.h + 6;
  
  // === HELPER FUNCTIONS ===
  
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
  
  function drawTwoColGrid(rows, y) {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    
    rows.forEach(([label1, value1, label2, value2]) => {
      doc.setFont(fontFamily, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(label1, margins.left, y);
      doc.setFont(fontFamily, 'normal');
      doc.text((value1 || '-').toString(), margins.left + 28, y);
      
      if (label2) {
        doc.setFont(fontFamily, 'bold');
        doc.text(label2, margins.left + contentWidth / 2, y);
        doc.setFont(fontFamily, 'normal');
        doc.text((value2 || '-').toString(), margins.left + contentWidth / 2 + 28, y);
      }
      
      y += 4.5;
    });
    
    return y;
  }
  
  const checkPageBreak = (needed = 10) => {
    if (yPos + needed > pageHeight - margins.bottom - 20) {
      drawFooter();
      doc.addPage();
      yPos = margins.top;
    }
  };
  
  const drawFooter = () => {
    const footerY = pageHeight - margins.bottom - 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont(fontFamily, 'normal');
    const footerText = [
      template?.company_name || 'Alpha Yachting',
      template?.company_address,
      template?.company_registration || template?.company_vat,
      template?.contact_email,
      template?.contact_phone
    ].filter(Boolean).join('  ·  ');
    doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });
  };

  // === HEADER ===
  if (template?.logo_url) {
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
  
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
  doc.text(template?.company_name || 'Alpha Yachting', pageWidth - margins.right, LOGO_BOX.y + 5, { align: 'right' });
  
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (template?.company_address) {
    doc.text(template.company_address, pageWidth - margins.right, LOGO_BOX.y + 10, { align: 'right' });
  }
  
  yPos = HEADER_TEXT_START_Y;
  
  // TITLE
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
  doc.text('EXTERNAL WORKER BRIEF', margins.left, yPos);
  yPos += 1;
  doc.setLineWidth(0.3);
  doc.setDrawColor(tealColor.r, tealColor.g, tealColor.b);
  doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
  yPos += 4;
  
  // Timestamp
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${briefDocument.meta.timestamp}`, margins.left, yPos);
  yPos += 6;

  // === PROJECT IDENTIFICATION ===
  const id = briefDocument.projectIdentification;
  yPos = drawSectionHeader('PROJECT IDENTIFICATION', yPos);
  yPos = drawTwoColGrid([
    ['Work Order #', id.workOrderNumber, 'Status', id.workOrderStatus],
    ['Date', id.scheduledDate, 'Customer', id.customerName],
    ['Vessel', id.vesselName, 'Location', id.locationName],
    ['Title', id.workOrderTitle, null, null]
  ], yPos);
  yPos += 2;

  // === ASSIGNED EXTERNAL WORKER ===
  if (briefDocument.assignedPartner) {
    const partner = briefDocument.assignedPartner;
    checkPageBreak(15);
    yPos = drawSectionHeader('ASSIGNED EXTERNAL WORKER', yPos);
    yPos = drawTwoColGrid([
      ['Name', partner.name, 'Role', partner.role],
      ['Contact', partner.contact, 'Email', partner.email]
    ], yPos);
    yPos += 2;
  }

  // === PROJECT DESCRIPTION (Bilingual) ===
  if (briefDocument.projectDescription) {
    checkPageBreak(30);
    yPos = drawSectionHeader('PROJECT DESCRIPTION / PROJEKTBESCHREIBUNG', yPos);
    
    // English
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
    doc.text('English:', margins.left + 2, yPos);
    yPos += 4;
    
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const enLines = doc.splitTextToSize(briefDocument.projectDescription.en, contentWidth - 4);
    enLines.forEach(line => {
      checkPageBreak(5);
      doc.text(line, margins.left + 2, yPos);
      yPos += 4.5;
    });
    yPos += 3;
    
    // German
    checkPageBreak(15);
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
    doc.text('Deutsch:', margins.left + 2, yPos);
    yPos += 4;
    
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const deLines = doc.splitTextToSize(briefDocument.projectDescription.de, contentWidth - 4);
    deLines.forEach(line => {
      checkPageBreak(5);
      doc.text(line, margins.left + 2, yPos);
      yPos += 4.5;
    });
    yPos += 3;
  }

  // === TASKS ===
  if (briefDocument.taskList && briefDocument.taskList.length > 0) {
    checkPageBreak(20);
    yPos = drawSectionHeader('TASKS & CHECKLIST', yPos);
    
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(tealColor.r, tealColor.g, tealColor.b);
    doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
    doc.text('#', margins.left + 2, yPos);
    doc.text('Task', margins.left + 12, yPos);
    doc.text('Est. Time', pageWidth - margins.right - 2, yPos, { align: 'right' });
    yPos += 6;
    
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    briefDocument.taskList.forEach(task => {
      checkPageBreak(8);
      doc.text(task.number.toString(), margins.left + 2, yPos);
      const taskLines = doc.splitTextToSize(task.title, contentWidth - 40);
      doc.text(taskLines, margins.left + 12, yPos);
      const estTime = task.estimatedHours ? `${task.estimatedHours}h` : '-';
      doc.text(estTime, pageWidth - margins.right - 2, yPos, { align: 'right' });
      yPos += Math.max(taskLines.length * 4, 4.5);
      doc.setDrawColor(220, 220, 220);
      doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
    });
    yPos += 2;
  }

  // === LOCATION & ACCESS ===
  if (briefDocument.locationAccess) {
    checkPageBreak(20);
    const loc = briefDocument.locationAccess;
    yPos = drawSectionHeader('LOCATION & ACCESS', yPos);
    yPos = drawTwoColGrid([
      ['Location', loc.name, 'Address', loc.address],
      ['City', loc.city, null, null],
      ['Access Notes', loc.accessNotes, null, null]
    ], yPos);
    yPos += 2;
  }

  // === DOCUMENTATION & PAYMENT REQUIREMENTS ===
  if (briefDocument.documentationNotice) {
    checkPageBreak(25);
    yPos = drawSectionHeader('DOCUMENTATION & PAYMENT REQUIREMENTS', yPos);
    
    // Highlighted notice box
    doc.setFillColor(255, 243, 224);
    doc.setDrawColor(255, 152, 0);
    doc.setLineWidth(0.5);
    doc.rect(margins.left - 2, yPos - 4, contentWidth + 4, 65, 'FD');
    
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 87, 34);
    doc.text('IMPORTANT NOTICE:', margins.left + 2, yPos);
    yPos += 5;
    
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    
    const notice = briefDocument.documentationNotice;
    const enNoticeLines = doc.splitTextToSize(notice.en, contentWidth - 8);
    enNoticeLines.forEach(line => {
      doc.text(line, margins.left + 4, yPos);
      yPos += 3.5;
    });
    
    yPos += 2;
    
    const deNoticeLines = doc.splitTextToSize(notice.de, contentWidth - 8);
    deNoticeLines.forEach(line => {
      doc.text(line, margins.left + 4, yPos);
      yPos += 3.5;
    });
    yPos += 4;
  }

  // === SAFETY NOTES ===
  if (briefDocument.safetyNotes) {
    checkPageBreak(15);
    yPos = drawSectionHeader('SAFETY NOTES', yPos);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const safetyLines = doc.splitTextToSize(briefDocument.safetyNotes, contentWidth - 4);
    safetyLines.forEach(line => {
      checkPageBreak(5);
      doc.text(line, margins.left + 2, yPos);
      yPos += 4.5;
    });
    yPos += 2;
  }

  // === BUDGET ===
  if (briefDocument.budget) {
    checkPageBreak(25);
    yPos = drawSectionHeader('BUDGET & COST COVERAGE', yPos);
    
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(tealColor.r, tealColor.g, tealColor.b);
    doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
    doc.text('Budget Category', margins.left + 2, yPos);
    doc.text('Amount', pageWidth - margins.right - 2, yPos, { align: 'right' });
    yPos += 6;
    
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    
    const budgetRows = [
      ['Total Approved Budget', `€${briefDocument.budget.totalApproved.toFixed(2)}`],
      ['Labor', `€${briefDocument.budget.labor.toFixed(2)}`],
      ['Travel', `€${briefDocument.budget.travel.toFixed(2)}`],
      ['Accommodation', `€${briefDocument.budget.accommodation.toFixed(2)}`],
      ['Per Diem', `€${briefDocument.budget.perDiem.toFixed(2)}`]
    ];
    
    budgetRows.forEach(([label, amount]) => {
      doc.text(label, margins.left + 2, yPos);
      doc.text(amount, pageWidth - margins.right - 2, yPos, { align: 'right' });
      yPos += 4.5;
      doc.setDrawColor(220, 220, 220);
      doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
    });
  }

  drawFooter();

  return doc;
}