// Template generation is embedded below since backend can't import from components
// This mirrors the same logic as components/pdf/pdfTemplateUtils.js

function buildPDFHTML(document, lineItems, template, payments = []) {
  const isInvoice = document.document_type === 'Invoice';
  const currency = document.currency === 'EUR' ? '€ ' : document.currency + ' ';

  // Configuration
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

  // Calculate totals - discount applied BEFORE VAT calculation
  const vatRate = document.vat_rate || 0;
  const subtotal = document.subtotal || 0;
  
  // Discount calculation
  const discountMode = document.discount_mode || 'NONE';
  let discountAmount = 0;
  
  if (discountMode === 'PERCENT' && document.discount_percent > 0) {
    discountAmount = Math.round(subtotal * document.discount_percent / 100 * 100) / 100;
  } else if (discountMode === 'TARGET_TOTAL' && document.discount_target_total > 0) {
    discountAmount = Math.max(0, Math.min(
      subtotal,
      Math.round((subtotal - document.discount_target_total) * 100) / 100
    ));
  }
  
  // Apply discount BEFORE VAT
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const taxTotal = Math.round(taxableBase * (vatRate / 100) * 100) / 100;

  const outstanding = isInvoice ? (document.total || 0) - (document.paid_amount || 0) : 0;

  // Watermark HTML
  const watermarkHTML = template.watermark_enabled
    ? `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(${template.watermark_angle ?? -45}deg);
        font-size: 72pt;
        font-weight: bold;
        color: #ccc;
        opacity: ${template.watermark_opacity ?? 0.1};
        pointer-events: none;
        white-space: nowrap;
        z-index: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      ">${template.watermark_text || 'DRAFT'}</div>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${document.document_number || 'Document'}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        html, body {
          width: 100%;
          height: 100%;
          background: white;
          font-family: ${fontFamily}, sans-serif;
          font-size: ${fontSizeBody}pt;
          line-height: ${lineSpacing};
          color: #333;
        }

        @page {
          size: A4;
          margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
        }

        @media print {
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }

        .document {
          width: 100%;
          background: white;
          position: relative;
        }

        .header {
          margin-bottom: ${paragraphSpacing}pt;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
        }

        .logo {
          flex: 0 0 auto;
        }

        .logo img {
          height: ${template.logo_height_mm || 20}mm;
          object-fit: contain;
        }

        .company-info {
          flex: 1;
        }

        .company-name {
          font-size: ${fontSizeCompanyName}pt;
          font-weight: bold;
          color: ${template.primary_color || '#2563eb'};
          margin-bottom: 5px;
        }

        .company-details {
          font-size: ${fontSizeBody - 2}pt;
          color: #555;
          line-height: ${lineSpacing};
        }

        .doc-title {
          margin-bottom: ${paragraphSpacing}pt;
        }

        .doc-type {
          font-size: ${fontSizeHeading}pt;
          color: ${template.primary_color || '#2563eb'};
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: bold;
          margin: 0;
        }

        .doc-number {
          font-size: ${fontSizeBody}pt;
          margin-top: 6px;
          font-weight: bold;
        }

        .info-block {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .info-section {
          width: 50%;
        }

        .info-label {
          font-size: 8pt;
          color: #666;
          margin-bottom: 4px;
          font-weight: bold;
        }

        .info-content {
          font-size: 10pt;
          line-height: 1.4;
        }

        .info-content strong {
          font-weight: bold;
          margin-bottom: 2px;
          display: block;
        }

        .info-content div {
          color: #333;
          font-size: 9pt;
          white-space: pre-line;
        }

        .meta-table {
          width: 100%;
          font-size: 9pt;
          border-collapse: collapse;
        }

        .meta-table td {
          padding: 3px 0;
        }

        .meta-label {
          color: #666;
          font-weight: bold;
          width: 50%;
        }

        .meta-value {
          text-align: right;
        }

        .vessel-info {
          margin-bottom: 15px;
          padding: 8px 10px;
          background-color: #f8fafc;
          border-radius: 3px;
          font-size: 9pt;
          line-height: 1.3;
        }

        .vessel-info > div {
          margin: 0;
        }

        .vessel-info .detail {
          color: #666;
          font-size: 8pt;
          margin-top: 1px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 9pt;
          background: transparent;
          border: none;
        }

        thead {
          background-color: transparent;
          color: #333;
          display: table-header-group;
        }

        th {
          padding: 4px 3px;
          text-align: left;
          font-weight: bold;
          border: none;
          white-space: nowrap;
        }

        td {
          padding: 4px 3px;
          border: none;
        }

        tbody tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        tbody tr:nth-child(even) {
          background-color: transparent;
        }

        .col-index {
          width: ${columnWidths.index}%;
          text-align: ${columnAlign.index};
        }

        .col-description {
          width: ${columnWidths.description}%;
          text-align: ${columnAlign.description};
        }

        .col-qty {
          width: ${columnWidths.quantity}%;
          text-align: ${columnAlign.quantity};
        }

        .col-unit {
          width: ${columnWidths.unit}%;
          text-align: ${columnAlign.unit};
        }

        .col-price {
          width: ${columnWidths.unit_price}%;
          text-align: ${columnAlign.unit_price};
        }

        .col-vat {
          width: ${columnWidths.vat}%;
          text-align: ${columnAlign.vat};
        }

        .col-total {
          width: ${columnWidths.total}%;
          text-align: ${columnAlign.total};
        }

        .item-title {
          font-weight: bold;
          font-size: 10pt;
          display: block;
        }

        .item-desc {
          font-size: 8pt;
          color: #666;
          margin-top: 2px;
          white-space: pre-line;
          line-height: 1.2;
        }

        .totals {
          width: 45%;
          margin-left: auto;
          margin-bottom: 20px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #ddd;
          font-size: 10pt;
        }

        .total-row.final {
          border-top: 2px solid #000;
          border-bottom: 2px solid ${template.primary_color || '#2563eb'};
          font-weight: bold;
          font-size: 12pt;
          padding: 12px 0;
        }

        .total-row.paid {
          color: #059669;
        }

        .total-row.outstanding {
          font-weight: bold;
          font-size: 11pt;
        }

        .notes {
          margin-bottom: 15px;
          padding: 12px;
          background-color: #f5f5f5;
          border-left: 3px solid ${template.primary_color || '#2563eb'};
          font-size: 10pt;
          line-height: 1.4;
          page-break-inside: avoid;
          break-inside: avoid;
          white-space: pre-line;
        }

        .payment-info {
          margin-bottom: 15px;
          padding: 12px;
          background-color: #eff6ff;
          border-radius: 3px;
          border: 1px solid #dbeafe;
          font-size: 9pt;
          line-height: 1.3;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .payment-info-title {
          font-size: 8pt;
          font-weight: bold;
          margin-bottom: 6px;
        }

        .payment-terms-box {
          margin-bottom: 15px;
          padding: 12px;
          background-color: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 3px;
          font-size: 9pt;
          line-height: 1.3;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .payment-terms-title {
          font-family: ${fontFamily}, sans-serif;
          font-size: 10pt;
          font-weight: bold;
          margin-bottom: 6px;
          color: #92400e;
          letter-spacing: normal;
        }

        .downpayment-info {
          margin: 6px 0;
          padding: 6px 0;
          border-bottom: 1px solid #fcd34d;
        }

        .downpayment-info:last-child {
          border-bottom: none;
        }

        .ownership-notice {
          margin-bottom: 15px;
          padding: 12px;
          background-color: #fee2e2;
          border-left: 4px solid #dc2626;
          border-radius: 3px;
          font-size: 9pt;
          line-height: 1.3;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .ownership-title {
          font-family: ${fontFamily}, sans-serif;
          font-size: 10pt;
          font-weight: bold;
          margin-bottom: 6px;
          color: #7f1d1d;
          letter-spacing: normal;
        }

        .ownership-text {
          color: #7f1d1d;
          white-space: pre-line;
        }

        .safety-compliance {
          margin-bottom: 15px;
          padding: 12px;
          background-color: #f0fdf4;
          border-left: 4px solid #16a34a;
          border-radius: 3px;
          font-size: 9pt;
          line-height: 1.3;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .safety-title {
          font-family: ${fontFamily}, sans-serif;
          font-size: 10pt;
          font-weight: bold;
          margin-bottom: 6px;
          color: #14532d;
          letter-spacing: normal;
        }

        .safety-text {
          color: #14532d;
          white-space: pre-line;
        }

        .footer {
          margin-top: ${paragraphSpacing * 2}pt;
          padding-top: 15px;
          border-top: 1px solid ${template.primary_color || '#2563eb'};
          font-size: ${fontSizeBody - 3}pt;
          color: #666;
          text-align: center;
          line-height: ${lineSpacing};
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .footer-graphic {
          max-width: 100%;
          height: ${template.footer_graphic_height_mm || 25}mm;
          margin-bottom: 12px;
          object-fit: contain;
        }

        .footer-text {
          margin-bottom: 8px;
        }

        .footer-bottom {
          display: flex;
          justify-content: space-between;
          font-size: ${fontSizeBody - 3}pt;
          margin-top: 12px;
        }

        .gallery-appendix {
          page-break-before: always;
          margin-top: 0;
          padding-top: 20px;
        }

        .gallery-title {
          font-size: ${fontSizeHeading}pt;
          color: ${template.primary_color || '#2563eb'};
          font-weight: bold;
          margin-bottom: 12px;
        }

        .gallery-intro {
          margin-bottom: 20px;
          padding: 12px;
          background-color: #f8fafc;
          border-left: 3px solid ${template.primary_color || '#2563eb'};
          font-size: 9pt;
          line-height: 1.4;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 15px;
        }

        .gallery-item {
          page-break-inside: avoid;
          break-inside: avoid;
          text-align: center;
        }

        .gallery-image {
          width: 100%;
          max-width: 200px;
          margin: 0 auto 10px;
          border: 1px solid #ddd;
          border-radius: 3px;
          display: block;
        }

        .gallery-caption {
          font-size: 9pt;
          color: #333;
          line-height: 1.3;
          margin-top: 8px;
          font-style: italic;
        }

        .gallery-no-image {
          width: 100%;
          max-width: 200px;
          height: 150px;
          margin: 0 auto 10px;
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8pt;
          color: #999;
        }
      </style>
    </head>
    <body>
      ${watermarkHTML}
      <div class="document">
        <div class="header">
          <div class="logo">
            ${template.logo_url ? `<img src="${template.logo_url}" alt="Logo">` : ''}
          </div>
          <div class="company-info">
            <div class="company-name">${template.company_name || 'Alpha Yachting'}</div>
            <div class="company-details">
              ${template.company_address ? `<div>${template.company_address}</div>` : ''}
              ${template.company_vat ? `<div>VAT: ${template.company_vat}</div>` : ''}
              ${template.company_registration ? `<div>Reg: ${template.company_registration}</div>` : ''}
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
            <div class="info-content">
              <strong>${document.customer_name || ''}</strong>
              ${document.customer_address ? `<div>${document.customer_address}</div>` : ''}
              ${document.customer_vat ? `<div style="margin-top: 4px;">VAT: ${document.customer_vat}</div>` : ''}
            </div>
          </div>
          <div style="width: 45%;">
            <table class="meta-table">
              <tr>
                <td class="meta-label">Issue Date:</td>
                <td class="meta-value">${formatDate(document.issue_date)}</td>
              </tr>
              ${isInvoice && document.due_date ? `
                <tr>
                  <td class="meta-label">Due Date:</td>
                  <td class="meta-value">${formatDate(document.due_date)}</td>
                </tr>
              ` : ''}
              ${!isInvoice && document.valid_until ? `
                <tr>
                  <td class="meta-label">Valid Until:</td>
                  <td class="meta-value">${formatDate(document.valid_until)}</td>
                </tr>
              ` : ''}
              ${document.payment_terms ? `
                <tr>
                  <td class="meta-label">Payment Terms:</td>
                  <td class="meta-value">${document.payment_terms}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        </div>

        ${document.boat_name || document.location_name ? `
          <div class="vessel-info">
            ${document.boat_name ? `<div><strong>Vessel:</strong> ${document.boat_name}</div>` : ''}
            ${document.boat_details ? `<div class="detail">${document.boat_details}</div>` : ''}
            ${document.location_name ? `<div style="margin-top: 3px;"><strong>Location:</strong> ${document.location_name}</div>` : ''}
          </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th class="col-index">#</th>
              <th class="col-description">Description</th>
              <th class="col-qty">Qty</th>
              <th class="col-unit">Unit</th>
              <th class="col-price">Unit Price</th>
              ${template.show_vat_column ? `<th class="col-vat">VAT %</th>` : ''}
              <th class="col-total">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems.map((item, idx) => `
              <tr ${item.is_optional ? 'style="opacity: 0.7; background-color: #fffbeb;"' : ''}>
                <td class="col-index">${idx + 1}</td>
                <td class="col-description">
                  <span class="item-title">${item.title || ''}${item.is_optional ? ' <span style="font-size: 8pt; font-weight: bold; color: #92400e; background: #fef3c7; padding: 2px 6px; border-radius: 3px; border: 1px solid #fde68a;">(Optional)</span>' : ''}</span>
                  ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
                </td>
                <td class="col-qty">${(item.quantity || 0).toFixed(2)}</td>
                <td class="col-unit">${item.unit || '-'}</td>
                <td class="col-price">${currency}${(item.unit_price || 0).toFixed(2)}</td>
                ${template.show_vat_column ? `<td class="col-vat">-</td>` : ''}
                <td class="col-total">${item.is_optional ? '<span style="color: #92400e; font-weight: bold;">Optional</span>' : `${currency}${(item.total_net || 0).toFixed(2)}`}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal (excl. VAT):</span>
            <span>${currency}${(document.subtotal || 0).toFixed(2)}</span>
          </div>
          ${discountAmount > 0 ? `
            <div class="total-row">
              <span>Discount ${discountMode === 'PERCENT' ? `(${document.discount_percent}%)` : ''}:</span>
              <span>-${currency}${discountAmount.toFixed(2)}</span>
            </div>
          ` : ''}
          ${vatRate > 0 ? `
            <div class="total-row">
              <span>VAT ${vatRate}%:</span>
              <span>${currency}${taxTotal.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row final">
            <span>Total (incl. VAT):</span>
            <span>${currency}${(taxableBase + taxTotal).toFixed(2)}</span>
          </div>
          ${isInvoice && document.paid_amount > 0 ? `
            <div class="total-row paid">
              <span>Paid:</span>
              <span>-${currency}${document.paid_amount.toFixed(2)}</span>
            </div>
            <div class="total-row outstanding">
              <span>Outstanding:</span>
              <span style="color: ${outstanding > 0 ? '#dc2626' : '#059669'}">${currency}${outstanding.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>

        ${document.public_notes ? `
          <div class="notes"><strong>Notes:</strong>
${document.public_notes}</div>
        ` : ''}

        ${!isInvoice && document.payment_terms_type ? `
          <div class="payment-terms-box">
            <div class="payment-terms-title">Payment Terms</div>
            ${document.payment_terms_type === 'Downpayment' ? `
              <div class="downpayment-info">
                <div><strong>Downpayment:</strong> ${document.downpayment_percent || 0}% (${currency}${(document.downpayment_amount || 0).toFixed(2)})</div>
                <div><strong>Remaining:</strong> ${100 - (document.downpayment_percent || 0)}% (${currency}${((document.total || 0) - (document.downpayment_amount || 0)).toFixed(2)})</div>
              </div>
              ${document.payment_schedule ? `<div class="downpayment-info" style="border-bottom: none;">${document.payment_schedule}</div>` : ''}
            ` : ''}
            ${document.payment_terms_type === 'Installments' ? `
              <div style="margin: 6px 0;">${document.payment_schedule || 'Payment in installments as agreed'}</div>
            ` : ''}
            ${document.payment_terms_type === 'Full' ? `
              <div style="margin: 6px 0;">Payment in full upon invoice</div>
            ` : ''}
          </div>
        ` : ''}

        ${!isInvoice && document.retention_of_title_enabled ? `
          <div class="ownership-notice">
            <div class="ownership-title">Retention of Title / Eigentumsvorbehalt</div>
            <div class="ownership-text">${document.retention_of_title_text || 'All delivered goods and services remain the property of Alpha Yachting until full payment has been received.'}</div>
          </div>
        ` : ''}

        ${!isInvoice && document.safety_compliance_clause ? `
          <div class="safety-compliance">
            <div class="safety-title">${document.language === 'English' ? 'Safety & Environmental Compliance' : 'Sicherheits- & Umwelthinweis'}</div>
            <div class="safety-text">${document.safety_compliance_clause}</div>
          </div>
        ` : ''}

        ${isInvoice && template.bank_iban ? `
          <div class="payment-info">
            <div class="payment-info-title">Payment Information:</div>
            ${template.bank_name ? `<div><strong>Bank:</strong> ${template.bank_name}</div>` : ''}
            <div><strong>IBAN:</strong> ${template.bank_iban}</div>
            ${template.bank_bic ? `<div><strong>BIC:</strong> ${template.bank_bic}</div>` : ''}
            <div style="margin-top: 4px; color: #666; font-size: 8pt;">Payment reference: ${document.document_number}</div>
          </div>
        ` : ''}

        <div class="footer">
          ${template.footer_graphic_url ? `<img src="${template.footer_graphic_url}" alt="Footer" class="footer-graphic">` : ''}
          ${template.footer_text ? `<div class="footer-text">${template.footer_text}</div>` : ''}
          ${template.custom_footer ? `<div class="footer-text" style="border-top: 1px solid #ddd; padding-top: 8px;">${template.custom_footer}</div>` : ''}
          <div class="footer-bottom">
            <div>${template.company_name || 'Alpha Yachting'}</div>
            <div>Generated: ${new Date().toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        ${document.attachments && document.attachments.length > 0 ? `
          <div class="gallery-appendix">
            <h2 class="gallery-title">Photo Documentation (Appendix)</h2>
            <div class="gallery-intro">Attached photos for documentation purposes.</div>
            <div class="gallery-grid">
              ${document.attachments.map((imageUrl, idx) => {
                const meta = document.gallery_meta?.[imageUrl] || {};
                const caption = meta.caption || '';
                return `
                  <div class="gallery-item">
                    <img src="${imageUrl}" alt="Photo ${idx + 1}" class="gallery-image" onerror="this.outerHTML='<div class=&quot;gallery-no-image&quot;>Image unavailable</div>'">
                    ${caption ? `<div class="gallery-caption">${caption}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
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