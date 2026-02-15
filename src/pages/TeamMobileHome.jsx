import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, MapPin, AlertCircle, Settings, X, ChevronRight, CheckCircle2, Users, WifiOff, Wifi, Calendar } from 'lucide-react';
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

      let tasksData, workOrdersData, locationsData, techniciansData, boatsData, jobsData;

      try {
        // CRITICAL FIX: Map User.id → Technician.id
        // Load all technicians first to find the match
        const allTechnicians = await base44.entities.Technician.list();
        
        // Find technician linked to current user
        let technicianId;
        if (previewUserId) {
          // Preview mode: use provided technician ID directly
          technicianId = previewUserId;
        } else {
          // Production mode: find technician by user_id OR email
          const matchedTech = allTechnicians.find(t => 
            t.user_id === currentUser?.id || 
            t.email === currentUser?.email
          );
          technicianId = matchedTech?.id;
        }

        console.log('🔍 DEBUG - Mobile Auth Mapping:', {
          userEmail: currentUser?.email,
          userId: currentUser?.id,
          resolvedTechnicianId: technicianId,
          isPreviewMode: !!previewUserId
        });

        // Store resolved technician ID for grouping function
        setResolvedTechnicianId(technicianId);

        // If no technician found, show empty state (no work orders assigned)
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

        // Filter work orders by resolved Technician.id
        [tasksData, workOrdersData, locationsData, boatsData, jobsData] = await Promise.all([
          base44.entities.Task.list(),
          base44.entities.WorkOrder.filter({
            $or: [
              { assigned_technicians: { $in: [technicianId] } },
              { lead_technician_id: technicianId }
            ]
          }),
          base44.entities.Location.list(),
          base44.entities.Boat.list(),
          base44.entities.Job.list()
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

  const CompactWorkOrderItem = ({ workOrder, woTasks, priority }) => {
    const timeString = workOrder.scheduled_start_time || '—';
    const job = jobs.find((j) => j.id === workOrder.job_id);
    const boat = job?.boat_id ? boats.find((b) => b.id === job.boat_id) : null;
    const location = getLocationName(job?.location_id);
    const taskCount = woTasks?.length || 0;
    const isInProgress = workOrder.status === 'In Progress' || workOrder.actual_start_time;
    
    const itemContent = (
      <div className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors">
        {/* Line 1: Time + Job Title */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-bold text-slate-900">{timeString}</span>
          <span className="text-sm font-semibold text-slate-800 flex-1">{workOrder.title}</span>
        </div>
        
        {/* Line 2: Boat - Marina */}
        <div className="text-sm text-slate-600 mb-1">
          {boat?.vessel_name || 'No boat'} – {location || 'No location'}
        </div>
        
        {/* Line 3: Tasks */}
        <div className="text-xs text-slate-500 mb-2">
          {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
        </div>
        
        {/* Line 4: Action Button */}
        <Button 
          size="sm" 
          className={isInProgress ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onNavigate) {
              onNavigate('workOrderDetail', { woId: workOrder.id });
            }
          }}
        >
          {isInProgress ? 'CONTINUE' : 'START'}
        </Button>
      </div>
    );

    if (onNavigate) {
      return <div className="cursor-pointer">{itemContent}</div>;
    }

    return (
      <Link 
        to={createPageUrl('TeamWorkOrderDetail') + `?woId=${workOrder.id}`}
        className="block"
      >
        {itemContent}
      </Link>
    );
  };

  const UpcomingJobItem = ({ workOrder }) => {
    const woDate = workOrder.scheduled_date ? parseISO(workOrder.scheduled_date) : null;
    const dayName = woDate ? format(woDate, 'EEE d') : '—';
    const timeString = workOrder.scheduled_start_time || '—';
    const job = jobs.find((j) => j.id === workOrder.job_id);
    const location = getLocationName(job?.location_id);
    
    const itemContent = (
      <div className="px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <div className="text-sm text-slate-700">
          <span className="font-semibold">{dayName}</span> – {timeString} – {workOrder.title} – {location || 'No location'}
        </div>
      </div>
    );

    if (onNavigate) {
      return (
        <div 
          onClick={() => onNavigate('workOrderDetail', { woId: workOrder.id })}
          className="cursor-pointer"
        >
          {itemContent}
        </div>
      );
    }

    return (
      <Link 
        to={createPageUrl('TeamWorkOrderDetail') + `?woId=${workOrder.id}`}
        className="block"
      >
        {itemContent}
      </Link>
    );
  };



  return (
    <div className="min-h-screen bg-slate-50">
      {/* Improved Header with Welcome Message */}
      <MobileHeaderWithWelcome
        user={user}
        taskCount={sections.today.length}
        onSettingsClick={() => setShowPreviewMode(!showPreviewMode)}
        showSettings={showPreviewMode} />


      {/* Date, Time & KPI Row */}
      <div className="bg-white border-b border-slate-200 px-4 py-2">
        <div className="text-center space-y-1">
          <div className="text-sm font-medium text-slate-900">
            {format(new Date(), 'EEE, MMM d')} – {format(new Date(), 'HH:mm')}
          </div>
          <div className="text-xs text-slate-600">
            Today: {sections.today.length} | Upcoming: {sections.upcoming.length} | Open Tasks: {tasks.filter(t => t.status !== 'Completed').length}
          </div>
        </div>
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
      <div className="bg-white">
        {/* Connection Status */}
        {!isOnline &&
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-orange-600" />
            <span className="text-xs font-medium text-orange-900">Offline mode</span>
          </div>
        }

        {/* TODAY Section */}
        {sections.today.length > 0 ? (
          <div>
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">TODAY</h2>
            </div>
            
            {/* Priority grouping */}
            {(() => {
              const now = new Date();
              const currentTime = now.getHours() * 60 + now.getMinutes();
              
              const nowJobs = sections.today.filter(wo => {
                if (wo.status === 'Completed') return false;
                if (!wo.scheduled_start_time) return false;
                const [hours, minutes] = wo.scheduled_start_time.split(':').map(Number);
                const woTime = hours * 60 + minutes;
                return woTime <= currentTime;
              });
              
              const laterJobs = sections.today.filter(wo => !nowJobs.includes(wo));
              const nextJob = laterJobs[0];
              const remainingJobs = laterJobs.slice(1);
              
              return (
                <>
                  {nowJobs.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                        <span className="text-xs font-bold text-red-700 uppercase">NOW</span>
                      </div>
                      {nowJobs.map(wo => (
                        <CompactWorkOrderItem key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} priority="now" />
                      ))}
                    </div>
                  )}
                  
                  {nextJob && (
                    <div>
                      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <span className="text-xs font-bold text-blue-700 uppercase">NEXT</span>
                      </div>
                      <CompactWorkOrderItem workOrder={nextJob} woTasks={getWorkOrderTasks(nextJob.id)} priority="next" />
                    </div>
                  )}
                  
                  {remainingJobs.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-600 uppercase">LATER TODAY</span>
                      </div>
                      {remainingJobs.map(wo => (
                        <CompactWorkOrderItem key={wo.id} workOrder={wo} woTasks={getWorkOrderTasks(wo.id)} priority="later" />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-500">No work orders scheduled for today</p>
          </div>
        )}

        {/* NEXT Section */}
        {sections.upcoming.length > 0 && (
          <div className="mt-6">
            <div className="px-4 py-3 bg-slate-50 border-y border-slate-200">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">NEXT</h2>
            </div>
            <div>
              {sections.upcoming.slice(0, 3).map(wo => (
                <UpcomingJobItem key={wo.id} workOrder={wo} />
              ))}
            </div>
          </div>
        )}

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
            <div className="mt-6 border-t-4 border-amber-400">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wide">⚠ ATTENTION</h2>
              </div>
              <div className="bg-amber-50/50">
                {overdueTasks.length > 0 && (
                  <div className="px-4 py-2.5 border-b border-amber-100 text-sm text-amber-900">
                    ⚠ {overdueTasks.length} overdue {overdueTasks.length === 1 ? 'task' : 'tasks'}
                  </div>
                )}
                {jobsWithoutTech.length > 0 && (
                  <div className="px-4 py-2.5 border-b border-amber-100 text-sm text-amber-900">
                    ⚠ {jobsWithoutTech.length} {jobsWithoutTech.length === 1 ? 'job' : 'jobs'} without technician
                  </div>
                )}
                {jobsWithoutLocation.length > 0 && (
                  <div className="px-4 py-2.5 text-sm text-amber-900">
                    ⚠ {jobsWithoutLocation.length} {jobsWithoutLocation.length === 1 ? 'job' : 'jobs'} without location
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Empty State */}
        {sections.today.length === 0 && sections.upcoming.length === 0 && (
          <div className="px-4 py-12 text-center">
            <AlertCircle className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-600 font-medium">No work orders assigned</p>
          </div>
        )}
      </div>

      {/* Sync Status Component */}
      <SyncStatus />
    </div>);

}