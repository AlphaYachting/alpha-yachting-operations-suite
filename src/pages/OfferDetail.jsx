import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Send, CheckCircle, XCircle, FileText, ArrowRight, Printer, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DocumentHeader from '@/components/documents/DocumentHeader';
import LineItemsTable from '@/components/documents/LineItemsTable';
import TotalsSection from '@/components/documents/TotalsSection';
import AddFromOperationsDrawer from '@/components/documents/AddFromOperationsDrawer';
import { addDays, format } from 'date-fns';

export default function OfferDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const offerId = urlParams.get('id');
  const isNew = urlParams.get('new') === 'true';

  const [offer, setOffer] = useState({
    document_type: 'Offer',
    status: 'Draft',
    currency: 'EUR',
    language: 'German',
    payment_terms: 'Net 14 days',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    valid_until: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    subtotal: 0,
    tax_total: 0,
    total: 0
  });
  const [lineItems, setLineItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showOperationsDrawer, setShowOperationsDrawer] = useState(false);

  useEffect(() => {
    loadMasterData();
    if (!isNew && offerId) {
      loadOffer();
    }
  }, [offerId, isNew]);

  const loadMasterData = async () => {
    try {
      const [customersData, boatsData, locationsData] = await Promise.all([
        base44.entities.Customer.list(),
        base44.entities.Boat.list(),
        base44.entities.Location.list()
      ]);
      setCustomers(customersData);
      setBoats(boatsData);
      setLocations(locationsData);
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  };

  const loadOffer = async () => {
    try {
      const [offerData, lineItemsData] = await Promise.all([
        base44.entities.Document.filter({ id: offerId }),
        base44.entities.DocumentLineItem.filter({ document_id: offerId })
      ]);
      
      if (offerData.length > 0) {
        setOffer(offerData[0]);
        setLineItems(lineItemsData.sort((a, b) => a.sort_order - b.sort_order));
      }
    } catch (error) {
      console.error('Error loading offer:', error);
      setError('Failed to load offer');
    } finally {
      setLoading(false);
    }
  };

  const recalculateTotals = (items) => {
    const subtotal = items.reduce((sum, item) => sum + (item.total_net || 0), 0);
    const taxTotal = items.reduce((sum, item) => sum + (item.total_tax || 0), 0);
    const total = items.reduce((sum, item) => sum + (item.total_gross || 0), 0);
    
    setOffer(prev => ({
      ...prev,
      subtotal,
      tax_total: taxTotal,
      total
    }));
  };

  const handleLineItemsChange = (updatedItems) => {
    setLineItems(updatedItems);
    recalculateTotals(updatedItems);
  };

  const handleAddFromOperations = (newItems) => {
    const withCalculatedTotals = newItems.map(item => {
      const subtotal = (item.quantity || 0) * (item.unit_price || 0);
      const discounted = subtotal * (1 - (item.discount_percent || 0) / 100);
      const totalNet = discounted;
      const totalTax = totalNet * ((item.tax_rate || 0) / 100);
      const totalGross = totalNet + totalTax;
      
      return {
        ...item,
        total_net: totalNet,
        total_tax: totalTax,
        total_gross: totalGross
      };
    });
    
    const updated = [...lineItems, ...withCalculatedTotals];
    setLineItems(updated);
    recalculateTotals(updated);
    setShowOperationsDrawer(false);
  };

  const generateOfferNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9999) + 1;
    return `OFF-${year}-${String(random).padStart(4, '0')}`;
  };

  const handleSave = async (newStatus) => {
    if (!offer.customer_id) {
      setError('Please select a customer');
      return;
    }

    if (newStatus !== 'Draft' && lineItems.length === 0) {
      setError('Cannot send offer without line items');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let savedOffer = { ...offer };
      
      // Generate number if issuing/sending
      if (!savedOffer.document_number && newStatus !== 'Draft') {
        savedOffer.document_number = generateOfferNumber();
      }
      
      savedOffer.status = newStatus;

      // Save or update offer
      if (isNew || !offerId) {
        const created = await base44.entities.Document.create(savedOffer);
        savedOffer = created;

        // Save line items
        for (const item of lineItems) {
          await base44.entities.DocumentLineItem.create({
            ...item,
            document_id: created.id
          });
        }

        navigate(createPageUrl('OfferDetail') + `?id=${created.id}`, { replace: true });
      } else {
        await base44.entities.Document.update(offerId, savedOffer);

        // Delete existing line items
        const existing = await base44.entities.DocumentLineItem.filter({ document_id: offerId });
        for (const item of existing) {
          await base44.entities.DocumentLineItem.delete(item.id);
        }

        // Save new line items
        for (const item of lineItems) {
          await base44.entities.DocumentLineItem.create({
            ...item,
            document_id: offerId
          });
        }
      }

      setOffer(savedOffer);
      
      if (newStatus === 'Sent') {
        alert('Offer marked as sent!');
      }
    } catch (error) {
      console.error('Error saving offer:', error);
      setError('Failed to save offer');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleConvertToInvoice = async () => {
    if (!window.confirm('Convert this offer to an invoice?')) return;

    setSaving(true);
    try {
      const invoice = {
        document_type: 'Invoice',
        status: 'Draft',
        customer_id: offer.customer_id,
        boat_id: offer.boat_id,
        location_id: offer.location_id,
        currency: offer.currency,
        language: offer.language,
        payment_terms: offer.payment_terms,
        public_notes: offer.public_notes,
        internal_notes: offer.internal_notes,
        subtotal: offer.subtotal,
        tax_total: offer.tax_total,
        total: offer.total,
        customer_name: offer.customer_name,
        customer_address: offer.customer_address,
        customer_vat: offer.customer_vat,
        boat_name: offer.boat_name,
        boat_details: offer.boat_details,
        location_name: offer.location_name,
        converted_from_offer_id: offer.id,
        issue_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
        paid_amount: 0
      };

      const createdInvoice = await base44.entities.Document.create(invoice);

      // Copy line items
      for (const item of lineItems) {
        await base44.entities.DocumentLineItem.create({
          ...item,
          document_id: createdInvoice.id
        });
      }

      // Update offer status
      await base44.entities.Document.update(offer.id, { status: 'Accepted' });

      navigate(createPageUrl('InvoiceDetail') + `?id=${createdInvoice.id}`);
    } catch (error) {
      console.error('Error converting to invoice:', error);
      setError('Failed to convert to invoice');
    } finally {
      setSaving(false);
    }
  };

  const isLocked = offer.status !== 'Draft';

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-content, #printable-content * {
            visibility: visible;
          }
          #printable-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Offers'))}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {offer.document_number || 'New Offer'}
            </h1>
            <p className="text-slate-500 mt-1">
              {isNew ? 'Create a new offer' : 'Edit offer details'}
            </p>
          </div>
          <Badge className={
            offer.status === 'Draft' ? 'bg-slate-100 text-slate-700' :
            offer.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
            offer.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' :
            'bg-slate-100 text-slate-700'
          }>
            {offer.status}
          </Badge>
        </div>
        <div className="flex gap-3">
          {offer.status !== 'Draft' && (
            <>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" onClick={handleExportPDF}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </>
          )}
          {!isLocked && offer.customer_id && (
            <Button variant="outline" onClick={() => setShowOperationsDrawer(true)}>
              <FileText className="h-4 w-4 mr-2" />
              Add from Operations
            </Button>
          )}
          {!isLocked && (
            <>
              <Button variant="outline" onClick={() => handleSave('Draft')} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button onClick={() => handleSave('Sent')} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                <Send className="h-4 w-4 mr-2" />
                Mark as Sent
              </Button>
            </>
          )}
          {offer.status === 'Sent' && (
            <>
              <Button onClick={() => handleSave('Accepted')} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Accepted
              </Button>
              <Button variant="outline" onClick={() => handleSave('Rejected')}>
                <XCircle className="h-4 w-4 mr-2" />
                Mark Rejected
              </Button>
            </>
          )}
          {offer.status === 'Accepted' && (
            <Button onClick={handleConvertToInvoice} className="bg-blue-600 hover:bg-blue-700">
              <ArrowRight className="h-4 w-4 mr-2" />
              Convert to Invoice
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="no-print">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Document Editor */}
      <div id="printable-content" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DocumentHeader
            document={offer}
            onChange={setOffer}
            customers={customers}
            boats={boats}
            locations={locations}
            isLocked={isLocked}
          />
          
          <LineItemsTable
            lineItems={lineItems}
            onChange={handleLineItemsChange}
            isLocked={isLocked}
            currency={offer.currency}
          />
        </div>

        <div>
          <TotalsSection
            lineItems={lineItems}
            currency={offer.currency}
          />
        </div>
      </div>

      {/* Add from Operations Drawer */}
      {showOperationsDrawer && (
        <AddFromOperationsDrawer
          customerId={offer.customer_id}
          boatId={offer.boat_id}
          onAdd={handleAddFromOperations}
          onClose={() => setShowOperationsDrawer(false)}
        />
      )}
    </>
  );
}