import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, parseISO, isSameDay, addDays, startOfWeek } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Clock, AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  Dispatched: 'bg-violet-100 text-violet-700 border-violet-200',
  'In Transit': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200',
  Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-700 border-slate-200'
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
  loading
}) {
  const [conflicts, setConflicts] = useState({});
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

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
    return workOrders.filter(wo => {
      if (!wo.scheduled_date) return false;
      return isSameDay(parseISO(wo.scheduled_date), date);
    });
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
    const newDate = format(weekDays[parseInt(destination.droppableId)], 'yyyy-MM-dd');
    
    await onWorkOrderUpdate(workOrderId, { scheduled_date: newDate });
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
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day, dayIndex) => {
          const dayWorkOrders = getWorkOrdersForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Droppable key={dayIndex} droppableId={dayIndex.toString()}>
              {(provided, snapshot) => (
                <Card 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[300px] transition-colors ${
                    isToday ? 'ring-2 ring-blue-500' : ''
                  } ${
                    snapshot.isDraggingOver ? 'bg-blue-50 border-blue-300' : ''
                  }`}
                >
                  <CardHeader className={`py-3 px-4 ${isToday ? 'bg-blue-50' : 'bg-slate-50'}`}>
                    <div className="text-center">
                      <p className="text-xs font-medium text-slate-500 uppercase">
                        {format(day, 'EEE')}
                      </p>
                      <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>
                        {format(day, 'd')}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2 space-y-2">
                    {dayWorkOrders.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        {snapshot.isDraggingOver ? 'Drop here' : 'No work orders'}
                      </p>
                    ) : (
                      dayWorkOrders.map((wo, index) => {
                        const jobInfo = getJobInfo(wo.job_id);
                        const techs = getTechnicianInitials(wo.assigned_technicians);
                        const hasConflict = conflicts[wo.id] && (
                          conflicts[wo.id].technicians.length > 0 || 
                          conflicts[wo.id].vehicles.length > 0
                        );
                        const conflictTooltip = getConflictTooltip(wo.id);
                        
                        return (
                          <Draggable key={wo.id} draggableId={wo.id} index={index}>
                            {(provided, snapshot) => (
                              <TooltipProvider>
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`${
                                    snapshot.isDragging ? 'opacity-50 rotate-2' : ''
                                  }`}
                                >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link
                                        to={createPageUrl('WorkOrderDetail') + `?id=${wo.id}`}
                                        className={`block p-2 rounded-lg border text-xs hover:shadow-md transition-all ${statusColors[wo.status]} ${
                                          hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''
                                        } relative`}
                                        onClick={(e) => snapshot.isDragging && e.preventDefault()}
                                      >
                                        {hasConflict && (
                                          <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1">
                                            <AlertTriangle className="h-3 w-3 text-white" />
                                          </div>
                                        )}
                                        <p className="font-medium truncate">{wo.title}</p>
                                        {wo.scheduled_start_time && (
                                          <div className="flex items-center gap-1 mt-1 text-[10px] opacity-80">
                                            <Clock className="h-3 w-3" />
                                            {wo.scheduled_start_time}
                                            {wo.scheduled_end_time && ` - ${wo.scheduled_end_time}`}
                                          </div>
                                        )}
                                        {jobInfo.boat && (
                                          <p className="truncate mt-1 opacity-80">{jobInfo.boat}</p>
                                        )}
                                        {techs.length > 0 && (
                                          <div className="flex items-center gap-1 mt-2">
                                            <div className="flex -space-x-1">
                                              {techs.slice(0, 2).map((tech, idx) => (
                                                <Avatar key={idx} className="h-5 w-5 border border-white">
                                                  <AvatarFallback className="text-[8px] bg-white">
                                                    {tech.initials}
                                                  </AvatarFallback>
                                                </Avatar>
                                              ))}
                                              {techs.length > 2 && (
                                                <div className="h-5 w-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px]">
                                                  +{techs.length - 2}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </Link>
                                    </TooltipTrigger>
                                    {hasConflict && conflictTooltip && (
                                      <TooltipContent side="top" className="bg-red-50 border-red-200">
                                        <div className="flex items-start gap-2">
                                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                                          <div className="text-xs text-red-900 whitespace-pre-line">
                                            {conflictTooltip}
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </div>
                              </TooltipProvider>
                            )}
                          </Draggable>
                        );
                      })
                    )}
                    {provided.placeholder}
                  </CardContent>
                </Card>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}