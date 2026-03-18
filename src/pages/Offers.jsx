import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import TemplateSelector from '@/components/offers/TemplateSelector';
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
  Copy,
  Eye,
  Edit,
  Trash2,
  ArrowUpDown,
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
  const [monthFilter, setMonthFilter] = useState('all');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const duplicateOfferMutation = useMutation({
    mutationFn: async (offerId) => {
      // Get original offer
      const originalOffer = offers.find(o => o.id === offerId);
      if (!originalOffer) throw new Error('Offer not found');

      // Get original offer tasks
      const originalTasks = await base44.entities.OfferTask.filter({ offer_id: offerId });

      // Generate new offer number
      const allOffers = await base44.entities.Offer.list();
      const existingNumbers = allOffers
        .map(o => o.offer_number)
        .filter(num => num && num.startsWith('OFF-2026-'))
        .map(num => parseInt(num.split('-')[2]) || 0);
      
      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      const newOfferNumber = `OFF-2026-${String(maxNumber + 1).padStart(4, '0')}`;

      // Create new offer (copy of original, but set status to Draft)
      const { id: newOfferId, created_date, updated_date, created_by, ...offerData } = originalOffer;
      const newOffer = await base44.entities.Offer.create({
        ...offerData,
        status: 'Draft',
        title: `${offerData.title} (Copy)`,
        offer_number: newOfferNumber,
        approved_date: null,
        converted_work_order_id: null,
        converted_job_id: null,
      });

      // Duplicate all tasks
      const taskPromises = originalTasks.map(task => {
        const { id, created_date, updated_date, created_by, offer_id, ...taskData } = task;
        return base44.entities.OfferTask.create({
          ...taskData,
          offer_id: newOffer.id,
        });
      });
      await Promise.all(taskPromises);

      return newOffer;
    },
    onSuccess: (newOffer) => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      window.location.href = createPageUrl('OfferDetail') + `?id=${newOffer.id}`;
    },
  });

  const deleteOfferMutation = useMutation({
    mutationFn: async (offerId) => {
      // Delete associated tasks first
      const tasks = await base44.entities.OfferTask.filter({ offer_id: offerId });
      await Promise.all(tasks.map(task => base44.entities.OfferTask.delete(task.id)));
      
      // Delete the offer
      await base44.entities.Offer.delete(offerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });

  const handleDuplicate = (e, offerId) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Duplicate this offer?')) {
      duplicateOfferMutation.mutate(offerId);
    }
  };

  const handleDelete = (e, offerId) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this offer and all its tasks?')) {
      deleteOfferMutation.mutate(offerId);
    }
  };

  const handleSelectTemplate = (template, lineItems) => {
    // Store template data in sessionStorage for OfferDetail to pick up
    sessionStorage.setItem('offerTemplate', JSON.stringify({
      template,
      lineItems
    }));
    navigate(createPageUrl('OfferDetail'));
  };

  const getCustomer = (customerId) => {
    return customers.find(c => c.id === customerId);
  };

  const getBoat = (boatId) => {
    return boats.find(b => b.id === boatId);
  };

  const getJob = (jobId) => {
    return jobs.find(j => j.id === jobId);
  };

  // Generate list of months from offers
  const availableMonths = [...new Set(offers.map(o => {
    const date = new Date(o.created_date);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }))].sort().reverse();

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = !searchTerm || 
      offer.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.offer_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || offer.status === statusFilter;
    
    const matchesMonth = monthFilter === 'all' || (() => {
      const date = new Date(offer.created_date);
      const offerMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return offerMonth === monthFilter;
    })();
    
    return matchesSearch && matchesStatus && matchesMonth;
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowTemplateSelector(true)}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <FileText className="h-4 w-4 mr-2" />
            From Template
          </Button>
          <Link to={createPageUrl('OfferDetail')}>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Offer
            </Button>
          </Link>
        </div>
      </div>

      {/* Template Selector Modal */}
      <TemplateSelector
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
        onSelectTemplate={handleSelectTemplate}
      />

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
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {availableMonths.map(month => {
                  const [year, monthNum] = month.split('-');
                  const date = new Date(year, parseInt(monthNum) - 1);
                  return (
                    <SelectItem key={month} value={month}>
                      {format(date, 'MMMM yyyy')}
                    </SelectItem>
                  );
                })}
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
              <Card key={offer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Offer Icon */}
                      <div className={`h-12 w-12 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0 ${
                        offer.status === 'Draft' ? 'from-slate-50 to-gray-50' :
                        offer.status === 'Sent' ? 'from-blue-50 to-cyan-50' :
                        offer.status === 'Approved' ? 'from-green-50 to-emerald-50' :
                        offer.status === 'Rejected' ? 'from-red-50 to-rose-50' :
                        offer.status === 'Expired' ? 'from-orange-50 to-amber-50' :
                        offer.status === 'Converted' ? 'from-purple-50 to-violet-50' :
                        'from-blue-50 to-cyan-50'
                      }`}>
                        <FileText className={`h-6 w-6 ${
                          offer.status === 'Draft' ? 'text-slate-500' :
                          offer.status === 'Sent' ? 'text-blue-500' :
                          offer.status === 'Approved' ? 'text-green-500' :
                          offer.status === 'Rejected' ? 'text-red-500' :
                          offer.status === 'Expired' ? 'text-orange-500' :
                          offer.status === 'Converted' ? 'text-purple-500' :
                          'text-blue-500'
                        }`} />
                      </div>

                      {/* Offer Details */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Title, Status, Offer Number */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Link to={createPageUrl('OfferDetail') + `?id=${offer.id}`} className="font-semibold text-slate-900 hover:text-blue-600 hover:underline">{offer.title}</Link>
                          <Badge className={statusConfig[offer.status]?.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {offer.status}
                          </Badge>
                          {offer.offer_number && (
                            <span className="text-sm font-medium text-slate-600">#{offer.offer_number}</span>
                          )}
                        </div>

                        {/* Row 2: Customer, Boat, Valid Until */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>
                              {customer?.company_name || 
                               `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() ||
                               'Unknown'}
                            </span>
                          </div>
                          {boat && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <Ship className="h-3 w-3" />
                                <span>{boat.vessel_name}</span>
                              </div>
                            </>
                          )}
                          {offer.valid_until && (
                            <>
                              {(customer || boat) && <span>•</span>}
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Valid until {format(new Date(offer.valid_until), 'MMM d, yyyy')}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Row 3: Total Amount (if present) */}
                        {offer.total_amount !== undefined && offer.total_amount !== null && (
                          <div className="mt-1 text-sm text-slate-500">
                            Total: <span className="font-semibold text-slate-900">€{offer.total_amount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Link to={createPageUrl('OfferDetail') + `?id=${offer.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </Link>
                      <Link to={createPageUrl('OfferDetail') + `?id=${offer.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleDelete(e, offer.id)}
                        disabled={deleteOfferMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleDuplicate(e, offer.id)}
                        disabled={duplicateOfferMutation.isPending}
                        className="h-7 w-7 p-0"
                        title="Duplicate offer"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}