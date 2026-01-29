import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfDay, endOfDay, isPast, isToday } from 'date-fns';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import WorkshopDisplayCard from '@/components/workshop/WorkshopDisplayCard';

export default function WorkshopDisplay() {
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [nextRefresh, setNextRefresh] = useState(15);

  const loadData = async () => {
    try {
      const [workOrdersData, jobsData, techniciansData, boatsData] = await Promise.all([
        base44.entities.WorkOrder.list('-scheduled_date', 500),
        base44.entities.Job.list('-created_date', 500),
        base44.entities.Technician.filter({ status: 'Active' }),
        base44.entities.Boat.filter({ status: { $ne: 'Sold' } }, '-created_date', 200)
      ]);

      setWorkOrders(workOrdersData);
      setJobs(jobsData);
      setTechnicians(techniciansData);
      setBoats(boatsData);
      setLastUpdate(new Date());
      setNextRefresh(15);
      setLoading(false);
    } catch (error) {
      console.error('Error loading workshop data:', error);
    }
  };

  useEffect(() => {
    loadData();

    // Refresh every 15 minutes
    const refreshInterval = setInterval(() => {
      loadData();
    }, 15 * 60 * 1000);

    // Countdown timer for next refresh
    const countdownInterval = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) return 15;
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const today = startOfDay(new Date());
  
  const overdueWorkOrders = workOrders.filter(wo => {
    if (!wo.scheduled_date) return false;
    const date = parseISO(wo.scheduled_date);
    return date < today && wo.status !== 'Draft' && !['Completed', 'Cancelled'].includes(wo.status);
  }).sort((a, b) => parseISO(a.scheduled_date) - parseISO(b.scheduled_date));

  const todayWorkOrders = workOrders.filter(wo => {
    if (!wo.scheduled_date) return false;
    const date = parseISO(wo.scheduled_date);
    return isToday(date) && wo.status !== 'Draft' && !['Completed', 'Cancelled'].includes(wo.status);
  }).sort((a, b) => {
    const aTime = a.scheduled_start_time || '00:00';
    const bTime = b.scheduled_start_time || '00:00';
    return aTime.localeCompare(bTime);
  });

  const getBoatName = (boatId) => {
    const boat = boats.find(b => b.id === boatId);
    return boat?.vessel_name || 'Unknown Boat';
  };

  const getJobDetails = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    return job;
  };

  const getTechnicianNames = (techIds) => {
    if (!techIds || techIds.length === 0) return 'Unassigned';
    return techIds
      .map(id => {
        const tech = technicians.find(t => t.id === id);
        return tech ? `${tech.first_name} ${tech.last_name}`.trim() : null;
      })
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-slate-700">
        <div>
          <h1 className="text-5xl font-bold text-white mb-2">Workshop Status</h1>
          <p className="text-xl text-slate-300">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} • {format(new Date(), 'HH:mm')}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm text-slate-400 mb-1">Last update</p>
            <p className="text-lg text-slate-200">{format(lastUpdate, 'HH:mm:ss')}</p>
            <p className="text-xs text-slate-400 mt-2">Next refresh in {nextRefresh}s</p>
          </div>
          <button
            onClick={loadData}
            className="p-4 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Overdue Alert Section */}
      {overdueWorkOrders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-red-600">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-red-400">
              ⚠️ OVERDUE WORK ({overdueWorkOrders.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
            {overdueWorkOrders.map((wo) => (
              <WorkshopDisplayCard
                key={wo.id}
                workOrder={wo}
                job={getJobDetails(wo.job_id)}
                boatName={getBoatName(getJobDetails(wo.job_id)?.boat_id)}
                technicianNames={getTechnicianNames(wo.assigned_technicians)}
                isOverdue={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Today's Work Section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-amber-600">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-amber-400">
            TODAY'S WORK ({todayWorkOrders.length})
          </h2>
        </div>

        {todayWorkOrders.length === 0 ? (
          <div className="rounded-2xl bg-slate-700/50 border-2 border-slate-600 p-16 text-center">
            <p className="text-3xl text-slate-300">No work orders scheduled for today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
            {todayWorkOrders.map((wo) => (
              <WorkshopDisplayCard
                key={wo.id}
                workOrder={wo}
                job={getJobDetails(wo.job_id)}
                boatName={getBoatName(getJobDetails(wo.job_id)?.boat_id)}
                technicianNames={getTechnicianNames(wo.assigned_technicians)}
                isOverdue={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}