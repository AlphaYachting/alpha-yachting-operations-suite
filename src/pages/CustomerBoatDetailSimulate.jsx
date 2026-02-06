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

  const welcomeMessage = `${boat.vessel_name} - ${jobs.length} ${jobs.length === 1 ? 'project' : 'projects'}`;

  return (
    <>
      {/* Header with Technician Style */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{jobs.length}</div>
                <div className="text-xs text-white/90">projects</div>
              </div>
            </div>
            <div className="text-center flex-1 mx-4">
              <div className="text-3xl font-bold text-white">
                {format(new Date(), 'HH:mm')}
              </div>
              <div className="text-sm text-white/90">
                {format(new Date(), 'EEE, MMM d')}
              </div>
            </div>
            <div className="h-16 w-16 flex items-center justify-center">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/6ff1c7bfe_alpha-yachting-logo-weiss-ohnepremiumsolutions.png"
                alt="Alpha Yachting"
                className="object-contain flex-shrink-0"
                style={{ height: 48 }}
              />
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4">
            <p className="text-white text-center font-medium">{welcomeMessage}</p>
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-slate-50 pt-44">
        <div className="max-w-4xl mx-auto p-4">
          {/* Test Mode Banner */}
          <div className="mb-4 bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-700" />
              <p className="text-yellow-700 font-medium">
                TEST MODE - Viewing as: {displayName}
              </p>
            </div>
          </div>

          {/* Back Button */}
          <Link to={createPageUrl('CustomerPortalSimulate') + `?customerId=${customerId}`}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to My Vessels
            </Button>
          </Link>

          {/* Projects List */}
          {jobs.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <Clock className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-slate-900 mb-2">No Projects</h3>
              <p className="text-slate-600">
                There are currently no active projects for this vessel.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 mb-4 px-1">Your Projects</h2>
              {jobs.map(job => {
                const jobWorkOrders = workOrders.filter(wo => wo.job_id === job.id);
                const latestWO = jobWorkOrders.sort((a, b) => 
                  new Date(b.updated_date) - new Date(a.updated_date)
                )[0];
                const customerStatus = latestWO ? mapWorkOrderStatus(latestWO.status) : 'Planned';
                const borderColor = customerStatus === 'In Progress' ? '#eab308' : 
                                  customerStatus === 'On Hold' ? '#f97316' : 
                                  customerStatus === 'Completed' ? '#10b981' : '#3b82f6';

                return (
                  <Link 
                    key={job.id} 
                    to={createPageUrl('CustomerProjectDetailSimulate') + `?jobId=${job.id}&customerId=${customerId}`}
                  >
                    <Card className="hover:shadow-md transition-all cursor-pointer border-l-4" style={{ borderLeftColor: borderColor }}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">{job.title}</h3>
                          </div>
                          <Badge className={statusConfig[customerStatus]?.color}>
                            {customerStatus}
                          </Badge>
                        </div>
                        {job.customer_notes && (
                          <p className="text-slate-600 text-sm mb-3">{job.customer_notes}</p>
                        )}
                        <div className="text-xs text-slate-500">
                          Started {format(new Date(job.intake_date || job.created_date), 'MMM d, yyyy')}
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
    </>
  );
}