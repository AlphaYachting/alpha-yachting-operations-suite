# BEFORE SNAPSHOT: PartnerBriefTemplate.js
## Date: 2026-02-01
## Purpose: Restore styled look & feel (teal headers, grids, tables)

```javascript
import { jsPDF } from 'jspdf';

export function generatePartnerBriefPDF(document, lineItems, template) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margins = {
    top: template?.margin_top_mm || 20,
    left: template?.margin_left_mm || 20,
    right: template?.margin_right_mm || 20,
    bottom: template?.margin_bottom_mm || 20
  };
  const contentWidth = pageWidth - margins.left - margins.right;

  const fontFamily = template?.font_family || 'helvetica';
  const primaryColor = template?.primary_color || '#06b6d4';

  // Convert hex color to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const color = hexToRgb(primaryColor);
  let yPos = margins.top;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // Logo and Company Header
  if (template?.logo_url) {
    try {
      const img = new Image();
      img.src = template.logo_url;
      const logoHeight = template?.logo_height_mm || 20;
      const logoWidth = logoHeight * 2.5; // Approximate aspect ratio
      doc.addImage(template.logo_url, 'PNG', margins.left, yPos, logoWidth, logoHeight);
    } catch (e) {
      console.error('Logo load error:', e);
    }
  }

  // Company name and address (top right)
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(template?.font_size_company_name || 14);
  doc.setTextColor(color.r, color.g, color.b);
  const companyName = template?.company_name || 'Alpha Yachting';
  doc.text(companyName, pageWidth - margins.right, yPos + 5, { align: 'right' });
  
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (template?.company_address) {
    doc.text(template.company_address, pageWidth - margins.right, yPos + 11, { align: 'right' });
  }

  yPos += 35;

  // Title
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(template?.font_size_heading || 18);
  doc.setTextColor(color.r, color.g, color.b);
  doc.text('PARTNER BRIEFING', margins.left, yPos);
  yPos += 2;
  doc.setLineWidth(0.5);
  doc.setDrawColor(color.r, color.g, color.b);
  doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
  yPos += 8;

  // Generated timestamp
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString('de-DE')}, ${new Date().toLocaleTimeString('de-DE')}`, margins.left, yPos);
  yPos += 10;

  // Section header helper
  const drawSectionHeader = (title, y) => {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(color.r, color.g, color.b);
    doc.rect(margins.left, y, contentWidth, 7, 'F');
    doc.text(title, margins.left + 2, y + 5);
    return y + 10;
  };

  // WORK ORDER INFORMATION
  yPos = drawSectionHeader('WORK ORDER INFORMATION', yPos);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Work Order #', margins.left, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(document.document_number || '', margins.left + 35, yPos);
  yPos += 5;

  doc.setFont(fontFamily, 'bold');
  doc.text('Title', margins.left, yPos);
  doc.setFont(fontFamily, 'normal');
  const titleLines = doc.splitTextToSize(document.work_order_title || '', contentWidth - 35);
  doc.text(titleLines, margins.left + 35, yPos);
  yPos += titleLines.length * 5 + 2;

  doc.setFont(fontFamily, 'bold');
  doc.text('Status', margins.left, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(document.work_order_status || '', margins.left + 35, yPos);
  
  doc.setFont(fontFamily, 'bold');
  doc.text('Scheduled Date', margins.left + 90, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(formatDate(document.scheduled_date) || '', margins.left + 125, yPos);
  yPos += 8;

  // CUSTOMER & VESSEL
  yPos = drawSectionHeader('CUSTOMER & VESSEL', yPos);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9);
  doc.text('Customer', margins.left, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(document.customer_name || '', margins.left + 35, yPos);
  
  doc.setFont(fontFamily, 'bold');
  doc.text('Vessel', margins.left + 90, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(document.boat_name || '', margins.left + 125, yPos);
  yPos += 5;

  doc.setFont(fontFamily, 'bold');
  doc.text('Type', margins.left, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(document.boat_type || '', margins.left + 35, yPos);
  
  doc.setFont(fontFamily, 'bold');
  doc.text('Length', margins.left + 90, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(document.boat_length ? `${document.boat_length}m` : '', margins.left + 125, yPos);
  yPos += 8;

  // LOCATION & ACCESS
  yPos = drawSectionHeader('LOCATION & ACCESS', yPos);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9);
  doc.text('Location', margins.left, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(document.location_name || '', margins.left + 35, yPos);
  yPos += 5;

  doc.setFont(fontFamily, 'bold');
  doc.text('Address', margins.left, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(document.location_address || '', margins.left + 35, yPos);
  yPos += 5;

  doc.setFont(fontFamily, 'bold');
  doc.text('Access Notes', margins.left, yPos);
  doc.setFont(fontFamily, 'normal');
  doc.text(document.location_access_notes || 'None', margins.left + 35, yPos);
  yPos += 8;

  // WORK DESCRIPTION
  if (document.work_order_description) {
    yPos = drawSectionHeader('WORK DESCRIPTION', yPos);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const descLines = doc.splitTextToSize(document.work_order_description, contentWidth - 4);
    doc.text(descLines, margins.left + 2, yPos);
    yPos += descLines.length * 4.5 + 5;
  }

  // TASKS & CHECKLIST
  const taskItems = lineItems.filter(item => item.is_task);
  if (taskItems.length > 0) {
    yPos = drawSectionHeader('TASKS & CHECKLIST', yPos);
    
    // Table header
    doc.setFillColor(color.r, color.g, color.b);
    doc.setTextColor(255, 255, 255);
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.rect(margins.left, yPos, contentWidth, 6, 'F');
    doc.text('#', margins.left + 2, yPos + 4);
    doc.text('Task', margins.left + 10, yPos + 4);
    doc.text('Est. Time', pageWidth - margins.right - 20, yPos + 4, { align: 'right' });
    yPos += 6;

    // Table rows
    doc.setTextColor(0, 0, 0);
    doc.setFont(fontFamily, 'normal');
    taskItems.forEach((item, idx) => {
      doc.text(String(idx + 1), margins.left + 2, yPos + 4);
      const taskTitle = doc.splitTextToSize(item.title, contentWidth - 35);
      doc.text(taskTitle, margins.left + 10, yPos + 4);
      doc.text(item.estimated_time || '-', pageWidth - margins.right - 2, yPos + 4, { align: 'right' });
      yPos += Math.max(taskTitle.length * 4.5, 6);
      
      doc.setDrawColor(220, 220, 220);
      doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
    });
    yPos += 5;
  }

  // COST COVERAGE & BUDGET
  yPos = drawSectionHeader('COST COVERAGE & BUDGET', yPos);
  
  // Table header
  doc.setFillColor(color.r, color.g, color.b);
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9);
  doc.rect(margins.left, yPos, contentWidth, 6, 'F');
  doc.text('Budget Category', margins.left + 2, yPos + 4);
  doc.text('Amount', pageWidth - margins.right - 2, yPos + 4, { align: 'right' });
  yPos += 6;

  // Table rows
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, 'normal');
  const budgetRows = [
    ['Total Approved Budget', `€${(document.approved_budget || 0).toFixed(2)}`],
    ['Labor', `€${(document.labor_budget || 0).toFixed(2)}`],
    ['Travel', `€${(document.travel_budget || 0).toFixed(2)}`],
    ['Accommodation', `€${(document.accommodation_budget || 0).toFixed(2)}`],
    ['Per Diem', `€${(document.per_diem_budget || 0).toFixed(2)}`]
  ];

  budgetRows.forEach(([label, amount]) => {
    doc.text(label, margins.left + 2, yPos + 4);
    doc.text(amount, pageWidth - margins.right - 2, yPos + 4, { align: 'right' });
    yPos += 6;
    doc.setDrawColor(220, 220, 220);
    doc.line(margins.left, yPos, pageWidth - margins.right, yPos);
  });
  yPos += 5;

  // COVERED COSTS
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
    doc.text('None', margins.left + 2, yPos);
    yPos += 5;
  }
  yPos += 3;

  // APPROVAL REQUIREMENTS
  if (document.requires_preapproval > 0 || document.budget_exceed_requires_approval) {
    yPos = drawSectionHeader('APPROVAL REQUIREMENTS', yPos);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    if (document.requires_preapproval > 0) {
      doc.text(`• Purchases over €${document.requires_preapproval} require pre-approval`, margins.left + 2, yPos);
      yPos += 5;
    }
    if (document.budget_exceed_requires_approval) {
      doc.text('• Budget overages require approval before proceeding', margins.left + 2, yPos);
      yPos += 5;
    }
    yPos += 3;
  }

  // SAFETY & NOTES - always show section
  yPos = drawSectionHeader('SAFETY & NOTES', yPos);
  
  const safetyNotes = document.safety_notes || '';
  const partnerNotes = document.partner_notes || '';
  const combinedNotes = [safetyNotes, partnerNotes].filter(n => n.trim()).join('\n\n');
  
  if (combinedNotes) {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    // Split into bullet points if multiple paragraphs
    const noteParagraphs = combinedNotes.split('\n').filter(p => p.trim());
    noteParagraphs.forEach(paragraph => {
      const bulletLine = `• ${paragraph.trim()}`;
      const lines = doc.splitTextToSize(bulletLine, contentWidth - 6);
      doc.text(lines, margins.left + 2, yPos);
      yPos += lines.length * 4.5 + 2;
    });
  } else {
    // Show "None" if no notes
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('None', margins.left + 2, yPos);
    yPos += 5;
  }
  yPos += 3;

  // ASSIGNED TEAM
  yPos = drawSectionHeader('ASSIGNED TEAM', yPos);
  
  // Table header
  doc.setFillColor(color.r, color.g, color.b);
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9);
  doc.rect(margins.left, yPos, contentWidth, 6, 'F');
  doc.text('Name', margins.left + 2, yPos + 4);
  doc.text('Phone', pageWidth - margins.right - 2, yPos + 4, { align: 'right' });
  yPos += 6;

  // Footer
  const footerY = pageHeight - margins.bottom + 5;
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${template?.company_name || 'Alpha Yachting'} | This briefing is confidential and intended for the assigned partner.`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc;
}
``