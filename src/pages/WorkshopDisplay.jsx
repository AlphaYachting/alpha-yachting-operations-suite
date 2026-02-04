import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Clock, RefreshCw, Play, AlertTriangle, CheckCircle, Timer } from 'lucide-react';

export default function WorkshopDisplay() {
  const [workOrders, setWorkOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [boats, setBoats] = useState([]);
  const [jobs, setJobs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshInterval, setRefreshInterval] = useState(2); // minutes
  const [countdown, setCountdown] = useState(120); // seconds
  const [currentTime, setCurrentTime] = useState(new Date());

  const loadData = async () => {
    try {
      setError(null);
      
      const today = new Date();
      const startDate = format(startOfDay(today), 'yyyy-MM-dd');
      const endDate = format(endOfDay(today), 'yyyy-MM-dd');

      // Load only TODAY's work orders
      const allWorkOrders = await base44.entities.WorkOrder.list('-scheduled_date', 200);
      const todayWorkOrders = allWorkOrders.filter(wo => {
        if (!wo.scheduled_date) return false;
        return wo.scheduled_date >= startDate && wo.scheduled_date <= endDate;
      });

      setWorkOrders(todayWorkOrders);

      // Load technicians only once (cache)
      if (technicians.length === 0) {
        const techData = await base44.entities.Technician.list();
        setTechnicians(techData);
      }

      // Load boats only for boat_ids in today's work orders
      const boatIds = new Set();
      const jobIds = new Set();
      todayWorkOrders.forEach(wo => {
        if (wo.job_id) jobIds.add(wo.job_id);
      });

      if (jobIds.size > 0) {
        const jobsList = await base44.entities.Job.filter({ id: { $in: Array.from(jobIds) } });
        const jobsMap = {};
        jobsList.forEach(job => {
          jobsMap[job.id] = job;
          if (job.boat_id) boatIds.add(job.boat_id);
        });
        setJobs(jobsMap);
      }

      if (boatIds.size > 0) {
        const boatsList = await base44.entities.Boat.filter({ id: { $in: Array.from(boatIds) } });
        setBoats(boatsList);
      }

      setLastUpdate(new Date());
      setCountdown(refreshInterval * 60);
      setLoading(false);
    } catch (err) {
      console.error('Error loading workshop data:', err);
      setError('Data load failed — retrying in ' + refreshInterval + ' minutes');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const dataRefreshTimer = setInterval(() => {
      loadData();
    }, refreshInterval * 60 * 1000);

    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return refreshInterval * 60;
        return prev - 1;
      });
    }, 1000);

    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(dataRefreshTimer);
      clearInterval(countdownTimer);
      clearInterval(clockTimer);
    };
  }, [refreshInterval]);

  const getBoatName = (jobId) => {
    const job = jobs[jobId];
    if (!job) return 'Unknown';
    const boat = boats.find(b => b.id === job.boat_id);
    return boat?.vessel_name || 'Unknown Boat';
  };

  const getTechName = (techIds) => {
    if (!techIds || techIds.length === 0) return 'Unassigned';
    const tech = technicians.find(t => t.id === techIds[0]);
    return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
  };

  const getJobLocation = (jobId) => {
    const job = jobs[jobId];
    return job?.location_id || '';
  };

  // Sort work orders by scheduled time, put unscheduled at the end
  const sortedWorkOrders = [...workOrders].sort((a, b) => {
    if (!a.scheduled_start_time && !b.scheduled_start_time) return 0;
    if (!a.scheduled_start_time) return 1;
    if (!b.scheduled_start_time) return -1;
    return a.scheduled_start_time.localeCompare(b.scheduled_start_time);
  });

  // Group by time slots for better overview
  const groupByTimeSlot = (wos) => {
    const groups = {
      morning: [], // before 12:00
      afternoon: [], // 12:00 - 17:00
      evening: [], // after 17:00
      unscheduled: []
    };

    wos.forEach(wo => {
      if (!wo.scheduled_start_time) {
        groups.unscheduled.push(wo);
        return;
      }
      const hour = parseInt(wo.scheduled_start_time.split(':')[0]);
      if (hour < 12) groups.morning.push(wo);
      else if (hour < 17) groups.afternoon.push(wo);
      else groups.evening.push(wo);
    });

    return groups;
  };

  const timeGroups = groupByTimeSlot(sortedWorkOrders);

  const WorkOrderCard = ({ wo }) => (
    <div className="bg-slate-800 rounded-lg p-4 border-l-4 border-blue-500 hover:bg-slate-750 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="text-3xl font-bold text-white">
          {getBoatName(wo.job_id)}
        </div>
        {wo.scheduled_start_time && (
          <div className="text-2xl font-bold text-blue-400 ml-4">
            {wo.scheduled_start_time}
          </div>
        )}
      </div>
      <div className="text-xl text-slate-300 mb-1">
        {wo.title}
      </div>
      {wo.scheduled_end_time && (
        <div className="text-sm text-slate-500">
          Expected completion: {wo.scheduled_end_time}
        </div>
      )}
      {getJobLocation(wo.job_id) && (
        <div className="text-sm text-slate-400 mt-2">
          📍 {getJobLocation(wo.job_id)}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
        <div>
          <h1 className="text-4xl font-bold">Workshop Display</h1>
          <p className="text-lg text-slate-400">
            {format(currentTime, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-900/50 border border-red-600 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-400" />
            <span className="text-red-200">{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Board - Today's Schedule */}
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4">
            <div className="text-blue-200 text-sm mb-1">Morning Jobs</div>
            <div className="text-4xl font-bold text-white">{timeGroups.morning.length}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg p-4">
            <div className="text-amber-200 text-sm mb-1">Afternoon Jobs</div>
            <div className="text-4xl font-bold text-white">{timeGroups.afternoon.length}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4">
            <div className="text-purple-200 text-sm mb-1">Evening Jobs</div>
            <div className="text-4xl font-bold text-white">{timeGroups.evening.length}</div>
          </div>
          <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg p-4">
            <div className="text-slate-200 text-sm mb-1">Total Today</div>
            <div className="text-4xl font-bold text-white">{workOrders.length}</div>
          </div>
        </div>

        {/* Morning Jobs */}
        {timeGroups.morning.length > 0 && (
          <div>
            <div className="bg-blue-900/30 rounded-lg p-4 mb-4 flex items-center gap-3">
              <div className="text-3xl">🌅</div>
              <div>
                <h2 className="text-2xl font-bold text-blue-400">Morning (before 12:00)</h2>
                <p className="text-slate-400">{timeGroups.morning.length} job{timeGroups.morning.length !== 1 ? 's' : ''} scheduled</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {timeGroups.morning.map(wo => (
                <WorkOrderCard key={wo.id} wo={wo} />
              ))}
            </div>
          </div>
        )}

        {/* Afternoon Jobs */}
        {timeGroups.afternoon.length > 0 && (
          <div>
            <div className="bg-amber-900/30 rounded-lg p-4 mb-4 flex items-center gap-3">
              <div className="text-3xl">☀️</div>
              <div>
                <h2 className="text-2xl font-bold text-amber-400">Afternoon (12:00 - 17:00)</h2>
                <p className="text-slate-400">{timeGroups.afternoon.length} job{timeGroups.afternoon.length !== 1 ? 's' : ''} scheduled</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {timeGroups.afternoon.map(wo => (
                <WorkOrderCard key={wo.id} wo={wo} />
              ))}
            </div>
          </div>
        )}

        {/* Evening Jobs */}
        {timeGroups.evening.length > 0 && (
          <div>
            <div className="bg-purple-900/30 rounded-lg p-4 mb-4 flex items-center gap-3">
              <div className="text-3xl">🌙</div>
              <div>
                <h2 className="text-2xl font-bold text-purple-400">Evening (after 17:00)</h2>
                <p className="text-slate-400">{timeGroups.evening.length} job{timeGroups.evening.length !== 1 ? 's' : ''} scheduled</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {timeGroups.evening.map(wo => (
                <WorkOrderCard key={wo.id} wo={wo} />
              ))}
            </div>
          </div>
        )}

        {/* Unscheduled Jobs */}
        {timeGroups.unscheduled.length > 0 && (
          <div>
            <div className="bg-slate-700 rounded-lg p-4 mb-4 flex items-center gap-3">
              <div className="text-3xl">⏰</div>
              <div>
                <h2 className="text-2xl font-bold text-slate-300">Time Not Set</h2>
                <p className="text-slate-400">{timeGroups.unscheduled.length} job{timeGroups.unscheduled.length !== 1 ? 's' : ''} without scheduled time</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {timeGroups.unscheduled.map(wo => (
                <WorkOrderCard key={wo.id} wo={wo} />
              ))}
            </div>
          </div>
        )}

        {/* No Jobs Today */}
        {workOrders.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-slate-300 mb-2">No jobs scheduled for today</h2>
            <p className="text-slate-500">Enjoy your day!</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-slate-400 text-sm">Current time:</span>
            <span className="ml-2 text-white font-semibold">{format(currentTime, 'HH:mm:ss')}</span>
          </div>
          <div>
            <span className="text-slate-400 text-sm">Last updated:</span>
            <span className="ml-2 text-white font-semibold">{format(lastUpdate, 'HH:mm')}</span>
          </div>
          <div>
            <span className="text-slate-400 text-sm">Next refresh:</span>
            <span className="ml-2 text-blue-400 font-semibold">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm">Refresh interval:</span>
          <button
            onClick={() => setRefreshInterval(2)}
            className={`px-3 py-1 rounded ${refreshInterval === 2 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            2 min
          </button>
          <button
            onClick={() => setRefreshInterval(5)}
            className={`px-3 py-1 rounded ${refreshInterval === 5 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            5 min
          </button>
        </div>
      </div>
    </div>
  );
}