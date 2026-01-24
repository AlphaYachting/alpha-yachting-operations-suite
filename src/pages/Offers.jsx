import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { FileText, Plus, Search, Filter, Download, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

const statusColors = {
  'Draft': 'bg-slate-100 text-slate-700',
  'Sent': 'bg-blue-100 text-blue-700',
  'Accepted': 'bg-emerald-100 text-emerald-700',
  'Rejected': 'bg-red-100 text-red-700',
  'Expired': 'bg-orange-100 text-orange-700'
};

const statusIcons = {
  'Draft': Clock,
  'Sent': Send,
  'Accepted': CheckCircle,
  'Rejected': XCircle,
  'Expired': Clock
};

export default function Offers() {
  const [offers, setOffers] = useState([]);
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
      const [offersData, customersData, boatsData] = await Promise.all([
        base44.entities.Document.filter({ document_type: 'Offer' }, '-created_date'),
        base44.entities.Customer.list(),
        base44.entities.Boat.list()
      ]);
      setOffers(offersData);
      setCustomers(customersData);
      setBoats(boatsData);
    } catch (error) {
      console.error('Error loading offers:', error);
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

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = !searchTerm || 
      offer.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(offer.customer_id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || offer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Offers</h1>
          <p className="text-slate-500 mt-1">Manage quotations and proposals</p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link to={createPageUrl('OfferDetail') + '?new=true'}>
            <Plus className="h-4 w-4 mr-2" />
            New Offer
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
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Offers List */}
      <div className="space-y-3">
        {loading ? (
          <Card><CardContent className="p-8 text-center text-slate-500">Loading...</CardContent></Card>
        ) : filteredOffers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No offers found</p>
              <Button asChild className="mt-4" variant="outline">
                <Link to={createPageUrl('OfferDetail') + '?new=true'}>Create First Offer</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredOffers.map((offer) => {
            const StatusIcon = statusIcons[offer.status] || FileText;
            return (
              <Link key={offer.id} to={createPageUrl('OfferDetail') + `?id=${offer.id}`}>
                <Card className="hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="p-3 rounded-lg bg-blue-50">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-semibold text-slate-900">{offer.document_number || 'Draft'}</p>
                            <Badge className={statusColors[offer.status]}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {offer.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            {getCustomerName(offer.customer_id)}
                            {offer.boat_id && ` • ${getBoatName(offer.boat_id)}`}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            {offer.issue_date && (
                              <span>Issued: {format(parseISO(offer.issue_date), 'MMM d, yyyy')}</span>
                            )}
                            {offer.valid_until && (
                              <span>Valid until: {format(parseISO(offer.valid_until), 'MMM d, yyyy')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-900">
                          €{offer.total?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{offer.currency || 'EUR'}</p>
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