import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import PDFDocumentTemplate from './PDFDocumentTemplate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PDFExportButton({ document: documentData, lineItems, payments = [], variant = "outline" }) {
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

  const openPrintDialog = async () => {
    try {
      if (!documentData?.id) {
        setPdfError('Document ID is missing. Please save the document first.');
        return;
      }
      // Open print document page in new window
      const printUrl = createPageUrl('PrintDocument') + `?type=${documentData.document_type}&id=${documentData.id}`;
      window.open(printUrl, '_blank', 'width=900,height=1000');
    } catch (error) {
      console.error('Error opening print dialog:', error);
      setPdfError('Failed to open print dialog');
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
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview PDF
        </Button>
        <Button 
          variant={variant}
          onClick={openPrintDialog}
          disabled={!documentData?.id}
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
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
           <Button onClick={openPrintDialog} disabled={!documentData?.id}>
             <Download className="h-4 w-4 mr-2" />
             Download PDF
           </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}