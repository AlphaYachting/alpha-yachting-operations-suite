// Template generation is embedded below since backend can't import from components
// This mirrors the same logic as components/pdf/pdfTemplateUtils.js

function buildPDFHTML(document, lineItems, template, payments = []) {
  const isInvoice = document.document_type === 'Invoice';
  const currency = document.currency === 'EUR' ? '€' : document.currency;

  const margins = {
    top: template.margin_top_mm || 20,
    right: template.margin_right_mm || 20,
    bottom: template.margin_bottom_mm || 20,
    left: template.margin_left_mm || 20
  };

  const fontFamily = template.font_family || 'Arial';
  const fontSizeBody = template.font_size_body || 11;
  const fontSizeHeading = template.font_size_heading || 18;
  const fontSizeCompanyName = template.font_size_company_name || 20;
  const lineSpacing = template.line_spacing || 1.5;
  const paragraphSpacing = template.paragraph_spacing || 15;

  const columnWidths = template.table_column_widths || {
    index: 4,
    description: 38,
    quantity: 8,
    unit: 8,
    unit_price: 13,
    vat: 8,
    total: 13
  };

  const columnAlign = template.table_column_align || {
    index: 'center',
    description: 'left',
    quantity: 'right',
    unit: 'center',
    unit_price: 'right',
    vat: 'right',
    total: 'right'
  };

  const taxBreakdown = lineItems.reduce((acc, item) => {
    const rate = item.tax_rate || 0;
    if (!acc[rate]) acc[rate] = 0;
    acc[rate] += item.total_tax || 0;
    return acc;
  }, {});

  const outstanding = isInvoice ? (document.total || 0) - (document.paid_amount || 0) : 0;

  const watermarkHTML = template.watermark_enabled
    ? `<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(${template.watermark_angle ?? -45}deg); font-size: 72pt; font-weight: bold; color: #ccc; opacity: ${template.watermark_opacity ?? 0.1}; pointer-events: none; white-space: nowrap; z-index: 0;">${template.watermark_text || 'DRAFT'}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${document.document_number || 'Document'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { width: 100%; height: 100%; background: white; font-family: ${fontFamily}, sans-serif; font-size: ${fontSizeBody}pt; line-height: ${lineSpacing}; color: #333; }
    @page { size: A4; margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
    .document { width: 100%; background: white; }
    .header { margin-bottom: ${paragraphSpacing}pt; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    .logo img { height: ${template.logo_height_mm || 20}mm; object-fit: contain; }
    .company-name { font-size: ${fontSizeCompanyName}pt; font-weight: bold; color: ${template.primary_color || '#2563eb'}; margin-bottom: 5px; }
    .company-details { font-size: ${fontSizeBody - 2}pt; color: #555; }
    .doc-type { font-size: ${fontSizeHeading}pt; color: ${template.primary_color || '#2563eb'}; text-transform: uppercase; font-weight: bold; }
    .doc-number { font-size: ${fontSizeBody}pt; margin-top: 6px; font-weight: bold; }
    .info-block { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .info-section { width: 50%; }
    .info-label { font-size: 8pt; color: #666; margin-bottom: 4px; font-weight: bold; }
    .vessel-info { margin-bottom: 15px; padding: 8px 10px; background-color: #f8fafc; border-radius: 3px; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10pt; }
    thead { background-color: ${template.primary_color || '#2563eb'}; color: white; }
    th, td { padding: 8px 6px; border: 1px solid #ddd; text-align: left; }
    th { font-weight: bold; }
    tbody tr:nth-child(even) { background-color: #f9f9f9; }
    .col-index { width: ${columnWidths.index}%; text-align: ${columnAlign.index}; }
    .col-description { width: ${columnWidths.description}%; text-align: ${columnAlign.description}; }
    .col-qty { width: ${columnWidths.quantity}%; text-align: ${columnAlign.quantity}; }
    .col-unit { width: ${columnWidths.unit}%; text-align: ${columnAlign.unit}; }
    .col-price { width: ${columnWidths.unit_price}%; text-align: ${columnAlign.unit_price}; }
    .col-vat { width: ${columnWidths.vat}%; text-align: ${columnAlign.vat}; }
    .col-total { width: ${columnWidths.total}%; text-align: ${columnAlign.total}; }
    .item-title { font-weight: bold; font-size: 10pt; }
    .item-desc { font-size: 8pt; color: #666; margin-top: 2px; white-space: pre-line; }
    .totals { width: 45%; margin-left: auto; margin-bottom: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
    .total-row.final { border-top: 2px solid #000; font-weight: bold; font-size: 12pt; }
    .notes { margin-bottom: 15px; padding: 12px; background-color: #f5f5f5; border-left: 3px solid ${template.primary_color || '#2563eb'}; white-space: pre-line; }
    .payment-info { margin-bottom: 15px; padding: 12px; background-color: #eff6ff; border-radius: 3px; font-size: 9pt; }
    .footer { margin-top: ${paragraphSpacing * 2}pt; padding-top: 15px; border-top: 1px solid ${template.primary_color || '#2563eb'}; font-size: ${fontSizeBody - 3}pt; color: #666; text-align: center; }
    .footer-graphic { max-width: 100%; height: ${template.footer_graphic_height_mm || 25}mm; margin-bottom: 12px; }
    .footer-bottom { display: flex; justify-content: space-between; margin-top: 12px; }
  </style>
</head>
<body>
  ${watermarkHTML}
  <div class="document">
    <div class="header">
      <div class="logo">${template.logo_url ? `<img src="${template.logo_url}" alt="Logo">` : ''}</div>
      <div class="company-info">
        <div class="company-name">${template.company_name || 'Alpha Yachting'}</div>
        <div class="company-details">
          ${template.company_address ? `<div>${template.company_address}</div>` : ''}
          ${template.company_vat ? `<div>VAT: ${template.company_vat}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="doc-title">
      <h1 class="doc-type">${isInvoice ? 'INVOICE' : 'OFFER'}</h1>
      <div class="doc-number">${document.document_number}</div>
    </div>
    <div class="info-block">
      <div class="info-section">
        <div class="info-label">BILL TO:</div>
        <strong>${document.customer_name || ''}</strong>
        ${document.customer_address ? `<div>${document.customer_address}</div>` : ''}
      </div>
      <table style="width: 45%;">
        <tr><td style="width: 50%;">Issue Date:</td><td style="text-align: right;">${formatDate(document.issue_date)}</td></tr>
      </table>
    </div>
    <table>
      <thead><tr>
        <th class="col-index">#</th>
        <th class="col-description">Description</th>
        <th class="col-qty">Qty</th>
        <th class="col-unit">Unit</th>
        <th class="col-price">Unit Price</th>
        ${template.show_vat_column ? `<th class="col-vat">VAT %</th>` : ''}
        <th class="col-total">Total</th>
      </tr></thead>
      <tbody>
        ${lineItems.map((item, idx) => `<tr>
          <td class="col-index">${idx + 1}</td>
          <td class="col-description"><span class="item-title">${item.title || ''}</span>${item.description ? `<div class="item-desc">${item.description}</div>` : ''}</td>
          <td class="col-qty">${(item.quantity || 0).toFixed(2)}</td>
          <td class="col-unit">${item.unit || '-'}</td>
          <td class="col-price">${currency}${(item.unit_price || 0).toFixed(2)}</td>
          ${template.show_vat_column ? `<td class="col-vat">${item.tax_rate || 0}%</td>` : ''}
          <td class="col-total">${currency}${(item.total_gross || 0).toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>Subtotal (Net):</span><span>${currency}${(document.subtotal || 0).toFixed(2)}</span></div>
      ${Object.entries(taxBreakdown).map(([rate, amount]) => `<div class="total-row"><span>VAT ${rate}%:</span><span>${currency}${amount.toFixed(2)}</span></div>`).join('')}
      <div class="total-row final"><span>Total (Gross):</span><span>${currency}${(document.total || 0).toFixed(2)}</span></div>
    </div>
    ${document.public_notes ? `<div class="notes"><strong>Notes:</strong>
${document.public_notes}</div>` : ''}
    ${isInvoice && template.bank_iban ? `<div class="payment-info"><div style="font-weight: bold; margin-bottom: 6px;">Payment Information:</div><div><strong>IBAN:</strong> ${template.bank_iban}</div></div>` : ''}
    <div class="footer">
      ${template.footer_graphic_url ? `<img src="${template.footer_graphic_url}" alt="Footer" class="footer-graphic">` : ''}
      <div class="footer-bottom"><div>${template.company_name || 'Alpha Yachting'}</div><div>Generated: ${new Date().toLocaleDateString()}</div></div>
    </div>
  </div>
</body>
</html>`;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

Deno.serve(async (req) => {
  try {
    const { documentData, lineItems, templateData } = await req.json();
    
    const puppeteer = (await import('npm:puppeteer@23.11.1')).default;
    let browser;
    
    try {
      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      
      // Build unified HTML template
      const html = buildPDFHTML(documentData, lineItems, templateData);
      
      // Set content with print styling
      await page.setContent(html, { waitUntil: 'networkidle2' });
      
      // Generate PDF with proper A4 formatting
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false
      });
      
      await browser.close();
      
      // Convert to base64
      const base64PDF = pdfBuffer.toString('base64');
      
      return Response.json({
        success: true,
        pdf: `data:application/pdf;base64,${base64PDF}`,
        fileName: `${documentData.document_number || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`
      });
    } catch (error) {
      if (browser) await browser.close();
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 400 });
  }
});