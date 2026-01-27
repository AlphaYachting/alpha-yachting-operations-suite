/**
 * Print-Based PDF Export (Vector, Selectable Text, Correct Pagination)
 * 
 * Uses browser's native print-to-PDF via iframe + window.print()
 * - NO canvas/screenshot
 * - Selectable text in PDF
 * - Proper @page rules and table header repetition
 * - No duplication on page 2+
 */

export async function generatePrintPDF({
  containerElement,
  templateData,
  documentData,
  fileName
}) {
  const diag = {
    logs: [],
    log(message, data = null) {
      const entry = { timestamp: new Date().toISOString(), message, data };
      this.logs.push(entry);
      console.log(`[Print PDF] ${message}`, data || '');
    }
  };

  diag.log('Print PDF Export Started', {
    engine: 'Browser native print-to-PDF',
    method: 'iframe + window.print()',
    format: templateData.page_format || 'A4',
    letterheadEnabled: templateData.letterhead_enabled
  });

  return new Promise((resolve, reject) => {
    try {
      // Create iframe for print
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      // Clone container
      const clone = containerElement.cloneNode(true);
      clone.id = 'print-pdf-content';
      clone.style.width = '210mm';
      clone.style.margin = '0';
      clone.style.padding = '0';

      // Inject comprehensive print CSS
      const printCSS = `
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        @page {
          size: A4 portrait;
          margin: 15mm 12mm 15mm 12mm;
        }

        body {
          font-family: Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #000;
          background: white;
          margin: 0;
          padding: 0;
        }

        #print-pdf-content {
          width: 100%;
          height: auto;
          margin: 0;
          padding: 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          page-break-inside: auto;
        }

        thead {
          display: table-header-group;
          background-color: #2563eb;
          color: white;
        }

        tbody tr {
          page-break-inside: avoid;
        }

        tfoot {
          display: table-footer-group;
        }

        .totals-section {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        img {
          max-width: 100%;
          height: auto;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          #print-pdf-content {
            margin: 0;
            padding: 0;
          }
          a {
            text-decoration: none;
          }
        }
      `;

      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${fileName}</title>
          <style>${printCSS}</style>
        </head>
        <body>
          ${clone.outerHTML}
        </body>
        </html>
      `);
      iframeDoc.close();

      diag.log('Iframe prepared', { contentLength: clone.outerHTML.length });

      // Wait for iframe to load, then print
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();

          diag.log('Print dialog triggered', {
            fileName,
            method: 'window.print()'
          });

          // Cleanup after print dialog closes
          setTimeout(() => {
            document.body.removeChild(iframe);
            diag.log('Iframe cleaned up');
            
            resolve({
              success: true,
              method: 'print-to-pdf',
              fileName,
              diagnostics: diag.logs
            });
          }, 500);
        } catch (err) {
          document.body.removeChild(iframe);
          reject(err);
        }
      }, 1000);
    } catch (error) {
      diag.log('❌ Export Failed', error.message);
      reject(error);
    }
  });
}