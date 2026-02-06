import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import CustomerHeader from '@/components/customer/CustomerHeader';
import CustomerJobTimeline from '@/components/customer/CustomerJobTimeline';

const statusConfig = {
  'Planned': { color: 'bg-blue-100 text-blue-800', label: 'Planned' },
  'In Progress': { color: 'bg-yellow-100 text-yellow-800', label: 'In Progress' },
  'On Hold': { color: 'bg-orange-100 text-orange-800', label: 'On Hold' },
  'Completed': { color: 'bg-green-100 text-green-800', label: 'Completed' }
};

function mapJobStatus(status) {
  const statusMap = {
    'New': 'Planned',
    'Quoted': 'Planned',
    'Approved': 'Planned',
    'Scheduled': 'Planned',
    'In Progress': 'In Progress',
    'Waiting for Parts': 'On Hold',
    'On Hold': 'On Hold',
    'Completed': 'Completed',
    'Invoiced': 'Completed'
  };
  return statusMap[status] || 'Planned';
}

export default function CustomerJobDetail() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const jobId = searchParams.get('jobId');

  const [job, setJob] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (jobId) {
      loadData();
    }
  }, [jobId]);

  const loadData = async () => {
    try {
      const [jobData] = await base44.entities.Job.filter({ id: jobId });
      if (jobData) {
        setJob(jobData);

        const [photosData, commentsData] = await Promise.all([
          base44.entities.WorkOrderPhoto.filter({ job_id: jobId }),
          base44.entities.WorkOrderComment.list()
        ]);

        setPhotos(photosData);
        setComments(commentsData.filter(c => {
          return photosData.some(p => p.work_order_id === c.work_order_id);
        }));
      }
    } catch (error) {
      console.error('Error loading job:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <CustomerHeader />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 pt-16 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <CustomerHeader />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 pt-16 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Project Not Found</h2>
          </div>
        </div>
      </>
    );
  }

  const customerStatus = mapJobStatus(job.status);
  const config = statusConfig[customerStatus];

  return (
    <>
      <CustomerHeader />
      <div className="min-h-screen bg-slate-50 pt-16">
        <div className="max-w-4xl mx-auto p-4">
          <Link to={createPageUrl('CustomerDashboard')}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>

          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
              <Badge className={config.color}>
                {config.label}
              </Badge>
            </div>
            
            {job.customer_notes && (
              <p className="text-slate-700 whitespace-pre-wrap">{job.customer_notes}</p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Project Updates</h2>
            <CustomerJobTimeline photos={photos} comments={comments} />
          </div>
        </div>
      </div>
    </>
  );
}