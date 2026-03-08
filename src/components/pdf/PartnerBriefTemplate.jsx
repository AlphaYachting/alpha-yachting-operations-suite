import { jsPDF } from 'jspdf';

export async function generatePartnerBriefPDF(document, lineItems, template) {
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
  
  // HEADER LAYOUT CONSTANTS - Reserve space for logo to prevent overlap
  const HEADER_TOP_Y = margins.top;
  const LOGO_BOX = {
    x: margins.left,
    y: HEADER_TOP_Y,
    w: 40,   // Width in mm
    h: 22    // Fixed height in mm
  };
  const HEADER_TEXT_START_Y = LOGO_BOX.y + LOGO_BOX.h + 6; // Logo bottom + compact padding
  
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
  
  // Section header: teal text with thin underline (NOT filled rectangle)
  function drawSectionHeader(title, y) {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
    doc.text(title, margins.left, y);
    y += 1;
    doc.setLineWidth(0.3);
    doc.setDrawColor(tealColor.r, tealColor.g, tealColor.b);
    doc.line(margins.left, y, pageWidth - margins.right, y);
    return y + 5;
  }
  
  // Two-column grid for key-value pairs
  function drawTwoColGrid(rows, y) {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    const colWidth = contentWidth / 2 - 5;
    
    rows.forEach(([label1, value1, label2, value2]) => {
      // Left column
      doc.setFont(fontFamily, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(label1, margins.left, y);
      doc.setFont(fontFamily, 'normal');
      const val1 = value1 || '-';
      doc.text(val1.toString(), margins.left + 30, y);
      
      // Right column (if provided)
      if (label2) {
        doc.setFont(fontFamily, 'bold');
        doc.text(label2, margins.left + contentWidth / 2, y);
        doc.setFont(fontFamily, 'normal');
        const val2 = value2 || '-';
        doc.text(val2.toString(), margins.left + contentWidth / 2 + 30, y);
      }
      
      y += 5;
    });
    
    return y;
  }
  
  // === HEADER SECTION - Reserved space, no overlap ===
  
  // Logo - fixed height to control header space
  if (template.logo_url) {
    try {
      doc.addImage(template.logo_url, 'PNG', LOGO_BOX.x, LOGO_BOX.y, LOGO_BOX.w, LOGO_BOX.h, undefined, 'FAST');
    } catch (e) {
      console.log('Logo not loaded');
    }
  }
  
  // Company name (right aligned, teal) - within header area
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
  
  // Move yPos to start of content area (below header)
  yPos = HEADER_TEXT_START_Y;
  
  // PARTNER BRIEFING header - teal
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(tealColor.r, tealColor.g, tealColor.b);
  doc.text('PARTNER BRIEFING', margins.left, yPos);
  yPos += 1;
  doc.setLineWidth(0.3);
  doc.setDrawColor(tealColor.r, tealColor.g, tealColor.b);
  doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
  yPos += 6;
  
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
  yPos += 10;

  // Footer helper - draws footer on current page
  const drawFooter = () => {
    const footerY = pageHeight - margins.bottom - 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont(fontFamily, 'normal');
    doc.text(
      `${template.company_name || 'Alpha Yachting'} | This briefing is confidential and intended for the assigned partner.`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
  };

  // Page break check - leaves room for footer (20mm from bottom)
  const checkPageBreak = (needed = 10) => {
    if (yPos + needed > pageHeight - margins.bottom - 20) {
      drawFooter();
      doc.addPage();
      yPos = margins.top;
    }
  };

  // === ASSIGNED PARTNER / TEAM - First section ===
  if (document.assigned_team && document.assigned_team.length > 0) {
    yPos = drawSectionHeader('ASSIGNED PARTNER / TEAM', yPos);
    
    // Highlight box background
    doc.setFillColor(240, 244, 255);
    doc.rect(margins.left, yPos - 4, contentWidth, document.assigned_team.length * 5 + 8, 'F');
    doc.setDrawColor(tealColor.r, tealColor.g, tealColor.b);
    doc.setLineWidth(0.8);
    doc.line(margins.left, yPos - 4, margins.left, yPos + document.assigned_team.length * 5 + 4);
    doc.setLineWidth(0.3);

    // Table header
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(tealColor.r, tealColor.g, tealColor.b);
    doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
    doc.text('Name', margins.left + 2, yPos);
    doc.text('Role', margins.left + contentWidth / 2, yPos);
    doc.text('Phone', pageWidth - margins.right - 2, yPos, { align: 'right' });
    yPos += 6;

    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    document.assigned_team.forEach(tech => {
      doc.text(tech.name || '-', margins.left + 2, yPos);
      doc.text(tech.role || '-', margins.left + contentWidth / 2, yPos);
      doc.text(tech.phone || '-', pageWidth - margins.right - 2, yPos, { align: 'right' });
      yPos += 5;
      doc.setDrawColor(220, 220, 220);
      doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
    });
    yPos += 6;
  }

  // WORK ORDER INFORMATION
  yPos = drawSectionHeader('WORK ORDER INFORMATION', yPos);
  yPos = drawTwoColGrid([
    ['Work Order #', document.work_order_number || document.document_number, 'Status', document.work_order_status],
    ['Title', document.work_order_title, 'Scheduled Date', formatDate(document.scheduled_date)]
  ], yPos);
  yPos += 3;
  
  // CUSTOMER & VESSEL
  checkPageBreak(25);
  yPos = drawSectionHeader('CUSTOMER & VESSEL', yPos);
  yPos = drawTwoColGrid([
    ['Customer', document.customer_name, 'Vessel', document.boat_name],
    ['Type', document.boat_type, 'Length', document.boat_length ? `${document.boat_length} m` : '-']
  ], yPos);
  yPos += 3;
  
  // LOCATION & ACCESS
  checkPageBreak(25);
  yPos = drawSectionHeader('LOCATION & ACCESS', yPos);
  yPos = drawTwoColGrid([
    ['Location', document.location_name, 'Address', document.location_address],
    ['Access Notes', document.location_access_notes || 'None', null, null]
  ], yPos);
  yPos += 3;
  
  // WORK DESCRIPTION
  if (document.work_order_description) {
    yPos = drawSectionHeader('WORK DESCRIPTION', yPos);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const descLines = doc.splitTextToSize('Service Area: ' + document.work_order_description, contentWidth - 4);
    doc.text(descLines, margins.left + 2, yPos);
    yPos += descLines.length * 4.5 + 5;
  }
  
  // TASKS & CHECKLIST
  if (lineItems && lineItems.length > 0) {
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
    lineItems.forEach((item, idx) => {
      checkPageBreak(8);
      doc.text((idx + 1).toString(), margins.left + 2, yPos);
      const taskLines = doc.splitTextToSize(item.title, contentWidth - 40);
      doc.text(taskLines, margins.left + 12, yPos);
      doc.text(item.estimated_time || '-', pageWidth - margins.right - 2, yPos, { align: 'right' });
      yPos += Math.max(taskLines.length * 4.5, 5) + 1;
      doc.setDrawColor(220, 220, 220);
      doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
    });
    yPos += 3;
  }
  
  // COST COVERAGE & BUDGET
  checkPageBreak(40);
  yPos = drawSectionHeader('COST COVERAGE & BUDGET', yPos);
  
  // Table header - teal background
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(tealColor.r, tealColor.g, tealColor.b);
  doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
  doc.text('Budget Category', margins.left + 2, yPos);
  doc.text('Amount', pageWidth - margins.right - 2, yPos, { align: 'right' });
  yPos += 6;
  
  // Table rows
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, 'normal');
  const budgetRows = [
    ['Total Approved Budget', `€${(document.approved_budget_total || 0).toFixed(2)}`],
    ['Labor', `€${(document.labor_budget || 0).toFixed(2)}`],
    ['Travel', `€${(document.travel_budget || 0).toFixed(2)}`],
    ['Accommodation', `€${(document.accommodation_budget || 0).toFixed(2)}`],
    ['Per Diem', `€${(document.per_diem_budget || 0).toFixed(2)}`]
  ];

  budgetRows.forEach(([label, amount]) => {
    doc.text(label, margins.left + 2, yPos);
    doc.text(amount, pageWidth - margins.right - 2, yPos, { align: 'right' });
    yPos += 5;
    doc.setDrawColor(220, 220, 220);
    doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
  });
  yPos += 3;
  
  // COVERED COSTS - render cost_policies array as bullet list
  checkPageBreak(20);
  yPos = drawSectionHeader('COVERED COSTS', yPos);
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  
  if (document.cost_policies && document.cost_policies.length > 0) {
    document.cost_policies.forEach(policy => {
      doc.text(`• ${policy}`, margins.left + 2, yPos);
      yPos += 5;
    });
  } else {
    doc.setTextColor(100, 100, 100);
    doc.text('No additional costs covered', margins.left + 2, yPos);
    yPos += 5;
  }
  yPos += 3;
  
  // APPROVAL REQUIREMENTS
  if (document.requires_preapproval || document.budget_exceed_requires_approval) {
    yPos = drawSectionHeader('APPROVAL REQUIREMENTS', yPos);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    if (document.requires_preapproval) {
      doc.text(`• Purchases over €${document.requires_preapproval} require pre-approval`, margins.left + 2, yPos);
      yPos += 5;
    }
    if (document.budget_exceed_requires_approval) {
      doc.text('• Budget overages require approval before proceeding', margins.left + 2, yPos);
      yPos += 5;
    }
    yPos += 3;
  }
  
  // Draw footer on last page
  drawFooter();

  return doc;
}