import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, MapPin, AlertTriangle, GripVertical } from 'lucide-react';
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
  onWorkOrderUpdate
}) {
  const [resizing, setResizing] = useState(null);
  const [error, setError] = useState(null);
  
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
  
  // Drag end handler - updates technician assignment
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const { draggableId, source, destination } = result;
    const woId = draggableId;
    const sourceTechId = source.droppableId;
    const destTechId = destination.droppableId;
    
    // No change if dropped on same technician
    if (sourceTechId === destTechId) return;
    
    // Find work order
    const wo = dayWorkOrders.find(w => w.id === woId);
    if (!wo) {
      console.warn('Work order not found:', woId);
      return;
    }
    
    try {
      setError(null);
      
      // Update assigned_technicians array
      const newAssigned = wo.assigned_technicians?.filter(id => id !== sourceTechId) || [];
      if (!newAssigned.includes(destTechId)) {
        newAssigned.push(destTechId);
      }
      
      const updates = {
        assigned_technicians: newAssigned,
        lead_technician_id: destTechId
      };
      
      await onWorkOrderUpdate(woId, updates);
    } catch (err) {
      console.warn('Failed to update technician assignment:', err);
      setError('Failed to update technician assignment. Please try again.');
    }
  };
  
  // Resize handler - updates work order duration (scheduled_end_time)
  // CRITICAL: This resize handle is positioned as a separate flex item (w-4, flex-shrink-0)
  // to avoid pointer-event conflicts with the drag handle (flex-1).
  // Do NOT change to absolute positioning or it will break drag interaction.
  const handleResizeStart = (e, wo) => {
    e.preventDefault();
    e.stopPropagation();
    
    const originalStartMinutes = parseTime(wo.scheduled_start_time);
    const originalEndMinutes = parseTime(wo.scheduled_end_time || wo.scheduled_start_time) || originalStartMinutes + 60;
    
    // Minimum duration enforcement (30 minutes)
    const MIN_DURATION_MINUTES = 30;
    
    setResizing({
      woId: wo.id,
      startX: e.clientX,
      originalStart: originalStartMinutes,
      originalEnd: originalEndMinutes
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
      
      // Enforce minimum duration
      if (newEnd - resizing.originalStart < MIN_DURATION_MINUTES) {
        newEnd = resizing.originalStart + MIN_DURATION_MINUTES;
      }
      
      // Clamp to visible day bounds (06:00-18:00)
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
        console.warn('Invalid resize: end time before or equal to start time');
        setError('Invalid duration: end time must be after start time');
        setResizing(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        return;
      }
      
      try {
        setError(null);
        const newEndTime = formatTime(resizing.newEnd);
        await onWorkOrderUpdate(resizing.woId, {
          scheduled_end_time: newEndTime
        });
      } catch (err) {
        console.warn('Failed to update duration:', err);
        setError('Failed to update duration. Please try again.');
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
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
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
            
            {/* Technician rows with droppable zones */}
            {technicianRows.map(({ technician, workOrders: techWOs }) => (
              <Droppable key={technician.id} droppableId={technician.id} direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="h-24 border-b relative"
                    style={{
                      backgroundColor: snapshot.isDraggingOver ? '#f1f5f920' : 'transparent'
                    }}
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {timeSlots.map((hour) => (
                        <div
                          key={hour}
                          className="flex-1 border-l first:border-l-0"
                          style={{ minWidth: `${100 / timeSlots.length}%` }}
                        />
                      ))}
                    </div>
                    
                    {/* Work order blocks */}
                    {techWOs.map((wo, index) => {
                      const position = calculatePosition(
                        wo.scheduled_start_time,
                        wo.scheduled_end_time,
                        startHour,
                        endHour
                      );
                      const jobInfo = getJobInfo(wo.job_id);
                      
                      return (
                        <Draggable key={wo.id} draggableId={wo.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="absolute top-2 bottom-2 rounded-md shadow-sm hover:shadow-md transition-all overflow-hidden border group"
                              style={{
                                ...provided.draggableProps.style,
                                left: `${position.left}%`,
                                width: `${position.width}%`,
                                zIndex: snapshot.isDragging ? 1000 : 10,
                                backgroundColor: (technician.color || '#3b82f6') + '20',
                                borderColor: technician.color || '#3b82f6',
                                borderLeftWidth: '4px',
                                borderLeftColor: technician.color || '#3b82f6'
                              }}
                            >
                              <div className="h-full flex items-start">
                                {/* DRAG HANDLE AREA: flex-1 (most of card width), receives dragHandleProps */}
                                <div
                                  {...provided.dragHandleProps}
                                  className="flex items-center gap-1 cursor-move flex-1 min-w-0 px-2 py-1"
                                >
                                  <GripVertical className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate text-slate-900">
                                      {wo.title}
                                    </p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="text-[10px] font-medium text-slate-700">
                                        {wo.scheduled_start_time}–{wo.scheduled_end_time || '?'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* RESIZE HANDLE AREA: fixed 4px strip on right edge, separate from drag handle.
                                    CRITICAL: Do NOT use position:absolute or it will block drag handle.
                                    Keep as flex item (w-4, flex-shrink-0) to prevent pointer overlap. */}
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, wo)}
                                  className="w-4 cursor-ew-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 border-l-2"
                                  style={{ borderLeftColor: technician.color || '#3b82f6' }}
                                />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}