import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
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

export default function PDFExportButton({ document, lineItems, payments = [], variant = "outline" }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [template, setTemplate] = useState(null);

  const loadTemplate = async () => {
    try {
      const templates = await base44.entities.PDFTemplate.list();
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      
      if (!defaultTemplate) {
        // Create default template if none exists
        const newTemplate = await base44.entities.PDFTemplate.create({
          company_name: 'Alpha Yachting',
          company_address: 'Novigrad, Croatia',
          primary_color: '#2563eb',
          secondary_color: '#06b6d4',
          show_vat_column: true,
          show_net_gross: true,
          is_default: true
        });
        return newTemplate;
      }
      
      return defaultTemplate;
    } catch (error) {
      console.error('Error loading template:', error);
      // Return default fallback
      return {
        company_name: 'Alpha Yachting',
        primary_color: '#2563eb',
        show_vat_column: true
      };
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const templateData = await loadTemplate();
      
      // Create a temporary container
      const container = window.document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '210mm'; // A4 width
      container.style.background = 'white';
      window.document.body.appendChild(container);

      // Render the PDF template
      const root = createRoot(container);
      
      await new Promise((resolve) => {
        root.render(
          <PDFDocumentTemplate 
            document={document} 
            lineItems={lineItems}
            template={templateData}
            payments={payments}
          />
        );
        setTimeout(resolve, 1000); // Wait for rendering
      });

      // Generate PDF
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      // Download the PDF
      const fileName = `${document.document_number || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      // Cleanup
      root.unmount();
      window.document.body.removeChild(container);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    const templateData = await loadTemplate();
    setTemplate(templateData);
    setShowPreview(true);
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

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PDF Preview</DialogTitle>
          </DialogHeader>
          {template && (
            <div className="bg-slate-100 p-4">
              <PDFDocumentTemplate 
                document={document} 
                lineItems={lineItems}
                template={template}
                payments={payments}
              />
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