import { jsPDF } from 'jspdf';

export async function generatePDFWithJsPDF(document, lineItems, template, payments = []) {
  const isInvoice = document.document_type === 'Invoice';
  const currency = document.currency === 'EUR' ? '€' : document.currency;

  // Page setup
  const pageFormat = template.page_format || 'A4';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageFormat.toLowerCase()
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Margins
  const hasLetterhead = template.letterhead_url && template.letterhead_enabled;
  
  const margins = {
    top: hasLetterhead ? (template.margin_top_mm || 70) : (template.margin_top_mm || 20),
    right: template.margin_right_mm || 20,
    bottom: template.margin_bottom_mm || 20,
    left: template.margin_left_mm || 20
  };

  const contentWidth = pageWidth - margins.left - margins.right;
  let yPos = margins.top;

  // Page break rules
  const pageBreakRules = template.page_break_rules || {};
  const minLinesBeforeBreak = pageBreakRules.min_lines_before_break || 3;
  const keepTotalsWithItems = pageBreakRules.keep_totals_with_items !== false;
  const breakBeforeTotals = pageBreakRules.break_before_totals || false;
  const breakBeforeNotes = pageBreakRules.break_before_notes || false;

  // Colors
  const primaryColor = hexToRgb(template.primary_color || '#2563eb');
  const secondaryColor = hexToRgb(template.secondary_color || '#06b6d4');

  // Helper to add letterhead to current page
  function addLetterhead() {
    if (hasLetterhead && template.letterhead_url) {
      try {
        // Add letterhead as full-page background image (no compression to preserve quality)
        doc.addImage(template.letterhead_url, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      } catch (e) {
        try {
          // Fallback to JPEG if PNG fails
          doc.addImage(template.letterhead_url, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        } catch (err) {
          console.error('Failed to load letterhead:', err);
        }
      }
    }
  }

  // Fonts
  const fontFamily = template.font_family || 'helvetica';
  const fontSizeBody = template.font_size_body || 11;
  const fontSizeHeading = template.font_size_heading || 18;

  // Helper functions
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 37, g: 99, b: 235 };
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  function formatCurrency(amount) {
    return `${currency}${(amount || 0).toFixed(2)}`;
  }

  function checkPageBreak(requiredSpace) {
    if (yPos + requiredSpace > pageHeight - margins.bottom) {
      doc.addPage();
      addLetterhead();
      yPos = margins.top;
      return true;
    }
    return false;
  }

  // Add letterhead to first page
  addLetterhead();

  // Watermark
  if (template.watermark_enabled) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: template.watermark_opacity || 0.1 }));
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(80);
    doc.text(
      template.watermark_text || 'DRAFT',
      pageWidth / 2,
      pageHeight / 2,
      { align: 'center', angle: template.watermark_angle || -45 }
    );
    doc.restoreGraphicsState();
  }

  // Logo and company info (only if no letterhead)
  if (!hasLetterhead) {
    if (template.logo_url) {
      try {
        const logoHeight = template.logo_height_mm || 20;
        const logoWidth = logoHeight * 3; // Assume 3:1 aspect ratio
        doc.addImage(template.logo_url, 'PNG', margins.left, yPos, logoWidth, logoHeight);
      } catch (e) {
        console.log('Logo not loaded');
      }
    }

    // Company info (right aligned)
    doc.setFontSize(template.font_size_company_name || 20);
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.setFont(fontFamily, 'bold');
    doc.text(template.company_name || 'Alpha Yachting', pageWidth - margins.right, yPos, { align: 'right' });
    
    yPos += 7;
    doc.setFontSize(9);
    doc.setTextColor(85, 85, 85);
    doc.setFont(fontFamily, 'normal');
    if (template.company_address) {
      doc.text(template.company_address, pageWidth - margins.right, yPos, { align: 'right' });
      yPos += 5;
    }
    if (template.company_vat) {
      doc.text(`VAT: ${template.company_vat}`, pageWidth - margins.right, yPos, { align: 'right' });
      yPos += 5;
    }

    yPos += 10;
  }

  // Document Title
  doc.setFontSize(fontSizeHeading);
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setFont(fontFamily, 'bold');
  doc.text(isInvoice ? 'INVOICE' : 'OFFER', margins.left, yPos);
  yPos += 8;

  doc.setFontSize(fontSizeBody);
  doc.setTextColor(0, 0, 0);
  doc.text(document.document_number || '', margins.left, yPos);
  yPos += 10;

  // Customer info (left) and meta info (right)
  const leftColX = margins.left;
  const rightColX = pageWidth / 2 + 10;
  const infoStartY = yPos;

  // Customer
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.setFont(fontFamily, 'bold');
  doc.text('BILL TO:', leftColX, yPos);
  yPos += 5;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, 'bold');
  doc.text(document.customer_name || '', leftColX, yPos);
  yPos += 5;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  if (document.customer_address) {
    const lines = doc.splitTextToSize(document.customer_address, contentWidth / 2 - 10);
    doc.text(lines, leftColX, yPos);
    yPos += lines.length * 5;
  }
  if (document.customer_vat) {
    yPos += 2;
    doc.text(`VAT: ${document.customer_vat}`, leftColX, yPos);
  }

  // Meta info (right side)
  let metaY = infoStartY;
  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.setFont(fontFamily, 'bold');
  
  doc.text('Issue Date:', rightColX, metaY);
  doc.setFont(fontFamily, 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(formatDate(document.issue_date), pageWidth - margins.right, metaY, { align: 'right' });
  metaY += 5;

  if (isInvoice && document.due_date) {
    doc.setTextColor(102, 102, 102);
    doc.setFont(fontFamily, 'bold');
    doc.text('Due Date:', rightColX, metaY);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(formatDate(document.due_date), pageWidth - margins.right, metaY, { align: 'right' });
    metaY += 5;
  }

  if (!isInvoice && document.valid_until) {
    doc.setTextColor(102, 102, 102);
    doc.setFont(fontFamily, 'bold');
    doc.text('Valid Until:', rightColX, metaY);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(formatDate(document.valid_until), pageWidth - margins.right, metaY, { align: 'right' });
    metaY += 5;
  }

  if (document.payment_terms) {
    doc.setTextColor(102, 102, 102);
    doc.setFont(fontFamily, 'bold');
    doc.text('Payment Terms:', rightColX, metaY);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(document.payment_terms, pageWidth - margins.right, metaY, { align: 'right' });
  }

  yPos = Math.max(yPos, metaY) + 10;

  // Vessel info
  if (document.boat_name || document.location_name) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margins.left, yPos - 3, contentWidth, 12, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont(fontFamily, 'bold');
    if (document.boat_name) {
      doc.text(`Vessel: `, margins.left + 2, yPos + 2);
      doc.setFont(fontFamily, 'normal');
      doc.text(document.boat_name, margins.left + 15, yPos + 2);
    }
    if (document.location_name) {
      doc.setFont(fontFamily, 'bold');
      doc.text(`Location: `, margins.left + 2, yPos + 7);
      doc.setFont(fontFamily, 'normal');
      doc.text(document.location_name, margins.left + 22, yPos + 7);
    }
    yPos += 15;
  }

  // Line items table
  checkPageBreak(40);
  
  // Table header
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.setFont(fontFamily, 'bold');
  
  let xPos = margins.left;
  
  // Calculate column widths based on template settings or defaults
  const totalWidth = contentWidth;
  const colConfig = template.table_column_widths || {
    index: 4,
    description: 38,
    quantity: 8,
    unit: 8,
    unit_price: 13,
    vat: 8,
    total: 13
  };
  
  const colWidths = [
    (colConfig.index / 100) * totalWidth,
    (colConfig.description / 100) * totalWidth,
    (colConfig.quantity / 100) * totalWidth,
    (colConfig.unit / 100) * totalWidth,
    (colConfig.unit_price / 100) * totalWidth
  ];
  
  if (template.show_vat_column) {
    colWidths.push((colConfig.vat / 100) * totalWidth);
  }
  colWidths.push((colConfig.total / 100) * totalWidth);
  
  const headers = ['#', 'Description', 'Qty', 'Unit', 'Unit Price'];
  if (template.show_vat_column) headers.push('VAT %');
  headers.push('Total');
  
  const colAlign = template.table_column_align || {
    index: 'center',
    description: 'left',
    quantity: 'right',
    unit: 'center',
    unit_price: 'right',
    vat: 'right',
    total: 'right'
  };
  
  // Draw headers
  headers.forEach((header, i) => {
    const align = i === 0 ? colAlign.index :
                  i === 1 ? colAlign.description :
                  i === 2 ? colAlign.quantity :
                  i === 3 ? colAlign.unit :
                  i === 4 ? colAlign.unit_price :
                  template.show_vat_column && i === 5 ? colAlign.vat :
                  colAlign.total;
    
    if (align === 'center') {
      doc.text(header, xPos + colWidths[i] / 2, yPos, { align: 'center' });
    } else if (align === 'right') {
      doc.text(header, xPos + colWidths[i] - 2, yPos, { align: 'right' });
    } else {
      doc.text(header, xPos + 2, yPos);
    }
    xPos += colWidths[i];
  });
  
  yPos += 6;
  
  // Table rows
  doc.setFont(fontFamily, 'normal');
  lineItems.forEach((item, idx) => {
    // Calculate required height for this row
    const titleLines = doc.splitTextToSize(item.title || '', colWidths[1] - 4);
    const descLines = item.description ? doc.splitTextToSize(item.description, colWidths[1] - 4) : [];
    const requiredHeight = (titleLines.length * 4) + (descLines.length * 3.5) + 10;

    // Always check for page breaks to prevent overflow
    checkPageBreak(requiredHeight);

    xPos = margins.left;
    const rowY = yPos;
    
    // Index
    doc.text((idx + 1).toString(), xPos + colWidths[0] / 2, rowY, { align: 'center' });
    xPos += colWidths[0];
    
    // Description
    doc.setFont(fontFamily, 'bold');
    doc.text(titleLines, xPos + 2, rowY);
    let descY = rowY + (titleLines.length * 4);
    
    if (item.description) {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(102, 102, 102);
      const descLines = doc.splitTextToSize(item.description, colWidths[1] - 4);
      doc.text(descLines, xPos + 2, descY);
      descY += descLines.length * 3.5;
      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);
    }
    doc.setFont(fontFamily, 'normal');
    xPos += colWidths[1];
    
    // Quantity
    doc.text((item.quantity || 0).toFixed(2), xPos + colWidths[2] - 2, rowY, { align: 'right' });
    xPos += colWidths[2];
    
    // Unit
    doc.text(item.unit || '-', xPos + colWidths[3] / 2, rowY, { align: 'center' });
    xPos += colWidths[3];
    
    // Unit Price
    doc.text(formatCurrency(item.unit_price), xPos + colWidths[4] - 2, rowY, { align: 'right' });
    xPos += colWidths[4];
    
    // VAT
    if (template.show_vat_column) {
      doc.text(`${item.tax_rate || 0}%`, xPos + colWidths[5] - 2, rowY, { align: 'right' });
      xPos += colWidths[5];
    }
    
    // Total
    const totalColIdx = template.show_vat_column ? 6 : 5;
    doc.text(formatCurrency(item.total_gross), xPos + colWidths[totalColIdx] - 2, rowY, { align: 'right' });
    
    yPos = Math.max(descY, rowY + 5) + 2;
  });
  
  yPos += 5;

  // Totals
  if (breakBeforeTotals) {
    doc.addPage();
    addLetterhead();
    yPos = margins.top;
  } else if (keepTotalsWithItems && lineItems.length >= minLinesBeforeBreak) {
    // Only keep totals with items if we have rendered minimum lines
    checkPageBreak(60);
  } else {
    checkPageBreak(30);
  }
  
  const totalsX = margins.left + contentWidth - 80;
  const totalsWidth = 80;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, 'normal');
  
  doc.text('Subtotal (Net):', totalsX, yPos);
  doc.text(formatCurrency(document.subtotal), totalsX + totalsWidth, yPos, { align: 'right' });
  yPos += 6;

  // Tax breakdown
  const taxBreakdown = lineItems.reduce((acc, item) => {
    const rate = item.tax_rate || 0;
    if (!acc[rate]) acc[rate] = 0;
    acc[rate] += item.total_tax || 0;
    return acc;
  }, {});

  doc.setTextColor(102, 102, 102);
  Object.entries(taxBreakdown).forEach(([rate, amount]) => {
    doc.text(`VAT ${rate}%:`, totalsX, yPos);
    doc.text(formatCurrency(amount), totalsX + totalsWidth, yPos, { align: 'right' });
    yPos += 6;
  });

  // Total
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(0.5);
  doc.line(totalsX, yPos - 2, totalsX + totalsWidth, yPos - 2);
  
  yPos += 2;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, 'bold');
  doc.text('Total (Gross):', totalsX, yPos);
  doc.text(formatCurrency(document.total), totalsX + totalsWidth, yPos, { align: 'right' });
  yPos += 8;

  // Payment info for invoices
  if (isInvoice && document.paid_amount > 0) {
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text('Paid:', totalsX, yPos);
    doc.text(`-${formatCurrency(document.paid_amount)}`, totalsX + totalsWidth, yPos, { align: 'right' });
    yPos += 6;

    const outstanding = (document.total || 0) - (document.paid_amount || 0);
    doc.setFont(fontFamily, 'bold');
    doc.setTextColor(outstanding > 0 ? 220 : 5, outstanding > 0 ? 38 : 150, outstanding > 0 ? 38 : 105);
    doc.text('Outstanding:', totalsX, yPos);
    doc.text(formatCurrency(outstanding), totalsX + totalsWidth, yPos, { align: 'right' });
    yPos += 10;
  } else {
    yPos += 5;
  }

  // Notes
  if (document.public_notes) {
    if (breakBeforeNotes) {
      doc.addPage();
      addLetterhead();
      yPos = margins.top;
    } else {
      checkPageBreak(30);
    }
    doc.setFillColor(245, 245, 245);
    const notesHeight = 20;
    doc.rect(margins.left, yPos - 3, contentWidth, notesHeight, 'F');
    
    doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.setLineWidth(1);
    doc.line(margins.left, yPos - 3, margins.left, yPos + notesHeight - 3);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont(fontFamily, 'bold');
    doc.text('Notes:', margins.left + 3, yPos + 2);
    
    doc.setFont(fontFamily, 'normal');
    const noteLines = doc.splitTextToSize(document.public_notes, contentWidth - 6);
    doc.text(noteLines, margins.left + 3, yPos + 8);
    yPos += notesHeight + 5;
  }

  // Bank info for invoices
  if (isInvoice && template.bank_iban) {
    checkPageBreak(25);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(margins.left, yPos - 3, contentWidth, 20, 1, 1, 'F');
    
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont(fontFamily, 'bold');
    doc.text('Payment Information:', margins.left + 3, yPos + 2);
    
    doc.setFontSize(9);
    doc.setFont(fontFamily, 'normal');
    yPos += 7;
    if (template.bank_name) {
      doc.text(`Bank: ${template.bank_name}`, margins.left + 3, yPos);
      yPos += 5;
    }
    doc.text(`IBAN: ${template.bank_iban}`, margins.left + 3, yPos);
    yPos += 5;
    if (template.bank_bic) {
      doc.text(`BIC: ${template.bank_bic}`, margins.left + 3, yPos);
    }
    yPos += 10;
  }

  // Footer
  const footerY = pageHeight - margins.bottom - 15;
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(0.3);
  doc.line(margins.left, footerY, pageWidth - margins.right, footerY);

  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.setFont(fontFamily, 'normal');
  
  if (template.footer_text) {
    const footerLines = doc.splitTextToSize(template.footer_text, contentWidth);
    doc.text(footerLines, margins.left, footerY + 5);
  }

  doc.text(
    template.company_name || 'Alpha Yachting',
    margins.left,
    pageHeight - margins.bottom - 3
  );
  
  const timestamp = new Date().toLocaleDateString('de-DE', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(timestamp, pageWidth - margins.right, pageHeight - margins.bottom - 3, { align: 'right' });

  return doc;
}