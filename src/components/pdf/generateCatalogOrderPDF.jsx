import { jsPDF } from 'jspdf';

/**
 * Stateless jsPDF generator for catalog order/request documents.
 * No entity writes. No side effects.
 */
export function generateCatalogOrderPDF({ items, docType, reference, note, companyName = 'Alpha Yachting', manufacturerName = '' }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margins = { top: 20, right: 20, bottom: 20, left: 20 };
  const contentWidth = pageWidth - margins.left - margins.right;
  let y = margins.top;

  const primaryColor = { r: 37, g: 99, b: 235 };

  const checkBreak = (needed) => {
    if (y + needed > 277 - margins.bottom) {
      doc.addPage();
      y = margins.top;
    }
  };

  // --- Header ---
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text(docType.toUpperCase(), margins.left, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  doc.text(`Date: ${dateStr}`, pageWidth - margins.right, y, { align: 'right' });
  y += 7;

  // Divider
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(0.5);
  doc.line(margins.left, y, pageWidth - margins.right, y);
  y += 7;

  // --- Company + Supplier block ---
  const colW = contentWidth / 2 - 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('FROM:', margins.left, y);
  doc.text('TO / SUPPLIER:', margins.left + colW + 10, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(companyName, margins.left, y);
  doc.text(manufacturerName || '—', margins.left + colW + 10, y);
  y += 14;

  // --- Reference / Note ---
  if (reference) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Reference / Internal Note:', margins.left, y);
    doc.setFont('helvetica', 'normal');
    const refLines = doc.splitTextToSize(reference, contentWidth - 40);
    doc.text(refLines, margins.left + 52, y);
    y += (refLines.length * 4.5) + 4;
  }

  if (note) {
    checkBreak(20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Message:', margins.left, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const noteLines = doc.splitTextToSize(note, contentWidth);
    doc.text(noteLines, margins.left, y);
    y += (noteLines.length * 4.5) + 6;
  }

  // --- Table ---
  checkBreak(20);

  // Table header background
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(margins.left, y - 4, contentWidth, 8, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);

  const cols = {
    pos: { x: margins.left + 2, w: 10 },
    code: { x: margins.left + 13, w: 35 },
    name: { x: margins.left + 49, w: 80 },
    qty: { x: margins.left + 130, w: 18 },
    unit_price: { x: margins.left + 149, w: 22 },
    total: { x: margins.left + 172, w: contentWidth - 152 },
  };

  doc.text('#', cols.pos.x, y);
  doc.text('Code', cols.code.x, y);
  doc.text('Description', cols.name.x, y);
  doc.text('Qty', cols.qty.x + cols.qty.w - 2, y, { align: 'right' });
  doc.text('Unit Price', cols.unit_price.x + cols.unit_price.w - 2, y, { align: 'right' });
  doc.text('Total', cols.total.x + cols.total.w - 2, y, { align: 'right' });

  y += 7;

  // Rows
  doc.setTextColor(0, 0, 0);
  let subtotal = 0;

  items.forEach(({ item, qty }, idx) => {
    checkBreak(8);

    const lineTotal = (item.net_price ?? 0) * qty;
    subtotal += lineTotal;

    // Alternating row bg
    if (idx % 2 === 0) {
      doc.setFillColor(247, 248, 250);
      doc.rect(margins.left, y - 4, contentWidth, 7, 'F');
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    doc.text(String(idx + 1), cols.pos.x, y);

    const codeLines = doc.splitTextToSize(item.product_code || '', cols.code.w - 1);
    doc.text(codeLines[0], cols.code.x, y);

    const nameLines = doc.splitTextToSize(item.product_name || '', cols.name.w - 2);
    doc.text(nameLines[0], cols.name.x, y);
    if (nameLines.length > 1) {
      // second line smaller
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(nameLines[1], cols.name.x, y + 3.5);
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
    }

    doc.text(String(qty), cols.qty.x + cols.qty.w - 2, y, { align: 'right' });
    doc.text(`€ ${(item.net_price ?? 0).toFixed(2)}`, cols.unit_price.x + cols.unit_price.w - 2, y, { align: 'right' });
    doc.text(`€ ${lineTotal.toFixed(2)}`, cols.total.x + cols.total.w - 2, y, { align: 'right' });

    y += nameLines.length > 1 ? 9 : 7;
  });

  // --- Totals ---
  checkBreak(20);
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margins.left + contentWidth - 60, y, pageWidth - margins.right, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Subtotal (net):', margins.left + contentWidth - 60, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`€ ${subtotal.toFixed(2)}`, pageWidth - margins.right, y, { align: 'right' });
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('Prices are net catalog prices. VAT and final terms subject to supplier confirmation.', margins.left, y);
  y += 10;

  // --- Footer ---
  const footerY = 277 - margins.bottom;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margins.left, footerY - 5, pageWidth - margins.right, footerY - 5);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(companyName, margins.left, footerY);
  doc.text(`Generated: ${dateStr}`, pageWidth - margins.right, footerY, { align: 'right' });

  return doc;
}