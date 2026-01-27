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
      console.log('[PrintDocument] Starting load with type:', docType, 'id:', docId);
      
      try {
        if (!docType || !docId) {
          console.error('[PrintDocument] Missing type or id parameter', { docType, docId });
          setIsLoading(false);
          return;
        }

        let doc, items;
        
        console.log('[PrintDocument] Fetching templates...');
        const templates = await base44.entities.PDFTemplate.list();
        console.log('[PrintDocument] Templates loaded:', templates.length);

        if (docType === 'Offer') {
          console.log('[PrintDocument] Fetching offers...');
          const offers = await base44.entities.Offer.list();
          console.log('[PrintDocument] Offers fetched:', offers.length, 'Looking for ID:', docId);
          doc = offers.find(o => o.id === docId);
          console.log('[PrintDocument] Offer found:', !!doc, doc?.offer_number);
          
          if (doc) {
            console.log('[PrintDocument] Fetching OfferTasks...');
            const tasks = await base44.entities.OfferTask.filter({ offer_id: docId }, 'sequence_order');
            console.log('[PrintDocument] Tasks found:', tasks.length);
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
          console.log('[PrintDocument] Fetching Document with ID:', docId);
          const docs = await base44.entities.Document.filter({ id: docId });
          console.log('[PrintDocument] Documents found:', docs.length);
          doc = docs[0];
          if (doc) {
            items = await base44.entities.DocumentLineItem.filter({ document_id: docId });
            console.log('[PrintDocument] Line items found:', items.length);
          }
        }

        console.log('[PrintDocument] Setting state - doc:', !!doc, 'items:', items?.length || 0);
        setDocument(doc);
        setLineItems(items || []);

        const defaultTemplate = templates.find(t => t.is_default) || templates[0];
        console.log('[PrintDocument] Using template:', defaultTemplate?.company_name);
        if (defaultTemplate) {
          setTemplate(defaultTemplate);
        }

        setIsLoading(false);
        console.log('[PrintDocument] Load complete');

        // Auto-trigger print on load
        setTimeout(() => {
          console.log('[PrintDocument] Triggering print...');
          window.print();
        }, 500);
      } catch (error) {
        console.error('[PrintDocument] Error loading print data:', error);
        console.error('[PrintDocument] Error details:', { message: error.message, stack: error.stack });
        setIsLoading(false);
      }
    };

    loadData();
  }, [docType, docId]);

  if (isLoading) {
    return (
      <div className="print-loading p-8">
        <p className="mb-4">Loading document...</p>
        <div className="p-4 bg-slate-100 rounded text-sm font-mono">
          <p>Type: {docType}</p>
          <p>ID: {docId}</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="print-loading p-8">
        <p className="text-red-600 mb-4">Document not found with ID: {docId}</p>
        <div className="p-4 bg-slate-100 rounded text-sm font-mono">
          <p>Type: {docType}</p>
          <p>ID: {docId}</p>
          <p className="mt-2">Check browser console for error details</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="print-loading p-8">
        <p className="text-orange-600 mb-4">Template not found</p>
        <div className="p-4 bg-slate-100 rounded text-sm font-mono">
          <p>Document loaded: {document.title || document.offer_number}</p>
          <p>But no PDF template available</p>
        </div>
      </div>
    );
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