// Shared HTML template generator for PDF export and preview
// Single source of truth for both backend (Puppeteer) and frontend (React preview)

export function buildPDFHTML(document, lineItems, template, payments = []) {
  const isInvoice = document.document_type === 'Invoice';
  const currency = document.currency === 'EUR' ? '€' : document.currency;

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

  // Calculate totals
  const taxBreakdown = lineItems.reduce((acc, item) => {
    const rate = item.tax_rate || 0;
    if (!acc[rate]) acc[rate] = 0;
    acc[rate] += item.total_tax || 0;
    return acc;
  }, {});

  const outstanding = isInvoice ? (document.total || 0) - (document.paid_amount || 0) : 0;

  // Letterhead background CSS
  const letterheadCSS = template.letterhead_image_url
    ? `
      body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: url('${template.letterhead_image_url}');
        background-attachment: fixed;
        background-size: 210mm 297mm;
        background-repeat: no-repeat;
        z-index: -1;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    `
    : '';

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

        /* Header */
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

        /* Document Title */
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

        /* Customer & Meta Info */
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

        /* Boat & Location Info */
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

        /* Line Items Table */
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 10pt;
        }

        thead {
          background-color: ${template.primary_color || '#2563eb'};
          color: white;
          display: table-header-group;
        }

        th {
          padding: 8px 6px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #ddd;
          white-space: nowrap;
        }

        td {
          padding: 8px 6px;
          border: 1px solid #ddd;
        }

        tbody tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        tbody tr:nth-child(even) {
          background-color: #f9f9f9;
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

        /* Totals Section */
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

        /* Notes & Payment */
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

        /* Footer */
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
      </style>
      ${letterheadCSS}
    </head>
    <body>
      ${watermarkHTML}
      <div class="document">
        <!-- Header -->
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

        <!-- Document Title -->
        <div class="doc-title">
          <h1 class="doc-type">${isInvoice ? 'INVOICE' : 'OFFER'}</h1>
          <div class="doc-number">${document.document_number}</div>
        </div>

        <!-- Customer & Meta Info -->
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

        <!-- Vessel & Location Info -->
        ${document.boat_name || document.location_name ? `
          <div class="vessel-info">
            ${document.boat_name ? `<div><strong>Vessel:</strong> ${document.boat_name}</div>` : ''}
            ${document.boat_details ? `<div class="detail">${document.boat_details}</div>` : ''}
            ${document.location_name ? `<div style="margin-top: 3px;"><strong>Location:</strong> ${document.location_name}</div>` : ''}
          </div>
        ` : ''}

        <!-- Line Items Table -->
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
              <tr>
                <td class="col-index">${idx + 1}</td>
                <td class="col-description">
                  <span class="item-title">${item.title || ''}</span>
                  ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
                </td>
                <td class="col-qty">${(item.quantity || 0).toFixed(2)}</td>
                <td class="col-unit">${item.unit || '-'}</td>
                <td class="col-price">${currency}${(item.unit_price || 0).toFixed(2)}</td>
                ${template.show_vat_column ? `<td class="col-vat">${item.tax_rate || 0}%</td>` : ''}
                <td class="col-total">${currency}${(item.total_gross || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="totals">
          <div class="total-row">
            <span>Subtotal (Net):</span>
            <span>${currency}${(document.subtotal || 0).toFixed(2)}</span>
          </div>
          ${Object.entries(taxBreakdown).map(([rate, amount]) => `
            <div class="total-row">
              <span style="color: #666;">VAT ${rate}%:</span>
              <span style="color: #666;">${currency}${amount.toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="total-row final">
            <span>Total (Gross):</span>
            <span>${currency}${(document.total || 0).toFixed(2)}</span>
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

        <!-- Notes -->
        ${document.public_notes ? `
          <div class="notes"><strong>Notes:</strong>
${document.public_notes}</div>
        ` : ''}

        <!-- Payment Info -->
        ${isInvoice && template.bank_iban ? `
          <div class="payment-info">
            <div class="payment-info-title">Payment Information:</div>
            ${template.bank_name ? `<div><strong>Bank:</strong> ${template.bank_name}</div>` : ''}
            <div><strong>IBAN:</strong> ${template.bank_iban}</div>
            ${template.bank_bic ? `<div><strong>BIC:</strong> ${template.bank_bic}</div>` : ''}
            <div style="margin-top: 4px; color: #666; font-size: 8pt;">Payment reference: ${document.document_number}</div>
          </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          ${template.footer_graphic_url ? `<img src="${template.footer_graphic_url}" alt="Footer" class="footer-graphic">` : ''}
          ${template.footer_text ? `<div class="footer-text">${template.footer_text}</div>` : ''}
          ${template.custom_footer ? `<div class="footer-text" style="border-top: 1px solid #ddd; padding-top: 8px;">${template.custom_footer}</div>` : ''}
          <div class="footer-bottom">
            <div>${template.company_name || 'Alpha Yachting'}</div>
            <div>Generated: ${new Date().toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
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