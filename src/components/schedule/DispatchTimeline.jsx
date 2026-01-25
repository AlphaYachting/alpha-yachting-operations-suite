import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, MapPin, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700',
  Scheduled: 'bg-blue-100 text-blue-700',
  Dispatched: 'bg-violet-100 text-violet-700',
  'In Transit': 'bg-indigo-100 text-indigo-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-slate-100 text-slate-700'
};

/**
 * Detect overlapping appointments for conflict visualization
 */
function detectConflicts(appointments) {
  const conflicts = new Set();
  
  for (let i = 0; i < appointments.length; i++) {
    for (let j = i + 1; j < appointments.length; j++) {
      const a = appointments[i];
      const b = appointments[j];
      
      if (!a.scheduled_start_time || !b.scheduled_start_time) continue;
      
      const aStart = parseTime(a.scheduled_start_time);
      const aEnd = parseTime(a.scheduled_end_time || '23:59');
      const bStart = parseTime(b.scheduled_start_time);
      const bEnd = parseTime(b.scheduled_end_time || '23:59');
      
      // Check for overlap
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  
  return conflicts;
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
 * Calculate position and width for appointment block on timeline
 */
function calculateBlockPosition(startTime, endTime, startHour, endHour, gridSize) {
  const start = parseTime(startTime);
  const end = parseTime(endTime || startTime) || start + 60; // Default 1 hour if no end
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;
  const totalMinutes = dayEnd - dayStart;
  
  const left = ((start - dayStart) / totalMinutes) * 100;
  const width = ((end - start) / totalMinutes) * 100;
  
  return {
    left: Math.max(0, left),
    width: Math.max(2, Math.min(width, 100 - left))
  };
}

export default function DispatchTimeline({
  technicians,
  workOrders,
  jobs,
  customers,
  boats,
  locations,
  selectedDate,
  viewMode,
  gridSize,
  locationFilter,
  statusFilter,
  technicianFilter,
  searchTerm,
  onWorkOrderClick
}) {
  const startHour = 6;
  const endHour = 18;
  const hoursRange = endHour - startHour;
  
  // Generate time slots based on grid size
  const timeSlots = useMemo(() => {
    const slots = [];
    const step = gridSize === '30m' ? 0.5 : gridSize === '2h' ? 2 : 1;
    for (let h = startHour; h < endHour; h += step) {
      slots.push(h);
    }
    return slots;
  }, [gridSize]);

  const getJobInfo = (jobId) => {
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
  };

  /**
   * Map work orders to technicians and filter by date/filters
   */
  const technicianRows = useMemo(() => {
    const rows = technicians.map(tech => {
      // Get work orders assigned to this technician
      const techWorkOrders = workOrders.filter(wo => {
        // Check if scheduled for selected date
        if (!wo.scheduled_date) return false;
        const woDate = parseISO(wo.scheduled_date);
        if (format(woDate, 'yyyy-MM-dd') !== format(selectedDate, 'yyyy-MM-dd')) return false;
        
        // Check if assigned to this technician
        if (!wo.assigned_technicians?.includes(tech.id) && wo.lead_technician_id !== tech.id) return false;
        
        // Apply filters
        if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
        
        const job = jobs.find(j => j.id === wo.job_id);
        if (locationFilter !== 'all' && job?.location_id !== locationFilter) return false;
        
        if (searchTerm) {
          const jobInfo = getJobInfo(wo.job_id);
          const searchLower = searchTerm.toLowerCase();
          if (!wo.title?.toLowerCase().includes(searchLower) &&
              !jobInfo.customer.toLowerCase().includes(searchLower) &&
              !jobInfo.boat.toLowerCase().includes(searchLower)) {
            return false;
          }
        }
        
        return true;
      });

      // Detect conflicts
      const conflicts = detectConflicts(techWorkOrders);

      return {
        technician: tech,
        workOrders: techWorkOrders.map(wo => ({
          ...wo,
          hasConflict: conflicts.has(wo.id)
        }))
      };
    });

    // Filter by selected technicians
    if (technicianFilter.length > 0) {
      return rows.filter(row => technicianFilter.includes(row.technician.id));
    }

    return rows;
  }, [technicians, workOrders, selectedDate, locationFilter, statusFilter, technicianFilter, searchTerm, jobs, customers, boats, locations]);

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div className="flex">
        {/* Left column - Technician names */}
        <div className="w-48 flex-shrink-0 border-r bg-slate-50">
          <div className="h-12 border-b flex items-center px-4 font-medium text-sm text-slate-700">
            Mechanic
          </div>
          {technicianRows.map(({ technician }) => (
            <div key={technician.id} className="h-20 border-b flex items-center px-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                    {technician.first_name?.[0]}{technician.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm text-slate-900">
                    {technician.first_name} {technician.last_name}
                  </p>
                  {technician.role && (
                    <p className="text-xs text-slate-500">{technician.role}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right area - Timeline */}
        <div className="flex-1 overflow-x-auto">
          {/* Time header */}
          <div className="h-12 border-b flex bg-slate-50">
            {timeSlots.map((hour) => (
              <div
                key={hour}
                className="flex-1 border-l first:border-l-0 px-2 flex items-center justify-center text-xs font-medium text-slate-600"
                style={{ minWidth: `${100 / timeSlots.length}%` }}
              >
                {Math.floor(hour)}:{hour % 1 === 0.5 ? '30' : '00'}
              </div>
            ))}
          </div>

          {/* Technician rows */}
          {technicianRows.map(({ technician, workOrders: techWorkOrders }) => (
            <div key={technician.id} className="h-20 border-b relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex">
                {timeSlots.map((hour, idx) => (
                  <div
                    key={hour}
                    className="flex-1 border-l first:border-l-0"
                    style={{ minWidth: `${100 / timeSlots.length}%` }}
                  />
                ))}
              </div>

              {/* Work order blocks */}
              <div className="absolute inset-0 px-1 py-2">
                {techWorkOrders.map((wo) => {
                  const position = calculateBlockPosition(
                    wo.scheduled_start_time,
                    wo.scheduled_end_time,
                    startHour,
                    endHour,
                    gridSize
                  );
                  const jobInfo = getJobInfo(wo.job_id);

                  return (
                    <Link
                      key={wo.id}
                      to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                      className="group absolute top-2 bottom-2 rounded-md shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
                      style={{
                        left: `${position.left}%`,
                        width: `${position.width}%`,
                        zIndex: wo.hasConflict ? 20 : 10
                      }}
                    >
                      <div className={`h-full px-2 py-1 border-l-4 ${
                        wo.hasConflict 
                          ? 'bg-red-50 border-red-500' 
                          : statusColors[wo.status] + ' border-transparent'
                      }`}>
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate text-slate-900">
                              {wo.title}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3 text-slate-500" />
                              <span className="text-[10px] text-slate-600">
                                {wo.scheduled_start_time}
                                {wo.scheduled_end_time && ` - ${wo.scheduled_end_time}`}
                              </span>
                            </div>
                            {jobInfo.location && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 text-slate-500" />
                                <span className="text-[10px] text-slate-600 truncate">
                                  {jobInfo.location}
                                </span>
                              </div>
                            )}
                          </div>
                          {wo.hasConflict && (
                            <AlertTriangle className="h-3 w-3 text-red-600 flex-shrink-0" />
                          )}
                        </div>

                        {/* Tooltip on hover */}
                        <div className="absolute hidden group-hover:block bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg z-50">
                          <p className="font-medium mb-1">{wo.title}</p>
                          <p className="text-slate-300">
                            {wo.scheduled_start_time} - {wo.scheduled_end_time || 'No end time'}
                          </p>
                          <p className="text-slate-300 mt-1">{jobInfo.boat}</p>
                          {jobInfo.location && (
                            <p className="text-slate-300">{jobInfo.location}</p>
                          )}
                          <Badge className={statusColors[wo.status] + ' mt-2'}>
                            {wo.status}
                          </Badge>
                          {wo.hasConflict && (
                            <p className="text-red-400 mt-2 font-medium">
                              ⚠️ Time conflict detected
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}