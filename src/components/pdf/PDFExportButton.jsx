import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Eye, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PDFDocumentTemplate from './PDFDocumentTemplate';
import { generatePrintPDF } from './PrintPDFExport';
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
      const templateData = await loadTemplate();

      const container = document.createElement('div');
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(container);

      root.render(
        <PDFDocumentTemplate 
          document={documentData} 
          lineItems={lineItems}
          template={templateData}
          payments={payments}
          isPdfExport={true}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      await generatePrintPDF({
        containerElement: container,
        templateData: templateData,
        documentData: documentData,
        fileName: `${documentData.document_number || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`
      });

      root.unmount();
      setIsGenerating(false);

    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfError(`Failed to generate PDF: ${error.message}`);
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
            <div id="preview-print-area" className="bg-white p-4">
              <PDFDocumentTemplate 
                document={documentData} 
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
            <Button onClick={() => {
              if (!template) return;

              // Clone the preview content
              const previewElement = document.getElementById('preview-print-area');
              if (!previewElement) return;

              const clonedContent = previewElement.cloneNode(true);

              // Create a new window
              const printWindow = window.open('', '', 'width=800,height=1000');
              printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <title>${documentData.document_number || 'document'}</title>
                  <style>
                    @page {
                      size: A4;
                      margin: 0;
                    }
                    * {
                      margin: 0;
                      padding: 0;
                      box-sizing: border-box;
                    }
                    body {
                      font-family: Arial, sans-serif;
                      background: white;
                    }
                  </style>
                </head>
                <body></body>
                </html>
              `);
              printWindow.document.close();

              // Wait for document to be ready, then append content
              setTimeout(() => {
                printWindow.document.body.appendChild(clonedContent);
                setTimeout(() => {
                  printWindow.print();
                }, 300);
              }, 100);
            }}>
              <Download className="h-4 w-4 mr-2" />
              Print to PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}