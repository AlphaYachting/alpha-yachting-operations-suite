import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Send, CheckCircle, DollarSign, FileText } from 'lucide-react';
import PDFExportButton from '@/components/pdf/PDFExportButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DocumentHeader from '@/components/documents/DocumentHeader';
import LineItemsTable from '@/components/documents/LineItemsTable';
import TotalsSection from '@/components/documents/TotalsSection';
import AddFromOperationsDrawer from '@/components/documents/AddFromOperationsDrawer';
import { addDays, format } from 'date-fns';

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('id');
  const isNew = urlParams.get('new') === 'true';

  const [invoice, setInvoice] = useState({
    document_type: 'Invoice',
    status: 'Draft',
    currency: 'EUR',
    language: 'German',
    payment_terms: 'Net 14 days',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    subtotal: 0,
    tax_total: 0,
    total: 0,
    paid_amount: 0
  });
  const [lineItems, setLineItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showOperationsDrawer, setShowOperationsDrawer] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [newPayment, setNewPayment] = useState({
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    amount: 0,
    payment_method: 'Bank Transfer',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    loadMasterData();
    if (!isNew && invoiceId) {
      loadInvoice();
    }
  }, [invoiceId, isNew]);

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

  const loadInvoice = async () => {
    try {
      const [invoiceData, lineItemsData, paymentsData] = await Promise.all([
        base44.entities.Document.filter({ id: invoiceId }),
        base44.entities.DocumentLineItem.filter({ document_id: invoiceId }),
        base44.entities.DocumentPayment.filter({ document_id: invoiceId })
      ]);
      
      if (invoiceData.length > 0) {
        setInvoice(invoiceData[0]);
        setLineItems(lineItemsData.sort((a, b) => a.sort_order - b.sort_order));
        setPayments(paymentsData);
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const recalculateTotals = (items) => {
    const subtotal = items.reduce((sum, item) => sum + (item.total_net || 0), 0);
    const taxTotal = items.reduce((sum, item) => sum + (item.total_tax || 0), 0);
    const total = items.reduce((sum, item) => sum + (item.total_gross || 0), 0);
    
    setInvoice(prev => ({
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

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9999) + 1;
    return `INV-${year}-${String(random).padStart(4, '0')}`;
  };

  const handleSave = async (newStatus) => {
    if (!invoice.customer_id) {
      setError('Please select a customer');
      return;
    }

    if (newStatus !== 'Draft' && lineItems.length === 0) {
      setError('Cannot issue invoice without line items');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let savedInvoice = { ...invoice };
      
      // Generate number if issuing
      if (!savedInvoice.document_number && newStatus !== 'Draft') {
        savedInvoice.document_number = generateInvoiceNumber();
      }
      
      savedInvoice.status = newStatus;

      // Save or update invoice
      if (isNew || !invoiceId) {
        const created = await base44.entities.Document.create(savedInvoice);
        savedInvoice = created;

        // Save line items
        for (const item of lineItems) {
          await base44.entities.DocumentLineItem.create({
            ...item,
            document_id: created.id
          });
        }

        navigate(createPageUrl('InvoiceDetail') + `?id=${created.id}`, { replace: true });
      } else {
        await base44.entities.Document.update(invoiceId, savedInvoice);

        // Delete existing line items
        const existing = await base44.entities.DocumentLineItem.filter({ document_id: invoiceId });
        for (const item of existing) {
          await base44.entities.DocumentLineItem.delete(item.id);
        }

        // Save new line items
        for (const item of lineItems) {
          await base44.entities.DocumentLineItem.create({
            ...item,
            document_id: invoiceId
          });
        }
      }

      setInvoice(savedInvoice);
      
      if (newStatus === 'Issued') {
        alert('Invoice issued successfully!');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      setError('Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // Use browser print to PDF
    window.print();
  };

  const handleAddPayment = async () => {
    if (!newPayment.amount || newPayment.amount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await base44.entities.DocumentPayment.create({
        ...newPayment,
        document_id: invoiceId
      });

      const totalPaid = invoice.paid_amount + newPayment.amount;
      const newStatus = totalPaid >= invoice.total ? 'Paid' : 'Partially Paid';

      await base44.entities.Document.update(invoiceId, {
        paid_amount: totalPaid,
        status: newStatus
      });

      setInvoice(prev => ({
        ...prev,
        paid_amount: totalPaid,
        status: newStatus
      }));

      setPayments([...payments, { ...newPayment, document_id: invoiceId }]);
      setShowPaymentDialog(false);
      setNewPayment({
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        amount: 0,
        payment_method: 'Bank Transfer',
        reference: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error adding payment:', error);
      setError('Failed to add payment');
    } finally {
      setSaving(false);
    }
  };

  const isLocked = invoice.status !== 'Draft';
  const outstanding = (invoice.total || 0) - (invoice.paid_amount || 0);

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
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Invoices'))}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {invoice.document_number || 'New Invoice'}
            </h1>
            <p className="text-slate-500 mt-1">
              {isNew ? 'Create a new invoice' : 'Edit invoice details'}
            </p>
          </div>
          <Badge className={
            invoice.status === 'Draft' ? 'bg-slate-100 text-slate-700' :
            invoice.status === 'Issued' ? 'bg-blue-100 text-blue-700' :
            invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
            invoice.status === 'Partially Paid' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-700'
          }>
            {invoice.status}
          </Badge>
        </div>
        <div className="flex gap-3">
          {invoice.status !== 'Draft' && (
            <PDFExportButton 
              document={invoice}
              lineItems={lineItems}
              payments={payments}
            />
          )}
          {!isLocked && invoice.customer_id && (
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
              <Button onClick={() => handleSave('Issued')} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                <Send className="h-4 w-4 mr-2" />
                Issue Invoice
              </Button>
            </>
          )}
          {(invoice.status === 'Issued' || invoice.status === 'Partially Paid') && outstanding > 0 && (
            <Button onClick={() => setShowPaymentDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <DollarSign className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="no-print">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Payment Status */}
      {invoice.status !== 'Draft' && (
        <Card className={`no-print ${outstanding > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Payment Status</p>
                <p className="text-2xl font-bold mt-1">
                  {outstanding > 0 ? (
                    <span className="text-amber-700">€{outstanding.toFixed(2)} Outstanding</span>
                  ) : (
                    <span className="text-emerald-700">Paid in Full</span>
                  )}
                </p>
                {invoice.paid_amount > 0 && (
                  <p className="text-sm text-slate-600 mt-1">
                    €{invoice.paid_amount.toFixed(2)} paid of €{invoice.total.toFixed(2)}
                  </p>
                )}
              </div>
              {payments.length > 0 && (
                <div className="text-right">
                  <p className="text-sm text-slate-600">{payments.length} payment(s) received</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Editor */}
      <div id="printable-content" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DocumentHeader
            document={invoice}
            onChange={setInvoice}
            customers={customers}
            boats={boats}
            locations={locations}
            isLocked={isLocked}
          />
          
          <LineItemsTable
            lineItems={lineItems}
            onChange={handleLineItemsChange}
            isLocked={isLocked}
            currency={invoice.currency}
          />
        </div>

        <div className="space-y-6">
          <TotalsSection
            lineItems={lineItems}
            currency={invoice.currency}
          />

          {/* Payments */}
          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {payments.map((payment, index) => (
                    <div key={index} className="flex justify-between text-sm p-2 bg-slate-50 rounded">
                      <div>
                        <p className="font-medium">{payment.payment_method}</p>
                        <p className="text-xs text-slate-500">{format(new Date(payment.payment_date), 'MMM d, yyyy')}</p>
                      </div>
                      <p className="font-semibold text-emerald-600">
                        €{payment.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>

      {/* Add from Operations Drawer */}
      {showOperationsDrawer && (
        <AddFromOperationsDrawer
          customerId={invoice.customer_id}
          boatId={invoice.boat_id}
          onAdd={handleAddFromOperations}
          onClose={() => setShowOperationsDrawer(false)}
        />
      )}

      {/* Payment Dialog */}
      {showPaymentDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Record Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })}
                  step="0.01"
                  max={outstanding}
                />
                <p className="text-xs text-slate-500 mt-1">Outstanding: €{outstanding.toFixed(2)}</p>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Input
                  value={newPayment.payment_method}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_method: e.target.value })}
                />
              </div>
              <div>
                <Label>Reference</Label>
                <Input
                  value={newPayment.reference}
                  onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                  placeholder="Transaction ID or reference"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleAddPayment} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Record Payment'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}