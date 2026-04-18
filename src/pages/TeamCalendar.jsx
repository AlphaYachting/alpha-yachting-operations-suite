import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft, ChevronRight, ArrowLeft, X, Clock, Anchor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, startOfWeek, endOfWeek, subMonths, addMonths } from 'date-fns';
import { offlineStorage } from '@/components/offline/offlineStorage';

const STATUS_COLORS = {
  'Draft':              'bg-slate-100 border-slate-300 text-slate-700',
  'Scheduled':          'bg-blue-100 border-blue-300 text-blue-800',
  'Dispatched':         'bg-indigo-100 border-indigo-300 text-indigo-800',
  'In Transit':         'bg-yellow-100 border-yellow-300 text-yellow-800',
  'In Progress':        'bg-orange-100 border-orange-300 text-orange-800',
  'Paused':             'bg-amber-100 border-amber-300 text-amber-800',
  'Waiting for Parts':  'bg-purple-100 border-purple-300 text-purple-800',
  'Waiting for Approval':'bg-pink-100 border-pink-300 text-pink-800',
  'Completed':          'bg-green-100 border-green-300 text-green-800',
  'Cancelled':          'bg-red-100 border-red-300 text-red-800',
};

const DEFAULT_COLOR = 'bg-blue-100 border-blue-300 text-blue-800';

function getStatusColor(status) {
  return STATUS_COLORS[status] || DEFAULT_COLOR;
}

