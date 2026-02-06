import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, CheckCircle2, Pause, Calendar, MessageSquare, Image as ImageIcon, Ship, AlertCircle } from 'lucide-react';
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

export default function CustomerProjectDetailSimulate() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const jobId = searchParams.get('jobId');
  const customerId = searchParams.get('customerId');

  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [job, setJob] = useState(null);
  const [boat, setBoat] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [comments, setComments] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, [jobId, customerId]);

  const checkAuthAndLoad = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser?.role !== 'admin') {
        setLoading(false);
        return;
      }

      if (jobId && customerId) {
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
      const [customerData, jobData] = await Promise.all([
        base44.entities.Customer.filter({ id: customerId }),
        base44.entities.Job.filter({ id: jobId })
      ]);

      if (customerData.length > 0) setCustomer(customerData[0]);

      if (jobData.length > 0) {
        const job = jobData[0];
        setJob(job);

        const boatData = await base44.entities.Boat.filter({ id: job.boat_id });
        if (boatData.length > 0) setBoat(boatData[0]);

        const wos = await base44.entities.WorkOrder.filter({ job_id: jobId });
        setWorkOrders(wos.filter(wo => wo.status !== 'Cancelled'));

        const allPhotos = [];
        const allComments = [];
        
        for (const wo of wos) {
          const woPhotos = await base44.entities.WorkOrderPhoto.filter({ work_order_id: wo.id });
          allPhotos.push(...woPhotos.filter(p => p.is_customer_visible));

          const woComments = await base44.entities.WorkOrderComment.filter({ work_order_id: wo.id });
          allComments.push(...woComments.filter(c => !c.is_internal));
        }

        setPhotos(allPhotos);
        setComments(allComments);

        const timelineItems = [
          ...allPhotos.map(p => ({ ...p, type: 'photo', date: p.created_date })),
          ...allComments.map(c => ({ ...c, type: 'comment', date: c.created_date }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        setTimeline(timelineItems);
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

  if (!job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-slate-600">Project not found</p>
        </div>
      </div>
    );
  }

  const latestWO = workOrders.sort((a, b) => 
    new Date(b.updated_date) - new Date(a.updated_date)
  )[0];
  const customerStatus = latestWO ? mapWorkOrderStatus(latestWO.status) : 'Planned';
  const StatusIcon = statusConfig[customerStatus]?.icon || Clock;

  const displayName = customer?.company_name || 
    `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim();

  const welcomeMessage = `Project: ${job.title}`;

  return (
    <>
      {/* Header with Technician Style */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">1</div>
                <div className="text-xs text-white/90">project</div>
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
          <Link to={createPageUrl('CustomerBoatDetailSimulate') + `?boatId=${boat?.id}&customerId=${customerId}`}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>

          {/* Project Header */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
              <Badge className={statusConfig[customerStatus]?.color}>
                {customerStatus}
              </Badge>
            </div>
            
            {job.customer_notes && (
              <p className="text-slate-700 whitespace-pre-wrap">{job.customer_notes}</p>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Project Updates</h2>

            {timeline.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No updates yet
              </div>
            ) : (
              <div className="space-y-6">
                {timeline.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0">
                      {item.type === 'photo' ? (
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-blue-600" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-green-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-500 mb-2">
                        {format(new Date(item.date), 'MMM d, yyyy • h:mm a')}
                      </p>
                      {item.type === 'photo' ? (
                        <button 
                          onClick={() => setSelectedPhoto(item)}
                          className="block"
                        >
                          <img 
                            src={item.file_url} 
                            alt="Project update"
                            className="rounded-lg max-w-xs hover:opacity-90 transition-opacity"
                          />
                          {item.caption && (
                            <p className="text-sm text-slate-700 mt-2">{item.caption}</p>
                          )}
                        </button>
                      ) : (
                        <div className="bg-slate-50 rounded-lg p-4">
                          {item.author_name && (
                            <p className="text-sm font-medium text-slate-900 mb-1">
                              {item.author_name}
                            </p>
                          )}
                          <p className="text-slate-700">{item.content}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photo Modal */}
          {selectedPhoto && (
            <div
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
              onClick={() => setSelectedPhoto(null)}
            >
              <div className="max-w-5xl w-full">
                <img
                  src={selectedPhoto.file_url}
                  alt={selectedPhoto.caption || 'Project photo'}
                  className="w-full rounded-lg"
                />
                {selectedPhoto.caption && (
                  <p className="text-white mt-4 text-center">{selectedPhoto.caption}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}