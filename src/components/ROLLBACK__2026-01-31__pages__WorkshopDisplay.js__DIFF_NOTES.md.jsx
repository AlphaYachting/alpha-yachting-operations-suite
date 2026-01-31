
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfDay, endOfDay, isToday } from 'date-fns';
import { AlertTriangle, Clock, RefreshCw, Loader2, Users, Calendar, SquareDot } from 'lucide-react';

// Define status mapping for board columns
const getWorkOrderColumn = (workOrder) => {
  switch (workOrder.status) {
    case 'Draft':
    case 'Scheduled':
      return 'PLANNED';
    case 'In Progress':
    case 'In Transit':
    case 'Dispatched':
      return 'IN_PROGRESS';
    case 'Paused':
    case 'Waiting for Parts':
    case 'Waiting for Approval':
      return 'BLOCKED';
    case 'Completed':
    case 'Cancelled':
      return 'DONE';
    default:
      return 'PLANNED'; // Default to planned if status is unknown
  }
};

const MAX_RETRIES = 3; // Maximum number of automatic retries for data loading

export default function WorkshopDisplay() {
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [boats, setBoats] = useState([]);
  const [technicians, setTechnicians] = useState([]); // Loaded once
  const [techniciansLoaded, setTechniciansLoaded] = useState(false); // Flag to track initial tech load
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [countdown, setCountdown] = useState(120); // Initial countdown for 2 minutes
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(120); // Default 2 minutes
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadData = async (isInitialLoad = false) => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      // Fetch technicians only once on initial load
      if (isInitialLoad && !techniciansLoaded) {
        const activeTechnicians = await base44.entities.Technician.filter({ status: 'Active' });
        setTechnicians(activeTechnicians);
        setTechniciansLoaded(true);
      }

      // Define today's date range for filtering work orders
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      // 1. Fetch work orders scheduled for today
      const workOrdersData = await base44.entities.WorkOrder.filter(
        {
          scheduled_date: {
            $gte: startOfToday,
            $lte: endOfToday
          }
        },
        '-scheduled_date',
        500
      );
      setWorkOrders(workOrdersData);

      // 2. Extract unique job IDs from today's work orders and fetch corresponding jobs
      const uniqueJobIds = [...new Set(workOrdersData.map(wo => wo.job_id).filter(Boolean))];
      const jobsData = uniqueJobIds.length > 0
        ? await Promise.all(uniqueJobIds.map(id => base44.entities.Job.get(id)))
        : [];
      setJobs(jobsData.filter(Boolean)); // Filter out any nulls from failed gets

      // 3. Extract unique boat IDs from the fetched jobs and fetch corresponding boats
      const uniqueBoatIds = [...new Set(jobsData.map(j => j?.boat_id).filter(Boolean))]; // Safely access boat_id
      const boatsData = uniqueBoatIds.length > 0
        ? await Promise.all(uniqueBoatIds.map(id => base44.entities.Boat.get(id)))
        : [];
      setBoats(boatsData.filter(Boolean));

      setLastUpdate(new Date());
      setCountdown(refreshIntervalSeconds); // Reset countdown
      setLoading(false);
      setRetryCount(0); // Reset retry count on successful load

    } catch (err) {
      console.error('Error loading workshop data:', err);
      setError(err.message || 'Failed to load data. Please try again.');
      setLoading(false);
      // Retry logic will be handled by the useEffect watching for `error` if needed,
      // or the manual refresh button can be used.
    }
  };

  useEffect(() => {
    // Function to handle fetching with retries
    const fetchWithRetries = async (isInitial = false) => {
      let success = false;
      for (let i = 0; i <= MAX_RETRIES; i++) {
        try {
          await loadData(isInitial);
          success = true;
          break; // Success, break retry loop
        } catch (e) {
          console.warn(`Data load attempt ${i + 1} failed. Retrying...`, e);
          if (i < MAX_RETRIES) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          }
        }
      }
      if (!success) {
        setError('Failed to load data after multiple retries. Please check network and try again.');
        setLoading(false);
      }
    };

    fetchWithRetries(true); // Initial load with retries

    // Set up auto-refresh interval
    const refreshInterval = setInterval(() => {
      fetchWithRetries(); // Reload on interval with retries
    }, refreshIntervalSeconds * 1000);

    // Set up countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return refreshIntervalSeconds; // Reset to full interval when 0
        return prev - 1;
      });
    }, 1000);

    // Clean up intervals on component unmount or when refresh interval changes
    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [refreshIntervalSeconds]); // Rerun effect if refreshIntervalSeconds changes

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

  // Categorize work orders for the board
  const plannedWorkOrders = useMemo(() => workOrders.filter(wo => getWorkOrderColumn(wo) === 'PLANNED'), [workOrders]);
  const inProgressWorkOrders = useMemo(() => workOrders.filter(wo => getWorkOrderColumn(wo) === 'IN_PROGRESS'), [workOrders]);
  const blockedWorkOrders = useMemo(() => workOrders.filter(wo => getWorkOrderColumn(wo) === 'BLOCKED'), [workOrders]);
  const doneWorkOrders = useMemo(() => workOrders.filter(wo => getWorkOrderColumn(wo) === 'DONE'), [workOrders]);

  // Calculate technician work order counts for the sidebar
  const technicianWorkCounts = useMemo(() => {
    const counts = {};
    workOrders.forEach(wo => {
      if (wo.assigned_technicians && wo.assigned_technicians.length > 0) {
        wo.assigned_technicians.forEach(techId => {
          counts[techId] = (counts[techId] || 0) + 1;
        });
      }
    });
    return technicians.map(tech => ({
      ...tech,
      workOrderCount: counts[tech.id] || 0
    })).sort((a, b) => b.workOrderCount - a.workOrderCount); // Sort by count descending
  }, [workOrders, technicians]);


  // Inline WorkOrderCard component for rendering within columns
  const WorkOrderCard = ({ workOrder }) => {
    const job = getJobDetails(workOrder.job_id);
    const boatName = getBoatName(job?.boat_id);
    const technicianNames = getTechnicianNames(workOrder.assigned_technicians);

    const scheduledTime = workOrder.scheduled_start_time ?
      format(parseISO(`2000-01-01T${workOrder.scheduled_start_time}`), 'HH:mm') :
      'Any time';

    return (
      <div className="bg-slate-700 rounded-lg p-4 shadow-lg mb-3 border border-slate-600 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-1">WO-{workOrder.id} - {job?.title || 'No Job Title'}</h3>
        <p className="text-slate-300 text-sm mb-2">{boatName}</p>
        <div className="flex items-center text-slate-400 text-xs mb-1">
          <Users className="h-4 w-4 mr-2" />
          <span>{technicianNames}</span>
        </div>
        <div className="flex items-center text-slate-400 text-xs">
          <Clock className="h-4 w-4 mr-2" />
          <span>{scheduledTime}</span>
        </div>
        <p className={`mt-2 text-sm font-medium ${workOrder.status === 'Completed' ? 'text-green-400' : workOrder.status === 'Blocked' || workOrder.status === 'Paused' ? 'text-red-400' : 'text-blue-400'}`}>
          Status: {workOrder.status}
        </p>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-slate-700 flex-shrink-0">
        <div>
          <h1 className="text-5xl font-bold text-white mb-2">Workshop Display Board</h1>
          <p className="text-xl text-slate-300">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} • {format(new Date(), 'HH:mm')}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm text-slate-400 mb-1">Last update</p>
            <p className="text-lg text-slate-200">{format(lastUpdate, 'HH:mm:ss')}</p>
            <p className="text-xs text-slate-400 mt-2">Next refresh in {countdown}s</p>
          </div>
          <button
            onClick={() => loadData()} // Manual refresh
            className="p-4 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <RefreshCw className="h-6 w-6 text-white" />}
          </button>
          <button
            onClick={() => setRefreshIntervalSeconds(prev => prev === 120 ? 300 : 120)}
            className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors text-white text-sm font-medium"
          >
            Auto-refresh: {refreshIntervalSeconds / 60} min
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-800 border border-red-600 text-white p-4 rounded-md mb-8 flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 mr-3" />
            <span>Error: {error}</span>
          </div>
          <button onClick={() => loadData()} className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md">
            Retry Now
          </button>
        </div>
      )}

      <div className="flex flex-grow gap-6">
        {/* Main Board Section */}
        <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* PLANNED Column */}
          <div className="bg-slate-800 rounded-xl p-4 shadow-xl flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-400" />
              PLANNED ({plannedWorkOrders.length})
            </h2>
            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
              {plannedWorkOrders.length === 0 ? (
                <div className="text-slate-400 text-center py-8">No planned work.</div>
              ) : (
                plannedWorkOrders.map(wo => <WorkOrderCard key={wo.id} workOrder={wo} />)
              )}
            </div>
          </div>

          {/* IN PROGRESS Column */}
          <div className="bg-slate-800 rounded-xl p-4 shadow-xl flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="h-6 w-6 text-amber-400" />
              IN PROGRESS ({inProgressWorkOrders.length})
            </h2>
            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
              {inProgressWorkOrders.length === 0 ? (
                <div className="text-slate-400 text-center py-8">No work in progress.</div>
              ) : (
                inProgressWorkOrders.map(wo => <WorkOrderCard key={wo.id} workOrder={wo} />)
              )}
            </div>
          </div>

          {/* BLOCKED Column */}
          <div className="bg-slate-800 rounded-xl p-4 shadow-xl flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              BLOCKED ({blockedWorkOrders.length})
            </h2>
            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
              {blockedWorkOrders.length === 0 ? (
                <div className="text-slate-400 text-center py-8">No blocked work.</div>
              ) : (
                blockedWorkOrders.map(wo => <WorkOrderCard key={wo.id} workOrder={wo} />)
              )}
            </div>
          </div>

          {/* DONE Column */}
          <div className="bg-slate-800 rounded-xl p-4 shadow-xl flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <SquareDot className="h-6 w-6 text-green-400" />
              DONE ({doneWorkOrders.length})
            </h2>
            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
              {doneWorkOrders.length === 0 ? (
                <div className="text-slate-400 text-center py-8">No completed work.</div>
              ) : (
                doneWorkOrders.map(wo => <WorkOrderCard key={wo.id} workOrder={wo} />)
              )}
            </div>
          </div>
        </div>

        {/* Technician Summary Sidebar */}
        <div className="w-72 bg-slate-800 rounded-xl p-4 shadow-xl flex-shrink-0 flex flex-col">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-400" />
            Technicians
          </h2>
          <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
            {technicianWorkCounts.length === 0 ? (
              <div className="text-slate-400 text-center py-8">No active technicians.</div>
            ) : (
              technicianWorkCounts.map(tech => (
                <div key={tech.id} className="bg-slate-700 rounded-lg p-3 mb-2 flex items-center justify-between shadow-sm border border-slate-600">
                  <span className="text-white text-md font-medium">{tech.first_name} {tech.last_name}</span>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${tech.workOrderCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-500 text-slate-300'}`}>
                    {tech.workOrderCount}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Custom CSS for scrollbar if needed, typically in a global CSS file */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #334155; /* slate-700 */
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569; /* slate-600 */
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b; /* slate-500 */
        }
      `}</style>
    </div>
  );
}
