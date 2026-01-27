import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Eye, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PDFDocumentTemplate from './PDFDocumentTemplate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PDFExportButton({ document: documentData, lineItems, payments = [], variant = "outline" }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [template, setTemplate] = useState(null);
  const [pdfError, setPdfError] = useState(null);

  const loadTemplate = async () => {
    try {
      const templates = await base44.entities.PDFTemplate.list();
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      
      if (!defaultTemplate) {
        const newTemplate = await base44.entities.PDFTemplate.create({
          company_name: 'Alpha Yachting',
          company_address: 'Novigrad, Croatia',
          primary_color: '#2563eb',
          secondary_color: '#06b6d4',
          show_vat_column: true,
          show_net_gross: true,
          is_default: true,
          render_dpi: 150,
          page_format: 'A4'
        });
        return newTemplate;
      }
      
      return defaultTemplate;
    } catch (error) {
      console.error('Error loading template:', error);
      throw error;
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    setPdfError(null);
    try {
      if (typeof document === 'undefined') {
        throw new Error('PDF generation requires browser environment');
      }

      const templateData = await loadTemplate();
      const pageFormat = templateData.page_format || 'A4';
      const renderDpi = templateData.render_dpi || 150;
      const useLetterhead = templateData.letterhead_enabled && templateData.letterhead_image_url;
      
      // Create invisible container with high DPI scaling
      const containerId = `pdf-export-${Date.now()}`;
      const container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.height = 'auto';
      container.style.margin = '0';
      container.style.padding = '0';
      
      // Apply letterhead background if enabled
      if (useLetterhead) {
        container.style.backgroundImage = `url(${templateData.letterhead_image_url})`;
        container.style.backgroundSize = 'cover';
        container.style.backgroundRepeat = 'no-repeat';
        container.style.backgroundPosition = 'top center';
        container.style.backgroundAttachment = 'fixed';
      } else {
        container.style.background = 'white';
      }
      
      // Set up CSS for print quality
      const styleSheet = document.createElement('style');
      styleSheet.textContent = `
        #${containerId} {
          font-family: Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        #${containerId} table {
          page-break-inside: auto;
          border-collapse: collapse;
        }
        #${containerId} tr {
          page-break-inside: avoid;
        }
        #${containerId} img {
          max-width: 100%;
          height: auto;
        }
      `;
      document.head.appendChild(styleSheet);
      document.body.appendChild(container);

      // Render React component into container
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(container);
      
      await new Promise((resolve) => {
        root.render(
          <PDFDocumentTemplate 
            document={documentData} 
            lineItems={lineItems}
            template={templateData}
            payments={payments}
            isPdfExport={true}
          />
        );
        setTimeout(resolve, 1500);
      });

      // Generate canvas at high DPI
      const scale = renderDpi / 96; // 96 DPI is standard screen DPI
      const canvas = await html2canvas(container, {
        scale: scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: useLetterhead ? null : '#ffffff',
        imageTimeout: 10000,
        width: 793.7, // A4 width in pixels at 96 DPI
        windowHeight: container.scrollHeight || 1122
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: pageFormat
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Convert canvas to image data
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let yPosition = 0;
      let isFirstPage = true;

      // Add content pages
      while (yPosition < imgHeight) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        
        // Add letterhead to each page if enabled
        if (useLetterhead) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = templateData.letterhead_image_url;
            });
            
            const letterheadCanvas = document.createElement('canvas');
            letterheadCanvas.width = img.width;
            letterheadCanvas.height = img.height;
            const ctx = letterheadCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const letterheadData = letterheadCanvas.toDataURL('image/png');
            
            pdf.addImage(letterheadData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          } catch (err) {
            console.warn('Failed to add letterhead:', err);
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
        isFirstPage = false;
      }

      // Download
      const fileName = `${documentData.document_number || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      // Cleanup
      root.unmount();
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      if (document.head.contains(styleSheet)) {
        document.head.removeChild(styleSheet);
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfError(`Failed to generate PDF: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    try {
      const templateData = await loadTemplate();
      setTemplate(templateData);
      setShowPreview(true);
    } catch (error) {
      setPdfError('Failed to load preview');
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button 
          variant={variant}
          onClick={handlePreview}
          disabled={isGenerating}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview PDF
        </Button>
        <Button 
          variant={variant}
          onClick={generatePDF}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </>
          )}
        </Button>
      </div>

      {pdfError && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {pdfError}
        </div>
      )}

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PDF Preview</DialogTitle>
          </DialogHeader>
          {template && (
           <div 
             className="bg-white p-4" 
             style={{
               backgroundImage: template.letterhead_enabled && template.letterhead_image_url 
                 ? `url(${template.letterhead_image_url})` 
                 : 'none',
               backgroundSize: 'cover',
               backgroundRepeat: 'no-repeat',
               backgroundPosition: 'top center',
               backgroundAttachment: 'fixed'
             }}
           >
             <div style={{
               paddingTop: template.letterhead_enabled ? `${template.margin_top_mm || 20}mm` : '0',
               paddingLeft: template.letterhead_enabled ? `${template.margin_left_mm || 20}mm` : '0',
               paddingRight: template.letterhead_enabled ? `${template.margin_right_mm || 20}mm` : '0',
               paddingBottom: template.letterhead_enabled ? `${template.margin_bottom_mm || 20}mm` : '0'
             }}>
               <PDFDocumentTemplate 
                 document={documentData} 
                 lineItems={lineItems}
                 template={template}
                 payments={payments}
               />
             </div>
           </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowPreview(false); generatePDF(); }}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}