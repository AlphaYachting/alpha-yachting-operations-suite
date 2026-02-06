import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ship, ArrowLeft, Clock, CheckCircle2, Pause, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig = {
  'Planned': { color: 'bg-blue-100 text-blue-700', icon: Clock },
  'In Progress': { color: 'bg-green-100 text-green-700', icon: Clock },
  'On Hold': { color: 'bg-orange-100 text-orange-700', icon: Pause },
  'Completed': { color: 'bg-slate-100 text-slate-700', icon: CheckCircle2 },
};

const mapWorkOrderStatus = (status) => {
  if (['Draft', 'Scheduled'].includes(status)) return 'Planned';
  if (['Dispatched', 'In Transit', 'In Progress'].includes(status)) return 'In Progress';
  if (['Paused', 'Waiting for Parts', 'Waiting for Approval'].includes(status)) return 'On Hold';
  if (status === 'Completed') return 'Completed';
  return 'Planned';
};

export default function CustomerBoatDetailSimulate() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const boatId = searchParams.get('boatId');
  const customerId = searchParams.get('customerId');

  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [boat, setBoat] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndLoad();
  }, [boatId, customerId]);

  const checkAuthAndLoad = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser?.role !== 'admin') {
        setLoading(false);
        return;
      }

      if (boatId && customerId) {
        await loadData();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth error:', error);
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [customerData, boatData] = await Promise.all([
        base44.entities.Customer.filter({ id: customerId }),
        base44.entities.Boat.filter({ id: boatId })
      ]);

      if (customerData.length > 0) setCustomer(customerData[0]);
      if (boatData.length > 0) {
        setBoat(boatData[0]);
        const jobsData = await base44.entities.Job.filter({ boat_id: boatId });
        setJobs(jobsData.filter(j => j.status !== 'Cancelled'));

        const allWorkOrders = [];
        for (const job of jobsData) {
          const wos = await base44.entities.WorkOrder.filter({ job_id: job.id });
          allWorkOrders.push(...wos);
        }
        setWorkOrders(allWorkOrders.filter(wo => wo.status !== 'Cancelled'));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">Admin access required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!boat) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-slate-600">Boat not found</p>
        </div>
      </div>
    );
  }

  const displayName = customer?.company_name || 
    `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Test Mode Banner */}
        <div className="mb-6 bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-700" />
            <p className="text-yellow-700 font-medium">
              TEST MODE - Viewing as: {displayName}
            </p>
          </div>
        </div>

        {/* Back Button */}
        <Link to={createPageUrl('CustomerPortalSimulate') + `?customerId=${customerId}`}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Boats
          </Button>
        </Link>

        {/* Boat Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                <Ship className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">{boat.vessel_name}</h1>
                <p className="text-slate-600">
                  {boat.manufacturer} {boat.model} • {boat.year}
                </p>
                {boat.length_m && (
                  <p className="text-sm text-slate-500 mt-1">Length: {boat.length_m}m</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects List */}
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Active Projects</h2>
        
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Clock className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-slate-900 mb-2">No Projects</h3>
              <p className="text-slate-600">
                There are currently no active projects for this vessel.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => {
              const jobWorkOrders = workOrders.filter(wo => wo.job_id === job.id);
              const latestWO = jobWorkOrders.sort((a, b) => 
                new Date(b.updated_date) - new Date(a.updated_date)
              )[0];
              const customerStatus = latestWO ? mapWorkOrderStatus(latestWO.status) : 'Planned';
              const StatusIcon = statusConfig[customerStatus]?.icon || Clock;

              return (
                <Link 
                  key={job.id} 
                  to={createPageUrl('CustomerProjectDetailSimulate') + `?jobId=${job.id}&customerId=${customerId}`}
                >
                  <Card className="hover:shadow-lg transition-all cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-slate-900">{job.title}</h3>
                            <Badge className={statusConfig[customerStatus]?.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {customerStatus}
                            </Badge>
                          </div>
                          {job.customer_notes && (
                            <p className="text-slate-600 mb-3">{job.customer_notes}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Started {format(new Date(job.intake_date || job.created_date), 'MMM d, yyyy')}
                            </div>
                            {jobWorkOrders.length > 0 && (
                              <span>{jobWorkOrders.length} work order{jobWorkOrders.length > 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}