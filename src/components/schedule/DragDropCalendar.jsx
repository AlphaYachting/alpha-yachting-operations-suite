import React, { useState, useEffect, useMemo, memo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, parseISO, isSameDay, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, isWithinInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, AlertTriangle, Users, MapPin, Flame, Zap, TrendingUp, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Vibrant color palette for technicians
const TECHNICIAN_COLORS = [
  { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
  { bg: 'bg-green-500', text: 'text-white', border: 'border-green-600' },
  { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-600' },
  { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
  { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-600' },
  { bg: 'bg-cyan-500', text: 'text-white', border: 'border-cyan-600' },
  { bg: 'bg-red-500', text: 'text-white', border: 'border-red-600' },
  { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
  { bg: 'bg-teal-500', text: 'text-white', border: 'border-teal-600' },
  { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' },
];

// Unassigned work order color
const UNASSIGNED_COLOR = { bg: 'bg-slate-300', text: 'text-slate-700', border: 'border-slate-400' };

// Job priority colors and icons
const PRIORITY_CONFIG = {
  Express: { color: 'bg-purple-600', icon: Zap, label: 'Express' },
  Urgent: { color: 'bg-red-600', icon: Flame, label: 'Urgent' },
  High: { color: 'bg-orange-500', icon: TrendingUp, label: 'High' },
  Normal: { color: 'bg-blue-500', icon: Circle, label: 'Normal' },
  Low: { color: 'bg-slate-400', icon: Circle, label: 'Low' }
};

export default function DragDropCalendar({
  currentWeekStart,
  workOrders,
  jobs,
  technicians,
  customers,
  boats,
  locations,
  inventoryReservations,
  onWorkOrderUpdate,
  onWorkOrderEdit,
  onDayClick,
  loading,
  viewType = 'month' // 'week' or 'month'
}) {
  const [conflicts, setConflicts] = useState({});
  const [technicianColorMap, setTechnicianColorMap] = useState({});
  
  // Generate calendar days based on view type
  const calendarDays = viewType === 'month' 
    ? eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentWeekStart), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentWeekStart), { weekStartsOn: 1 })
      })
    : Array.from({ length: 35 }, (_, i) => addDays(currentWeekStart, i));
  
  // Assign colors to technicians based on their assigned color field
  useEffect(() => {
    const colorMap = {};
    technicians.forEach((tech) => {
      const techColor = tech.color || '#3b82f6'; // Default to blue
      // Convert hex color to rgba with opacity
      const hexToRgba = (hex, alpha = 0.2) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      
      colorMap[tech.id] = {
        bg: techColor,
        bgLight: hexToRgba(techColor, 0.2),
        text: '#ffffff',
        border: techColor
      };
    });
    setTechnicianColorMap(colorMap);
  }, [technicians]);

  // Memoize work orders by date for performance - includes multi-day work orders
  const workOrdersByDate = useMemo(() => {
    const byDate = {};
    workOrders.forEach(wo => {
      if (!wo.scheduled_date) return;
      
      const startDate = parseISO(wo.scheduled_date);
      const endDate = wo.scheduled_end_date ? parseISO(wo.scheduled_end_date) : startDate;
      
      // Add work order to each day it spans
      const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
      daysInRange.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        if (!byDate[dateKey]) byDate[dateKey] = [];
        
        // Mark continuation and position info for multi-day rendering
        const isStart = isSameDay(day, startDate);
        const isEnd = isSameDay(day, endDate);
        const totalDays = differenceInDays(endDate, startDate) + 1;
        
        byDate[dateKey].push({
          ...wo,
          _multiDay: totalDays > 1,
          _isStart: isStart,
          _isEnd: isEnd,
          _totalDays: totalDays
        });
      });
    });
    return byDate;
  }, [workOrders]);

  useEffect(() => {
    detectConflicts();
  }, [workOrders, inventoryReservations]);

  const detectConflicts = () => {
    const newConflicts = {};
    
    // Group work orders by date
    const workOrdersByDate = {};
    workOrders.forEach(wo => {
      if (!wo.scheduled_date) return;
      const dateKey = format(parseISO(wo.scheduled_date), 'yyyy-MM-dd');
      if (!workOrdersByDate[dateKey]) workOrdersByDate[dateKey] = [];
      workOrdersByDate[dateKey].push(wo);
    });

    // Check for conflicts on each date
    Object.keys(workOrdersByDate).forEach(dateKey => {
      const dayWorkOrders = workOrdersByDate[dateKey];
      
      // Check technician conflicts
      const technicianWorkloads = {};
      dayWorkOrders.forEach(wo => {
        if (!wo.assigned_technicians) return;
        wo.assigned_technicians.forEach(techId => {
          if (!technicianWorkloads[techId]) technicianWorkloads[techId] = [];
          technicianWorkloads[techId].push(wo);
        });
      });

      // Mark conflicts where technicians have overlapping work orders
      Object.entries(technicianWorkloads).forEach(([techId, wos]) => {
        if (wos.length > 1) {
          // Check for time overlaps
          const overlaps = checkTimeOverlaps(wos);
          overlaps.forEach(woId => {
            if (!newConflicts[woId]) newConflicts[woId] = { technicians: [], vehicles: [] };
            const tech = technicians.find(t => t.id === techId);
            if (tech && !newConflicts[woId].technicians.includes(tech.id)) {
              newConflicts[woId].technicians.push(tech.id);
            }
          });
        }
      });

      // Check vehicle conflicts
      const vehicleBookings = {};
      dayWorkOrders.forEach(wo => {
        if (wo.vehicle_used) {
          if (!vehicleBookings[wo.vehicle_used]) vehicleBookings[wo.vehicle_used] = [];
          vehicleBookings[wo.vehicle_used].push(wo);
        }
      });

      // Also check inventory reservations for vehicles
      if (inventoryReservations) {
        inventoryReservations.forEach(res => {
          if (res.status !== 'Reserved') return;
          const resDate = format(parseISO(res.start_datetime), 'yyyy-MM-dd');
          if (resDate === dateKey && res.work_order_id) {
            const wo = workOrders.find(w => w.id === res.work_order_id);
            if (wo && res.inventory_item_id) {
              if (!vehicleBookings[res.inventory_item_id]) vehicleBookings[res.inventory_item_id] = [];
              vehicleBookings[res.inventory_item_id].push(wo);
            }
          }
        });
      }

      Object.entries(vehicleBookings).forEach(([vehicleId, wos]) => {
        if (wos.length > 1) {
          const overlaps = checkTimeOverlaps(wos);
          overlaps.forEach(woId => {
            if (!newConflicts[woId]) newConflicts[woId] = { technicians: [], vehicles: [] };
            if (!newConflicts[woId].vehicles.includes(vehicleId)) {
              newConflicts[woId].vehicles.push(vehicleId);
            }
          });
        }
      });
    });

    setConflicts(newConflicts);
  };

  const checkTimeOverlaps = (workOrders) => {
    const overlappingIds = [];
    for (let i = 0; i < workOrders.length; i++) {
      for (let j = i + 1; j < workOrders.length; j++) {
        if (timesOverlap(workOrders[i], workOrders[j])) {
          overlappingIds.push(workOrders[i].id, workOrders[j].id);
        }
      }
    }
    return [...new Set(overlappingIds)];
  };

  const timesOverlap = (wo1, wo2) => {
    if (!wo1.scheduled_start_time || !wo2.scheduled_start_time) return true; // Assume conflict if no time
    
    const start1 = parseTime(wo1.scheduled_start_time);
    const end1 = wo1.scheduled_end_time ? parseTime(wo1.scheduled_end_time) : start1 + (wo1.estimated_duration_hours || 4) * 60;
    
    const start2 = parseTime(wo2.scheduled_start_time);
    const end2 = wo2.scheduled_end_time ? parseTime(wo2.scheduled_end_time) : start2 + (wo2.estimated_duration_hours || 4) * 60;
    
    return (start1 < end2 && end1 > start2);
  };

  const parseTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getWorkOrdersForDay = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return workOrdersByDate[dateKey] || [];
  };

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

  const getTechnicianInitials = (techIds) => {
    if (!techIds || techIds.length === 0) return [];
    return techIds.map(id => {
      const tech = technicians.find(t => t.id === id);
      return tech ? { 
        id: tech.id,
        name: `${tech.first_name} ${tech.last_name}`, 
        initials: `${tech.first_name?.[0]}${tech.last_name?.[0]}` 
      } : null;
    }).filter(Boolean);
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const workOrderId = draggableId;
    const workOrder = workOrders.find(wo => wo.id === workOrderId);
    if (!workOrder) return;
    
    const oldStartDate = parseISO(workOrder.scheduled_date);
    const newStartDate = calendarDays[parseInt(destination.droppableId)];
    const daysDiff = differenceInDays(newStartDate, oldStartDate);
    
    // Update both start and end dates if multi-day
    const updates = { scheduled_date: format(newStartDate, 'yyyy-MM-dd') };
    if (workOrder.scheduled_end_date) {
      const oldEndDate = parseISO(workOrder.scheduled_end_date);
      const newEndDate = addDays(oldEndDate, daysDiff);
      updates.scheduled_end_date = format(newEndDate, 'yyyy-MM-dd');
    }
    
    await onWorkOrderUpdate(workOrderId, updates);
  };
  
  const getTechnicianColor = (techIds) => {
    if (!techIds || techIds.length === 0) {
      return {
        bg: '#94a3b8',
        bgLight: 'rgba(148, 163, 184, 0.2)',
        text: '#ffffff',
        border: '#94a3b8'
      };
    }
    // Use lead technician color or first assigned technician
    const leadTechId = techIds[0];
    return technicianColorMap[leadTechId] || {
      bg: '#3b82f6',
      bgLight: 'rgba(59, 130, 246, 0.2)',
      text: '#ffffff',
      border: '#3b82f6'
    };
  };
  
  const getJobPriority = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    return job?.priority || 'Normal';
  };
  
  const handleWorkOrderClick = (e, wo, isDragging) => {
    if (isDragging) return; // Ignore clicks during drag
    e.preventDefault();
    e.stopPropagation();
    if (onWorkOrderEdit) {
      onWorkOrderEdit(wo);
    }
  };

  const getConflictTooltip = (woId) => {
    const conflict = conflicts[woId];
    if (!conflict || (conflict.technicians.length === 0 && conflict.vehicles.length === 0)) return null;

    const parts = [];
    if (conflict.technicians.length > 0) {
      const techNames = conflict.technicians.map(tid => {
        const tech = technicians.find(t => t.id === tid);
        return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
      });
      parts.push(`Technician conflict: ${techNames.join(', ')}`);
    }
    if (conflict.vehicles.length > 0) {
      parts.push(`Vehicle conflict: ${conflict.vehicles.length} vehicle(s)`);
    }
    return parts.join('\n');
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className={`grid gap-2 grid-cols-7`}>
          {calendarDays.map((day, dayIndex) => {
            const dayWorkOrders = getWorkOrdersForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = viewType === 'week' || format(day, 'M') === format(currentWeekStart, 'M');
          
          return (
            <Droppable key={dayIndex} droppableId={dayIndex.toString()}>
              {(provided, snapshot) => (
                <div 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  onClick={() => onDayClick && onDayClick(day)}
                  className={`min-h-[120px] border rounded-lg transition-all ${onDayClick ? 'cursor-pointer' : ''} ${
                    isToday ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'
                  } ${
                    !isCurrentMonth ? 'opacity-40' : ''
                  } ${
                    snapshot.isDraggingOver ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300' : 'border-slate-200'
                  }`}
                >
                  <div className={`p-2 border-b ${isToday ? 'bg-blue-100 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>
                        {format(day, viewType === 'month' ? 'EEE' : 'EEEE')}
                      </span>
                      <span className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-slate-900'}`}>
                        {format(day, 'd')}
                      </span>
                    </div>
                  </div>
                  <div className="p-1 space-y-1 min-h-[80px]">
                    {dayWorkOrders.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-2">
                        {snapshot.isDraggingOver ? 'Drop here' : ''}
                      </p>
                    ) : (
                      dayWorkOrders
                        .sort((a, b) => {
                          // Multi-day tasks first, then by total days (longer first), then by index
                          if (a._multiDay && !b._multiDay) return -1;
                          if (!a._multiDay && b._multiDay) return 1;
                          if (a._multiDay && b._multiDay) {
                            return (b._totalDays || 0) - (a._totalDays || 0);
                          }
                          return 0;
                        })
                        .map((wo, index) => {
                        const jobInfo = getJobInfo(wo.job_id);
                        const techs = getTechnicianInitials(wo.assigned_technicians);
                        const techColor = getTechnicianColor(wo.assigned_technicians);
                        const priority = getJobPriority(wo.job_id);
                        const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Normal;
                        const PriorityIcon = priorityConfig.icon;
                        const hasConflict = conflicts[wo.id] && (
                          conflicts[wo.id].technicians.length > 0 || 
                          conflicts[wo.id].vehicles.length > 0
                        );
                        const conflictTooltip = getConflictTooltip(wo.id);

                        // Multi-day rendering logic
                        const isMultiDay = wo._multiDay;
                        const isStart = wo._isStart;
                        const isEnd = wo._isEnd;
                        const isContinuation = isMultiDay && !isStart;

                        // Only render draggable on start day for multi-day work orders
                        if (isMultiDay && !isStart) {
                          return (
                            <TooltipProvider key={`${wo.id}-${index}`}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                   onClick={(e) => handleWorkOrderClick(e, wo, false)}
                                   className={`relative overflow-hidden text-[10px] cursor-pointer hover:shadow-lg transition-all select-none ${
                                     isEnd ? 'rounded-r-md border-r-4' : 'border-r border-white/30'
                                   } ${
                                     hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''
                                   }`}
                                   style={{
                                     backgroundColor: techColor.bg,
                                     color: techColor.text,
                                     borderRightColor: isEnd ? techColor.border : 'rgba(255, 255, 255, 0.3)',
                                     borderLeftWidth: '0px',
                                     borderTopLeftRadius: '0px',
                                     borderBottomLeftRadius: '0px'
                                   }}
                                  >
                                    {/* Green line at top */}
                                    <div 
                                      className="absolute top-0 left-0 right-0 h-[4px]" 
                                      style={{ backgroundColor: '#00ff00' }}
                                    />
                                    
                                    <div className="p-1.5 pt-2">
                                      {hasConflict && (
                                        <div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5">
                                          <AlertTriangle className="h-2 w-2 text-white" />
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1">
                                        <PriorityIcon className="h-2.5 w-2.5 flex-shrink-0" />
                                        <p className="font-semibold truncate leading-tight flex-1">{wo.title}</p>
                                      </div>
                                      {isEnd && wo.scheduled_end_time && (
                                        <div className="flex items-center gap-0.5 mt-0.5 opacity-90">
                                          <Clock className="h-2 w-2" />
                                          <span>Ends {wo.scheduled_end_time}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className={`bg-slate-900 ${hasConflict ? "border-red-500 border-2" : "border-slate-700"} shadow-xl`}>
                                  <div className="text-sm space-y-2 min-w-[250px]">
                                    <div className="flex items-center gap-2">
                                      <div className={`p-1.5 rounded ${priorityConfig.color}`}>
                                        <PriorityIcon className="h-4 w-4 text-white" />
                                      </div>
                                      <div>
                                        <p className="font-bold text-white text-base">{wo.title}</p>
                                        <p className="text-xs text-slate-400">{priorityConfig.label} Priority</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-amber-300 font-medium">
                                      <AlertTriangle className="h-4 w-4" />
                                      <span>Multi-day work order (Day {Math.abs(differenceInDays(parseISO(wo.scheduled_date), day)) + 1} of {wo._totalDays})</span>
                                    </div>

                                    {(wo.scheduled_start_time || wo.estimated_duration_hours) && (
                                      <div className="flex items-center gap-2 text-white">
                                        <Clock className="h-4 w-4" />
                                        {wo.scheduled_start_time ? (
                                          <>
                                            <span>{wo.scheduled_start_time}{wo.scheduled_end_time && ` - ${wo.scheduled_end_time}`}</span>
                                            {wo.estimated_duration_hours && (
                                              <span className="text-slate-300">({wo.estimated_duration_hours}h)</span>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-slate-300">{wo.estimated_duration_hours}h estimated</span>
                                        )}
                                      </div>
                                    )}

                                    {jobInfo.boat && (
                                      <div className="flex items-center gap-2 text-white">
                                        <span>🚤</span>
                                        <span>{jobInfo.boat}</span>
                                      </div>
                                    )}

                                    {jobInfo.location && (
                                      <div className="flex items-center gap-2 text-white">
                                        <MapPin className="h-4 w-4" />
                                        <span>{jobInfo.location}</span>
                                      </div>
                                    )}

                                    {techs.length > 0 ? (
                                      <div className="flex items-center gap-2 text-white">
                                        <Users className="h-4 w-4" />
                                        <span>{techs.map(t => t.name).join(', ')}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-amber-300 font-medium">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span>No technicians assigned</span>
                                      </div>
                                    )}

                                    {hasConflict && conflictTooltip && (
                                      <div className="mt-2 pt-2 border-t border-red-400">
                                        <div className="flex items-start gap-2 text-red-300 font-medium">
                                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                          <span className="whitespace-pre-line">{conflictTooltip}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }

                        return (
                          <Draggable key={wo.id} draggableId={wo.id} index={index}>
                            {(provided, dragSnapshot) => (
                              <TooltipProvider key={wo.id}>
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                       onClick={(e) => handleWorkOrderClick(e, wo, dragSnapshot.isDragging)}
                                       className={`relative overflow-hidden border-l-4 text-[10px] hover:shadow-lg transition-all ${
                                         dragSnapshot.isDragging ? 'cursor-grabbing' : 'cursor-pointer'
                                       } ${
                                         dragSnapshot.isDragging ? 'opacity-60 shadow-xl scale-110 rotate-3 cursor-grabbing' : 'hover:scale-105'
                                       } ${
                                         hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''
                                       } ${
                                         isMultiDay && !isEnd ? 'rounded-l-md border-r border-white/30' : 'rounded-md'
                                       } select-none`}
                                       style={isMultiDay && !isEnd ? {
                                         backgroundColor: techColor.bg,
                                         color: techColor.text,
                                         borderLeftColor: techColor.border,
                                         borderRightColor: 'rgba(255, 255, 255, 0.3)',
                                         borderTopRightRadius: '0px',
                                         borderBottomRightRadius: '0px'
                                       } : {
                                         backgroundColor: techColor.bg,
                                         color: techColor.text,
                                         borderLeftColor: techColor.border
                                       }}
                                      >
                                        {/* Green line at top for multi-day tasks */}
                                        {isMultiDay && (
                                          <div 
                                            className="absolute top-0 left-0 right-0 h-[4px]" 
                                            style={{ backgroundColor: '#00ff00' }}
                                          />
                                        )}
                                        
                                        <div className={isMultiDay ? "p-1.5 pt-2" : "p-1.5"}>
                                          {hasConflict && (
                                            <div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5">
                                              <AlertTriangle className="h-2 w-2 text-white" />
                                            </div>
                                          )}
                                          <div className="flex items-center gap-1">
                                            <div 
                                              {...provided.dragHandleProps}
                                              className="cursor-move p-0.5 hover:bg-white/20 rounded"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <PriorityIcon className="h-2.5 w-2.5 flex-shrink-0" />
                                            </div>
                                            <p className="font-semibold truncate leading-tight flex-1">{wo.title}</p>
                                          </div>
                                          {wo.scheduled_start_time && (
                                            <div className="flex items-center gap-0.5 mt-0.5 opacity-90">
                                              <Clock className="h-2 w-2" />
                                              <span>{wo.scheduled_start_time}</span>
                                            </div>
                                          )}
                                          {jobInfo.boat && (
                                            <p className="truncate mt-0.5 opacity-80 leading-tight">{jobInfo.boat}</p>
                                          )}
                                          {isMultiDay && (
                                            <div className="mt-0.5 text-[9px] font-medium opacity-90">
                                              {wo._totalDays} days →
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className={`bg-slate-900 ${hasConflict ? "border-red-500 border-2" : "border-slate-700"} shadow-xl`}>
                                      <div className="text-sm space-y-2 min-w-[250px]">
                                        <div className="flex items-center gap-2">
                                          <div className={`p-1.5 rounded ${priorityConfig.color}`}>
                                            <PriorityIcon className="h-4 w-4 text-white" />
                                          </div>
                                          <div>
                                            <p className="font-bold text-white text-base">{wo.title}</p>
                                            <p className="text-xs text-slate-400">{priorityConfig.label} Priority</p>
                                          </div>
                                        </div>

                                        {isMultiDay && (
                                          <div className="flex items-center gap-2 text-amber-300 font-medium">
                                            <AlertTriangle className="h-4 w-4" />
                                            <span>Multi-day work order ({wo._totalDays} days)</span>
                                          </div>
                                        )}

                                        {(wo.scheduled_start_time || wo.estimated_duration_hours) && (
                                          <div className="flex items-center gap-2 text-white">
                                            <Clock className="h-4 w-4" />
                                            {wo.scheduled_start_time ? (
                                              <>
                                                <span>{wo.scheduled_start_time}{wo.scheduled_end_time && ` - ${wo.scheduled_end_time}`}</span>
                                                {wo.estimated_duration_hours && (
                                                  <span className="text-slate-300">({wo.estimated_duration_hours}h)</span>
                                                )}
                                              </>
                                            ) : (
                                              <span className="text-slate-300">{wo.estimated_duration_hours}h estimated</span>
                                            )}
                                          </div>
                                        )}

                                        {jobInfo.boat && (
                                          <div className="flex items-center gap-2 text-white">
                                            <span>🚤</span>
                                            <span>{jobInfo.boat}</span>
                                          </div>
                                        )}

                                        {jobInfo.location && (
                                          <div className="flex items-center gap-2 text-white">
                                            <MapPin className="h-4 w-4" />
                                            <span>{jobInfo.location}</span>
                                          </div>
                                        )}

                                        {techs.length > 0 ? (
                                          <div className="flex items-center gap-2 text-white">
                                            <Users className="h-4 w-4" />
                                            <span>{techs.map(t => t.name).join(', ')}</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 text-amber-300 font-medium">
                                            <AlertTriangle className="h-4 w-4" />
                                            <span>No technicians assigned</span>
                                          </div>
                                        )}

                                        {hasConflict && conflictTooltip && (
                                          <div className="mt-2 pt-2 border-t border-red-400">
                                            <div className="flex items-start gap-2 text-red-300 font-medium">
                                              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                              <span className="whitespace-pre-line">{conflictTooltip}</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </TooltipProvider>
                            )}
                          </Draggable>
                        );
                      })
                    )}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}