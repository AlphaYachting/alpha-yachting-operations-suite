/**
 * Backend Function: generateOfferPDF
 * 
 * Uses Puppeteer headless browser to render HTML → PDF with:
 * - Native print-to-PDF (not canvas/screenshot)
 * - Proper @page rules and letterhead as background
 * - Selectable text + vector graphics
 * - Correct A4 pagination
 */

import puppeteer from 'puppeteer';

export async function generateOfferPDF(params) {
  const { htmlContent, fileName, templateData = {} } = params;

  if (!htmlContent) {
    throw new Error('htmlContent is required');
  }

  try {
    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set viewport to A4
    await page.setViewport({
      width: 2480,
      height: 3508,
      deviceScaleFactor: 1
    });

    // Inject print CSS
    const printCSS = `
      @page {
        size: A4;
        margin: 15mm 12mm 15mm 12mm;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: Arial, sans-serif;
        line-height: 1.5;
      }

      #pdf-content {
        width: 100%;
        height: 100%;
        page-break-after: always;
      }

      table {
        page-break-inside: auto;
        border-collapse: collapse;
        width: 100%;
      }

      tr {
        page-break-inside: avoid;
      }

      thead {
        display: table-header-group;
      }

      tfoot {
        display: table-footer-group;
      }

      .totals-section {
        page-break-inside: avoid;
      }

      @media print {
        body {
          margin: 0;
          padding: 0;
        }
      }
    `;

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>${printCSS}</style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    // Set content
    await page.setContent(fullHtml, { waitUntil: 'networkidle2' });

    // Generate PDF with proper settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '15mm',
        right: '12mm',
        bottom: '15mm',
        left: '12mm'
      },
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
      displayHeaderFooter: false
    });

    await browser.close();

    return {
      success: true,
      pdfBuffer: pdfBuffer.toString('base64'),
      fileName: fileName || 'document.pdf',
      contentType: 'application/pdf'
    };

  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}