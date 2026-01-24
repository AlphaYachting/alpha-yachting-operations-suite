import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown, ChevronRight, Briefcase, CheckSquare } from 'lucide-react';

export default function AddFromOperationsDrawer({ 
  customerId, 
  boatId, 
  onAdd, 
  onClose 
}) {
  const [jobs, setJobs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [customerId, boatId]);

  const loadData = async () => {
    try {
      const filters = { customer_id: customerId };
      if (boatId) filters.boat_id = boatId;

      const [jobsData, tasksData, boatsData, locationsData] = await Promise.all([
        base44.entities.Job.filter(filters, '-created_date'),
        base44.entities.Task.list(),
        base44.entities.Boat.list(),
        base44.entities.Location.list()
      ]);

      setJobs(jobsData);
      setTasks(tasksData);
      setBoats(boatsData);
      setLocations(locationsData);
    } catch (error) {
      console.error('Error loading operations data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleJob = (jobId) => {
    const expanded = new Set(expandedJobs);
    if (expanded.has(jobId)) {
      expanded.delete(jobId);
    } else {
      expanded.add(jobId);
    }
    setExpandedJobs(expanded);
  };

  const toggleSelection = (type, id, data) => {
    setSelectedItems(prev => {
      const key = `${type}-${id}`;
      const updated = { ...prev };
      if (updated[key]) {
        delete updated[key];
      } else {
        updated[key] = { type, id, data };
      }
      return updated;
    });
  };

  const handleAdd = () => {
    const lineItems = [];
    
    Object.values(selectedItems).forEach(item => {
      if (item.type === 'job') {
        lineItems.push({
          line_type: 'FlatFee',
          title: item.data.title,
          description: item.data.description,
          quantity: 1,
          unit: 'job',
          unit_price: item.data.estimated_cost || 0,
          tax_rate: 20,
          discount_percent: 0,
          job_id: item.data.id,
          show_on_pdf: true,
          sort_order: lineItems.length
        });
      } else if (item.type === 'task') {
        lineItems.push({
          line_type: 'Labor',
          title: item.data.title,
          description: item.data.description,
          quantity: (item.data.estimated_minutes || 60) / 60,
          unit: 'hrs',
          unit_price: 75, // Default hourly rate
          tax_rate: 20,
          discount_percent: 0,
          job_id: item.data.work_order_id,
          task_id: item.data.id,
          show_on_pdf: true,
          sort_order: lineItems.length
        });
      }
    });

    onAdd(lineItems);
  };

  const getBoatName = (boatId) => boats.find(b => b.id === boatId)?.vessel_name || 'Unknown';
  const getLocationName = (locationId) => locations.find(l => l.id === locationId)?.name || 'Unknown';
  const getJobTasks = (jobId) => {
    const workOrders = tasks.filter(t => t.work_order_id && jobs.find(j => j.id === jobId));
    return tasks.filter(t => workOrders.some(wo => wo.id === t.work_order_id));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
          <p>Loading operations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-4xl sm:mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Add from Operations</h2>
            <p className="text-sm text-slate-500 mt-1">
              Select jobs or tasks to add as line items
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p>No jobs found for this customer</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => {
                const jobTasks = getJobTasks(job.id);
                const isExpanded = expandedJobs.has(job.id);
                const isJobSelected = selectedItems[`job-${job.id}`];

                return (
                  <Card key={job.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isJobSelected}
                        onCheckedChange={() => toggleSelection('job', job.id, job)}
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{job.title}</h3>
                              <Badge variant="secondary">{job.status}</Badge>
                              {job.priority && job.priority !== 'Normal' && (
                                <Badge variant="secondary">{job.priority}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                              {getBoatName(job.boat_id)} • {getLocationName(job.location_id)}
                            </p>
                            {job.description && (
                              <p className="text-sm text-slate-500 mt-2">{job.description}</p>
                            )}
                            {job.estimated_cost && (
                              <p className="text-sm font-medium text-slate-700 mt-2">
                                Estimated: €{job.estimated_cost.toFixed(2)}
                              </p>
                            )}
                          </div>
                          {jobTasks.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleJob(job.id)}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {jobTasks.length} tasks
                            </Button>
                          )}
                        </div>

                        {/* Tasks */}
                        {isExpanded && jobTasks.length > 0 && (
                          <div className="mt-4 pl-4 border-l-2 border-slate-200 space-y-2">
                            {jobTasks.map(task => {
                              const isTaskSelected = selectedItems[`task-${task.id}`];
                              return (
                                <div key={task.id} className="flex items-start gap-2 p-2 rounded bg-slate-50">
                                  <Checkbox
                                    checked={isTaskSelected}
                                    onCheckedChange={() => toggleSelection('task', task.id, task)}
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-900">{task.title}</p>
                                    {task.description && (
                                      <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                                    )}
                                    {task.estimated_minutes && (
                                      <p className="text-xs text-slate-600 mt-1">
                                        Est: {(task.estimated_minutes / 60).toFixed(1)} hrs
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-slate-50">
          <p className="text-sm text-slate-600">
            {Object.keys(selectedItems).length} item(s) selected
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleAdd}
              disabled={Object.keys(selectedItems).length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Add Selected
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}