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
      setTemplate(templateData);

      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      // Render the template
      const root = document.createElement('div');
      container.appendChild(root);
      
      const { createRoot } = await import('react-dom/client');
      const reactRoot = createRoot(root);
      
      await new Promise((resolve) => {
        reactRoot.render(
          <PDFDocumentTemplate 
            document={document} 
            lineItems={lineItems}
            template={templateData}
            payments={payments}
          />
        );
        setTimeout(resolve, 500);
      });

      // Generate PDF
      const content = root.querySelector('#pdf-content');
      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Generate filename
      const docType = document.document_type === 'Invoice' ? 'INV' : 'OFF';
      const docNumber = document.document_number || 'DRAFT';
      const filename = `${docType}_${docNumber}_${new Date().getTime()}.pdf`;

      // Download
      pdf.save(filename);

      // Cleanup
      reactRoot.unmount();
      document.body.removeChild(container);

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