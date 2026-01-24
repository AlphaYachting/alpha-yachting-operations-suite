import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Receipt, Plus, Search, Filter, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isPast } from 'date-fns';

const statusColors = {
  'Draft': 'bg-slate-100 text-slate-700',
  'Issued': 'bg-blue-100 text-blue-700',
  'Partially Paid': 'bg-amber-100 text-amber-700',
  'Paid': 'bg-emerald-100 text-emerald-700',
  'Overdue': 'bg-red-100 text-red-700',
  'Cancelled': 'bg-slate-100 text-slate-700'
};

const statusIcons = {
  'Draft': Clock,
  'Issued': Receipt,
  'Partially Paid': AlertCircle,
  'Paid': CheckCircle2,
  'Overdue': AlertCircle,
  'Cancelled': Clock
};

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [invoicesData, customersData, boatsData] = await Promise.all([
        base44.entities.Document.filter({ document_type: 'Invoice' }, '-created_date'),
        base44.entities.Customer.list(),
        base44.entities.Boat.list()
      ]);
      setInvoices(invoicesData);
      setCustomers(customersData);
      setBoats(boatsData);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return 'Unknown';
    return customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  };

  const getBoatName = (boatId) => {
    const boat = boats.find(b => b.id === boatId);
    return boat?.vessel_name || '-';
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = !searchTerm || 
      invoice.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(invoice.customer_id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getOutstanding = (invoice) => {
    return (invoice.total || 0) - (invoice.paid_amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 mt-1">Manage invoices and payments</p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to={createPageUrl('InvoiceDetail') + '?new=true'}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by number or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Issued">Issued</SelectItem>
                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <div className="space-y-3">
        {loading ? (
          <Card><CardContent className="p-8 text-center text-slate-500">Loading...</CardContent></Card>
        ) : filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No invoices found</p>
              <Button asChild className="mt-4" variant="outline">
                <Link to={createPageUrl('InvoiceDetail') + '?new=true'}>Create First Invoice</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredInvoices.map((invoice) => {
            const StatusIcon = statusIcons[invoice.status] || Receipt;
            const outstanding = getOutstanding(invoice);
            const isOverdue = invoice.due_date && isPast(parseISO(invoice.due_date)) && outstanding > 0;
            
            return (
              <Link key={invoice.id} to={createPageUrl('InvoiceDetail') + `?id=${invoice.id}`}>
                <Card className={`hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer ${isOverdue ? 'border-red-200' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`p-3 rounded-lg ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
                          <Receipt className={`h-5 w-5 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-semibold text-slate-900">{invoice.document_number || 'Draft'}</p>
                            <Badge className={statusColors[isOverdue ? 'Overdue' : invoice.status]}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {isOverdue ? 'Overdue' : invoice.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            {getCustomerName(invoice.customer_id)}
                            {invoice.boat_id && ` • ${getBoatName(invoice.boat_id)}`}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            {invoice.issue_date && (
                              <span>Issued: {format(parseISO(invoice.issue_date), 'MMM d, yyyy')}</span>
                            )}
                            {invoice.due_date && (
                              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                Due: {format(parseISO(invoice.due_date), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-900">
                          €{invoice.total?.toFixed(2) || '0.00'}
                        </p>
                        {outstanding > 0 && invoice.status !== 'Draft' && (
                          <p className="text-sm text-red-600 font-medium mt-1">
                            €{outstanding.toFixed(2)} due
                          </p>
                        )}
                        {invoice.status === 'Paid' && (
                          <p className="text-sm text-emerald-600 font-medium mt-1">
                            Paid in full
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}