import React, { useState, useEffect, useMemo, memo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, parseISO, isSameDay, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, AlertTriangle, Users, MapPin } from 'lucide-react';
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
    : Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  
  // Assign colors to technicians
  useEffect(() => {
    const colorMap = {};
    technicians.forEach((tech, index) => {
      colorMap[tech.id] = TECHNICIAN_COLORS[index % TECHNICIAN_COLORS.length];
    });
    setTechnicianColorMap(colorMap);
  }, [technicians]);

  // Memoize work orders by date for performance
  const workOrdersByDate = useMemo(() => {
    const byDate = {};
    workOrders.forEach(wo => {
      if (!wo.scheduled_date) return;
      const dateKey = format(parseISO(wo.scheduled_date), 'yyyy-MM-dd');
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(wo);
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
    const newDate = format(calendarDays[parseInt(destination.droppableId)], 'yyyy-MM-dd');
    
    await onWorkOrderUpdate(workOrderId, { scheduled_date: newDate });
  };
  
  const getTechnicianColor = (techIds) => {
    if (!techIds || techIds.length === 0) return UNASSIGNED_COLOR;
    // Use lead technician color or first assigned technician
    const leadTechId = techIds[0];
    return technicianColorMap[leadTechId] || TECHNICIAN_COLORS[0];
  };
  
  const handleWorkOrderClick = (e, wo) => {
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
      <div className={`grid gap-2 ${viewType === 'month' ? 'grid-cols-7' : 'grid-cols-1 md:grid-cols-7'}`}>
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
                  className={`min-h-[120px] border rounded-lg transition-all ${
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
                      dayWorkOrders.map((wo, index) => {
                        const jobInfo = getJobInfo(wo.job_id);
                        const techs = getTechnicianInitials(wo.assigned_technicians);
                        const techColor = getTechnicianColor(wo.assigned_technicians);
                        const hasConflict = conflicts[wo.id] && (
                          conflicts[wo.id].technicians.length > 0 || 
                          conflicts[wo.id].vehicles.length > 0
                        );
                        const conflictTooltip = getConflictTooltip(wo.id);
                        
                        return (
                          <Draggable key={wo.id} draggableId={wo.id} index={index}>
                            {(provided, dragSnapshot) => (
                              <TooltipProvider key={wo.id}>
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={(e) => !dragSnapshot.isDragging && handleWorkOrderClick(e, wo)}
                                        className={`p-1.5 rounded-md border-l-4 text-[10px] cursor-move hover:shadow-lg transition-all ${
                                          techColor.bg
                                        } ${techColor.text} ${techColor.border} ${
                                          dragSnapshot.isDragging ? 'opacity-60 shadow-xl scale-110 rotate-3 cursor-grabbing' : 'hover:scale-105'
                                        } ${
                                          hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''
                                        } relative select-none`}
                                      >
                                        {hasConflict && (
                                          <div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5">
                                            <AlertTriangle className="h-2 w-2 text-white" />
                                          </div>
                                        )}
                                        <p className="font-semibold truncate leading-tight">{wo.title}</p>
                                        {wo.scheduled_start_time && (
                                          <div className="flex items-center gap-0.5 mt-0.5 opacity-90">
                                            <Clock className="h-2 w-2" />
                                            <span>{wo.scheduled_start_time}</span>
                                          </div>
                                        )}
                                        {jobInfo.boat && (
                                          <p className="truncate mt-0.5 opacity-80 leading-tight">{jobInfo.boat}</p>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className={`${hasConflict ? "bg-red-50 border-red-300" : "bg-slate-900 border-slate-700"} shadow-xl`}>
                                      <div className="text-sm space-y-2 min-w-[250px]">
                                        <p className="font-bold text-white text-base">{wo.title}</p>
                                        
                                        {wo.scheduled_start_time && (
                                          <div className="flex items-center gap-2 text-white">
                                            <Clock className="h-4 w-4" />
                                            <span>{wo.scheduled_start_time}{wo.scheduled_end_time && ` - ${wo.scheduled_end_time}`}</span>
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