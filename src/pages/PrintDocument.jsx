import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PDFDocumentTemplate from '@/components/pdf/PDFDocumentTemplate';

export default function PrintDocument() {
  const [searchParams] = useSearchParams();
  const docType = searchParams.get('type');
  const docId = searchParams.get('id');
  
  const [document, setDocument] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [template, setTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!docType || !docId) {
          console.error('Missing type or id parameter');
          setIsLoading(false);
          return;
        }

        let doc, items;
        const templates = await base44.entities.PDFTemplate.list();

        if (docType === 'Offer') {
          // Fetch from Offer entity
          const offers = await base44.entities.Offer.list();
          doc = offers.find(o => o.id === docId);
          
          if (doc) {
            // Fetch OfferTasks as line items
            const tasks = await base44.entities.OfferTask.filter({ offer_id: docId }, 'sequence_order');
            items = tasks.map(task => ({
              sort_order: task.sequence_order || 0,
              title: task.title,
              description: task.description,
              quantity: task.quantity || 0,
              unit: task.unit_type || 'Hour',
              unit_price: task.unit_price || 0,
              tax_rate: 0,
              total_net: task.total_amount || 0,
              total_tax: 0,
              total_gross: task.total_amount || 0
            }));
          }
        } else {
          // Fetch from Document entity (Invoice)
          const docs = await base44.entities.Document.filter({ id: docId });
          doc = docs[0];
          items = await base44.entities.DocumentLineItem.filter({ document_id: docId });
        }

        setDocument(doc);
        setLineItems(items || []);

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
  }, [docType, docId]);

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