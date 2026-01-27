import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PDFDocumentTemplate from '@/components/pdf/PDFDocumentTemplate';

export default function PrintDocument() {
  const [searchParams] = useSearchParams();
  const [document, setDocument] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [template, setTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const docType = searchParams.get('type'); // 'offer' or 'invoice'
        const docId = searchParams.get('id');

        if (!docType || !docId) {
          console.error('Missing type or id parameter');
          return;
        }

        const [doc, items, templates] = await Promise.all([
          base44.entities.Document.filter({ id: docId }).then(r => r[0]),
          base44.entities.DocumentLineItem.filter({ document_id: docId }),
          base44.entities.PDFTemplate.list()
        ]);

        setDocument(doc);
        setLineItems(items);

        const defaultTemplate = templates.find(t => t.is_default) || templates[0];
        if (defaultTemplate) {
          setTemplate(defaultTemplate);
        }

        setIsLoading(false);

        // Auto-trigger print on load
        setTimeout(() => {
          window.print();
        }, 500);
      } catch (error) {
        console.error('Error loading print data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, [searchParams]);

  if (isLoading) {
    return <div className="print-loading">Loading document...</div>;
  }

  if (!document || !template) {
    return <div className="print-loading">Document not found</div>;
  }

  return (
    <div className="print-document-container">
      <PDFDocumentTemplate 
        document={document} 
        lineItems={lineItems}
        template={template}
        payments={[]}
      />
    </div>
  );
}