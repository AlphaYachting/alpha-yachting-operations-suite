import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  Euro,
  Ship,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

const statusConfig = {
  'Draft': { color: 'bg-slate-100 text-slate-700', icon: Clock },
  'Sent': { color: 'bg-blue-100 text-blue-700', icon: Send },
  'Approved': { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'Rejected': { color: 'bg-red-100 text-red-700', icon: XCircle },
  'Expired': { color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  'Converted': { color: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
};

export default function Offers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ['offers'],
    queryFn: () => base44.entities.Offer.list('-created_date'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: boats = [] } = useQuery({
    queryKey: ['boats'],
    queryFn: () => base44.entities.Boat.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const getCustomer = (customerId) => {
    return customers.find(c => c.id === customerId);
  };

  const getBoat = (boatId) => {
    return boats.find(b => b.id === boatId);
  };

  const getJob = (jobId) => {
    return jobs.find(j => j.id === jobId);
  };

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = !searchTerm || 
      offer.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.offer_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || offer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: offers.length,
    draft: offers.filter(o => o.status === 'Draft').length,
    sent: offers.filter(o => o.status === 'Sent').length,
    approved: offers.filter(o => o.status === 'Approved').length,
  };

  if (offersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Offers</h1>
          <p className="text-slate-600 mt-1">Create and manage service offers</p>
        </div>
        <Link to={createPageUrl('OfferDetail')}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Offer
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Offers</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Draft</p>
                <p className="text-2xl font-bold text-slate-900">{stats.draft}</p>
              </div>
              <Clock className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Sent</p>
                <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
              </div>
              <Send className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search offers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Converted">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Offers List */}
      <div className="grid gap-4">
        {filteredOffers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No offers found</h3>
                <p className="text-slate-600 mb-4">Get started by creating your first offer</p>
                <Link to={createPageUrl('OfferDetail')}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Offer
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredOffers.map(offer => {
            const customer = getCustomer(offer.customer_id);
            const boat = getBoat(offer.boat_id);
            const job = getJob(offer.job_id);
            const StatusIcon = statusConfig[offer.status]?.icon || Clock;

            return (
              <Link key={offer.id} to={createPageUrl('OfferDetail') + `?id=${offer.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-xl">{offer.title}</CardTitle>
                          <Badge className={statusConfig[offer.status]?.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {offer.status}
                          </Badge>
                        </div>
                        <CardDescription>
                          {offer.offer_number && (
                            <span className="font-medium">#{offer.offer_number}</span>
                          )}
                          {offer.description && ` • ${offer.description}`}
                        </CardDescription>
                      </div>
                      {offer.total_amount !== undefined && offer.total_amount !== null && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900">
                            €{offer.total_amount.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="h-4 w-4" />
                        <span>
                          {customer?.company_name || 
                           `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() ||
                           'Unknown Customer'}
                        </span>
                      </div>
                      {boat && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Ship className="h-4 w-4" />
                          <span>{boat.vessel_name}</span>
                        </div>
                      )}
                      {offer.valid_until && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>Valid until {format(new Date(offer.valid_until), 'MMM d, yyyy')}</span>
                        </div>
                      )}
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