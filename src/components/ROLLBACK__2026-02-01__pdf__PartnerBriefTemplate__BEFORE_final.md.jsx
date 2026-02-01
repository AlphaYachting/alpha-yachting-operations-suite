# BEFORE SNAPSHOT: PartnerBriefTemplate.js (COMPLETE CURRENT VERSION)
## Date: 2026-02-01
## Purpose: Align frontend template to backend data builder fields + restore teal styled layout

```javascript
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
  
  const primaryColor = hexToRgb(template.primary_color || '#06b6d4');
  const fontFamily = 'helvetica';
  
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 6, g: 182, b: 212 };
  }
  
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  
  function drawSectionHeader(title, y) {
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.rect(margins.left, y - 4, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(10);
    doc.text(title, margins.left + 2, y);
    return y + 8;
  }
  
  function drawField(label, value, y, labelWidth = 40) {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(label, margins.left, y);
    
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    const valueLines = doc.splitTextToSize(value || '-', contentWidth - labelWidth);
    doc.text(valueLines, margins.left + labelWidth, y);
    
    return y + (valueLines.length * 4.5) + 1;
  }
  
  // Logo - fixed aspect ratio preservation
  if (template.logo_url) {
    try {
      const maxLogoHeight = 15;
      const maxLogoWidth = 50;
      // Let browser determine aspect ratio by only setting height
      doc.addImage(template.logo_url, 'PNG', margins.left, yPos, maxLogoWidth, maxLogoHeight, undefined, 'FAST');
    } catch (e) {
      console.log('Logo not loaded');
    }
  }
  
  // Company name (right aligned)
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text(template.company_name || 'Alpha Yachting', pageWidth - margins.right, yPos + 5, { align: 'right' });
  
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (template.company_address) {
    doc.text(template.company_address, pageWidth - margins.right, yPos + 10, { align: 'right' });
  }
  
  yPos += 25;
  
  // PARTNER BRIEFING header
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('PARTNER BRIEFING', margins.left, yPos);
  yPos += 8;
  
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
  yPos += 12;
  
  // WORK ORDER INFORMATION
  yPos = drawSectionHeader('WORK ORDER INFORMATION', yPos);
  yPos = drawField('Work Order #', document.work_order_number, yPos);
  yPos = drawField('Title', document.work_order_title, yPos);
  yPos = drawField('Status', document.work_order_status, yPos);
  yPos = drawField('Scheduled Date', formatDate(document.scheduled_date), yPos);
  yPos += 5;
  
  // CUSTOMER & VESSEL
  yPos = drawSectionHeader('CUSTOMER & VESSEL', yPos);
  yPos = drawField('Customer', document.customer_name, yPos);
  yPos = drawField('Vessel', document.vessel_name, yPos);
  yPos = drawField('Type', document.vessel_type, yPos);
  yPos = drawField('Length', document.vessel_length, yPos);
  yPos += 5;
  
  // LOCATION & ACCESS
  yPos = drawSectionHeader('LOCATION & ACCESS', yPos);
  yPos = drawField('Location', document.location_name, yPos);
  yPos = drawField('Address', document.location_address, yPos);
  yPos = drawField('Access Notes', document.location_access_notes, yPos);
  yPos += 5;
  
  // WORK DESCRIPTION
  if (document.work_description) {
    yPos = drawSectionHeader('WORK DESCRIPTION', yPos);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const descLines = doc.splitTextToSize(document.work_description, contentWidth - 4);
    doc.text(descLines, margins.left + 2, yPos);
    yPos += descLines.length * 4.5 + 5;
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
  
  // TASKS & CHECKLIST
  if (lineItems && lineItems.length > 0) {
    yPos = drawSectionHeader('TASKS & CHECKLIST', yPos);
    
    // Table header
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
    doc.text('#', margins.left + 2, yPos);
    doc.text('Task', margins.left + 10, yPos);
    doc.text('Est. Time', pageWidth - margins.right - 15, yPos);
    yPos += 6;
    
    // Table rows
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    lineItems.forEach((item, idx) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margins.top;
      }
      
      doc.text((idx + 1).toString(), margins.left + 2, yPos);
      const taskLines = doc.splitTextToSize(item.title, contentWidth - 30);
      doc.text(taskLines, margins.left + 10, yPos);
      doc.text(item.estimated_time || '-', pageWidth - margins.right - 15, yPos);
      yPos += Math.max(taskLines.length * 4.5, 5) + 1;
    });
    yPos += 5;
  }
  
  // COST COVERAGE & BUDGET
  if (document.budget_total) {
    yPos = drawSectionHeader('COST COVERAGE & BUDGET', yPos);
    
    // Table
    const budgetData = [
      ['Total Approved Budget', `€${(document.budget_total || 0).toFixed(2)}`],
      ['Labor', `€${(document.budget_labor || 0).toFixed(2)}`],
      ['Travel', `€${(document.budget_travel || 0).toFixed(2)}`],
      ['Accommodation', `€${(document.budget_accommodation || 0).toFixed(2)}`],
      ['Per Diem', `€${(document.budget_per_diem || 0).toFixed(2)}`]
    ];
    
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
    doc.text('Budget Category', margins.left + 2, yPos);
    doc.text('Amount', pageWidth - margins.right - 30, yPos);
    yPos += 6;
    
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    budgetData.forEach(([category, amount]) => {
      doc.text(category, margins.left + 2, yPos);
      doc.text(amount, pageWidth - margins.right - 30, yPos);
      yPos += 5;
    });
    yPos += 5;
  }
  
  // COVERED COSTS
  if (document.covered_costs) {
    yPos = drawSectionHeader('COVERED COSTS', yPos);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    const costs = document.covered_costs;
    if (costs.accommodation?.enabled) {
      doc.text(`• Accommodation: up to €${costs.accommodation.max_per_night}/night`, margins.left + 2, yPos);
      yPos += 5;
    }
    if (costs.per_diem?.enabled) {
      doc.text(`• Per Diem: €${costs.per_diem.rate_per_day}/day`, margins.left + 2, yPos);
      yPos += 5;
    }
    if (costs.mileage?.enabled) {
      doc.text(`• Mileage: €${costs.mileage.rate_per_km}/km (cap: €${costs.mileage.cap_total || 'TBD'})`, margins.left + 2, yPos);
      yPos += 5;
    }
    if (costs.travel_time?.enabled) {
      doc.text(`• Travel Time: €${costs.travel_time.rate_per_hour}/hour`, margins.left + 2, yPos);
      yPos += 5;
    }
    yPos += 3;
  }
  
  // APPROVAL REQUIREMENTS
  if (document.approval_requirements) {
    yPos = drawSectionHeader('APPROVAL REQUIREMENTS', yPos);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    doc.text(`• Purchases over €${document.approval_requirements.preapproval_over || 500} require pre-approval`, margins.left + 2, yPos);
    yPos += 5;
    if (document.approval_requirements.budget_exceed_requires_approval) {
      doc.text('• Budget overages require approval before proceeding', margins.left + 2, yPos);
      yPos += 5;
    }
    yPos += 3;
  }
  
  // ASSIGNED TEAM
  if (document.assigned_team && document.assigned_team.length > 0) {
    yPos = drawSectionHeader('ASSIGNED TEAM', yPos);
    
    // Table header
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.rect(margins.left, yPos - 4, contentWidth, 6, 'F');
    doc.text('Name', margins.left + 2, yPos);
    doc.text('Phone', pageWidth - margins.right - 30, yPos);
    yPos += 6;
    
    // Table rows
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    document.assigned_team.forEach(member => {
      doc.text(member.name, margins.left + 2, yPos);
      doc.text(member.phone || '-', pageWidth - margins.right - 30, yPos);
      yPos += 5;
    });
  }
  
  // Footer
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
  
  return doc;
}
``