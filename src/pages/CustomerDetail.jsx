import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Edit,
  Ship,
  Briefcase,
  ClipboardList,
  FileText,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Plus,
  Camera,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import CustomerForm from '@/components/customers/CustomerForm';
import WorkOrderForm from '@/components/workorders/WorkOrderForm';
import JobForm from '@/components/jobs/JobForm';
import BoatForm from '@/components/boats/BoatForm';
import SendInviteButton from '@/components/invites/SendInviteButton';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusColors = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-slate-100 text-slate-700',
  VIP: 'bg-amber-100 text-amber-700',
  Blocked: 'bg-red-100 text-red-700'
};

const jobStatusColors = {
  'New': 'bg-blue-100 text-blue-700',
  'Quoted': 'bg-purple-100 text-purple-700',
  'Approved': 'bg-green-100 text-green-700',
  'Scheduled': 'bg-cyan-100 text-cyan-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Completed': 'bg-emerald-100 text-emerald-700',
  'Invoiced': 'bg-slate-100 text-slate-700',
  'Cancelled': 'bg-red-100 text-red-700'
};

const woStatusColors = {
  'Draft': 'bg-slate-100 text-slate-700',
  'Scheduled': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Completed': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-red-100 text-red-700'
};

export default function CustomerDetail() {
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('id');
  
  const [customer, setCustomer] = useState(null);
  const [boats, setBoats] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [workOrderPhotoCounts, setWorkOrderPhotoCounts] = useState({});
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [locations, setLocations] = useState([]);
  // Quick-edit state
  const [editingBoat, setEditingBoat] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [editingWorkOrder, setEditingWorkOrder] = useState(null);

  useEffect(() => {
    if (customerId) {
      loadData();
    }
  }, [customerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [customerData, boatsData, jobsData, offersData, techData, locationsData] = await Promise.all([
        base44.entities.Customer.filter({ id: customerId }),
        base44.entities.Boat.filter({ customer_id: customerId }),
        base44.entities.Job.filter({ customer_id: customerId }),
        base44.entities.Offer.filter({ customer_id: customerId }),
        base44.entities.Technician.list(),
        base44.entities.Location.list()
      ]);

      if (customerData.length === 0) {
        setCustomer(null);
        setLoading(false);
        return;
      }

      setCustomer(customerData[0]);
      setBoats(boatsData);
      setJobs(jobsData);
      setOffers(offersData);
      setTechnicians(techData);
      setLocations(locationsData);

      // Load work orders for all jobs
      const jobIds = jobsData.map(j => j.id);
      if (jobIds.length > 0) {
        const allWorkOrders = await base44.entities.WorkOrder.list();
        const customerWorkOrders = allWorkOrders.filter(wo => jobIds.includes(wo.job_id));
        setWorkOrders(customerWorkOrders);
      } else {
        setWorkOrders([]);
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (customerData) => {
    try {
      await base44.entities.Customer.update(customerId, customerData);
      await loadData();
      setShowEditForm(false);
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  const getDisplayName = (customer) => {
    if (customer.company_name) return customer.company_name;
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unnamed';
  };

  const isDataComplete = (customer) => {
    return customer.first_name && 
           customer.last_name && 
           customer.email && 
           customer.phone && 
           customer.billing_address && 
           customer.billing_city &&
           customer.billing_country;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-slate-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Customer not found</h2>
        <Link to={createPageUrl('Customers')}>
          <Button variant="outline">Back to Customers</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Customers')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{getDisplayName(customer)}</h1>
            <p className="text-slate-500 mt-1">Customer Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <SendInviteButton
            email={customer.email}
            role="CUSTOMER"
            customerId={customerId}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
          />
          <Button
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-50"
            onClick={() => setShowJobForm(true)}
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Create Project
          </Button>
          <Button 
            variant="outline" 
            className="border-indigo-600 text-indigo-600 hover:bg-indigo-50"
            onClick={() => setShowWorkOrderForm(true)}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Create Work Order
          </Button>
          <Link to={createPageUrl('OfferDetail') + `?customer=${customerId}`}>
            <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
              <FileText className="h-4 w-4 mr-2" />
              Create Offer
            </Button>
          </Link>
          <Button onClick={() => setShowEditForm(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Customer
          </Button>
        </div>
      </div>

      {/* Customer Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Information</CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[customer.status]}>{customer.status}</Badge>
              {customer.customer_type && customer.customer_type !== 'Private' && (
                <Badge variant="outline">{customer.customer_type}</Badge>
              )}
              {!isDataComplete(customer) && (
                <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Incomplete Data
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {customer.company_name && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Company Name</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-900">{customer.company_name}</span>
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-slate-500">Contact Name</label>
                <div className="text-slate-900 mt-1">
                  {customer.first_name} {customer.last_name}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-500">Email</label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">
                    {customer.email}
                  </a>
                </div>
              </div>

              {customer.phone && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Phone</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}

              {customer.phone_secondary && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Secondary Phone</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <a href={`tel:${customer.phone_secondary}`} className="text-blue-600 hover:underline">
                      {customer.phone_secondary}
                    </a>
                  </div>
                </div>
              )}

              {customer.preferred_language && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Preferred Language</label>
                  <div className="text-slate-900 mt-1">{customer.preferred_language}</div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-500">Billing Address</label>
                <div className="flex items-start gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="text-slate-900">
                    {customer.billing_address && <div>{customer.billing_address}</div>}
                    <div>
                      {customer.billing_postal_code && `${customer.billing_postal_code} `}
                      {customer.billing_city}
                    </div>
                    {customer.billing_country && <div>{customer.billing_country}</div>}
                  </div>
                </div>
              </div>

              {customer.vat_number && (
                <div>
                  <label className="text-sm font-medium text-slate-500">VAT Number</label>
                  <div className="text-slate-900 mt-1">{customer.vat_number}</div>
                </div>
              )}

              {customer.payment_terms && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Payment Terms</label>
                  <div className="text-slate-900 mt-1">{customer.payment_terms}</div>
                </div>
              )}

              {customer.notes && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Notes</label>
                  <div className="text-slate-900 mt-1 whitespace-pre-wrap">{customer.notes}</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Boats</p>
                <p className="text-2xl font-bold text-slate-900">{boats.length}</p>
              </div>
              <Ship className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Projects</p>
                <p className="text-2xl font-bold text-slate-900">{jobs.length}</p>
              </div>
              <Briefcase className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Work Orders</p>
                <p className="text-2xl font-bold text-slate-900">{workOrders.length}</p>
              </div>
              <ClipboardList className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Offers</p>
                <p className="text-2xl font-bold text-slate-900">{offers.length}</p>
              </div>
              <FileText className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Boats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            Boats ({boats.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {boats.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No boats registered</p>
          ) : (
            <div className="space-y-3">
              {boats.map(boat => (
                <div key={boat.id} className="flex items-center gap-2">
                  <Link to={createPageUrl('BoatDetail') + `?id=${boat.id}`} className="flex-1">
                    <div className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-900">{boat.vessel_name}</h4>
                          <p className="text-sm text-slate-500">
                            {boat.manufacturer && `${boat.manufacturer} `}
                            {boat.model && `${boat.model} `}
                            {boat.year && `(${boat.year})`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(boat.images?.length > 0 || boat.photo_url) && (
                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              <Camera className="h-3 w-3" />
                              {(boat.images?.length || 0) + (boat.photo_url ? 1 : 0)}
                            </span>
                          )}
                          {(boat.known_issues || boat.systems_notes || boat.access_details) && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <FileText className="h-3 w-3" />
                              Notizen
                            </span>
                          )}
                          <Badge variant="outline">{boat.vessel_type}</Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    onClick={() => setEditingBoat(boat)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Projects ({jobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No projects yet</p>
          ) : (
            <div className="space-y-3">
              {jobs.slice(0, 5).map(job => (
                <div key={job.id} className="flex items-center gap-2">
                  <Link to={createPageUrl('JobDetail') + `?id=${job.id}`} className="flex-1">
                    <div className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-900">{job.title}</h4>
                        <div className="flex items-center gap-2">
                          {job.attachments?.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              <Camera className="h-3 w-3" />
                              {job.attachments.length}
                            </span>
                          )}
                          {(job.internal_notes || job.customer_notes) && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <MessageSquare className="h-3 w-3" />
                              Notizen
                            </span>
                          )}
                          <Badge className={jobStatusColors[job.status]}>{job.status}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        {job.job_number && <span>#{job.job_number}</span>}
                        {job.intake_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Start: {format(new Date(job.intake_date), 'dd.MM.yyyy')}
                          </span>
                        )}
                        {job.requested_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Ende: {format(new Date(job.requested_date), 'dd.MM.yyyy')}
                          </span>
                        )}
                        {job.completion_date && (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Abgeschlossen: {format(new Date(job.completion_date), 'dd.MM.yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    onClick={() => setEditingJob(job)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {jobs.length > 5 && (
                <Link to={createPageUrl('Jobs') + `?customer=${customerId}`}>
                  <Button variant="outline" className="w-full">
                    View All {jobs.length} Projects
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Work Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Work Orders ({workOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No work orders yet</p>
          ) : (
            <div className="space-y-3">
              {workOrders.slice(0, 5).map(wo => (
                <div key={wo.id} className="flex items-center gap-2">
                  <Link to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`} className="flex-1">
                    <div className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-900">{wo.title}</h4>
                        <div className="flex items-center gap-2">
                          {((wo.photos_before?.length || 0) + (wo.photos_after?.length || 0) + (wo.photos_detail?.length || 0)) > 0 && (
                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              <Camera className="h-3 w-3" />
                              {(wo.photos_before?.length || 0) + (wo.photos_after?.length || 0) + (wo.photos_detail?.length || 0)}
                            </span>
                          )}
                          {(wo.work_summary || wo.internal_notes || wo.issues_found || wo.recommendations) && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <MessageSquare className="h-3 w-3" />
                              Notizen
                            </span>
                          )}
                          {wo.customer_signature_url && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />
                              Unterschrift
                            </span>
                          )}
                          <Badge className={woStatusColors[wo.status]}>{wo.status}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        {wo.work_order_number && <span>#{wo.work_order_number}</span>}
                        {wo.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(wo.scheduled_date), 'dd.MM.yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    onClick={() => setEditingWorkOrder(wo)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {workOrders.length > 5 && (
                <Link to={createPageUrl('WorkOrders')}>
                  <Button variant="outline" className="w-full">
                    View All {workOrders.length} Work Orders
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Offers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Offers ({offers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No offers yet</p>
          ) : (
            <div className="space-y-3">
              {offers.slice(0, 5).map(offer => (
                <Link key={offer.id} to={createPageUrl('OfferDetail') + `?id=${offer.id}`}>
                  <div className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{offer.title}</h4>
                      <Badge variant="outline">{offer.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      {offer.offer_number && <span>#{offer.offer_number}</span>}
                      {offer.total_amount && (
                        <span className="font-medium text-slate-900">€{offer.total_amount.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
              {offers.length > 5 && (
                <Link to={createPageUrl('Offers')}>
                  <Button variant="outline" className="w-full">
                    View All {offers.length} Offers
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Project Dialog */}
      <Dialog open={showJobForm} onOpenChange={setShowJobForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <JobForm
            customers={[customer]}
            boats={boats}
            locations={locations}
            technicians={technicians}
            onSave={async (jobData) => {
              const newJob = await base44.entities.Job.create({
                ...jobData,
                customer_id: customerId,
                job_number: `P${Date.now().toString().slice(-6)}`,
                intake_date: new Date().toISOString()
              });
              setJobs(prev => [newJob, ...prev]);
              setShowJobForm(false);
              toast.success('Project created successfully');
            }}
            onCancel={() => setShowJobForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={customer}
            onSave={handleSave}
            onCancel={() => setShowEditForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Quick Edit: Boat */}
      <Dialog open={!!editingBoat} onOpenChange={(open) => !open && setEditingBoat(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Boat</DialogTitle>
          </DialogHeader>
          {editingBoat && (
            <BoatForm
              boat={editingBoat}
              customers={[customer]}
              locations={locations}
              onSave={async (boatData) => {
                await base44.entities.Boat.update(editingBoat.id, boatData);
                setEditingBoat(null);
                toast.success('Boot gespeichert');
                loadData();
              }}
              onCancel={() => setEditingBoat(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Edit: Project */}
      <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          {editingJob && (
            <JobForm
              job={editingJob}
              customers={[customer]}
              boats={boats}
              locations={locations}
              technicians={technicians}
              onSave={async (jobData) => {
                await base44.entities.Job.update(editingJob.id, jobData);
                setEditingJob(null);
                toast.success('Project updated');
                await loadData();
              }}
              onCancel={() => setEditingJob(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Edit: Work Order */}
      <Dialog open={!!editingWorkOrder} onOpenChange={(open) => !open && setEditingWorkOrder(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Work Order</DialogTitle>
          </DialogHeader>
          {editingWorkOrder && (
            <WorkOrderForm
              workOrder={editingWorkOrder}
              jobs={jobs}
              technicians={technicians}
              customers={[customer]}
              boats={boats}
              onSave={async (woData) => {
                await base44.entities.WorkOrder.update(editingWorkOrder.id, woData);
                setEditingWorkOrder(null);
                toast.success('Work order updated');
                await loadData();
              }}
              onCancel={() => setEditingWorkOrder(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Work Order Dialog */}
      <Dialog open={showWorkOrderForm} onOpenChange={setShowWorkOrderForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Work Order</DialogTitle>
          </DialogHeader>
          <WorkOrderForm
            jobs={jobs}
            technicians={technicians}
            customers={[customer]}
            boats={boats}
            preselectedCustomerId={customerId}
            onSave={async (workOrderData, templateId, suggestedTasks) => {
              const { work_order_number } = await base44.functions.invoke('generateWorkOrderNumber', {});
              const newWo = await base44.entities.WorkOrder.create({ 
                ...workOrderData, 
                work_order_number 
              });

              // Handle template tasks
              if (templateId) {
                const templateItems = await base44.entities.TaskTemplateItem.filter(
                  { template_list_id: templateId },
                  'sort_order'
                );
                if (templateItems.length > 0) {
                  const user = await base44.auth.me();
                  await Promise.all(
                    templateItems.map((item, idx) =>
                      base44.entities.Task.create({
                        work_order_id: newWo.id,
                        title: item.title,
                        description: item.description || '',
                        estimated_minutes: item.default_estimated_hours ? Math.round(item.default_estimated_hours * 60) : null,
                        sequence_order: idx,
                        status: 'Not Started',
                        notes: item.required_tools_note || '',
                        requires_approval: item.requires_customer_approval || false
                      })
                    )
                  );
                  await base44.entities.WorkOrderTemplateUsage.create({
                    work_order_id: newWo.id,
                    template_list_id: templateId,
                    applied_at: new Date().toISOString(),
                    applied_by: user.email,
                    mode: 'full',
                    selected_item_ids: templateItems.map(t => t.id)
                  });
                }
              }

              // Handle AI-suggested tasks
              if (suggestedTasks && suggestedTasks.length > 0) {
                await Promise.all(
                  suggestedTasks.map((task, idx) =>
                    base44.entities.Task.create({
                      work_order_id: newWo.id,
                      title: task.title,
                      description: task.description || '',
                      estimated_minutes: task.estimated_hours ? Math.round(task.estimated_hours * 60) : null,
                      sequence_order: idx,
                      status: 'Not Started'
                    })
                  )
                );
              }

              setShowWorkOrderForm(false);
              toast.success('Work order created');
              await loadData();
            }}
            onCancel={() => setShowWorkOrderForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}