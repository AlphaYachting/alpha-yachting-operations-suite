
// DayDispatchView.js

import React, { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react'; // Assuming lucide-react for the GripVertical icon, a common choice.
                                            // You might need to adjust this import based on your actual icon library.

// --- Placeholder Components (These would be your actual application components) ---
// Since the original file's full content was not provided, these are minimal
// functional components to demonstrate the Drag & Drop and the specific handle changes.

/**
 * Placeholder component for a Technician row, which acts as a Droppable area.
 */
const TechnicianRow = React.forwardRef(({ id, name, children, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    className="bg-gray-100 p-2 my-2 rounded border border-gray-300 shadow-sm"
    data-rbd-droppable-id={id} // Required for @hello-pangea/dnd
  >
    <h3 className="font-semibold text-lg text-gray-800 mb-2">{name}</h3>
    <div className="min-h-[50px] p-1 border border-dashed border-gray-400 rounded bg-gray-50">
      {/* Ensure droppable area has a visual height */}
      {children}
    </div>
  </div>
));

/**
 * Placeholder component for a Work Order card, which acts as a Draggable item.
 * This component contains the core logic for the drag and resize handles.
 */
const WorkOrderCard = ({ id, content, index }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [initialWidth, setInitialWidth] = useState(0);
  const [initialMouseX, setInitialMouseX] = useState(0);
  const cardRef = React.useRef(null); // Ref to hold the actual card DOM element

  // Callback for when the resize handle is pressed down
  const handleResizeMouseDown = useCallback((e) => {
    e.stopPropagation(); // CRITICAL: Prevents the drag operation from starting when resizing.
    setIsResizing(true);
    if (cardRef.current) {
      setInitialWidth(cardRef.current.offsetWidth); // Get current width of the card container
      setInitialMouseX(e.clientX);
    }
    // Add global event listeners to track mouse movement for resizing
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  }, [cardRef]);

  // Callback for mouse movement during resizing
  const handleResizeMouseMove = useCallback((e) => {
    if (isResizing && cardRef.current) {
      const deltaX = e.clientX - initialMouseX;
      // In a real application, you would update state or a global context
      // to change the width property of this card, potentially saving it.
      // For this example, we'll just apply a hypothetical width for visual feedback.
      // Make sure there's a minimum width to prevent collapsing.
      const newWidth = Math.max(100, initialWidth + deltaX);
      // console.log(`Resizing: New width would be ${newWidth}px`);
      // For demonstration, you might directly manipulate style, but typically you'd
      // update a React state variable that controls the card's width.
      // cardRef.current.style.width = `${newWidth}px`; // Don't do this directly in React usually.
    }
  }, [isResizing, initialMouseX, initialWidth, cardRef]);

  // Callback for when the mouse button is released, ending resize
  const handleResizeMouseUp = useCallback(() => {
    setIsResizing(false);
    // Remove global event listeners
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  }, [handleResizeMouseMove]);

  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={(el) => {
            provided.innerRef(el); // Assign ref for react-beautiful-dnd
            cardRef.current = el;  // Assign ref for our own component logic
          }}
          {...provided.draggableProps}
          className={`
            relative bg-white p-2 mb-2 rounded shadow transition-all duration-100 ease-in-out
            ${snapshot.isDragging ? 'border-2 border-blue-500 shadow-lg' : 'border border-gray-200'}
            ${isResizing ? 'resize-active cursor-grabbing' : 'cursor-grab'}
          `}
          style={{
            ...provided.draggableProps.style,
            // Example of how to apply dynamic width if resizing was implemented via state
            // width: cardWidthState || '200px', // Default width or state-controlled width
          }}
        >
          {/*
            --- PREVIOUS STRUCTURE (conceptual outline, for context of changes) ---
            This was the problematic structure where resize handle overlapped drag handle:
            <div className="relative flex justify-between items-center h-full">
              <div {...provided.dragHandleProps} className="flex-1 min-w-0 pr-4">
                <GripVertical className="inline-block mr-2 text-gray-400" />
                <span>{content}</span>
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize border-r border-gray-300"
                onMouseDown={handleResizeMouseDown}
              ></div>
            </div>
            --- END PREVIOUS STRUCTURE ---
          */}

          {/*
            --- START OF CHANGES: Separated Drag Handle from Resize Handle ---
            Solution: Changed layout from nested absolute positioning to flexbox.
            The outer div is now `flex`. The drag handle takes `flex-1` and the resize
            handle is a separate `w-4` sibling.
          */}
          <div className="flex items-center h-full">
            {/* Drag Handle Area: Takes most of the space, has `cursor-move` */}
            <div
              {...provided.dragHandleProps}
              className="flex-1 min-w-0 cursor-move pr-1" // `pr-1` for a little space from resize handle
            >
              <GripVertical className="inline-block mr-1 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{content}</span>
            </div>

            {/*
              Resize Handle Area: A separate `w-4` (4px wide) strip on the right.
              Changed from `absolute` to flex item, `borderRight` to `borderLeft`.
            */}
            <div
              className="w-4 flex-shrink-0 cursor-ew-resize border-l border-gray-300 hover:bg-gray-100 transition-colors duration-75"
              onMouseDown={handleResizeMouseDown}
            >
              {/* Optional visual indicator for the resize handle */}
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                {/* Could place a small icon or just leave as a bar */}
              </div>
            </div>
          </div>
          {/* --- END OF CHANGES --- */}
        </div>
      )}
    </Draggable>
  );
};
// --- End Placeholder Components ---


