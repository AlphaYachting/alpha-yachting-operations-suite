import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, MapPin, AlertCircle, Settings, X, ChevronRight, CheckCircle2, Users, WifiOff, Wifi, Calendar, Ship } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isToday, isTomorrow, startOfDay, formatDistanceToNow } from 'date-fns';
import TeamPreviewMode from '@/components/mobile/TeamPreviewMode';
import MobileHeaderWithWelcome from '@/components/mobile/MobileHeaderWithWelcome';
import SyncStatus from '@/components/mobile/SyncStatus';
import { offlineStorage } from '@/components/offline/offlineStorage';
import { connectionMonitor } from '@/components/offline/connectionMonitor';
import { syncQueue } from '@/components/offline/syncQueue';

export default function TeamMobileHome({ onNavigate, previewUserId, onPreviewUserChange }) {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [locations, setLocations] = useState([]);
  const [boats, setBoats] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showPreviewMode, setShowPreviewMode] = useState(false);
  const [previewTechnicianName, setPreviewTechnicianName] = useState(null);
  const [resolvedTechnicianId, setResolvedTechnicianId] = useState(null);
  const [displayUser, setDisplayUser] = useState(null);
  const [allSearchWorkOrders, setAllSearchWorkOrders] = useState([]);
  const [allSearchJobs, setAllSearchJobs] = useState([]);
  const [allSearchBoats, setAllSearchBoats] = useState([]);
  const [allSearchLocations, setAllSearchLocations] = useState([]);
  const [allSearchCustomers, setAllSearchCustomers] = useState([]);

  useEffect(() => {
    // Monitor connection status
    const unsubscribe = connectionMonitor.subscribe((status) => {
      setIsOnline(status.isOnline);
      if (status.isOnline) {
        syncPendingChanges();
      }
    });

    loadData(true); // Show cached data first
    return unsubscribe;
  }, [previewUserId]);

  const syncPendingChanges = async () => {
    await syncQueue.processQueue();
    await syncQueue.clearCompletedItems();
  };

  const loadData = async (showCachedFirst = false) => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Show cached data immediately for instant load
      if (showCachedFirst) {
        const cachedData = await Promise.all([
          offlineStorage.getAllData(offlineStorage.STORES.workOrders),
          offlineStorage.getAllData(offlineStorage.STORES.jobs),
          offlineStorage.getAllData(offlineStorage.STORES.locations),
          offlineStorage.getAllData(offlineStorage.STORES.boats),
          offlineStorage.getAllData(offlineStorage.STORES.tasks)
        ]);

        if (cachedData[0]?.length > 0) {
          setWorkOrders(cachedData[0]);
          setJobs(cachedData[1] || []);
          setLocations(cachedData[2] || []);
          setBoats(cachedData[3] || []);
          setTasks(cachedData[4] || []);
          setLoading(false); // Show immediately
        }
      }

      let tasksData, workOrdersData, locationsData, boatsData, jobsData;

      try {
        // Find technician efficiently
        let technicianId;
        if (previewUserId) {
          technicianId = previewUserId;
        } else {
          const matchedTechs = await base44.entities.Technician.filter({
            $or: [
              { user_id: currentUser?.id },
              { email: currentUser?.email }
            ]
          });
          technicianId = matchedTechs?.[0]?.id;
        }

        setResolvedTechnicianId(technicianId);

        // Set display user: in preview mode, fetch the technician's name for welcome message
        if (previewUserId && technicianId) {
          const techs = await base44.entities.Technician.filter({ id: technicianId });
          if (techs?.[0]) {
            setDisplayUser({
              id: technicianId,
              full_name: `${techs[0].first_name} ${techs[0].last_name}`,
              role: 'technician'
            });
          }
        } else {
          setDisplayUser(currentUser);
        }

        if (!technicianId) {
          setWorkOrders([]);
          setLocations([]);
          setBoats([]);
          setJobs([]);
          setTasks([]);
          setLoading(false);
          return;
        }

        // Fetch work orders
        workOrdersData = await base44.entities.WorkOrder.filter({
          $or: [
            { assigned_technicians: { $in: [technicianId] } },
            { lead_technician_id: technicianId }
          ]
        });

        const jobIds = [...new Set(workOrdersData.map(wo => wo.job_id).filter(Boolean))];
        const woIds = workOrdersData.map(wo => wo.id);

        // Fetch related data
        jobsData = jobIds.length > 0 ? await base44.entities.Job.filter({ id: { $in: jobIds } }) : [];
        tasksData = woIds.length > 0 ? await base44.entities.Task.filter({ 
          work_order_id: { $in: woIds } 
        }) : [];

        const locationIds = [...new Set(jobsData.map(j => j.location_id).filter(Boolean))];
        const boatIds = [...new Set(jobsData.map(j => j.boat_id).filter(Boolean))];

        [locationsData, boatsData] = await Promise.all([
          locationIds.length > 0 ? base44.entities.Location.filter({ id: { $in: locationIds } }) : Promise.resolve([]),
          boatIds.length > 0 ? base44.entities.Boat.filter({ id: { $in: boatIds } }) : Promise.resolve([])
        ]);

        // Fetch customers
        const customerIds = [...new Set(jobsData.map(j => j.customer_id).filter(Boolean))];
        const customersData = customerIds.length > 0 ? await base44.entities.Customer.filter({ id: { $in: customerIds } }) : [];

        // Update state with fresh data
        setWorkOrders(workOrdersData || []);
        setJobs(jobsData || []);
        setLocations(locationsData || []);
        setBoats(boatsData || []);
        setTasks(tasksData || []);
        setCustomers(customersData || []);

        // For admin users: load ALL work orders for global search
        if (currentUser?.role === 'admin' || currentUser?.role === 'lead_technician') {
          const [allWOs, allJs, allBs, allLs, allCs] = await Promise.all([
            base44.entities.WorkOrder.list('-created_date', 500),
            base44.entities.Job.list('-created_date', 500),
            base44.entities.Boat.list('-created_date', 200),
            base44.entities.Location.list('-created_date', 200),
            base44.entities.Customer.list('-created_date', 200),
          ]);
          setAllSearchWorkOrders(allWOs || []);
          setAllSearchJobs(allJs || []);
          setAllSearchBoats(allBs || []);
          setAllSearchLocations(allLs || []);
          setAllSearchCustomers(allCs || []);
        }

        // Cache in background (non-blocking)
        Promise.all([
          offlineStorage.saveMultiple(offlineStorage.STORES.workOrders, workOrdersData || []),
          offlineStorage.saveMultiple(offlineStorage.STORES.jobs, jobsData || []),
          offlineStorage.saveMultiple(offlineStorage.STORES.locations, locationsData || []),
          offlineStorage.saveMultiple(offlineStorage.STORES.boats, boatsData || []),
          offlineStorage.saveMultiple(offlineStorage.STORES.tasks, tasksData || [])
        ]).catch(e => console.error('Cache save error:', e));
      } catch (error) {
        // Network error - use cache only
        if (!showCachedFirst) {
          workOrdersData = await offlineStorage.getAllData(offlineStorage.STORES.workOrders);
          tasksData = await offlineStorage.getAllData(offlineStorage.STORES.tasks);
          locationsData = await offlineStorage.getAllData(offlineStorage.STORES.locations);
          boatsData = await offlineStorage.getAllData(offlineStorage.STORES.boats);
          jobsData = await offlineStorage.getAllData(offlineStorage.STORES.jobs);
          
          setWorkOrders(workOrdersData || []);
          setLocations(locationsData || []);
          setBoats(boatsData || []);
          setJobs(jobsData || []);
          setTasks(tasksData || []);
        }
      }
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupWorkOrdersBySection = () => {
    const today = startOfDay(new Date());
    const sections = { overdue: [], today: [], upcoming: [], later: [] };

    // Exclude completed and cancelled WOs
    const activeWorkOrders = workOrders.filter(wo =>
      wo.status !== 'Completed' && wo.status !== 'Cancelled'
    );

    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    activeWorkOrders.forEach((wo) => {
      const woDate = wo.scheduled_date ? startOfDay(parseISO(wo.scheduled_date)) : null;
      
      if (!woDate) {
        sections.later.push(wo);
      } else if (woDate < today) {
        sections.overdue.push(wo);
      } else if (woDate.getTime() === today.getTime()) {
        sections.today.push(wo);
      } else if (woDate > today && woDate <= sevenDaysFromNow) {
        sections.upcoming.push(wo);
      } else {
        sections.later.push(wo);
      }
    });

    // Sort each section by date and time
    [sections.overdue, sections.today, sections.upcoming, sections.later].forEach((section) => {
      section.sort((a, b) => {
        const dateA = a.scheduled_date ? parseISO(a.scheduled_date) : new Date();
        const dateB = b.scheduled_date ? parseISO(b.scheduled_date) : new Date();
        if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
        return (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || '');
      });
    });

    return sections;
  };

  const getWorkOrderInfo = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return null;
    return workOrders.find((w) => w.id === task.work_order_id);
  };

  const getLocationName = (locationId) => {
    if (!locationId) return null;
    const loc = locations.find((l) => l.id === locationId);
    return loc?.name || null;
  };

  const getBoatInfo = (jobId) => {
    if (!jobId) return null;
    const job = jobs.find((j) => j.id === jobId);
    if (!job?.boat_id) return null;
    return boats.find((b) => b.id === job.boat_id);
  };

  const getWorkOrderTaskCount = (woId) => {
    return tasks.filter((t) => t.work_order_id === woId).length;
  };

  const sections = groupWorkOrdersBySection();

  // Guard: don't render header until user is available
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50">
        {user && (
          <MobileHeaderWithWelcome
            user={displayUser || user}
            taskCount={0}
            onSettingsClick={() => {}}
            showSettings={false}
            onNavigate={onNavigate}
            workOrders={workOrders}
            jobs={jobs}
            boats={boats}
            locations={locations}
            customers={customers}
            tasks={tasks} />
        )}
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>);
  }

  // Fallback: user has technician role but no linked Technician record
  if (!resolvedTechnicianId && !previewUserId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-800">Kein Techniker-Profil verknüpft</p>
          <p className="text-sm text-slate-500 mt-2 max-w-xs">Diesem Konto ist noch kein Techniker-Profil zugeordnet. Bitte einen Administrator kontaktieren.</p>
        </div>
        <button
          onClick={() => loadData(false)}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  const WorkOrderCard = React.memo(({ workOrder, taskCount, showDateHeader }) => {
    // Memoize expensive date operations
    const { dayName, dateString, timeString } = React.useMemo(() => {
      const woDate = workOrder.scheduled_date ? parseISO(workOrder.scheduled_date) : null;
      return {
        dayName: woDate ? format(woDate, 'EEE').toUpperCase() : '—',
        dateString: woDate ? format(woDate, 'd') : '—',
        timeString: workOrder.scheduled_start_time || '—'
      };
    }, [workOrder.scheduled_date, workOrder.scheduled_start_time]);

    const job = React.useMemo(() => jobs.find((j) => j.id === workOrder.job_id), [workOrder.job_id]);
    const boat = React.useMemo(() => job?.boat_id ? boats.find((b) => b.id === job.boat_id) : null, [job?.boat_id]);
    const location = React.useMemo(() => getLocationName(job?.location_id), [job?.location_id]);
    const statusBadgeColor = workOrder.status === 'Completed' ? 'bg-green-100 text-green-800' :
    workOrder.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
    'bg-slate-100 text-slate-800';

    const cardContent = (
      <>
        {/* Top Meta Row: Date/Time + Status Badge */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">{dayName} {dateString} • {timeString}</span>
          </div>
          <Badge className={`text-xs whitespace-nowrap ${statusBadgeColor}`}>
            {workOrder.status}
          </Badge>
        </div>

        {/* Title Section */}
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-500 font-medium mb-1">#{workOrder.work_order_number || workOrder.id}</p>
          <p className="text-base font-bold text-slate-900 leading-tight">{workOrder.title}</p>
        </div>

        {/* Boat & Location */}
        <div className="px-4 pb-3 space-y-2">
          {boat?.vessel_name &&
            <div className="flex items-center gap-2 text-slate-700">
              <Ship className="h-4 w-4 text-slate-400" />
              <span className="text-sm">{boat.vessel_name}</span>
            </div>
          }
          {location &&
            <div className="flex items-center gap-2 text-slate-700">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-sm">{location}</span>
            </div>
          }
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Bottom Meta Row: Tasks + Notes */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium">{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
          </div>

          {workOrder.internal_notes &&
            <Button variant="outline" size="sm" className="h-7 text-xs">
              📝 Notes
            </Button>
          }
        </div>
      </>
    );

    if (onNavigate) {
      return (
        <div 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNavigate('workOrderDetail', { woId: workOrder.id });
          }}
          className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
        >
          {cardContent}
        </div>
      );
    }

    return (
      <Link 
        to={createPageUrl('TeamWorkOrderDetail') + `?woId=${workOrder.id}`}
        className="block bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
      >
        {cardContent}
      </Link>
    );
  });



  return (
    <div className="min-h-screen bg-slate-50">
      {/* Improved Header with Welcome Message */}
      <MobileHeaderWithWelcome
        user={displayUser || user}
        taskCount={sections.today.length}
        onSettingsClick={() => setShowPreviewMode(!showPreviewMode)}
        showSettings={showPreviewMode}
        onNavigate={onNavigate}
        workOrders={allSearchWorkOrders.length > 0 ? allSearchWorkOrders : workOrders}
        jobs={allSearchJobs.length > 0 ? allSearchJobs : jobs}
        boats={allSearchBoats.length > 0 ? allSearchBoats : boats}
        locations={allSearchLocations.length > 0 ? allSearchLocations : locations}
        customers={allSearchCustomers.length > 0 ? allSearchCustomers : customers}
        tasks={tasks} />


      {/* KPI Mini Cards */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 bg-slate-50">
        <Card className="bg-white shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-slate-900">{sections.today.length}</div>
            <div className="text-xs text-slate-600 mt-1">Today</div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-slate-900">{sections.upcoming.length}</div>
            <div className="text-xs text-slate-600 mt-1">Upcoming</div>
          </CardContent>
        </Card>
        <Card 
          className="bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            if (onNavigate) {
              onNavigate('calendar');
            } else {
              window.location.href = createPageUrl('TeamCalendar');
            }
          }}
        >
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <div className="text-2xl font-bold text-slate-900">
                {(() => {
                  const workOrderIds = workOrders.map(wo => wo.id);
                  return tasks.filter(t => workOrderIds.includes(t.work_order_id) && t.status !== 'Completed').length;
                })()}
              </div>
              <Calendar className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-xs text-slate-600 mt-1">Open Tasks</div>
          </CardContent>
        </Card>
      </div>

      {/* Test Mode Badge */}
      {previewUserId &&
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-500 text-white">🧪 TEST MODE</Badge>
            <span className="text-sm font-medium text-orange-900">{previewTechnicianName}</span>
          </div>
          <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (onPreviewUserChange) {
              onPreviewUserChange(null);
            }
            setPreviewTechnicianName(null);
          }}
          className="h-8 w-8 hover:bg-orange-100">

            <X className="h-4 w-4 text-orange-600" />
          </Button>
        </div>
      }

      {/* Preview Mode */}
      {showPreviewMode && user?.role === 'admin' &&
      <TeamPreviewMode
        onUserSelect={(techId, techName) => {
          if (onPreviewUserChange) {
            onPreviewUserChange(techId);
          }
          setPreviewTechnicianName(techName);
          setShowPreviewMode(false);
        }}
        currentUserId={previewUserId} />

      }



      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Connection Status */}
        {!isOnline &&
          <Card className="bg-orange-50 border-orange-200 shadow-sm">
            <CardContent className="p-3 flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-orange-600 flex-shrink-0" />
              <span className="text-sm font-medium text-orange-900">You're offline. Data is cached.</span>
            </CardContent>
          </Card>
        }

        {/* OVERDUE Section */}
        {sections.overdue.length > 0 &&
          <div>
            <h2 className="text-lg font-bold text-red-700 mb-3">⚠️ Overdue ({sections.overdue.length})</h2>
            <div className="space-y-3">
              {sections.overdue.map((wo) =>
                <WorkOrderCard key={wo.id} workOrder={wo} taskCount={getWorkOrderTaskCount(wo.id)} />
              )}
            </div>
          </div>
        }

        {/* TODAY Section */}
        {sections.today.length > 0 &&
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Today</h2>
            <div className="space-y-3">
              {sections.today.map((wo) =>
                <WorkOrderCard key={wo.id} workOrder={wo} taskCount={getWorkOrderTaskCount(wo.id)} />
              )}
            </div>
          </div>
        }

        {/* UPCOMING Section */}
        {sections.upcoming.length > 0 &&
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Upcoming (Next 7 days)</h2>
            <div className="space-y-4">
              {(() => {
                const grouped = sections.upcoming.slice(0, 3).reduce((acc, wo) => {
                  const woDate = wo.scheduled_date ? format(parseISO(wo.scheduled_date), 'EEE d') : 'No date';
                  if (!acc[woDate]) acc[woDate] = [];
                  acc[woDate].push(wo);
                  return acc;
                }, {});

                return Object.entries(grouped).map(([dateLabel, wos]) => (
                  <div key={dateLabel}>
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">{dateLabel}</h3>
                    <div className="space-y-3">
                      {wos.map((wo) =>
                        <WorkOrderCard key={wo.id} workOrder={wo} taskCount={getWorkOrderTaskCount(wo.id)} showDateHeader={false} />
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        }

        {/* ATTENTION Section - Admin only for assignment/location issues */}
        {user?.role === 'admin' && (() => {
          const jobsWithoutTech = workOrders.filter(wo => 
            (!wo.assigned_technicians || wo.assigned_technicians.length === 0) && 
            wo.status !== 'Completed' && wo.status !== 'Cancelled'
          );
          const jobsWithoutLocation = workOrders.filter(wo => {
            const job = jobs.find(j => j.id === wo.job_id);
            return !job?.location_id && wo.status !== 'Completed' && wo.status !== 'Cancelled';
          });
          if (jobsWithoutTech.length === 0 && jobsWithoutLocation.length === 0) return null;
          return (
            <Card className="bg-amber-50 border-amber-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900 uppercase">Admin: Attention Required</h3>
                </div>
                <div className="space-y-2">
                  {jobsWithoutTech.length > 0 && (
                    <div className="text-sm text-amber-900">⚠️ {jobsWithoutTech.length} {jobsWithoutTech.length === 1 ? 'job' : 'jobs'} without technician</div>
                  )}
                  {jobsWithoutLocation.length > 0 && (
                    <div className="text-sm text-amber-900">⚠️ {jobsWithoutLocation.length} {jobsWithoutLocation.length === 1 ? 'job' : 'jobs'} without location</div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Empty State */}
        {sections.overdue.length === 0 && sections.today.length === 0 && sections.upcoming.length === 0 && sections.later.length === 0 &&
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium mb-1">No open work orders</p>
            <p className="text-slate-500 text-sm">All your work is done or no items assigned</p>
          </div>
        }
      </div>

      {/* Sync Status Component */}
      <SyncStatus />
    </div>);

}