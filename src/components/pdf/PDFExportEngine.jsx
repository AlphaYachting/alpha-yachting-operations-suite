/**
 * PDF Export Engine v2 — High-Quality Export with Diagnostics
 * 
 * Architecture:
 * 1. Render React template to hidden DOM with correct print styles
 * 2. Use html2canvas at high DPI (300) for crisp output
 * 3. Handle multi-page content with proper page breaks
 * 4. Apply letterhead as background, repeated on each page
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
  diag.log('PDF Export Started', {
    engine: 'html2canvas + jsPDF',
    dpi: 300,
    format: templateData.page_format || 'A4',
    letterheadEnabled: templateData.letterhead_enabled
  });

  try {
    // Step 1: Determine export settings
    const pageFormat = templateData.page_format || 'A4';
    const renderDpi = 300; // Force high quality
    const scale = renderDpi / 96; // 96 DPI is screen baseline
    const useLetterhead = templateData.letterhead_enabled && templateData.letterhead_image_url;
    
    diag.log('Export Config', { pageFormat, renderDpi, scale, useLetterhead });

    // Step 2: Prepare container with print styles
    containerElement.style.position = 'absolute';
    containerElement.style.left = '-9999px';
    containerElement.style.width = pageFormat === 'A4' ? '210mm' : '216mm'; // A4 or Letter
    containerElement.style.margin = '0';
    containerElement.style.padding = '0';
    containerElement.style.backgroundColor = 'white';
    
    // Inject print CSS into container
    const printStyle = document.createElement('style');
    printStyle.textContent = `
      #pdf-export-container {
        page-break-after: always;
      }
      #pdf-export-container table {
        page-break-inside: auto;
        border-collapse: collapse;
      }
      #pdf-export-container tr {
        page-break-inside: avoid;
      }
      #pdf-export-container thead {
        display: table-header-group;
        page-break-after: always;
      }
      #pdf-export-container tbody tr:last-child {
        page-break-after: always;
      }
      @media print {
        #pdf-export-container {
          margin: 0;
          padding: 0;
          width: 100%;
          height: auto;
        }
      }
    `;
    document.head.appendChild(printStyle);
    document.body.appendChild(containerElement);

    // Step 3: Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Render to canvas at high DPI
    diag.log('Starting html2canvas render', {
      containerHeight: containerElement.scrollHeight,
      width: 793.7 // A4 at 96 DPI
    });

    const canvas = await html2canvas(containerElement, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 15000,
      width: 793.7 * (pageFormat === 'A4' ? 1 : 1.04),
      windowHeight: containerElement.scrollHeight || 1122
    });

    diag.log('Canvas rendered', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      estimatedPages: Math.ceil(canvas.height / (scale * 1122))
    });

    // Step 5: Create PDF and split into pages
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: pageFormat
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    diag.log('PDF Created', {
      pdfWidth,
      pdfHeight,
      imgWidth,
      imgHeight,
      totalPages: Math.ceil(imgHeight / pdfHeight)
    });

    // Step 6: Add pages with letterhead
    let yPosition = 0;
    let pageCount = 0;

    while (yPosition < imgHeight) {
      if (pageCount > 0) {
        pdf.addPage();
      }

      // Add letterhead on each page if enabled
      if (useLetterhead && templateData.letterhead_image_url) {
        try {
          const letterheadImg = new Image();
          letterheadImg.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            letterheadImg.onload = resolve;
            letterheadImg.onerror = reject;
            letterheadImg.src = templateData.letterhead_image_url;
          });

          // Create high-quality letterhead image
          const letterheadCanvas = document.createElement('canvas');
          letterheadCanvas.width = letterheadImg.naturalWidth;
          letterheadCanvas.height = letterheadImg.naturalHeight;
          const ctx = letterheadCanvas.getContext('2d');
          ctx.drawImage(letterheadImg, 0, 0);
          
          const letterheadData = letterheadCanvas.toDataURL('image/png');
          pdf.addImage(letterheadData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          
          diag.log(`Letterhead added to page ${pageCount + 1}`);
        } catch (err) {
          diag.log(`⚠️ Letterhead failed on page ${pageCount + 1}`, err.message);
        }
      }

      // Add content slice
      const contentHeight = Math.min(imgHeight - yPosition, pdfHeight);
      pdf.addImage(
        imgData,
        'PNG',
        0,
        -yPosition / scale,
        imgWidth,
        imgHeight
      );

      yPosition += pdfHeight;
      pageCount++;
    }

    diag.log('PDF Export Complete', {
      pagesAdded: pageCount,
      fileName: fileName
    });

    // Step 7: Download and cleanup
    pdf.save(fileName);

    // Cleanup
    if (document.body.contains(containerElement)) {
      document.body.removeChild(containerElement);
    }
    if (document.head.contains(printStyle)) {
      document.head.removeChild(printStyle);
    }

    return { success: true, pageCount, diagnostics: diag.getLogs() };

  } catch (error) {
    diag.log('❌ Export Failed', error.message);
    throw error;
  }
}