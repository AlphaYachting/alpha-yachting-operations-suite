import puppeteer from 'puppeteer';

async function generateOfferPDF({ documentData, lineItems, templateData }) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Set viewport for A4
    await page.setViewport({ width: 1240, height: 1754 });
    
    // Build HTML from document data
    const html = buildHTMLDocument(documentData, lineItems, templateData);
    
    // Set content
    await page.setContent(html, { waitUntil: 'networkidle2' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '15mm',
        right: '12mm',
        bottom: '15mm',
        left: '12mm'
      },
      printBackground: true,
      scale: 1
    });
    
    await browser.close();
    
    // Convert to base64
    const base64PDF = pdfBuffer.toString('base64');
    
    return {
      success: true,
      pdf: `data:application/pdf;base64,${base64PDF}`,
      fileName: `${documentData.document_number || 'offer'}_${new Date().toISOString().split('T')[0]}.pdf`
    };
  } catch (error) {
    if (browser) await browser.close();
    return {
      success: false,
      error: error.message
    };
  }
}

function buildHTMLDocument(documentData, lineItems, templateData) {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.total_net || 0), 0);
  const taxTotal = lineItems.reduce((sum, item) => sum + (item.total_tax || 0), 0);
  const total = subtotal + taxTotal;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${documentData.document_number || 'Document'}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #333;
          background: white;
        }
        
        @page {
          size: A4;
          margin: 15mm 12mm;
        }
        
        .page {
          width: 100%;
          min-height: 297mm;
          page-break-after: always;
          padding: 0;
        }
        
        .header {
          margin-bottom: 20px;
          border-bottom: 2px solid ${templateData.primary_color || '#2563eb'};
          padding-bottom: 15px;
        }
        
        .header-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 10px;
        }
        
        .seller, .buyer, .meta {
          flex: 1;
        }
        
        .company-name {
          font-size: 16pt;
          font-weight: bold;
          color: ${templateData.primary_color || '#2563eb'};
          margin-bottom: 5px;
        }
        
        .seller-info {
          font-size: 10pt;
          line-height: 1.4;
          color: #666;
        }
        
        .section-title {
          font-weight: bold;
          color: #333;
          margin-top: 10px;
          margin-bottom: 5px;
          font-size: 10pt;
        }
        
        .buyer-info {
          font-size: 11pt;
          line-height: 1.6;
        }
        
        .meta-value {
          margin-bottom: 8px;
          font-size: 10pt;
        }
        
        .meta-label {
          font-weight: bold;
          font-size: 9pt;
          color: #666;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 10pt;
        }
        
        thead {
          background-color: ${templateData.primary_color || '#2563eb'};
          color: white;
        }
        
        th {
          padding: 8px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #ddd;
        }
        
        td {
          padding: 8px;
          border: 1px solid #ddd;
        }
        
        tbody tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        .text-right {
          text-align: right;
        }
        
        .text-center {
          text-align: center;
        }
        
        .totals {
          margin-top: 20px;
          width: 100%;
          max-width: 400px;
          margin-left: auto;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #ddd;
          font-size: 10pt;
        }
        
        .total-row.final {
          border-bottom: 2px solid ${templateData.primary_color || '#2563eb'};
          font-weight: bold;
          font-size: 12pt;
          padding: 12px 0;
        }
        
        .notes {
          margin-top: 20px;
          padding: 12px;
          background-color: #f5f5f5;
          border-left: 3px solid ${templateData.primary_color || '#2563eb'};
          font-size: 10pt;
          line-height: 1.4;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          font-size: 9pt;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Header -->
        <div class="header">
          <div class="company-name">${templateData.company_name || 'Company'}</div>
          <div class="seller-info">
            ${templateData.company_address || ''}<br>
            ${templateData.contact_email ? `Email: ${templateData.contact_email}` : ''}<br>
            ${templateData.contact_phone ? `Phone: ${templateData.contact_phone}` : ''}
          </div>
        </div>
        
        <!-- Customer Info -->
        <div class="header-row">
          <div class="seller">
            <div class="section-title">Bill From:</div>
            <div class="seller-info">
              ${templateData.company_name}<br>
              ${templateData.company_address}
            </div>
          </div>
          <div class="buyer">
            <div class="section-title">Bill To:</div>
            <div class="buyer-info">
              <strong>${documentData.customer_name || ''}</strong><br>
              ${documentData.customer_address || ''}
            </div>
          </div>
          <div class="meta">
            <div class="meta-value">
              <div class="meta-label">Document Number</div>
              <strong>${documentData.document_number || ''}</strong>
            </div>
            <div class="meta-value">
              <div class="meta-label">Issue Date</div>
              ${formatDate(documentData.issue_date)}
            </div>
            <div class="meta-value">
              <div class="meta-label">Valid Until</div>
              ${formatDate(documentData.valid_until)}
            </div>
          </div>
        </div>
        
        <!-- Line Items Table -->
        <table>
          <thead>
            <tr>
              <th style="width: 40%;">Description</th>
              <th style="width: 15%;" class="text-right">Quantity</th>
              <th style="width: 15%;" class="text-right">Unit Price</th>
              <th style="width: 15%;" class="text-right">Total</th>
              <th style="width: 15%;" class="text-right">Tax</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems.map(item => `
              <tr>
                <td>
                  <strong>${item.title || ''}</strong>
                  ${item.description ? `<br><span style="color: #666; font-size: 9pt;">${item.description}</span>` : ''}
                </td>
                <td class="text-right">${(item.quantity || 0).toFixed(2)} ${item.unit || ''}</td>
                <td class="text-right">€${(item.unit_price || 0).toFixed(2)}</td>
                <td class="text-right">€${(item.total_net || 0).toFixed(2)}</td>
                <td class="text-right">€${(item.total_tax || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <!-- Totals -->
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>€${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Tax:</span>
            <span>€${taxTotal.toFixed(2)}</span>
          </div>
          <div class="total-row final">
            <span>Total:</span>
            <span>€${total.toFixed(2)}</span>
          </div>
        </div>
        
        <!-- Notes -->
        ${documentData.public_notes ? `
          <div class="notes">
            <strong>Notes:</strong><br>
            ${documentData.public_notes}
          </div>
        ` : ''}
        
        <!-- Footer -->
        <div class="footer">
          ${documentData.payment_terms ? `<div>Payment Terms: ${documentData.payment_terms}</div>` : ''}
          <div style="margin-top: 10px;">
            ${templateData.footer_text || ''}
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