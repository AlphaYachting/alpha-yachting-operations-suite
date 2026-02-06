import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, MessageSquare } from 'lucide-react';

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

export default function CustomerJobCard({ job, hasPhotos, hasComments, boatName }) {
  const customerStatus = mapJobStatus(job.status);
  const config = statusConfig[customerStatus];

  return (
    <Link to={createPageUrl('CustomerJobDetail') + `?jobId=${job.id}`}>
      <Card className="hover:shadow-md transition-all cursor-pointer border-l-4" style={{ borderLeftColor: config.color.includes('blue') ? '#3b82f6' : config.color.includes('yellow') ? '#eab308' : config.color.includes('orange') ? '#f97316' : '#10b981' }}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                {job.title}
              </h3>
              {boatName && (
                <p className="text-sm text-slate-500 mb-2">{boatName}</p>
              )}
            </div>
            <Badge className={config.color}>
              {config.label}
            </Badge>
          </div>
          {(hasPhotos || hasComments) && (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              {hasPhotos && (
                <div className="flex items-center gap-1">
                  <Camera className="h-4 w-4" />
                  <span>Photos</span>
                </div>
              )}
              {hasComments && (
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  <span>Updates</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}