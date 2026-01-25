import React, { useMemo } from 'react';
import { format, addDays, startOfDay, endOfDay, parseISO, differenceInMinutes } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertTriangle, TrendingUp } from 'lucide-react';

/**
 * Calculate if a work order overlaps with a given date
 * Returns overlap duration in minutes, or 0 if no overlap
 */
function calculateDayOverlap(workOrder, targetDate) {
  if (!workOrder.scheduled_date || !workOrder.scheduled_start_time) return 0;
  
  const woDate = parseISO(workOrder.scheduled_date);
  const woDateStr = format(woDate, 'yyyy-MM-dd');
  const targetDateStr = format(targetDate, 'yyyy-MM-dd');
  
  // Must be same date
  if (woDateStr !== targetDateStr) return 0;
  
  // Calculate duration
  const startTime = parseTime(workOrder.scheduled_start_time);
  const endTime = workOrder.scheduled_end_time 
    ? parseTime(workOrder.scheduled_end_time)
    : startTime + 60; // Default 1 hour
  
  return endTime - startTime;
}

/**
 * Parse HH:MM time string to minutes since midnight
 */
function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Detect if multiple appointments overlap on a given day
 */
function hasConflict(appointments) {
  for (let i = 0; i < appointments.length; i++) {
    for (let j = i + 1; j < appointments.length; j++) {
      const a = appointments[i];
      const b = appointments[j];
      
      if (!a.scheduled_start_time || !b.scheduled_start_time) continue;
      
      const aStart = parseTime(a.scheduled_start_time);
      const aEnd = parseTime(a.scheduled_end_time || '23:59');
      const bStart = parseTime(b.scheduled_start_time);
      const bEnd = parseTime(b.scheduled_end_time || '23:59');
      
      if (aStart < bEnd && bStart < aEnd) return true;
    }
  }
  return false;
}

