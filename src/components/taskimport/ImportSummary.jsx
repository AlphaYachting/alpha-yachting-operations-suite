import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Users, Ship, MapPin, Briefcase, ListTodo, AlertTriangle, Home } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function ImportSummary({ results, onStartNew }) {
  const handleViewJob = () => {
    const jobId = results.parentJobId || results.createdJobs[0]?.id;
    if (jobId) {
      window.location.href = `/jobs?id=${jobId}`;
    }
  };
  return (
    <div className="space-y-6">
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-green-900">
            <CheckCircle2 className="w-8 h-8" />
            Import Completed Successfully!
          </CardTitle>
          <CardDescription className="text-green-700">
            Your tasklist has been imported and jobs are ready for review
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{results.createdCustomers.length}</div>
                <div className="text-xs text-gray-600">Customers</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Ship className="w-8 h-8 text-teal-600" />
              <div>
                <div className="text-2xl font-bold">{results.createdBoats.length}</div>
                <div className="text-xs text-gray-600">Boats</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MapPin className="w-8 h-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{results.createdLocations.length}</div>
                <div className="text-xs text-gray-600">Locations</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-indigo-600" />
              <div>
                <div className="text-2xl font-bold">{results.createdJobs.length}</div>
                <div className="text-xs text-gray-600">Jobs</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ListTodo className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{results.createdTasks.length}</div>
                <div className="text-xs text-gray-600">Tasks</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review List */}
      {results.reviewList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-5 h-5" />
              Items Requiring Review ({results.reviewList.length})
            </CardTitle>
            <CardDescription>
              These items need your attention before scheduling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.reviewList.map((item, idx) => (
                <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{item.taskTitle}</div>
                      <div className="text-xs text-amber-700 mt-1">{item.issue}</div>
                      <Badge variant="outline" className="text-xs mt-2">
                        Excel Row {item.rowNum}
                      </Badge>
                    </div>
                    <Link to={createPageUrl('Jobs')}>
                      <Button variant="outline" size="sm">View Job</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Created Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>Created Jobs</CardTitle>
          <CardDescription>Click to view and manage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.createdJobs.map((job, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
                <div>
                  <div className="font-medium text-sm">{job.title}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Status: {job.status}
                  </div>
                </div>
                <Link to={createPageUrl('Jobs')}>
                  <Button variant="outline" size="sm">Open</Button>
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        {results.parentJobId && (
          <Button onClick={handleViewJob} className="flex-1 bg-green-600 hover:bg-green-700">
            <Briefcase className="w-4 h-4 mr-2" />
            View Main Job
          </Button>
        )}
        <Link to={createPageUrl('Jobs')} className="flex-1">
          <Button className="w-full" variant="outline">
            <Briefcase className="w-4 h-4 mr-2" />
            All Jobs
          </Button>
        </Link>
        <Button onClick={onStartNew} className="flex-1 bg-blue-600 hover:bg-blue-700">
          <Home className="w-4 h-4 mr-2" />
          New Import
        </Button>
      </div>
    </div>
  );
}