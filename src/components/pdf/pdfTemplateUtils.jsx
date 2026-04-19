// Shared PDF HTML template generator for both frontend preview and backend export
// Used by: PDFDocumentTemplate (React preview), generateOfferPDF (Puppeteer export)

// Centralized PDF label translations
const PDF_LABELS = {
  German:    { docOffer: 'ANGEBOT', docInvoice: 'RECHNUNG', billTo: 'RECHNUNGSEMPFÄNGER', issueDate: 'Ausstellungsdatum', dueDate: 'Fälligkeitsdatum', validUntil: 'Gültig bis', paymentTerms: 'Zahlungsbedingungen', vessel: 'Fahrzeug', location: 'Standort', description: 'Beschreibung', qty: 'Menge', unit: 'Einheit', unitPrice: 'Einzelpreis', vat: 'MwSt.', total: 'Gesamt', subtotalNet: 'Zwischensumme (Netto)', discount: 'Rabatt', taxableBase: 'Steuerbasis (Netto)', totalGross: 'Gesamtbetrag (Brutto)', paid: 'Bezahlt', outstanding: 'Offen', paymentInfo: 'Zahlungsinformationen', galleryTitle: 'Fotodokumentation (Anhang)', galleryIntro: 'Beigefügte Fotos zur Dokumentation.', vat_label: 'USt.', retentionFallback: 'Alle gelieferten Waren und Leistungen bleiben bis zur vollständigen Bezahlung Eigentum von Alpha Yachting.' },
  English:   { docOffer: 'OFFER', docInvoice: 'INVOICE', billTo: 'BILL TO', issueDate: 'Issue Date', dueDate: 'Due Date', validUntil: 'Valid Until', paymentTerms: 'Payment Terms', vessel: 'Vessel', location: 'Location', description: 'Description', qty: 'Qty', unit: 'Unit', unitPrice: 'Unit Price', vat: 'VAT %', total: 'Total', subtotalNet: 'Subtotal (Net)', discount: 'Discount', taxableBase: 'Taxable Base (Net)', totalGross: 'Total (Gross)', paid: 'Paid', outstanding: 'Outstanding', paymentInfo: 'Payment Information', galleryTitle: 'Photo Documentation (Appendix)', galleryIntro: 'Attached photos for documentation purposes.', vat_label: 'VAT', retentionFallback: 'All delivered goods and services remain the property of Alpha Yachting until full payment has been received.' },
  Italian:   { docOffer: 'OFFERTA', docInvoice: 'FATTURA', billTo: 'DESTINATARIO', issueDate: 'Data di emissione', dueDate: 'Data di scadenza', validUntil: 'Valido fino', paymentTerms: 'Termini di pagamento', vessel: 'Imbarcazione', location: 'Posizione', description: 'Descrizione', qty: 'Qtà', unit: 'Unità', unitPrice: 'Prezzo unitario', vat: 'IVA %', total: 'Totale', subtotalNet: 'Subtotale (netto)', discount: 'Sconto', taxableBase: 'Base imponibile', totalGross: 'Totale (lordo)', paid: 'Pagato', outstanding: 'Da pagare', paymentInfo: 'Informazioni di pagamento', galleryTitle: 'Documentazione fotografica', galleryIntro: 'Foto allegate a scopo documentale.', vat_label: 'IVA', retentionFallback: 'Tutti i beni e servizi consegnati rimangono di proprietà di Alpha Yachting fino al pagamento completo.' },
  Slovenian: { docOffer: 'PONUDBA', docInvoice: 'RAČUN', billTo: 'PREJEMNIK', issueDate: 'Datum izdaje', dueDate: 'Datum zapadlosti', validUntil: 'Veljavno do', paymentTerms: 'Plačilni pogoji', vessel: 'Plovilo', location: 'Lokacija', description: 'Opis', qty: 'Kol.', unit: 'Enota', unitPrice: 'Cena/enota', vat: 'DDV %', total: 'Skupaj', subtotalNet: 'Vmesni seštevek (brez DDV)', discount: 'Popust', taxableBase: 'Osnova za DDV', totalGross: 'Skupaj (bruto)', paid: 'Plačano', outstanding: 'Odprto', paymentInfo: 'Podatki za plačilo', galleryTitle: 'Fotodokumentacija (priloga)', galleryIntro: 'Priložene fotografije za dokumentacijo.', vat_label: 'DDV', retentionFallback: 'Vso dobavljeno blago in storitve ostanejo last podjetja Alpha Yachting do popolnega plačila.' },
  Croatian:  { docOffer: 'PONUDA', docInvoice: 'RAČUN', billTo: 'PRIMATELJ', issueDate: 'Datum izdavanja', dueDate: 'Datum dospijeća', validUntil: 'Vrijedi do', paymentTerms: 'Uvjeti plaćanja', vessel: 'Plovilo', location: 'Lokacija', description: 'Opis', qty: 'Kol.', unit: 'Jed.', unitPrice: 'Jed. cijena', vat: 'PDV %', total: 'Ukupno', subtotalNet: 'Međuzbroj (bez PDV-a)', discount: 'Popust', taxableBase: 'Osnovica za PDV', totalGross: 'Ukupno (bruto)', paid: 'Plaćeno', outstanding: 'Za uplatu', paymentInfo: 'Podaci za plaćanje', galleryTitle: 'Fotodokumentacija (prilog)', galleryIntro: 'Priložene fotografije za dokumentaciju.', vat_label: 'PDV', retentionFallback: 'Sva isporučena roba i usluge ostaju vlasništvo tvrtke Alpha Yachting do potpune uplate.' },
};

