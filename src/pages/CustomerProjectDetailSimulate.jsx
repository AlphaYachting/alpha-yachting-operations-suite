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
    if (jobId && customerId) loadData();
  }, [jobId, customerId]);

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
        <Link to={createPageUrl('CustomerBoatDetailSimulate') + `?boatId=${boat?.id}&customerId=${customerId}`}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {boat?.vessel_name}
          </Button>
        </Link>

        {/* Project Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-slate-900">{job.title}</h1>
                  <Badge className={statusConfig[customerStatus]?.color}>
                    <StatusIcon className="h-4 w-4 mr-1" />
                    {customerStatus}
                  </Badge>
                </div>
                {boat && (
                  <div className="flex items-center gap-2 text-slate-600 mb-3">
                    <Ship className="h-4 w-4" />
                    <span>{boat.vessel_name}</span>
                  </div>
                )}
                {job.customer_notes && (
                  <p className="text-slate-700 text-lg">{job.customer_notes}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-500 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Started {format(new Date(job.intake_date || job.created_date), 'MMM d, yyyy')}</span>
              </div>
              {latestWO?.completion_date && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Completed {format(new Date(latestWO.completion_date), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Project Updates</h2>

        {timeline.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Clock className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-slate-900 mb-2">No Updates Yet</h3>
              <p className="text-slate-600">
                Updates and photos will appear here as work progresses.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {timeline.map((item, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  {item.type === 'photo' ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <ImageIcon className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-slate-700">Photo Update</span>
                        <span className="text-sm text-slate-500">
                          • {format(new Date(item.date), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <img
                        src={item.file_url}
                        alt={item.caption || 'Project photo'}
                        className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedPhoto(item)}
                      />
                      {item.caption && (
                        <p className="text-slate-600 mt-3">{item.caption}</p>
                      )}
                      {item.category && (
                        <Badge variant="outline" className="mt-2">{item.category}</Badge>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-slate-700">
                          {item.author_name || 'Team'}
                        </span>
                        <span className="text-sm text-slate-500">
                          • {format(new Date(item.date), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <p className="text-slate-700">{item.content}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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
  );
}