// Day detail modal
function DayModal({ day, workOrders, jobs, boats, onClose, onNavigate }) {
  const getBoatName = (wo) => {
    const job = jobs.find(j => j.id === wo.job_id);
    if (!job?.boat_id) return null;
    const boat = boats.find(b => b.id === job.boat_id);
    return boat?.vessel_name;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800">
            {format(day, 'EEEE, d MMMM yyyy')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          {workOrders.map((wo) => {
            const boatName = getBoatName(wo);
            const colorClass = getStatusColor(wo.status);
            const card = (
              <div className={`rounded-xl border p-3 ${colorClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{boatName || wo.title}</p>
                    {boatName && <p className="text-xs opacity-75 truncate mt-0.5">{wo.title}</p>}
                  </div>
                  {wo.scheduled_start_time && (
                    <div className="flex items-center gap-1 shrink-0 text-xs font-medium opacity-80">
                      <Clock className="h-3 w-3" />
                      {wo.scheduled_start_time}
                      {wo.scheduled_end_time && <> – {wo.scheduled_end_time}</>}
                    </div>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-medium opacity-70">{wo.status}</span>
                  {wo.service_area && (
                    <span className="text-[11px] opacity-60">· {wo.service_area}</span>
                  )}
                </div>
              </div>
            );

            return onNavigate ? (
              <div
                key={wo.id}
                onClick={() => { onClose(); onNavigate('workOrderDetail', { woId: wo.id }); }}
                className="cursor-pointer"
              >
                {card}
              </div>
            ) : (
              <Link
                key={wo.id}
                to={createPageUrl('TeamWorkOrderDetail') + `?woId=${wo.id}`}
                onClick={onClose}
              >
                {card}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TeamCalendar({ onNavigate, previewUserId }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [boats, setBoats] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    loadData();
  }, [previewUserId]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      let workOrdersData, jobsData, boatsData;

      try {
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

        if (!technicianId) {
          console.warn('⚠️ No Technician record found for calendar user:', currentUser?.email);
          setWorkOrders([]);
          setJobs([]);
          setBoats([]);
          setLoading(false);
          return;
        }

        // Limit to ±2 months around current date to avoid loading full history
        const rangeStart = format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd');
        const rangeEnd = format(endOfMonth(addMonths(new Date(), 2)), 'yyyy-MM-dd');
        workOrdersData = await base44.entities.WorkOrder.filter({
          $or: [
            { assigned_technicians: { $in: [technicianId] } },
            { lead_technician_id: technicianId }
          ],
          scheduled_date: { $gte: rangeStart, $lte: rangeEnd }
        });

        const jobIds = [...new Set(workOrdersData.map(wo => wo.job_id).filter(Boolean))];
        jobsData = jobIds.length > 0 ? await base44.entities.Job.filter({ id: { $in: jobIds } }) : [];
        const boatIds = [...new Set(jobsData.map(j => j.boat_id).filter(Boolean))];
        boatsData = boatIds.length > 0 ? await base44.entities.Boat.filter({ id: { $in: boatIds } }) : [];

        if (workOrdersData) await offlineStorage.saveMultiple(offlineStorage.STORES.workOrders, workOrdersData);
        if (jobsData) await offlineStorage.saveMultiple(offlineStorage.STORES.jobs, jobsData);
        if (boatsData) await offlineStorage.saveMultiple(offlineStorage.STORES.boats, boatsData);
      } catch (error) {
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
      if (wo.status === 'Cancelled') return false;
      return isSameDay(parseISO(wo.scheduled_date), day);
    });
  };

  const getBoatName = (workOrder) => {
    const job = jobs.find(j => j.id === workOrder.job_id);
    if (!job?.boat_id) return null;
    const boat = boats.find(b => b.id === job.boat_id);
    return boat?.vessel_name;
  };

  const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
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
              variant="outline"
              size="icon"
              onClick={() => onNavigate('home')}
              className="h-9 w-9 bg-transparent border-white hover:bg-white/20 text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-9 w-9 bg-transparent border-white hover:bg-white/20 text-white"
            >
              <Link to={createPageUrl('TeamMobileHome')}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}
          <h1 className="text-xl font-bold">My Calendar</h1>
        </div>

        <div className="flex items-center justify-between">
          <Button onClick={goToPreviousMonth} variant="outline" size="icon"
            className="h-10 w-10 bg-transparent border-white hover:bg-white/20 text-white">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="text-2xl font-bold">{format(currentDate, 'MMMM yyyy')}</p>
          <Button onClick={goToNextMonth} variant="outline" size="icon"
            className="h-10 w-10 bg-transparent border-white hover:bg-white/20 text-white">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-3">
          <Button onClick={goToToday} variant="outline" size="sm"
            className="w-full bg-transparent border-white hover:bg-white/20 text-white">
            Today
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-3">
        {/* Week Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-slate-500 py-1">
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
            const hasWorkOrders = dayWorkOrders.length > 0 && isCurrentMonth;
            const visible = dayWorkOrders.slice(0, 2);
            const overflow = dayWorkOrders.length - 2;

            return (
              <div
                key={day.toString()}
                onClick={() => hasWorkOrders && setSelectedDay(day)}
                className={[
                  'min-h-[80px] p-1.5 rounded-lg border flex flex-col',
                  !isCurrentMonth ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200',
                  isToday ? 'ring-2 ring-blue-500 border-transparent' : '',
                  hasWorkOrders ? 'cursor-pointer hover:shadow-md transition-shadow' : '',
                ].join(' ')}
              >
                {/* Day number */}
                <div className={[
                  'text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  isToday ? 'bg-blue-500 text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-300',
                ].join(' ')}>
                  {format(day, 'd')}
                </div>

                {/* Work order chips */}
                {isCurrentMonth && (
                  <div className="flex-1 space-y-0.5">
                    {visible.map((wo) => {
                      const boatName = getBoatName(wo);
                      const label = boatName || wo.title;
                      const colorClass = getStatusColor(wo.status);
                      return (
                        <div
                          key={wo.id}
                          className={`rounded px-1 py-0.5 border text-[10px] leading-tight truncate font-medium ${colorClass}`}
                          title={label}
                        >
                          {wo.scheduled_start_time && (
                            <span className="opacity-70 mr-0.5">{wo.scheduled_start_time}</span>
                          )}
                          {label}
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <div className="text-[10px] text-blue-600 font-semibold pl-1">
                        +{overflow} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-3 pb-6">
        <div className="bg-white rounded-xl p-3 border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-2">Status Colors</p>
          <div className="grid grid-cols-2 gap-1">
            {['Scheduled', 'In Progress', 'Completed', 'Waiting for Parts'].map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded border ${getStatusColor(s)}`} />
                <span className="text-[11px] text-slate-600">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day Modal */}
      {selectedDay && (
        <DayModal
          day={selectedDay}
          workOrders={getWorkOrdersForDay(selectedDay)}
          jobs={jobs}
          boats={boats}
          onClose={() => setSelectedDay(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}