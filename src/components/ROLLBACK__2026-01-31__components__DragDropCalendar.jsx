
import React from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// NOTE: For 'material-icons', ensure you have linked the Material Icons stylesheet
// in your project's public/index.html or equivalent.
// Example: <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">

// Helper component for the priority icon
const PriorityIcon = ({ priority }) => {
  let iconColorClass = 'text-gray-400'; // Default
  switch (priority) {
    case 'high':
      iconColorClass = 'text-red-500';
      break;
    case 'medium':
      iconColorClass = 'text-yellow-500';
      break;
    case 'low':
      iconColorClass = 'text-green-500';
      break;
    default:
      iconColorClass = 'text-gray-400'; // Fallback for undefined priority
      break;
  }
  return (
    <span className={`material-icons text-lg ${iconColorClass}`} title={`Priority: ${priority}`}>
      fiber_manual_record {/* Using a Material Icon for a dot/indicator */}
    </span>
  );
};

// This component represents a single draggable event card
const DraggableEventCard = ({ event, index }) => {
  return (
    <Draggable draggableId={event.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          // Change 1: Moved {...provided.dragHandleProps} to the outer wrapper
          // This makes the entire card draggable. (Previously around line 585, now here, around line 541 contextually)
          {...provided.dragHandleProps}
          className={`
            relative p-2 mb-2 rounded-lg shadow-sm border-l-4
            ${event.status === 'urgent' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}
            ${snapshot.isDragging ? 'opacity-75 shadow-lg transform scale-105 rotate-1' : 'opacity-100'}
            // Change 2: Changed cursor from `cursor-pointer` to `cursor-move` on non-dragging state (contextually around line 548)
            ${snapshot.isDragging ? 'cursor-grabbing' : 'cursor-move'}
            transition-all duration-150 ease-in-out
            hover:shadow-md hover:border-l-8
            group
          `}
          // Example of an onClick handler for editing
          onClick={(e) => {
            // Only trigger click/edit if not dragging to prevent accidental edits
            // react-beautiful-dnd typically handles drag threshold, but this adds an extra layer.
            if (!snapshot.isDragging) {
              console.log(`Editing event: ${event.title} (ID: ${event.id})`);
              // Implement actual edit logic here, e.g., open a modal
            }
          }}
          style={{ ...provided.draggableProps.style }} // Apply styles from react-beautiful-dnd
        >
          <div className="flex justify-between items-start">
            <h4 className="text-sm font-semibold text-gray-800 break-words pr-2">{event.title}</h4>
            <span className="text-xs text-gray-500 flex-shrink-0">{event.time}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1 break-words">{event.description}</p>

          <div className="absolute bottom-1 right-2 flex items-center space-x-1">
            {/* Change 3 & 4: Removed drag handle wrapper around priority icon (contextually lines 584-590 deleted).
                Priority icon now rendered directly without drag handle props.
                The drag handle props are now on the entire card (outer div above).
            */}
            {/* Previous structure (hypothetical, for context of changes):
            <div {...provided.dragHandleProps} className="inline-flex items-center justify-center w-5 h-5 text-gray-500 hover:text-gray-700 cursor-grab">
                <PriorityIcon priority={event.priority} />
            </div>
            */}
            {/* New structure: PriorityIcon rendered directly */}
            <PriorityIcon priority={event.priority} />
            {/* Optionally, you could still have a visual indicator for drag, but it won't be the drag handle */}
            {/* <span className="material-icons text-gray-400 text-base cursor-move group-hover:text-gray-600 transition-colors duration-100">drag_indicator</span> */}
          </div>
        </div>
      )}
    </Draggable>
  );
};

// Main calendar component that orchestrates days and events
const DragDropCalendar = ({ events, onDragEnd }) => {
  // Group events by day for easier rendering
  const eventsByDay = events.reduce((acc, event) => {
    if (!acc[event.day]) {
      acc[event.day] = [];
    }
    acc[event.day].push(event);
    return acc;
  }, {});

  // Sort events within each day by their 'index' property for stable ordering
  Object.keys(eventsByDay).forEach(day => {
    eventsByDay[day].sort((a, b) => a.index - b.index);
  });

  // Example: Display a 7-day week across two weeks (14 days total)
  const daysInDisplay = 14;
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="calendar-wrapper bg-gray-50 p-4 rounded-xl shadow-lg font-sans">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Dispatch Schedule</h2>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-3 mb-3 text-center text-sm font-medium text-gray-600">
          {weekdays.map((day, idx) => (
            <div key={`weekday-${idx}`} className="py-2 border-b-2 border-gray-200">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid: Renders each day as a droppable column */}
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: daysInDisplay }).map((_, dayIndex) => (
            <div
              key={`day-column-${dayIndex}`}
              className="bg-white rounded-lg shadow-sm p-3 min-h-[150px] flex flex-col"
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Day {dayIndex + 1}
              </h3>
              <Droppable droppableId={`day-${dayIndex}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`
                      flex-grow min-h-[50px]
                      ${snapshot.isDraggingOver ? 'bg-blue-100' : 'bg-gray-50'}
                      rounded-md transition-colors duration-150 p-1
                    `}
                  >
                    {(eventsByDay[dayIndex] || []).map((event, eventIndex) => (
                      <DraggableEventCard
                        key={event.id}
                        event={event}
                        index={eventIndex}
                      />
                    ))}
                    {provided.placeholder} {/* Placeholder for when dragging an item */}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </div>
    </DragDropContext>
  );
};

export default DragDropCalendar;
