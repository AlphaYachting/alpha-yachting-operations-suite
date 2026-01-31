import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { format, addDays, startOfWeek, addMonths, startOfMonth, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DragDropCalendar from '@/components/schedule/DragDropCalendar';
import DayDispatchView from '@/components/DayDispatchView';
import ScheduleItemEditModal from '@/components/ScheduleItemEditModal';

export default function DispatchFullscreenModal({ open, onClose }) {
  const [mode, setMode] = useState('calendar'); // 'calendar' or 'day'
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState(null);
  const [gridSize, setGridSize] = useState('1h');
  
  // Data state
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventoryReservations, setInventoryReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState(null);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [woData, jobsData, techData, custData, boatsData, locData, invResData] = await Promise.all([
        base44.entities.WorkOrder.list('-scheduled_date'),
        base44.entities.Job.list(),
        base44.entities.Technician.list(),
        base44.entities.Customer.list(),
        base44.entities.Boat.list(),
        base44.entities.Location.list(),
        base44.entities.InventoryReservation.list()
      ]);
      setWorkOrders(woData);
      setJobs(jobsData);
      setTechnicians(techData);
      setCustomers(custData);
      setBoats(boatsData);
      setLocations(locData);
      setInventoryReservations(invResData);
    } catch (error) {
      console.error('Error loading dispatch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkOrderUpdate = async (workOrderId, updates) => {
    try {
      await base44.entities.WorkOrder.update(workOrderId, updates);
      await loadData();
    } catch (error) {
      console.error('Error updating work order:', error);
      alert('Failed to update work order. Please try again.');
    }
  };

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setMode('day');
  };

  const handleBackToCalendar = () => {
    setMode('calendar');
    setSelectedDate(null);
  };

  const handleWorkOrderEdit = (wo) => {
    setEditingWorkOrder(wo);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    await loadData();
  };

  const prevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const nextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          {mode === 'day' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToCalendar}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Calendar
            </Button>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {mode === 'calendar' ? 'Calendar Dispatch' : 'Day Dispatch'}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === 'calendar' 
                ? format(currentWeekStart, 'MMMM yyyy')
                : format(selectedDate || new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {mode === 'calendar' && (
            <>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={prevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          
          {mode === 'day' && (
            <Select value={gridSize} onValueChange={setGridSize}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30m">30 minutes</SelectItem>
                <SelectItem value="1h">1 hour</SelectItem>
              </SelectContent>
            </Select>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="ml-4"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content - SINGLE SCROLL CONTAINER for @hello-pangea/dnd */}
      <div className="flex-1 overflow-auto p-6" id="dispatchScroll">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-slate-500">Loading...</div>
          </div>
        ) : mode === 'calendar' ? (
          <DragDropCalendar
            currentWeekStart={currentWeekStart}
            workOrders={workOrders}
            jobs={jobs}
            technicians={technicians}
            customers={customers}
            boats={boats}
            locations={locations}
            inventoryReservations={inventoryReservations}
            onWorkOrderUpdate={handleWorkOrderUpdate}
            onWorkOrderEdit={handleWorkOrderEdit}
            onDayClick={handleDayClick}
            loading={loading}
            viewType="week"
          />
        ) : (
          <DayDispatchView
            technicians={technicians}
            workOrders={workOrders}
            jobs={jobs}
            customers={customers}
            boats={boats}
            locations={locations}
            selectedDate={selectedDate || new Date()}
            gridSize={gridSize}
            onWorkOrderUpdate={handleWorkOrderUpdate}
            onWorkOrderEdit={handleWorkOrderEdit}
          />
        )}
      </div>

      <ScheduleItemEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        workOrder={editingWorkOrder}
        technicians={technicians}
        onSave={handleEditSave}
      />
    </div>
  );
}