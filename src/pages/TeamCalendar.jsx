import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { offlineStorage } from '@/components/offline/offlineStorage';

export default function TeamCalendar({ onNavigate, previewUserId }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [boats, setBoats] = useState([]);

  useEffect(() => {
    loadData();
  }, [previewUserId]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      let workOrdersData, jobsData, boatsData;

      try {
        // CRITICAL FIX: Map User.id → Technician.id (same as TeamMobileHome)
        const allTechnicians = await base44.entities.Technician.list();
        
        let technicianId;
        if (previewUserId) {
          technicianId = previewUserId;
        } else {
          const matchedTech = allTechnicians.find(t => 
            t.user_id === currentUser?.id || 
            t.email === currentUser?.email
          );
          technicianId = matchedTech?.id;
        }

        console.log('🔍 DEBUG - Calendar Auth Mapping:', {
          userEmail: currentUser?.email,
          userId: currentUser?.id,
          resolvedTechnicianId: technicianId
        });

        if (!technicianId) {
          console.warn('⚠️ No Technician record found for calendar user:', currentUser?.email);
          setWorkOrders([]);
          setJobs([]);
          setBoats([]);
          setLoading(false);
          return;
        }

        // Filter work orders by resolved Technician.id
        [workOrdersData, jobsData, boatsData] = await Promise.all([
          base44.entities.WorkOrder.filter({
            $or: [
              { assigned_technicians: { $in: [technicianId] } },
              { lead_technician_id: technicianId }
            ]
          }),
          base44.entities.Job.list(),
          base44.entities.Boat.list()
        ]);

        console.log('✅ Calendar Work Orders Found:', workOrdersData?.length || 0);

        // Cache for offline
        if (workOrdersData) await offlineStorage.saveMultiple(offlineStorage.STORES.workOrders, workOrdersData);
        if (jobsData) await offlineStorage.saveMultiple(offlineStorage.STORES.jobs, jobsData);
        if (boatsData) await offlineStorage.saveMultiple(offlineStorage.STORES.boats, boatsData);
      } catch (error) {
        // Fall back to offline cache
        workOrdersData = await offlineStorage.getAllData(offlineStorage.STORES.workOrders);
        jobsData = await offlineStorage.getAllData(offlineStorage.STORES.jobs);
        boatsData = await offlineStorage.getAllData(offlineStorage.STORES.boats);
      }

      setWorkOrders(workOrdersData || []);
      setJobs(jobsData || []);
      setBoats(boatsData || []);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWorkOrdersForDay = (day) => {
    return workOrders.filter((wo) => {
      if (!wo.scheduled_date) return false;
      const woDate = parseISO(wo.scheduled_date);
      return isSameDay(woDate, day);
    });
  };

  const getBoatName = (workOrder) => {
    const job = jobs.find(j => j.id === workOrder.job_id);
    if (!job?.boat_id) return null;
    const boat = boats.find(b => b.id === job.boat_id);
    return boat?.vessel_name;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days including leading/trailing days from other months
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="text-center py-12">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 text-white p-4 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
{onNavigate ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate('home')}
              className="h-9 w-9 hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-white/20"
            >
              <Link to={createPageUrl('TeamMobileHome')}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}
          <h1 className="text-xl font-bold">My Calendar</h1>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button
            onClick={goToPreviousMonth}
            variant="ghost"
            size="icon"
            className="h-10 w-10 hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="text-center">
            <p className="text-2xl font-bold">{format(currentDate, 'MMMM yyyy')}</p>
          </div>

          <Button
            onClick={goToNextMonth}
            variant="ghost"
            size="icon"
            className="h-10 w-10 hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-3">
          <Button
            onClick={goToToday}
            variant="ghost"
            size="sm"
            className="w-full hover:bg-white/20 text-white"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Week Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-slate-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayWorkOrders = getWorkOrdersForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const hasWorkOrders = dayWorkOrders.length > 0;

            return (
              <div
                key={day.toString()}
                className={`
                  min-h-[80px] p-2 rounded-lg border
                  ${!isCurrentMonth ? 'bg-slate-100 text-slate-400' : 'bg-white'}
                  ${isToday ? 'ring-2 ring-blue-500' : 'border-slate-200'}
                  ${hasWorkOrders && isCurrentMonth ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
                `}
              >
                <div className="flex flex-col h-full">
                  <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="flex-1 space-y-1">
{dayWorkOrders.map((wo) => (
                      onNavigate ? (
                        <div
                          key={wo.id}
                          onClick={() => onNavigate('workOrderDetail', { woId: wo.id })}
                          className="block cursor-pointer"
                        >
                          <div className="bg-blue-100 border border-blue-300 rounded px-1.5 py-1 text-xs">
                            <p className="font-semibold text-blue-900 truncate">
                              {wo.scheduled_start_time || '—'}
                            </p>
                            <p className="text-blue-700 truncate text-[10px] leading-tight">
                              {getBoatName(wo) || wo.title}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Link
                          key={wo.id}
                          to={createPageUrl('TeamWorkOrderDetail') + `?woId=${wo.id}`}
                          className="block"
                        >
                          <div className="bg-blue-100 border border-blue-300 rounded px-1.5 py-1 text-xs">
                            <p className="font-semibold text-blue-900 truncate">
                              {wo.scheduled_start_time || '—'}
                            </p>
                            <p className="text-blue-700 truncate text-[10px] leading-tight">
                              {getBoatName(wo) || wo.title}
                            </p>
                          </div>
                        </Link>
                      )
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4">
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-semibold text-slate-700 mb-2">Legend</p>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border-2 border-blue-500"></div>
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-blue-100 border border-blue-300"></div>
              <span>Work Order</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}