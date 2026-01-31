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

  // Status mapping to 4 columns
  const planned = workOrders.filter(wo => 
    ['Draft', 'Scheduled'].includes(wo.status)
  );
  const inProgress = workOrders.filter(wo => 
    ['In Progress', 'In Transit', 'Dispatched'].includes(wo.status)
  );
  const blocked = workOrders.filter(wo => 
    ['Paused', 'Waiting for Parts', 'Waiting for Approval'].includes(wo.status)
  );
  const done = workOrders.filter(wo => 
    wo.status === 'Completed'
  );

  // Technician summary
  const techSummary = technicians.map(tech => {
    const inProgressWO = inProgress.find(wo => wo.assigned_technicians?.includes(tech.id));
    const blockedWO = blocked.find(wo => wo.assigned_technicians?.includes(tech.id));
    const plannedWO = planned.find(wo => wo.assigned_technicians?.includes(tech.id));

    let state = 'Free';
    let icon = '✓';
    let color = 'text-slate-400';
    let wo = null;

    if (inProgressWO) {
      state = 'In Progress';
      icon = '▶';
      color = 'text-amber-400';
      wo = inProgressWO;
    } else if (blockedWO) {
      state = 'Blocked';
      icon = '⚠';
      color = 'text-red-400';
      wo = blockedWO;
    } else if (plannedWO) {
      state = 'Planned';
      icon = '⏳';
      color = 'text-blue-400';
      wo = plannedWO;
    }

    return {
      name: `${tech.first_name} ${tech.last_name}`,
      state,
      icon,
      color,
      wo,
      isActive: tech.status === 'Active'
    };
  }).filter(t => t.isActive);

  const WorkOrderCard = ({ wo, columnColor }) => (
    <div className="bg-slate-800 rounded-lg p-4 border-l-4" style={{ borderColor: columnColor }}>
      <div className="text-2xl font-bold text-white mb-2">
        {getBoatName(wo.job_id)}
      </div>
      <div className="text-lg text-slate-300 mb-2">
        {wo.title}
      </div>
      <div className="text-xl font-semibold text-amber-400 mb-2">
        {getTechName(wo.assigned_technicians)}
      </div>
      <div className="text-sm text-slate-400">
        {wo.scheduled_start_time && wo.scheduled_end_time 
          ? `${wo.scheduled_start_time} – ${wo.scheduled_end_time}`
          : 'Time TBD'
        }
      </div>
      {getJobLocation(wo.job_id) && (
        <div className="text-xs text-slate-500 mt-1">
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

      {/* Main Board - 4 Columns */}
      <div className="flex gap-6 mb-6">
        {/* Left: 4-column board (70%) */}
        <div className="flex-1 grid grid-cols-4 gap-4">
          {/* PLANNED */}
          <div>
            <div className="bg-blue-900/30 rounded-lg p-3 mb-3 flex items-center gap-2">
              <Timer className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-bold text-blue-400">PLANNED</h2>
              <span className="ml-auto text-blue-300 font-semibold">{planned.length}</span>
            </div>
            <div className="space-y-3">
              {planned.map(wo => (
                <WorkOrderCard key={wo.id} wo={wo} columnColor="#60a5fa" />
              ))}
            </div>
          </div>

          {/* IN PROGRESS */}
          <div>
            <div className="bg-amber-900/30 rounded-lg p-3 mb-3 flex items-center gap-2">
              <Play className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold text-amber-400">IN PROGRESS</h2>
              <span className="ml-auto text-amber-300 font-semibold">{inProgress.length}</span>
            </div>
            <div className="space-y-3">
              {inProgress.map(wo => (
                <WorkOrderCard key={wo.id} wo={wo} columnColor="#fbbf24" />
              ))}
            </div>
          </div>

          {/* BLOCKED */}
          <div>
            <div className="bg-red-900/30 rounded-lg p-3 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <h2 className="text-lg font-bold text-red-400">BLOCKED</h2>
              <span className="ml-auto text-red-300 font-semibold">{blocked.length}</span>
            </div>
            <div className="space-y-3">
              {blocked.map(wo => (
                <WorkOrderCard key={wo.id} wo={wo} columnColor="#f87171" />
              ))}
            </div>
          </div>

          {/* DONE */}
          <div>
            <div className="bg-emerald-900/30 rounded-lg p-3 mb-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-emerald-400">DONE</h2>
              <span className="ml-auto text-emerald-300 font-semibold">{done.length}</span>
            </div>
            <div className="space-y-3">
              {done.map(wo => (
                <WorkOrderCard key={wo.id} wo={wo} columnColor="#34d399" />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Technician Summary (30%) */}
        <div className="w-80">
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Technicians Today
            </h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {techSummary.map((tech, idx) => (
                <div key={idx} className="p-3 bg-slate-700 rounded flex items-start gap-3">
                  <span className={`text-xl ${tech.color}`}>{tech.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{tech.name}</div>
                    {tech.wo ? (
                      <div className="text-sm text-slate-300 truncate">
                        {getBoatName(tech.wo.job_id)} • {tech.wo.title}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Free</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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