export default function FutureOverview({
  technicians,
  workOrders,
  jobs,
  customers,
  boats,
  locations,
  startDate,
  rangeWeeks,
  locationFilter,
  statusFilter,
  technicianFilter,
  searchTerm,
  showBlockedOnly,
  focusBlockedDays,
  onDateClick
}) {
  const rangeDays = rangeWeeks * 7;
  
  /**
   * Generate array of dates for the range
   */
  const dateRange = useMemo(() => {
    return Array.from({ length: rangeDays }, (_, i) => addDays(startDate, i));
  }, [startDate, rangeDays]);

  /**
   * Aggregate appointments per mechanic per day
   * Returns: Map<technicianId, Map<dateStr, { appointments, bookedMinutes, hasConflict }>>
   */
  const aggregatedData = useMemo(() => {
    const data = new Map();
    
    technicians.forEach(tech => {
      const techMap = new Map();
      
      dateRange.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Find all work orders for this tech on this date
        const dayAppointments = workOrders.filter(wo => {
          // Check date match
          if (!wo.scheduled_date) return false;
          const woDateStr = format(parseISO(wo.scheduled_date), 'yyyy-MM-dd');
          if (woDateStr !== dateStr) return false;
          
          // Check tech assignment
          if (!wo.assigned_technicians?.includes(tech.id) && wo.lead_technician_id !== tech.id) {
            return false;
          }
          
          // Apply filters
          if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
          
          const job = jobs.find(j => j.id === wo.job_id);
          if (locationFilter !== 'all' && job?.location_id !== locationFilter) return false;
          
          if (searchTerm) {
            const jobInfo = getJobInfo(wo.job_id, jobs, customers, boats, locations);
            const searchLower = searchTerm.toLowerCase();
            if (!wo.title?.toLowerCase().includes(searchLower) &&
                !jobInfo.customer.toLowerCase().includes(searchLower) &&
                !jobInfo.boat.toLowerCase().includes(searchLower)) {
              return false;
            }
          }
          
          return true;
        });
        
        if (dayAppointments.length > 0) {
          const bookedMinutes = dayAppointments.reduce((sum, wo) => {
            return sum + calculateDayOverlap(wo, date);
          }, 0);
          
          techMap.set(dateStr, {
            appointments: dayAppointments,
            bookedMinutes,
            hasConflict: hasConflict(dayAppointments)
          });
        }
      });
      
      data.set(tech.id, techMap);
    });
    
    return data;
  }, [technicians, workOrders, dateRange, locationFilter, statusFilter, searchTerm, jobs, customers, boats, locations]);

  /**
   * Filter dates to show based on "blocked only" toggle
   */
  const visibleDates = useMemo(() => {
    if (!showBlockedOnly) return dateRange;
    
    // Only show dates where at least one selected technician has bookings
    return dateRange.filter(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const selectedTechs = technicianFilter.length > 0 
        ? technicians.filter(t => technicianFilter.includes(t.id))
        : technicians;
      
      return selectedTechs.some(tech => {
        const techData = aggregatedData.get(tech.id);
        return techData && techData.has(dateStr);
      });
    });
  }, [dateRange, showBlockedOnly, technicianFilter, technicians, aggregatedData]);

  /**
   * Filter technicians
   */
  const visibleTechnicians = useMemo(() => {
    if (technicianFilter.length > 0) {
      return technicians.filter(t => technicianFilter.includes(t.id));
    }
    return technicians;
  }, [technicians, technicianFilter]);

  /**
   * Calculate stats for each technician
   */
  const technicianStats = useMemo(() => {
    const stats = new Map();
    
    visibleTechnicians.forEach(tech => {
      const techData = aggregatedData.get(tech.id);
      let blockedDays = 0;
      let totalMinutes = 0;
      
      if (techData) {
        dateRange.forEach(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayData = techData.get(dateStr);
          if (dayData) {
            blockedDays++;
            totalMinutes += dayData.bookedMinutes;
          }
        });
      }
      
      stats.set(tech.id, {
        blockedDays,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        utilizationPercent: Math.round((blockedDays / rangeDays) * 100)
      });
    });
    
    return stats;
  }, [visibleTechnicians, aggregatedData, dateRange, rangeDays]);

  const isToday = (date) => {
    return format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div className="flex">
        {/* Left column - Technician names with stats */}
        <div className="w-64 flex-shrink-0 border-r bg-slate-50 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <div className="h-24 border-b flex items-center px-4 font-medium text-sm text-slate-700 sticky top-0 bg-slate-50 z-10">
            <div>
              <div>Mechanic</div>
              <div className="text-xs text-slate-500 font-normal mt-1">
                {rangeDays} days • {visibleDates.length} shown
              </div>
            </div>
          </div>
          {visibleTechnicians.map(tech => {
            const stats = technicianStats.get(tech.id);
            return (
              <div key={tech.id} className="border-b p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 mt-1">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                      {tech.first_name?.[0]}{tech.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">
                      {tech.first_name} {tech.last_name}
                    </p>
                    {tech.role && (
                      <p className="text-xs text-slate-500 truncate">{tech.role}</p>
                    )}
                    {stats && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">{stats.blockedDays}</span> / {rangeDays} days
                        </div>
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">{stats.totalHours}h</span> booked
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(stats.utilizationPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right area - Date grid */}
        <div className="flex-1 overflow-x-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {/* Date header */}
          <div className="h-24 border-b flex bg-slate-50 sticky top-0 z-10">
            {visibleDates.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const hasBookings = Array.from(aggregatedData.values()).some(techData => 
                techData.has(dateStr)
              );
              
              return (
                <div
                  key={dateStr}
                  className={`flex-shrink-0 w-20 border-l first:border-l-0 px-2 py-2 text-center transition-all ${
                    isToday(date) ? 'bg-blue-50' : ''
                  } ${
                    isWeekend(date) ? 'bg-slate-100' : ''
                  } ${
                    focusBlockedDays && hasBookings ? 'bg-green-50 border-green-200 border-2' : ''
                  } ${
                    focusBlockedDays && !hasBookings ? 'opacity-40' : ''
                  }`}
                >
                  <div className={`text-xs font-medium uppercase ${
                    isToday(date) ? 'text-blue-600' : 'text-slate-500'
                  }`}>
                    {format(date, 'EEE')}
                  </div>
                  <div className={`text-lg font-bold mt-1 ${
                    isToday(date) ? 'text-blue-600' : 'text-slate-900'
                  }`}>
                    {format(date, 'd')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {format(date, 'MMM')}
                  </div>
                  {focusBlockedDays && hasBookings && (
                    <Badge className="text-[8px] px-1 py-0 mt-1 bg-green-600">Booked</Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Technician rows */}
          {visibleTechnicians.map(tech => {
            const techData = aggregatedData.get(tech.id);
            
            return (
              <div key={tech.id} className="border-b flex min-h-[80px]">
                {visibleDates.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayData = techData?.get(dateStr);
                  const isBlocked = !!dayData;
                  const isOverloaded = dayData && (dayData.bookedMinutes > 480 || dayData.hasConflict);
                  
                  return (
                    <button
                      key={dateStr}
                      onClick={() => onDateClick(date, tech.id)}
                      className={`flex-shrink-0 w-20 border-l first:border-l-0 p-2 transition-all hover:bg-slate-50 cursor-pointer group relative ${
                        isWeekend(date) ? 'bg-slate-50' : ''
                      } ${
                        isBlocked ? 'bg-blue-50 hover:bg-blue-100' : ''
                      } ${
                        isOverloaded ? 'bg-red-50 hover:bg-red-100' : ''
                      }`}
                    >
                      {dayData && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              isOverloaded ? 'bg-red-500' : 'bg-blue-500'
                            }`} />
                            {isOverloaded && (
                              <AlertTriangle className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                          <div className="text-xs font-medium text-slate-900">
                            {dayData.appointments.length}
                          </div>
                          <div className="text-[10px] text-slate-600">
                            {Math.round(dayData.bookedMinutes / 60 * 10) / 10}h
                          </div>
                        </div>
                      )}
                      
                      {/* Tooltip */}
                      {dayData && (
                        <div className="absolute hidden group-hover:block top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg z-50">
                          <p className="font-medium mb-2">
                            {format(date, 'EEEE, MMM d, yyyy')}
                          </p>
                          <div className="space-y-1 text-slate-300">
                            <div>{dayData.appointments.length} appointment(s)</div>
                            <div>{Math.round(dayData.bookedMinutes / 60 * 10) / 10} hours booked</div>
                            {dayData.hasConflict && (
                              <div className="text-red-400 font-medium">⚠️ Time conflicts</div>
                            )}
                          </div>
                          {dayData.appointments.slice(0, 3).map((wo, idx) => {
                            const jobInfo = getJobInfo(wo.job_id, jobs, customers, boats, locations);
                            return (
                              <div key={idx} className="mt-2 pt-2 border-t border-slate-700 text-slate-300">
                                <div className="font-medium truncate">{wo.title}</div>
                                <div className="text-[10px]">
                                  {wo.scheduled_start_time} {jobInfo.location && `• ${jobInfo.location}`}
                                </div>
                              </div>
                            );
                          })}
                          {dayData.appointments.length > 3 && (
                            <div className="mt-2 text-slate-400 text-[10px]">
                              +{dayData.appointments.length - 3} more
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-slate-700 text-blue-400 text-[10px]">
                            Click to view day timeline
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to get job info
 */
function getJobInfo(jobId, jobs, customers, boats, locations) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return { customer: '', boat: '', location: '' };
  
  const customer = customers.find(c => c.id === job.customer_id);
  const boat = boats.find(b => b.id === job.boat_id);
  const location = locations.find(l => l.id === job.location_id);
  
  return {
    customer: customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || '',
    boat: boat?.vessel_name || '',
    location: location?.name || ''
  };
}