// Initial data structure for demonstration
const initialData = {
  technicians: {
    'tech-1': { id: 'tech-1', name: 'John Doe (Morning)', taskIds: ['task-1', 'task-2'] },
    'tech-2': { id: 'tech-2', name: 'Jane Smith (Afternoon)', taskIds: ['task-3', 'task-4'] },
    'tech-3': { id: 'tech-3', name: 'Unassigned', taskIds: [] },
  },
  tasks: {
    'task-1': { id: 'task-1', content: 'Work Order #1001 - Fix Leak' },
    'task-2': { id: 'task-2', content: 'Work Order #1002 - Install Fan' },
    'task-3': { id: 'task-3', content: 'Work Order #1003 - Boiler Maintenance' },
    'task-4': { id: 'task-4', content: 'Work Order #1004 - AC Repair' },
  },
  technicianOrder: ['tech-1', 'tech-2', 'tech-3'],
};

/**
 * Main DayDispatchView component that uses DragDropContext, Droppable, and Draggable.
 */
function DayDispatchView() {
  const [data, setData] = useState(initialData);

  // Handles the end of a drag operation
  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    // If there is no destination, do nothing
    if (!destination) {
      return;
    }

    // If dropped in the same place, do nothing
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const startTech = data.technicians[source.droppableId];
    const finishTech = data.technicians[destination.droppableId];

    // Case 1: Moving task within the same technician's schedule
    if (startTech === finishTech) {
      const newTaskIds = Array.from(startTech.taskIds);
      newTaskIds.splice(source.index, 1); // Remove task from old position
      newTaskIds.splice(destination.index, 0, draggableId); // Insert task into new position

      const newTechnician = {
        ...startTech,
        taskIds: newTaskIds,
      };

      setData({
        ...data,
        technicians: {
          ...data.technicians,
          [newTechnician.id]: newTechnician,
        },
      });
      return;
    }

    // Case 2: Moving task from one technician to another
    const startTaskIds = Array.from(startTech.taskIds);
    startTaskIds.splice(source.index, 1); // Remove task from the source technician
    const newStartTech = {
      ...startTech,
      taskIds: startTaskIds,
    };

    const finishTaskIds = Array.from(finishTech.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId); // Add task to the destination technician
    const newFinishTech = {
      ...finishTech,
      taskIds: finishTaskIds,
    };

    setData({
      ...data,
      technicians: {
        ...data.technicians,
        [newStartTech.id]: newStartTech,
        [newFinishTech.id]: newFinishTech,
      },
    });
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-sans">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-6 border-b pb-2">
        Daily Dispatch Schedule
      </h2>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.technicianOrder.map((technicianId) => {
            const technician = data.technicians[technicianId];
            const tasks = technician.taskIds.map(taskId => data.tasks[taskId]);

            return (
              <Droppable droppableId={technician.id} key={technician.id}>
                {(provided) => (
                  <TechnicianRow
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    id={technician.id}
                    name={technician.name}
                  >
                    {tasks.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">Drag tasks here</p>
                    )}
                    {tasks.map((task, index) => (
                      <WorkOrderCard
                        key={task.id}
                        id={task.id}
                        content={task.content}
                        index={index}
                      />
                    ))}
                    {provided.placeholder} {/* Essential for Droppable to adjust height */}
                  </TechnicianRow>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}

export default DayDispatchView;
