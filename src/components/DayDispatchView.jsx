import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, MapPin, AlertTriangle, GripVertical } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ScheduleItemEditModal from '@/components/ScheduleItemEditModal';

const statusColors = {
  Draft: 'bg-slate-100 text-slate-700',
  Scheduled: 'bg-blue-100 text-blue-700',
  Dispatched: 'bg-violet-100 text-violet-700',
  'In Transit': 'bg-indigo-100 text-indigo-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-slate-100 text-slate-700'
};

// Parse HH:MM to minutes since midnight
function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Convert minutes to HH:MM
function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Snap to grid (30-min intervals)
function snapToGrid(minutes, gridSize = 30) {
  return Math.round(minutes / gridSize) * gridSize;
}

// Compute end time with field priority: scheduled_end_time > estimated_duration_hours > default 60min
function computeEndTime(wo) {
  const start = parseTime(wo.scheduled_start_time || '09:00');
  
  // Priority 1: scheduled_end_time
  if (wo.scheduled_end_time) {
    const end = parseTime(wo.scheduled_end_time);
    if (end > start) return formatTime(end);
  }
  
  // Priority 2: estimated_duration_hours
  if (wo.estimated_duration_hours && wo.estimated_duration_hours > 0) {
    const durationMinutes = wo.estimated_duration_hours * 60;
    return formatTime(start + durationMinutes);
  }
  
  // Default: 60 minutes
  return formatTime(start + 60);
}

