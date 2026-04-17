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
    doc.setFontSize(11);
    doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
    doc.text(title, margins.left, y);
    y += 1;
    doc.setLineWidth(0.5);
    doc.setDrawColor(tealColor.r, tealColor.g, tealColor.b);
    doc.line(margins.left, y, pageWidth - margins.right, y);
    return y + 5;
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
  doc.setFontSize(20);
  doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
  doc.text('EXTERNAL WORKER BRIEF', margins.left, yPos);
  yPos += 1.5;
  doc.setLineWidth(0.5);
  doc.setDrawColor(tealColor.r, tealColor.g, tealColor.b);
  doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
  yPos += 6;

  // Timestamp
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${briefDocument.meta.timestamp}`, margins.left, yPos);
  yPos += 8;

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
     checkPageBreak(35);
     yPos = drawSectionHeader('PROJECT DESCRIPTION / SCOPE OF WORK', yPos);

     // English section
     if (briefDocument.projectDescription.en) {
       doc.setFont(fontFamily, 'bold');
       doc.setFontSize(9);
       doc.setTextColor(0, 0, 0);
       doc.text('English:', margins.left, yPos);
       yPos += 4;

       doc.setFont(fontFamily, 'normal');
       doc.setFontSize(9);
       doc.setTextColor(0, 0, 0);
       const enLines = doc.splitTextToSize(briefDocument.projectDescription.en, contentWidth);
       enLines.forEach(line => {
         checkPageBreak(5);
         doc.text(line, margins.left, yPos);
         yPos += 4.5;
       });
       yPos += 5;
     }

     // German section (only render if translation exists)
     if (briefDocument.projectDescription.de) {
       checkPageBreak(20);
       doc.setFont(fontFamily, 'bold');
       doc.setFontSize(9);
       doc.setTextColor(0, 0, 0);
       doc.text('Deutsch:', margins.left, yPos);
       yPos += 4;

       doc.setFont(fontFamily, 'normal');
       doc.setFontSize(9);
       doc.setTextColor(0, 0, 0);
       const deLines = doc.splitTextToSize(briefDocument.projectDescription.de, contentWidth);
       deLines.forEach(line => {
         checkPageBreak(5);
         doc.text(line, margins.left, yPos);
         yPos += 4.5;
       });
       yPos += 3;
     }
   }

  // === TASKS ===
  if (briefDocument.taskList && briefDocument.taskList.length > 0) {
    checkPageBreak(25);
    yPos = drawSectionHeader('TASKS & CHECKLIST', yPos);
    
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    
    briefDocument.taskList.forEach((task, idx) => {
      checkPageBreak(12);
      
      // Task number and title
      doc.setFont(fontFamily, 'bold');
      doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
      doc.text(`${task.number}. ${task.title}`, margins.left, yPos);
      yPos += 5;
      
      // Description if available
      if (task.description) {
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        const descLines = doc.splitTextToSize(task.description, contentWidth - 4);
        descLines.forEach(line => {
          doc.text(line, margins.left + 2, yPos);
          yPos += 4;
        });
        yPos += 1;
      }
      
      // Estimated time
      if (task.estimatedHours) {
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text(`Est. ${task.estimatedHours}h`, margins.left + 2, yPos);
        yPos += 4;
      }
      
      // Separator between tasks
      if (idx < briefDocument.taskList.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
        yPos += 4;
      }
    });
    yPos += 3;
  }

  // === LOCATION & ACCESS ===
  if (briefDocument.locationAccess) {
    checkPageBreak(25);
    const loc = briefDocument.locationAccess;
    yPos = drawSectionHeader('LOCATION & ACCESS', yPos);
    yPos = drawTwoColGrid([
      ['Location', loc.name, 'City', loc.city],
      ['Address', loc.address, null, null],
      ['Access Notes', loc.accessNotes, null, null]
    ], yPos);
    yPos += 3;
  }

  // === DOCUMENTATION & PAYMENT REQUIREMENTS ===
  if (briefDocument.documentationNotice) {
    checkPageBreak(30);
    yPos = drawSectionHeader('DOCUMENTATION & PAYMENT REQUIREMENTS', yPos);
    
    // Highlighted notice box
    doc.setFillColor(255, 243, 224);
    doc.setDrawColor(255, 152, 0);
    doc.setLineWidth(1);
    
    const notice = briefDocument.documentationNotice;
    const enNoticeLines = doc.splitTextToSize(notice.en, contentWidth - 8);
    const deNoticeLines = doc.splitTextToSize(notice.de, contentWidth - 8);
    const boxHeight = enNoticeLines.length * 3.5 + deNoticeLines.length * 3.5 + 20;
    
    doc.rect(margins.left, yPos - 3, contentWidth, boxHeight, 'FD');
    
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 87, 34);
    doc.text('IMPORTANT NOTICE', margins.left + 3, yPos);
    yPos += 5;
    
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    
    // English notice
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(7);
    doc.text('English:', margins.left + 3, yPos);
    yPos += 3;
    
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8);
    enNoticeLines.forEach(line => {
      doc.text(line, margins.left + 3, yPos);
      yPos += 3.5;
    });
    yPos += 2;
    
    // German notice
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(7);
    doc.text('Deutsch:', margins.left + 3, yPos);
    yPos += 3;
    
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8);
    deNoticeLines.forEach(line => {
      doc.text(line, margins.left + 3, yPos);
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
    checkPageBreak(28);
    yPos = drawSectionHeader('BUDGET & COST COVERAGE', yPos);
    
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(tealColor.r, tealColor.g, tealColor.b);
    doc.rect(margins.left, yPos - 3.5, contentWidth, 5.5, 'F');
    doc.text('Budget Category', margins.left + 2, yPos);
    doc.text('Amount', pageWidth - margins.right - 2, yPos, { align: 'right' });
    yPos += 6;
    
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    
    const budgetRows = [
      ['Total Approved Budget', `€${briefDocument.budget.totalApproved.toFixed(2)}`, true],
      ['Labor', `€${briefDocument.budget.labor.toFixed(2)}`, false],
      ['Travel', `€${briefDocument.budget.travel.toFixed(2)}`, false],
      ['Accommodation', `€${briefDocument.budget.accommodation.toFixed(2)}`, false],
      ['Per Diem', `€${briefDocument.budget.perDiem.toFixed(2)}`, false]
    ];
    
    budgetRows.forEach(([label, amount, isBold], idx) => {
      if (isBold) {
        doc.setFont(fontFamily, 'bold');
      } else {
        doc.setFont(fontFamily, 'normal');
      }
      doc.text(label, margins.left + 2, yPos);
      doc.text(amount, pageWidth - margins.right - 2, yPos, { align: 'right' });
      yPos += 4.5;
      if (idx < budgetRows.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
      }
    });
  }

  drawFooter();

  return doc;
}