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
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showPreviewMode, setShowPreviewMode] = useState(false);
  const [previewTechnicianName, setPreviewTechnicianName] = useState(null);
  const [resolvedTechnicianId, setResolvedTechnicianId] = useState(null);

  useEffect(() => {
    // Monitor connection status
    const unsubscribe = connectionMonitor.subscribe((status) => {
      setIsOnline(status.isOnline);
      if (status.isOnline) {
        // Auto sync when connection restored
        syncPendingChanges();
      }
    });

    loadData();
    return unsubscribe;
  }, [previewUserId]);

  const syncPendingChanges = async () => {
    await syncQueue.processQueue();
    await syncQueue.clearCompletedItems();
  };

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      let tasksData, workOrdersData, locationsData, boatsData, jobsData;

      try {
        // Optimize: Find technician without loading full list
        let technicianId;
        if (previewUserId) {
          technicianId = previewUserId;
        } else {
          // Fetch only matching technician by email filter
          const matchedTechs = await base44.entities.Technician.filter({
            $or: [
              { user_id: currentUser?.id },
              { email: currentUser?.email }
            ]
          });
          technicianId = matchedTechs?.[0]?.id;
        }

        setResolvedTechnicianId(technicianId);

        if (!technicianId) {
          console.warn('⚠️ No Technician record found for user:', currentUser?.email);
          setWorkOrders([]);
          setLocations([]);
          setBoats([]);
          setJobs([]);
          setTasks([]);
          setLoading(false);
          return;
        }

        // Fetch work orders first to know what we need
        workOrdersData = await base44.entities.WorkOrder.filter({
          $or: [
            { assigned_technicians: { $in: [technicianId] } },
            { lead_technician_id: technicianId }
          ]
        });

        // Extract unique IDs from work orders to fetch only needed data
        const jobIds = [...new Set(workOrdersData.map(wo => wo.job_id).filter(Boolean))];
        const woIds = workOrdersData.map(wo => wo.id);

        // Fetch only related data in parallel
        [tasksData, jobsData] = await Promise.all([
          base44.entities.Task.filter({ work_order_id: { $in: woIds } }),
          jobIds.length > 0 ? base44.entities.Job.filter({ id: { $in: jobIds } }) : Promise.resolve([])
        ]);

        // Extract location and boat IDs from jobs
        const locationIds = [...new Set(jobsData.map(j => j.location_id).filter(Boolean))];
        const boatIds = [...new Set(jobsData.map(j => j.boat_id).filter(Boolean))];

        // Fetch only needed locations and boats
        [locationsData, boatsData] = await Promise.all([
          locationIds.length > 0 ? base44.entities.Location.filter({ id: { $in: locationIds } }) : Promise.resolve([]),
          boatIds.length > 0 ? base44.entities.Boat.filter({ id: { $in: boatIds } }) : Promise.resolve([])
        ]);

        console.log('✅ Work Orders Found:', workOrdersData?.length || 0);

        // Cache all data for offline access
        if (workOrdersData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.workOrders, workOrdersData);
        }
        if (tasksData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.tasks, tasksData);
        }
        if (locationsData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.locations, locationsData);
        }
        if (boatsData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.boats, boatsData);
        }
        if (jobsData) {
          await offlineStorage.saveMultiple(offlineStorage.STORES.jobs, jobsData);
        }
      } catch (error) {
        // Fall back to offline cache
        workOrdersData = await offlineStorage.getAllData(offlineStorage.STORES.workOrders);
        tasksData = await offlineStorage.getAllData(offlineStorage.STORES.tasks);
        locationsData = await offlineStorage.getAllData(offlineStorage.STORES.locations);
        boatsData = await offlineStorage.getAllData(offlineStorage.STORES.boats);
        jobsData = await offlineStorage.getAllData(offlineStorage.STORES.jobs);
      }

      setWorkOrders(workOrdersData || []);
      setLocations(locationsData || []);
      setBoats(boatsData || []);
      setJobs(jobsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupWorkOrdersBySection = () => {
    const today = startOfDay(new Date());
    const sections = { today: [], upcoming: [], later: [] };

    // CRITICAL FIX: Work orders already filtered by technicianId in loadData
    // No need to re-filter - just use all loaded work orders
    const userWorkOrders = workOrders;

    console.log('📊 DEBUG - Grouping:', {
      totalWorkOrders: workOrders.length,
      resolvedTechnicianId,
      todayDate: today.toISOString()
    });

    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    userWorkOrders.forEach((wo) => {
      const woDate = wo.scheduled_date ? startOfDay(parseISO(wo.scheduled_date)) : null;
      
      if (!woDate) {
        sections.later.push(wo);
      } else if (woDate.getTime() === today.getTime()) {
        sections.today.push(wo);
      } else if (woDate > today && woDate <= sevenDaysFromNow) {
        sections.upcoming.push(wo);
      } else {
        sections.later.push(wo);
      }
    });

    console.log('✅ Sections:', {
      today: sections.today.length,
      upcoming: sections.upcoming.length,
      later: sections.later.length
    });

    // Sort each section by date and time
    [sections.today, sections.upcoming, sections.later].forEach((section) => {
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

  const getWorkOrderTasks = (woId) => {
    return tasks.filter((t) => t.work_order_id === woId);
  };

  const sections = groupWorkOrdersBySection();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MobileHeaderWithWelcome
          user={user}
          taskCount={0}
          onSettingsClick={() => {}}
          showSettings={false} />

        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>);

  }

  const WorkOrderCard = React.memo(({ workOrder, woTasks, showDateHeader }) => {
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
    const taskCount = woTasks?.length || 0;
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
        user={user}
        taskCount={sections.today.length}
        onSettingsClick={() => setShowPreviewMode(!showPreviewMode)}
        showSettings={showPreviewMode} />


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

        {/* TODAY Section */}
        {sections.today.length > 0 &&
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Today</h2>
            <div className="space-y-3">
              {sections.today.map((wo) =>
                <WorkOrderCard key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} />
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
                        <WorkOrderCard key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} showDateHeader={false} />
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        }

        {/* ATTENTION Section */}
        {(() => {
          const overdueTasks = tasks.filter(t => {
            const wo = workOrders.find(w => w.id === t.work_order_id);
            if (!wo?.scheduled_date) return false;
            const woDate = parseISO(wo.scheduled_date);
            return woDate < startOfDay(new Date()) && t.status !== 'Completed';
          });
          
          const jobsWithoutTech = workOrders.filter(wo => 
            (!wo.assigned_technicians || wo.assigned_technicians.length === 0) && 
            wo.status !== 'Completed' && 
            wo.status !== 'Cancelled'
          );
          
          const jobsWithoutLocation = workOrders.filter(wo => {
            const job = jobs.find(j => j.id === wo.job_id);
            return !job?.location_id && wo.status !== 'Completed' && wo.status !== 'Cancelled';
          });
          
          const hasAlerts = overdueTasks.length > 0 || jobsWithoutTech.length > 0 || jobsWithoutLocation.length > 0;
          
          if (!hasAlerts) return null;
          
          return (
            <Card className="bg-amber-50 border-amber-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900 uppercase">Attention Required</h3>
                </div>
                <div className="space-y-2">
                  {overdueTasks.length > 0 && (
                    <div className="text-sm text-amber-900">
                      ⚠️ {overdueTasks.length} overdue {overdueTasks.length === 1 ? 'task' : 'tasks'}
                    </div>
                  )}
                  {jobsWithoutTech.length > 0 && (
                    <div className="text-sm text-amber-900">
                      ⚠️ {jobsWithoutTech.length} {jobsWithoutTech.length === 1 ? 'job' : 'jobs'} without technician
                    </div>
                  )}
                  {jobsWithoutLocation.length > 0 && (
                    <div className="text-sm text-amber-900">
                      ⚠️ {jobsWithoutLocation.length} {jobsWithoutLocation.length === 1 ? 'job' : 'jobs'} without location
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Empty State */}
        {sections.today.length === 0 && sections.upcoming.length === 0 &&
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium mb-1">No scheduled work orders</p>
            <p className="text-slate-500 text-sm">You have no items assigned in the next 7 days</p>
          </div>
        }
      </div>

      {/* Sync Status Component */}
      <SyncStatus />
    </div>);

}