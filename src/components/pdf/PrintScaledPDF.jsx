import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Generates a properly scaled PDF from a DOM element
 * Handles A4 sizing and content scaling correctly
 */
export async function printScaledPDF({
  containerElement,
  fileName,
  templateData = {}
}) {
  try {
    const pageFormat = templateData.page_format || 'A4';
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;
    const DPI = 150;
    const PX_PER_MM = DPI / 25.4;
    
    // Set container to exact A4 dimensions
    const originalStyle = containerElement.getAttribute('style') || '';
    containerElement.style.width = `${A4_WIDTH_MM}mm`;
    containerElement.style.height = 'auto';
    containerElement.style.margin = '0';
    containerElement.style.padding = '0';
    containerElement.style.boxSizing = 'border-box';
    containerElement.style.backgroundColor = 'white';
    containerElement.style.display = 'block';
    
    // Append to body if not already there
    const wasInDOM = document.body.contains(containerElement);
    if (!wasInDOM) {
      document.body.appendChild(containerElement);
    }
    
    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Render canvas at A4 dimensions
    const canvas = await html2canvas(containerElement, {
      scale: DPI / 96, // Convert to target DPI
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: A4_WIDTH_MM * PX_PER_MM,
      windowHeight: containerElement.scrollHeight
    });
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: pageFormat,
      compress: true
    });
    
    const pdfWidth = A4_WIDTH_MM;
    const pdfHeight = A4_HEIGHT_MM;
    const canvasHeight = (canvas.height * pdfWidth) / canvas.width;
    
    const imgData = canvas.toDataURL('image/png');
    
    // Split into pages
    let yOffset = 0;
    let pageNum = 0;
    
    while (yOffset < canvasHeight) {
      if (pageNum > 0) {
        pdf.addPage();
      }
      
      pdf.addImage(
        imgData,
        'PNG',
        0,
        -yOffset,
        pdfWidth,
        canvasHeight
      );
      
      yOffset += pdfHeight;
      pageNum++;
    }
    
    // Download
    pdf.save(fileName);
    
    // Cleanup
    if (!wasInDOM && document.body.contains(containerElement)) {
      document.body.removeChild(containerElement);
    }
    containerElement.setAttribute('style', originalStyle);
    
    return { success: true, pageCount: pageNum };
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
}