import React from 'react';
import CustomerJobCard from './CustomerJobCard';
import { Briefcase } from 'lucide-react';

export default function CustomerJobList({ jobs, photos, comments }) {
  const visibleJobs = jobs.filter(j => j.status !== 'Cancelled');

  const getJobPhotos = (jobId) => {
    return photos.filter(p => p.job_id === jobId && p.visible_to_customer !== false);
  };

  const getJobComments = (jobId) => {
    return comments.filter(c => c.job_id === jobId && !c.is_internal);
  };

  if (visibleJobs.length === 0) {
    return (
      <div className="text-center py-12">
        <Briefcase className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-slate-900 mb-2">No Projects</h3>
        <p className="text-slate-600">
          No active projects at this time
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Projects</h2>
      {visibleJobs.map(job => (
        <CustomerJobCard 
          key={job.id}
          job={job}
          hasPhotos={getJobPhotos(job.id).length > 0}
          hasComments={getJobComments(job.id).length > 0}
        />
      ))}
    </div>
  );
}