export function buildPDFHTML(document, lineItems, template, payments = [], offerSections = []) {
  const isInvoice = document.document_type === 'Invoice';
  const currency = document.currency === 'EUR' ? '€ ' : document.currency + ' ';
  const lang = document.language || 'German';
  const L = PDF_LABELS[lang] || PDF_LABELS.German;

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
    description: 40,
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
  
  // Use pre-calculated discount from frontend (single source of truth)
  const discountMode = document.discount_mode || 'NONE';
  const discountPercent = document.discount_percent;
  const discountAmount = document.discount_amount || 0;
  
  // Deterministic discount active flag
  const discountActive = discountMode !== 'NONE' && 
                         discountAmount != null && 
                         Math.abs(discountAmount) > 0.005;
  
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
          line-height: 1.2;
        }
        .item-desc strong, .item-desc b { font-weight: bold; }
        .item-desc em, .item-desc i { font-style: italic; }
        .item-desc u { text-decoration: underline; }
        .item-desc ol, .item-desc ul {
          margin: 0;
          padding-left: 12pt;
        }
        .item-desc li {
          margin-bottom: 0;
          line-height: 1.3;
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

        /* Gallery Appendix */
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

        /* Module Sections */
        .modules-section {
          margin-bottom: 20px;
          padding: 12px;
          background-color: #f8fafc;
          border-left: 3px solid ${template.primary_color || '#2563eb'};
          border-radius: 3px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .modules-title {
          font-size: 11pt;
          font-weight: bold;
          color: ${template.primary_color || '#2563eb'};
          margin-bottom: 10px;
        }

        .module-item {
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
        }

        .module-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .module-name {
          font-size: 10pt;
          font-weight: bold;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .module-description {
          font-size: 9pt;
          color: #475569;
          line-height: 1.4;
          margin-bottom: 6px;
        }

        .module-bullets {
          font-size: 9pt;
          color: #64748b;
          line-height: 1.3;
          padding-left: 8px;
        }

        .module-bullets li {
          margin-bottom: 2px;
        }
      </style>
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
          <h1 class="doc-type">${isInvoice ? L.docInvoice : L.docOffer}</h1>
          <div class="doc-number">${document.document_number}</div>
        </div>

        <!-- Customer & Meta Info -->
        <div class="info-block">
          <div class="info-section">
            <div class="info-label">${L.billTo}:</div>
            <div class="info-content">
              <strong>${document.customer_name || ''}</strong>
              ${document.customer_address ? `<div>${document.customer_address}</div>` : ''}
              ${document.customer_vat ? `<div style="margin-top: 4px;">${L.vat_label}: ${document.customer_vat}</div>` : ''}
            </div>
          </div>
          <div style="width: 45%;">
            <table class="meta-table">
              <tr>
                <td class="meta-label">${L.issueDate}:</td>
                <td class="meta-value">${formatDate(document.issue_date)}</td>
              </tr>
              ${isInvoice && document.due_date ? `
                <tr>
                  <td class="meta-label">${L.dueDate}:</td>
                  <td class="meta-value">${formatDate(document.due_date)}</td>
                </tr>
              ` : ''}
              ${!isInvoice && document.valid_until ? `
                <tr>
                  <td class="meta-label">${L.validUntil}:</td>
                  <td class="meta-value">${formatDate(document.valid_until)}</td>
                </tr>
              ` : ''}
              ${document.payment_terms ? `
                <tr>
                  <td class="meta-label">${L.paymentTerms}:</td>
                  <td class="meta-value">${document.payment_terms}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        </div>

        <!-- Vessel & Location Info -->
        ${document.boat_name || document.location_name ? `
          <div class="vessel-info">
            ${document.boat_name ? `<div><strong>${L.vessel}:</strong> ${document.boat_name}</div>` : ''}
            ${document.boat_details ? `<div class="detail">${document.boat_details}</div>` : ''}
            ${document.location_name ? `<div style="margin-top: 3px;"><strong>${L.location}:</strong> ${document.location_name}</div>` : ''}
          </div>
        ` : ''}

        <!-- Module Sections (Offers Only) -->
        ${!isInvoice && offerSections && offerSections.filter(s => s.section_type === 'MODULE').length > 0 ? `
          <div class="modules-section">
            <div class="modules-title">${document.language === 'English' ? 'Selected Service Packages' : 'Ausgewählte Servicepakete'}</div>
            ${offerSections
              .filter(s => s.section_type === 'MODULE')
              .map((section, idx) => `
                <div class="module-item">
                  <div class="module-name">${idx + 1}. ${section.title || ''}</div>
                  ${section.description ? `<div class="module-description">${section.description}</div>` : ''}
                  ${section.bullets_json && section.bullets_json.length > 0 ? `
                    <ul class="module-bullets">
                      ${section.bullets_json.map(bullet => `<li>• ${bullet}</li>`).join('')}
                    </ul>
                  ` : ''}
                </div>
              `).join('')}
          </div>
        ` : ''}

        <!-- Line Items Table -->
        <table>
          <thead>
            <tr>
              <th class="col-index">#</th>
              <th class="col-description">${L.description}</th>
              <th class="col-qty">${L.qty}</th>
              <th class="col-unit">${L.unit}</th>
              <th class="col-price">${L.unitPrice}</th>
              ${template.show_vat_column ? `<th class="col-vat">${L.vat}</th>` : ''}
              <th class="col-total">${L.total}</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              let rowNum = 0;
              return lineItems.map((item) => {
                if (item.item_type === 'Chapter' || item.unit_type === 'Lump Sum' && item.quantity === 0 && item.unit_price === 0 && item.total_net === 0 && item.title) {
                  // Check more robustly
                }
                if (item.item_type === 'Chapter') {
                  const colSpan = template.show_vat_column ? 7 : 6;
                  // Strip leading numbering like "1. ", "2. ", "1) " etc. from title
                  const chapterTitle = (item.title || '').replace(/^\d+[\.\)]\s*/, '');
                  return `
                    <tr style="page-break-inside: avoid;">
                      <td style="padding: 0; border: none; height: 12px;" colspan="${colSpan}"></td>
                    </tr>
                    <tr style="page-break-inside: avoid;">
                      <td colspan="${colSpan}" style="padding: 7px 8px 7px 0; background-color: transparent; border-bottom: 2px solid #1e293b; font-weight: bold; font-size: 11pt; color: #1e293b; letter-spacing: 0.2px;">
                        ${chapterTitle}
                      </td>
                    </tr>
                  `;
                }
                rowNum++;
                return `
                  <tr ${item.is_optional ? 'style="opacity: 0.7; background-color: #fffbeb;"' : ''}>
                    <td class="col-index">${rowNum}</td>
                    <td class="col-description">
                      <span class="item-title">${item.title || ''}${item.title_hr ? ` <span style="font-weight: normal; color: #64748b;">/ ${item.title_hr}</span>` : ''}${item.is_optional ? ' <span style="font-size: 8pt; font-weight: bold; color: #92400e; background: #fef3c7; padding: 2px 6px; border-radius: 3px; border: 1px solid #fde68a;">(Optional)</span>' : ''}</span>
                      ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
                    </td>
                    <td class="col-qty">${(item.quantity || 0).toFixed(2)}</td>
                    <td class="col-unit">${item.unit || '-'}</td>
                    <td class="col-price">${currency}${(item.unit_price || 0).toFixed(2)}</td>
                    ${template.show_vat_column ? `<td class="col-vat">-</td>` : ''}
                    <td class="col-total">${item.is_optional ? '<span style="color: #92400e; font-weight: bold;">Optional</span>' : `${currency}${(item.total_net || 0).toFixed(2)}`}</td>
                  </tr>
                `;
              }).join('');
            })()}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="totals">
          <div class="total-row">
            <span>${L.subtotalNet}:</span>
            <span>${currency}${(document.subtotal || 0).toFixed(2)}</span>
          </div>
          ${discountActive ? `
            <div class="total-row">
              <span>${L.discount}${discountMode === 'PERCENT' && discountPercent != null ? ` (${discountPercent.toFixed(1)}%)` : ''}:</span>
              <span>-${currency}${discountAmount.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>${L.taxableBase}:</span>
              <span>${currency}${taxableBase.toFixed(2)}</span>
            </div>
          ` : ''}
          ${vatRate > 0 ? `
            <div class="total-row">
              <span>${L.vat_label} ${vatRate}%:</span>
              <span>${currency}${taxTotal.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row final">
            <span>${L.totalGross}:</span>
            <span>${currency}${(taxableBase + taxTotal).toFixed(2)}</span>
          </div>
          ${isInvoice && document.paid_amount > 0 ? `
            <div class="total-row paid">
              <span>${L.paid}:</span>
              <span>-${currency}${document.paid_amount.toFixed(2)}</span>
            </div>
            <div class="total-row outstanding">
              <span>${L.outstanding}:</span>
              <span style="color: ${outstanding > 0 ? '#dc2626' : '#059669'}">${currency}${outstanding.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>

        <!-- Payment Terms (Offers Only) — shown BEFORE notes -->
        ${!isInvoice && document.payment_terms_type ? (() => {
          const lang = document.language || 'German';
          const labels = {
            paymentTermsTitle: { German: 'Zahlungsbedingungen', English: 'Payment Terms', Italian: 'Termini di pagamento', Slovenian: 'Plačilni pogoji', Croatian: 'Uvjeti plaćanja' },
            downpayment: { German: 'Anzahlung', English: 'Downpayment', Italian: 'Acconto', Slovenian: 'Predplačilo', Croatian: 'Predujam' },
            remaining: { German: 'Restbetrag', English: 'Remaining', Italian: 'Residuo', Slovenian: 'Preostalo', Croatian: 'Ostatak' },
            fullPayment: { German: 'Zahlung in voller Höhe bei Rechnungsstellung', English: 'Payment in full upon invoice', Italian: 'Pagamento completo alla fattura', Slovenian: 'Plačilo v celoti ob računu', Croatian: 'Plaćanje u cijelosti po računu' },
            installmentsDefault: { German: 'Ratenzahlung gemäß Vereinbarung', English: 'Payment in installments as agreed', Italian: 'Pagamento a rate come concordato', Slovenian: 'Plačilo v obrokih po dogovoru', Croatian: 'Plaćanje u ratama prema dogovoru' },
          };
          const t = (key) => (labels[key] && labels[key][lang]) || labels[key]['German'];
          return `
          <div class="payment-terms-box">
            <div class="payment-terms-title">${t('paymentTermsTitle')}</div>
            ${document.payment_terms_type === 'Downpayment' ? `
              <div class="downpayment-info">
                ${document.payment_schedule
                  ? `<div>${document.payment_schedule}</div>`
                  : `<div><strong>${t('downpayment')}:</strong> ${document.downpayment_percent || 0}% &nbsp;(${document.currency || 'EUR'} ${(document.downpayment_amount || 0).toFixed(2)})</div>
                     <div><strong>${t('remaining')}:</strong> ${100 - (document.downpayment_percent || 0)}% &nbsp;(${document.currency || 'EUR'} ${((document.total || 0) - (document.downpayment_amount || 0)).toFixed(2)})</div>`
                }
              </div>
            ` : ''}
            ${document.payment_terms_type === 'Installments' ? `
              <div style="margin: 6px 0;">${document.payment_schedule || t('installmentsDefault')}</div>
            ` : ''}
            ${document.payment_terms_type === 'Full' ? `
              <div style="margin: 6px 0;">${t('fullPayment')}</div>
            ` : ''}
          </div>
        `;
        })() : ''}

        <!-- Notes (after Payment Terms) -->
        ${document.public_notes ? (() => {
          const lang = document.language || 'German';
          const notesLabel = { German: 'Bemerkungen', English: 'Notes', Italian: 'Note', Slovenian: 'Opombe', Croatian: 'Napomene' };
          return `<div class="notes"><strong>${notesLabel[lang] || 'Bemerkungen'}:</strong>
${document.public_notes}</div>`;
        })() : ''}

        <!-- Retention of Title (Offers Only) -->
        ${!isInvoice && document.retention_of_title_enabled ? (() => {
          const lang = document.language || 'German';
          const titles = { German: 'Eigentumsvorbehalt', English: 'Retention of Title', Italian: 'Riserva di proprietà', Slovenian: 'Pridržek lastninske pravice', Croatian: 'Zadržaj prava vlasništva' };
          return `
          <div class="ownership-notice">
            <div class="ownership-title">${titles[lang] || titles['German']}</div>
            <div class="ownership-text">${document.retention_of_title_text || L.retentionFallback}</div>
          </div>
        `;
        })() : ''}

        <!-- Safety & Environmental Compliance (Offers Only) -->
        ${!isInvoice && document.safety_compliance_clause ? (() => {
          const lang = document.language || 'German';
          const titles = { German: 'Sicherheits- & Umwelthinweis', English: 'Safety & Environmental Compliance', Italian: 'Conformità sicurezza e ambiente', Slovenian: 'Varnost in okolje', Croatian: 'Sigurnost i okoliš' };
          return `
          <div class="safety-compliance">
            <div class="safety-title">${titles[lang] || titles['German']}</div>
            <div class="safety-text">${document.safety_compliance_clause}</div>
          </div>
        `;
        })() : ''}

        <!-- Payment Info -->
        ${isInvoice && template.bank_iban ? `
          <div class="payment-info">
            <div class="payment-info-title">${L.paymentInfo}:</div>
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

        <!-- Gallery Appendix (if images exist) -->
        ${document.attachments && document.attachments.length > 0 ? `
          <div class="gallery-appendix">
            <h2 class="gallery-title">${L.galleryTitle}</h2>
            <div class="gallery-intro">${L.galleryIntro}</div>
            <div class="gallery-grid">
              ${document.attachments.map((imageUrl, idx) => {
                const meta = document.gallery_meta?.[imageUrl] || {};
                const caption = meta.caption || '';
                return `
                  <div class="gallery-item">
                    <img src="${imageUrl}" alt="Photo ${idx + 1}" class="gallery-image" onerror="this.outerHTML='<div class=\"gallery-no-image\">Image unavailable</div>'">
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