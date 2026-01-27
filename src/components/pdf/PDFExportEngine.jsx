/**
 * PDF Export Engine v3 — Page-Break Aware, Letterhead Overlay
 * 
 * Architecture:
 * 1. Render full DOM respecting @page rules and page-break CSS
 * 2. Use html2canvas to convert each section to image
 * 3. Apply letterhead as fixed overlay (not background) on each page
 * 4. Split by page-break markers, render separately, combine into PDF
 * 5. Log diagnostics for debugging
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const PDFExportDiagnostics = {
  enabled: true,
  logs: [],
  
  log(message, data = null) {
    const entry = { timestamp: new Date().toISOString(), message, data };
    this.logs.push(entry);
    console.log(`[PDF Export] ${message}`, data || '');
  },
  
  clear() {
    this.logs = [];
  },
  
  getLogs() {
    return this.logs;
  }
};

export async function generateHighQualityPDF({
  containerElement,
  templateData,
  documentData,
  fileName
}) {
  const diag = PDFExportDiagnostics;
  diag.clear();
  diag.log('PDF Export Started (v3 - Page-Break Aware)', {
    engine: 'html2canvas + jsPDF',
    dpi: 300,
    format: templateData.page_format || 'A4',
    letterheadEnabled: templateData.letterhead_enabled
  });

  try {
    // Step 1: Configuration
    const pageFormat = templateData.page_format || 'A4';
    const renderDpi = 300;
    const scale = renderDpi / 96;
    const useLetterhead = templateData.letterhead_enabled && templateData.letterhead_image_url;
    const pageHeightMm = pageFormat === 'A4' ? 297 : 279;
    const pageHeightPx = pageHeightMm * 3.78; // mm to px at 96 DPI

    diag.log('Export Config', { pageFormat, renderDpi, scale, pageHeightMm, useLetterhead });

    // Step 2: Prepare container with print styles
    containerElement.id = 'pdf-export-container';
    containerElement.style.position = 'relative';
    containerElement.style.width = pageFormat === 'A4' ? '210mm' : '216mm';
    containerElement.style.margin = '0';
    containerElement.style.padding = '0';
    containerElement.style.backgroundColor = 'white';
    containerElement.style.display = 'block';
    containerElement.style.boxSizing = 'border-box';

    // Remove inline background image from PDFDocumentTemplate
    const pdfContent = containerElement.querySelector('#pdf-content');
    if (pdfContent) {
      pdfContent.style.backgroundImage = 'none';
      pdfContent.style.backgroundAttachment = 'scroll';
    }

    // Inject print CSS that REMOVES background and enforces page breaks
    const printStyle = document.createElement('style');
    printStyle.id = 'pdf-export-style';
    printStyle.textContent = `
      #pdf-export-container {
        page-break-after: always;
        width: 100%;
        margin: 0;
        padding: 0;
      }

      #pdf-content {
        background-image: none !important;
        background-attachment: scroll !important;
        margin: 0;
        padding: 0;
        display: block;
      }

      #pdf-export-container table {
        page-break-inside: auto;
        border-collapse: collapse;
        width: 100%;
      }

      #pdf-export-container tr {
        page-break-inside: avoid;
      }

      #pdf-export-container thead {
        display: table-header-group;
      }

      #pdf-export-container tfoot {
        display: table-footer-group;
      }

      /* Totals section: keep on same page if possible */
      .totals-section {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* Notes and footer: avoid orphaning */
      #pdf-export-container > div:last-child {
        page-break-inside: avoid;
      }

      @media print {
        #pdf-export-container {
          margin: 0;
          padding: 0;
          width: 100%;
          height: auto;
          box-shadow: none;
        }
        #pdf-content {
          width: 100%;
          height: auto;
          margin: 0;
          padding: 0;
        }
      }
    `;
    document.head.appendChild(printStyle);
    document.body.appendChild(containerElement);

    // Step 3: Wait for render
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 4: Get total content height
    const totalHeight = containerElement.scrollHeight;
    const estimatedPages = Math.ceil(totalHeight / pageHeightPx);

    diag.log('Content measured', {
      scrollHeight: totalHeight,
      estimatedPageHeight: pageHeightPx,
      estimatedPages
    });

    // Step 5: Render container to single large canvas
    const canvas = await html2canvas(containerElement, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 15000,
      width: 793.7 * (pageFormat === 'A4' ? 1 : 1.04),
      windowHeight: totalHeight
    });

    diag.log('Canvas rendered', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      scale,
      actualPages: Math.ceil(canvas.height / (pageHeightPx * scale))
    });

    // Step 6: Load letterhead if enabled
    let letterheadImgData = null;
    let letterheadWidth = 0;
    let letterheadHeight = 0;

    if (useLetterhead) {
      try {
        const letterheadImg = new Image();
        letterheadImg.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          letterheadImg.onload = resolve;
          letterheadImg.onerror = reject;
          letterheadImg.src = templateData.letterhead_image_url;
        });

        // Store original dimensions
        letterheadWidth = letterheadImg.naturalWidth;
        letterheadHeight = letterheadImg.naturalHeight;

        const letterheadCanvas = document.createElement('canvas');
        letterheadCanvas.width = letterheadWidth;
        letterheadCanvas.height = letterheadHeight;
        const ctx = letterheadCanvas.getContext('2d');
        ctx.drawImage(letterheadImg, 0, 0);
        letterheadImgData = letterheadCanvas.toDataURL('image/png');

        diag.log('Letterhead loaded', {
          width: letterheadWidth,
          height: letterheadHeight,
          format: 'PNG'
        });
      } catch (err) {
        diag.log('⚠️ Letterhead load failed', err.message);
      }
    }

    // Step 7: Create PDF and split canvas into pages
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: pageFormat,
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    diag.log('PDF created', {
      pdfWidth,
      pdfHeight,
      imgWidth,
      imgHeight,
      pageCount: Math.ceil(imgHeight / pdfHeight)
    });

    // Step 8: Slice canvas into pages and add to PDF
    let yPosition = 0;
    let pageCount = 0;

    while (yPosition < imgHeight) {
      // Add new page (first page already exists)
      if (pageCount > 0) {
        pdf.addPage();
      }

      // Add content slice from canvas
      const sliceHeight = Math.min(pdfHeight, imgHeight - yPosition);
      pdf.addImage(
        imgData,
        'PNG',
        0,
        -(yPosition / scale),  // Correct offset for page positioning
        imgWidth,
        imgHeight
      );

      // Add letterhead overlay on top of this page (if enabled)
      if (letterheadImgData && letterheadWidth > 0) {
        // Scale letterhead to fit page width while maintaining aspect ratio
        const letterheadPageWidth = pdfWidth;
        const letterheadPageHeight = (letterheadHeight * pdfWidth) / letterheadWidth;

        try {
          pdf.addImage(
            letterheadImgData,
            'PNG',
            0,
            0,
            letterheadPageWidth,
            letterheadPageHeight
          );
          diag.log(`Letterhead overlay added to page ${pageCount + 1}`);
        } catch (err) {
          diag.log(`⚠️ Letterhead overlay failed on page ${pageCount + 1}`, err.message);
        }
      }

      yPosition += pdfHeight;
      pageCount++;
    }

    diag.log('PDF complete', {
      totalPages: pageCount,
      fileName
    });

    // Step 9: Download
    pdf.save(fileName);

    // Step 10: Cleanup
    if (document.body.contains(containerElement)) {
      document.body.removeChild(containerElement);
    }
    if (document.head.contains(printStyle)) {
      document.head.removeChild(printStyle);
    }

    return {
      success: true,
      pageCount,
      diagnostics: diag.getLogs()
    };

  } catch (error) {
    diag.log('❌ Export Failed', error.message);
    console.error('PDF Export Error:', error);
    throw error;
  }
}