// Calculate position for timeline block
function calculatePosition(startTime, endTime, startHour, endHour) {
  const start = parseTime(startTime);
  const end = parseTime(endTime) || start + 60;
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

export default function DayDispatchView({
  technicians,
  workOrders,
  jobs,
  customers,
  boats,
  locations,
  selectedDate,
  gridSize = '30m',
  onWorkOrderUpdate,
  onWorkOrderEdit,
  useScheduleModal = false
}) {
  const [resizing, setResizing] = useState(null);
  const [error, setError] = useState(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  
  const startHour = 6;
  const endHour = 18;
  const gridMinutes = gridSize === '30m' ? 30 : 60;
  
  // Time slots for header
  const timeSlots = useMemo(() => {
    const slots = [];
    const step = gridSize === '30m' ? 0.5 : 1;
    for (let h = startHour; h < endHour; h += step) {
      slots.push(h);
    }
    return slots;
  }, [gridSize]);
  
  // Get job info helper
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
  
  // Filter work orders for selected date
  const dayWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      if (!wo.scheduled_date) return false;
      return format(parseISO(wo.scheduled_date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
    });
  }, [workOrders, selectedDate]);
  
  // Map work orders to technicians
  const technicianRows = useMemo(() => {
    return technicians.map(tech => {
      const techWOs = dayWorkOrders.filter(wo => 
        wo.assigned_technicians?.includes(tech.id) || wo.lead_technician_id === tech.id
      );
      return {
        technician: tech,
        workOrders: techWOs
      };
    });
  }, [technicians, dayWorkOrders]);
  
  // Drag end handler - updates technician assignment AND time (preserves duration)
  const handleDragEnd = async (result) => {
    console.log('[DnD] onDragEnd:', { draggableId: result.draggableId, source: result.source?.droppableId, destination: result.destination?.droppableId });
    if (!result.destination) return;
    
    const { draggableId, source, destination } = result;
    const woId = draggableId;
    
    // Parse destination droppableId: "tech:<id>|date:<YYYY-MM-DD>|t:<HH:MM>"
    const destParts = destination.droppableId.split('|');
    if (destParts.length !== 3) {
      console.warn('Invalid droppableId format:', destination.droppableId);
      return;
    }
    
    const destTechId = destParts[0].replace('tech:', '');
    const destTime = destParts[2].replace('t:', '');
    
    // Find work order
    const wo = dayWorkOrders.find(w => w.id === woId);
    if (!wo) {
      console.warn('Work order not found:', woId);
      return;
    }
    
    // Calculate duration to preserve (field priority: scheduled_end_time > estimated_duration_hours > default)
    const currentStart = parseTime(wo.scheduled_start_time || '09:00');
    let duration = 60; // default
    
    if (wo.scheduled_end_time) {
      const currentEnd = parseTime(wo.scheduled_end_time);
      if (currentEnd > currentStart) {
        duration = currentEnd - currentStart;
      }
    } else if (wo.estimated_duration_hours && wo.estimated_duration_hours > 0) {
      duration = wo.estimated_duration_hours * 60;
    }
    
    // New times
    const newStartMinutes = parseTime(destTime);
    const newEndMinutes = newStartMinutes + duration;
    
    // Validate bounds
    if (newEndMinutes > endHour * 60) {
      setError('Work order would extend past 18:00. Please choose an earlier time slot.');
      return;
    }
    
    try {
      setError(null);
      
      // Update assigned_technicians array
      const sourceParts = source.droppableId.split('|');
      const sourceTechId = sourceParts[0].replace('tech:', '');
      
      const newAssigned = wo.assigned_technicians?.filter(id => id !== sourceTechId) || [];
      if (!newAssigned.includes(destTechId)) {
        newAssigned.push(destTechId);
      }
      
      const updates = {
        assigned_technicians: newAssigned,
        lead_technician_id: destTechId,
        scheduled_start_time: formatTime(newStartMinutes)
      };
      
      // Update scheduled_end_time if it exists (priority field)
      if (wo.scheduled_end_time) {
        updates.scheduled_end_time = formatTime(newEndMinutes);
      } else if (wo.estimated_duration_hours !== undefined) {
        // Keep estimated_duration_hours unchanged (duration preserved via start time shift)
      }
      
      await onWorkOrderUpdate(woId, updates);
    } catch (err) {
      console.warn('Failed to update work order:', err);
      setError('Failed to update work order. Please try again.');
    }
  };
  
  // Resize handler - updates duration (field priority: scheduled_end_time > estimated_duration_hours)
  const handleResizeStart = (e, wo) => {
    e.preventDefault();
    e.stopPropagation();
    
    const originalStartMinutes = parseTime(wo.scheduled_start_time || '09:00');
    const computedEnd = computeEndTime(wo);
    const originalEndMinutes = parseTime(computedEnd);
    
    // Store original values for revert on error
    const originalWO = { ...wo };
    
    setResizing({
      woId: wo.id,
      startX: e.clientX,
      originalStart: originalStartMinutes,
      originalEnd: originalEndMinutes,
      originalWO
    });
    
    const handleMouseMove = (moveEvent) => {
      if (!resizing) return;
      
      const deltaX = moveEvent.clientX - resizing.startX;
      const container = document.querySelector('.timeline-container');
      if (!container) return;
      
      const containerWidth = container.offsetWidth;
      const totalMinutes = (endHour - startHour) * 60;
      const deltaMinutes = (deltaX / containerWidth) * totalMinutes;
      
      let newEnd = resizing.originalEnd + deltaMinutes;
      newEnd = snapToGrid(newEnd, gridMinutes);
      
      // Enforce minimum duration (one grid step)
      if (newEnd - resizing.originalStart < gridMinutes) {
        newEnd = resizing.originalStart + gridMinutes;
      }
      
      // Clamp to visible day bounds
      const maxEndMinutes = endHour * 60;
      if (newEnd > maxEndMinutes) {
        newEnd = maxEndMinutes;
      }
      
      setResizing(prev => ({ ...prev, newEnd }));
    };
    
    const handleMouseUp = async () => {
      if (!resizing || !resizing.newEnd) {
        setResizing(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        return;
      }
      
      // Validate final time
      if (resizing.newEnd <= resizing.originalStart) {
        setError('Invalid duration: end time must be after start time');
        setResizing(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        return;
      }
      
      try {
        setError(null);
        const newEndTime = formatTime(resizing.newEnd);
        const newDurationMinutes = resizing.newEnd - resizing.originalStart;
        const newDurationHours = newDurationMinutes / 60;
        
        const updates = {};
        
        // Field priority: scheduled_end_time > estimated_duration_hours
        if (wo.scheduled_end_time !== undefined) {
          // Priority 1: Update scheduled_end_time
          updates.scheduled_end_time = newEndTime;
        } else if (wo.estimated_duration_hours !== undefined) {
          // Priority 2: Update estimated_duration_hours
          updates.estimated_duration_hours = newDurationHours;
        } else {
          // No duration field exists - create scheduled_end_time
          updates.scheduled_end_time = newEndTime;
        }
        
        await onWorkOrderUpdate(resizing.woId, updates);
      } catch (err) {
        console.warn('Failed to update duration:', err);
        setError('Save failed, reverted.');
        // Revert will happen automatically on data reload
      }
      
      setResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  if (dayWorkOrders.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-500">No scheduled work orders for {format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
      </Card>
    );
  }
  
  const handleDragStart = (result) => {
    console.log('[DnD] onDragStart:', result.draggableId);
  };

  return (
    <>
    <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div className="border rounded-lg bg-white overflow-hidden">
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        
        <div className="flex timeline-container">
          {/* Left column - Technicians */}
          <div className="w-48 flex-shrink-0 border-r bg-slate-50">
            <div className="h-12 border-b flex items-center px-4 font-medium text-sm text-slate-700">
              Mechanic
            </div>
            {technicianRows.map(({ technician }) => (
              <div key={technician.id} className="h-24 border-b flex items-center px-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div 
                      className="absolute -inset-1 rounded-full"
                      style={{ backgroundColor: (technician.color || '#3b82f6') + '30' }}
                    />
                    <Avatar className="h-8 w-8 relative">
                      <AvatarFallback 
                        className="text-xs font-semibold"
                        style={{ 
                          backgroundColor: (technician.color || '#3b82f6') + '20',
                          color: technician.color || '#3b82f6'
                        }}
                      >
                        {technician.first_name?.[0]}{technician.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900">
                      {technician.first_name} {technician.last_name}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Right area - Timeline with drag-drop */}
          <div className="flex-1">
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
            
            {/* Technician rows with timeslot droppables */}
            {technicianRows.map(({ technician, workOrders: techWOs }) => {
              // Calculate timeline container width once per row for pixel-based card sizing
              const timelineContainerEl = document.querySelector('.timeline-container');
              const containerWidth = timelineContainerEl?.offsetWidth || 1000;
              const leftPanelWidth = 192; // w-48 = 12rem = 192px
              const timelineWidth = containerWidth - leftPanelWidth;
              
              return (
                <div key={technician.id} className="h-24 border-b relative">
                  {/* Time slot grid with droppables */}
                  <div className="absolute inset-0 flex">
                    {timeSlots.map((hour) => {
                      const slotTime = formatTime(hour * 60);
                      const dateStr = format(selectedDate, 'yyyy-MM-dd');
                      const droppableId = `tech:${technician.id}|date:${dateStr}|t:${slotTime}`;

                      // Find work orders that start in this slot
                      const slotWOs = techWOs.filter(wo => {
                        const woStart = wo.scheduled_start_time || '09:00';
                        return woStart === slotTime;
                      });

                      return (
                        <Droppable key={slotTime} droppableId={droppableId} direction="horizontal">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className="flex-1 border-l first:border-l-0 transition-colors relative"
                              style={{
                                minWidth: `${100 / timeSlots.length}%`,
                                backgroundColor: snapshot.isDraggingOver ? '#3b82f620' : 'transparent',
                                borderColor: snapshot.isDraggingOver ? '#3b82f6' : 'transparent',
                                borderWidth: snapshot.isDraggingOver ? '2px' : '0'
                              }}
                            >
                              {/* Work orders starting in this slot */}
                              {slotWOs.map((wo, index) => {
                                // Compute end time using field priority
                                const computedEnd = computeEndTime(wo);
                                const woStartMinutes = parseTime(wo.scheduled_start_time || '09:00');
                                const woEndMinutes = parseTime(computedEnd);
                                
                                // Calculate pixel-based width (NOT percentage)
                                const duration = woEndMinutes - woStartMinutes;
                                const totalMinutes = (endHour - startHour) * 60;
                                const widthPx = (duration / totalMinutes) * timelineWidth;
                                const heightPx = 96 - 16; // h-24 minus padding
                                
                                const jobInfo = getJobInfo(wo.job_id);

                                return (
                                  <Draggable key={wo.id} draggableId={wo.id} index={index}>
                                    {(provided, snapshot) => {
                                      // Merge DnD positioning with fixed pixel width
                                      const dndStyle = provided.draggableProps.style || {};
                                      const isDragging = snapshot.isDragging;
                                      
                                      const cardStyle = {
                                        ...dndStyle,
                                        width: `${widthPx}px`,
                                        height: `${heightPx}px`,
                                        top: isDragging ? dndStyle.top : '8px',
                                        left: isDragging ? dndStyle.left : '0px',
                                        position: isDragging ? 'fixed' : 'absolute',
                                        zIndex: isDragging ? 1000 : 10,
                                        backgroundColor: (technician.color || '#3b82f6') + '20',
                                        borderColor: technician.color || '#3b82f6',
                                        borderLeftWidth: '4px',
                                        borderLeftColor: technician.color || '#3b82f6',
                                        pointerEvents: 'auto'
                                      };

                                      const handleCardClick = (e) => {
                                        if (isDragging) return;
                                        e.stopPropagation();
                                        if (useScheduleModal) {
                                          setSelectedWorkOrder(wo);
                                          setScheduleModalOpen(true);
                                        } else if (onWorkOrderEdit) {
                                          onWorkOrderEdit(wo);
                                        }
                                      };
                                      
                                      return (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          onClick={handleCardClick}
                                          className="rounded-md shadow-sm hover:shadow-md transition-all overflow-hidden border group cursor-pointer"
                                          style={cardStyle}
                                        >
                                          <div className="h-full flex items-start">
                                            <div
                                              {...provided.dragHandleProps}
                                              onClick={(e) => e.stopPropagation()}
                                              className="flex items-center gap-1 cursor-move px-2 py-1 hover:bg-black/5"
                                            >
                                              <GripVertical className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                            </div>
                                            <div className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1">
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate text-slate-900">
                                                  {wo.title}
                                                </p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                  <span className="text-[10px] font-medium text-slate-700">
                                                    {wo.scheduled_start_time || '09:00'}–{computedEnd}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>

                                            <div
                                              onMouseDown={(e) => handleResizeStart(e, wo)}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-4 cursor-ew-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 border-l-2"
                                              style={{ borderLeftColor: technician.color || '#3b82f6' }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    }}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DragDropContext>

    {/* Schedule Edit Modal */}
    {useScheduleModal && (
      <ScheduleItemEditModal
        open={scheduleModalOpen}
        onClose={() => {
          setScheduleModalOpen(false);
          setSelectedWorkOrder(null);
        }}
        workOrder={selectedWorkOrder}
        technicians={technicians}
        jobs={jobs}
        customers={customers}
        boats={boats}
        onSave={onWorkOrderUpdate}
      />
    )}
    </>
  );
}