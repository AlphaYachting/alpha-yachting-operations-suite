
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline'; // Example icon
import { format } from 'date-fns';

// --- Mock API Functions (Replace with actual API calls) ---
// These functions simulate network requests for work orders.
// In a real application, these would interact with your backend.

// Simulates fetching work orders from an API
const fetchWorkOrders = async (date) => {
  console.log(`[API Mock] Fetching work orders for date: ${format(date, 'yyyy-MM-dd')}`);
  return new Promise(resolve => {
    setTimeout(() => {
      // Example data structure for work orders
      const mockData = [
        { id: 'wo1', title: 'Fix broken pipe', technician: 'Alice', status: 'assigned', startTime: '09:00', endTime: '10:00', date: format(date, 'yyyy-MM-dd') },
        { id: 'wo2', title: 'Install new AC unit', technician: 'Bob', status: 'pending', startTime: '10:30', endTime: '12:00', date: format(date, 'yyyy-MM-dd') },
        { id: 'wo3', title: 'Routine maintenance', technician: 'Alice', status: 'completed', startTime: '13:00', endTime: '14:00', date: format(date, 'yyyy-MM-dd') },
        { id: 'wo4', title: 'Inspect electrical panel', technician: null, status: 'unassigned', startTime: null, endTime: null, date: format(date, 'yyyy-MM-dd') },
      ];
      resolve(mockData);
    }, 500); // Simulate network delay
  });
};

// Simulates updating a work order on the API
const updateWorkOrderOnBackend = async (workOrderId, updatedFields) => {
  console.log(`[API Mock] Updating work order ${workOrderId} with:`, updatedFields);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate a potential error 10% of the time
      if (Math.random() < 0.1) {
        reject(new Error("Failed to update work order on backend (simulated error)."));
      } else {
        resolve({ success: true, updatedId: workOrderId });
      }
    }, 300); // Simulate network delay
  });
};

// --- DispatchFullscreenModal Component ---

const DispatchFullscreenModal = ({ isOpen, onClose, initialDate }) => {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());

  // Function to load all data
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkOrders(selectedDate);
      setWorkOrders(data);
    } catch (err) {
      console.error("Failed to load work orders:", err);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Effect to load data initially or when the modal opens/date changes
  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen, selectedDate, loadAllData]);

  // Handler for drag-and-drop operations
  // This function would be called after a successful drag-and-drop
  // For example, when a work order is assigned to a new technician or time slot.
  const handleDragDrop = useCallback(async (updatedWorkOrder) => {
    // updatedWorkOrder should contain the work order's new state (e.g., new technician, new time)
    console.log("Drag-and-drop detected. Attempting to update work order:", updatedWorkOrder);

    try {
      // 1. Call the API to persist the change on the backend
      await updateWorkOrderOnBackend(updatedWorkOrder.id, {
        technician: updatedWorkOrder.technician,
        status: updatedWorkOrder.status,
        startTime: updatedWorkOrder.startTime,
        endTime: updatedWorkOrder.endTime,
        // ... other fields that might change during a drag-and-drop
      });

      // Line 103 (approximate):
      // 2. Optimistic state update: Update the specific work order in the local state.
      // This replaces the previous `await loadAllData()` call,
      // preventing a full page reload and maintaining modal state.
      setWorkOrders(prev =>
        prev.map(wo =>
          wo.id === updatedWorkOrder.id ? { ...wo, ...updatedWorkOrder } : wo
        )
      );
      console.log("Work order updated optimistically in UI.");

    } catch (err) {
      console.error("Error updating work order after drag/drop:", err);
      setError("Failed to update work order. Reloading data for consistency.");
      // 3. Only calls loadAllData() on error (for data consistency).
      // If the optimistic update fails, re-fetch all data to ensure
      // the UI is consistent with the backend.
      await loadAllData();
    }
  }, [loadAllData]);

  // --- Example UI for the modal content ---
  // This is a placeholder for the actual calendar/dispatch board UI.
  // It demonstrates how `workOrders` and `handleDragDrop` might be used.

  const handlePreviousDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay);
  };

  const handleNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  };

  // Mock function to simulate a drag-drop event for testing purposes
  const simulateDragDrop = (workOrderId) => {
    const workOrderToUpdate = workOrders.find(wo => wo.id === workOrderId);
    if (workOrderToUpdate) {
      const newTech = workOrderToUpdate.technician === 'Alice' ? 'Bob' : 'Alice';
      const newStatus = newTech ? 'assigned' : 'unassigned';
      console.log(`Simulating drag drop for ${workOrderId}: assign to ${newTech}`);
      handleDragDrop({
        ...workOrderToUpdate,
        technician: newTech,
        status: newStatus,
        // You would typically pass updated time slots, etc., here too
        startTime: '10:00',
        endTime: '11:00'
      });
    }
  };


  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full h-[95vh] transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all flex flex-col">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center pb-4 border-b border-gray-200"
                >
                  Dispatch Board - {format(selectedDate, 'PPP')}
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                {/* Date navigation */}
                <div className="flex items-center justify-between my-4">
                  <button onClick={handlePreviousDay} className="px-4 py-2 bg-blue-500 text-white rounded">
                    Previous Day
                  </button>
                  <span className="text-xl font-semibold">{format(selectedDate, 'EEEE, MMMM do, yyyy')}</span>
                  <button onClick={handleNextDay} className="px-4 py-2 bg-blue-500 text-white rounded">
                    Next Day
                  </button>
                </div>

                {/* Loading, Error, and Content display */}
                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-blue-600">Loading work orders...</p>
                  </div>
                ) : error ? (
                  <div className="flex-1 flex items-center justify-center text-red-600">
                    <p>{error}</p>
                    <button onClick={loadAllData} className="ml-4 px-3 py-1 bg-red-100 text-red-700 rounded">Retry</button>
                  </div>
                ) : (
                  <div className="flex-1 mt-4 overflow-auto">
                    {/* Placeholder for the actual dispatch/calendar grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {workOrders.length === 0 ? (
                        <p className="col-span-full text-center text-gray-500">No work orders for this date.</p>
                      ) : (
                        workOrders.map((wo) => (
                          <div
                            key={wo.id}
                            className={`p-4 border rounded-lg shadow-sm ${
                              wo.status === 'assigned' ? 'bg-green-50' : wo.status === 'pending' ? 'bg-yellow-50' : 'bg-gray-50'
                            }`}
                          >
                            <h4 className="font-semibold text-gray-800">{wo.title}</h4>
                            <p className="text-sm text-gray-600">ID: {wo.id}</p>
                            <p className="text-sm text-gray-600">Status: {wo.status}</p>
                            <p className="text-sm text-gray-600">Technician: {wo.technician || 'Unassigned'}</p>
                            <p className="text-sm text-gray-600">Time: {wo.startTime} - {wo.endTime}</p>
                            {/* Simulate a drag-drop action for testing */}
                            <button
                              onClick={() => simulateDragDrop(wo.id)}
                              className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Simulate Drag/Drop
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* You can add footer actions here if needed */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default DispatchFullscreenModal;
