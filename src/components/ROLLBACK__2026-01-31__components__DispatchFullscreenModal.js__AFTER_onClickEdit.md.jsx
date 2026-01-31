
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, IconButton, Button, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
// Assuming CalendarView and DayDispatchView are local components
import CalendarView from './CalendarView'; 
import DayDispatchView from './DayDispatchView'; 
import ScheduleItemEditModal from '@/components/ScheduleItemEditModal'; // 1. Import ScheduleItemEditModal

// --- Mock Data and Components (for a fully functioning example) ---
// In a real application, these would be separate files or fetched from an API.

const mockTechnicians = [
  { id: 'tech1', name: 'Alice Smith' },
  { id: 'tech2', name: 'Bob Johnson' },
  { id: 'tech3', name: 'Charlie Brown' },
];

const generateMockWorkOrders = () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  return [
    { id: 'wo1', title: 'HVAC Checkup', description: 'Annual maintenance for AC unit', scheduledStart: new Date(today.setHours(9, 0, 0, 0)), scheduledEnd: new Date(today.setHours(11, 0, 0, 0)), technicianId: 'tech1', status: 'Scheduled' },
    { id: 'wo2', title: 'Plumbing Repair', description: 'Fix leaking faucet in kitchen', scheduledStart: new Date(today.setHours(13, 0, 0, 0)), scheduledEnd: new Date(today.setHours(14, 30, 0, 0)), technicianId: 'tech2', status: 'Scheduled' },
    { id: 'wo3', title: 'Electrical Wiring', description: 'Install new outlet in living room', scheduledStart: new Date(tomorrow.setHours(10, 0, 0, 0)), scheduledEnd: new Date(tomorrow.setHours(12, 0, 0, 0)), technicianId: 'tech1', status: 'Scheduled' },
    { id: 'wo4', title: 'Appliance Installation', description: 'Install new dishwasher', scheduledStart: new Date(today.setHours(15, 0, 0, 0)), scheduledEnd: new Date(today.setHours(17, 0, 0, 0)), technicianId: 'tech3', status: 'Scheduled' },
  ];
};

// Placeholder for CalendarView component
const CalendarView = ({ dispatchData, technicians, onDateChange, onWorkOrderEdit }) => {
  return (
    <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: '4px' }}>
      <h3>Calendar View (Placeholder)</h3>
      <p>Displaying {dispatchData.length} work orders. Click an item to edit.</p>
      <Button onClick={() => onDateChange(new Date())}>Go to Today</Button>
      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
        {dispatchData.map(wo => (
          <Box 
            key={wo.id} 
            onClick={() => onWorkOrderEdit(wo)} 
            sx={{ 
              p: 1.5, 
              border: '1px solid #ccc', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              '&:hover': { bgcolor: '#f5f5f5' } 
            }}
          >
            <h4>{wo.title}</h4>
            <p><strong>Scheduled:</strong> {new Date(wo.scheduledStart).toLocaleString()} - {new Date(wo.scheduledEnd).toLocaleTimeString()}</p>
            <p><strong>Technician:</strong> {technicians.find(t => t.id === wo.technicianId)?.name || 'Unassigned'}</p>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// Placeholder for DayDispatchView component
const DayDispatchView = ({ dispatchData, technicians, onDateChange, onWorkOrderEdit }) => {
  const todayWorkOrders = dispatchData.filter(wo => {
    const woDate = new Date(wo.scheduledStart);
    const today = new Date();
    return woDate.getDate() === today.getDate() &&
           woDate.getMonth() === today.getMonth() &&
           woDate.getFullYear() === today.getFullYear();
  });

  return (
    <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: '4px' }}>
      <h3>Day Dispatch View (Placeholder for {new Date().toLocaleDateString()})</h3>
      <p>Displaying {todayWorkOrders.length} work orders for today. Click an item to edit.</p>
      <Button onClick={() => onDateChange(new Date())}>View Another Day</Button>
      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        {todayWorkOrders.map(wo => (
          <Box 
            key={wo.id} 
            onClick={() => onWorkOrderEdit(wo)} 
            sx={{ 
              p: 1.5, 
              border: '1px solid #ccc', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              '&:hover': { bgcolor: '#f5f5f5' } 
            }}
          >
            <h4>{wo.title}</h4>
            <p><strong>Scheduled:</strong> {new Date(wo.scheduledStart).toLocaleTimeString()} - {new Date(wo.scheduledEnd).toLocaleTimeString()}</p>
            <p><strong>Technician:</strong> {technicians.find(t => t.id === wo.technicianId)?.name || 'Unassigned'}</p>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// Placeholder for ScheduleItemEditModal component
const ScheduleItemEditModal = ({ open, onClose, workOrder, technicians, onSave }) => {
  const [formData, setFormData] = useState(workOrder || {});

  useEffect(() => {
    setFormData(workOrder || {});
  }, [workOrder]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveClick = () => {
    // Simulate API call for saving
    console.log("Attempting to save:", formData);
    // In a real app, you'd send formData to your backend
    onSave(formData); // Call the onSave prop from parent
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {workOrder && workOrder.id ? 'Edit Work Order' : 'Create Work Order'}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {workOrder ? ( // Only show form if a workOrder is provided (for editing)
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label>
              Title:
              <input type="text" name="title" value={formData.title || ''} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </label>
            <label>
              Description:
              <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={3} style={{ width: '100%', padding: '8px', marginTop: '4px' }}></textarea>
            </label>
            <label>
              Technician:
              <select name="technicianId" value={formData.technicianId || ''} onChange={handleChange} style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
                <option value="">Select Technician</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>{tech.name}</option>
                ))}
              </select>
            </label>
            {/* Add more fields here as needed: scheduled dates, times, status, etc. */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
              <Button onClick={onClose} variant="outlined">Cancel</Button>
              <Button onClick={handleSaveClick} variant="contained">Save Changes</Button>
            </Box>
          </Box>
        ) : (
          <p>No work order selected for editing. Please select an item from the dispatch view.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- Main Component: DispatchFullscreenModal ---

const DispatchFullscreenModal = ({ open, onClose }) => {
  // 2. Added Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState(null);

  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'day'
  const [dispatchData, setDispatchData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState(mockTechnicians); // Assuming technicians are loaded or passed as prop

  // Function to load/reload data
  const loadData = useCallback(async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    setDispatchData(generateMockWorkOrders()); // Replace with actual data fetching logic
    setLoading(false);
  }, []);

  // Effect to load data when modal opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  // 3. Added Edit Handlers
  const handleWorkOrderEdit = (wo) => {
    setEditingWorkOrder(wo);
    setEditModalOpen(true);
  };

  const handleEditSave = async (updatedWorkOrder) => {
    // In a real app, you would send updatedWorkOrder to your backend
    console.log("Work order saved, reloading data:", updatedWorkOrder);
    setEditModalOpen(false); // Close the modal
    await loadData(); // Reload data to reflect changes
  };

  const handleDayViewDateChange = (date) => {
    console.log("Day view date changed to:", date);
    // Implement logic to filter/reload data for the selected day
  };

  const handleCalendarViewDateChange = (date) => {
    console.log("Calendar view date changed to:", date);
    // Implement logic to filter/reload data for the selected calendar view
  };

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle>
        Dispatch Management
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* View mode toggle buttons */}
        <Box sx={{ mb: 2 }}>
          <Button 
            variant={viewMode === 'calendar' ? 'contained' : 'outlined'} 
            onClick={() => setViewMode('calendar')} 
            sx={{ mr: 1 }}
          >
            Calendar View
          </Button>
          <Button 
            variant={viewMode === 'day' ? 'contained' : 'outlined'} 
            onClick={() => setViewMode('day')}
          >
            Day Dispatch
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div>Loading dispatch data...</div>
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            {viewMode === 'calendar' && (
              <CalendarView
                dispatchData={dispatchData}
                technicians={technicians}
                onDateChange={handleCalendarViewDateChange}
                // 4. Wired Edit Handler to Calendar
                onWorkOrderEdit={handleWorkOrderEdit}
              />
            )}
            {viewMode === 'day' && (
              <DayDispatchView
                dispatchData={dispatchData}
                technicians={technicians}
                onDateChange={handleDayViewDateChange}
                // 5. Wired Edit Handler to Day Dispatch
                onWorkOrderEdit={handleWorkOrderEdit}
              />
            )}
          </Box>
        )}
      </DialogContent>

      {/* 6. Rendered Modal */}
      <ScheduleItemEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        workOrder={editingWorkOrder}
        technicians={technicians} // Pass technicians for selection in the modal
        onSave={handleEditSave}
      />
    </Dialog>
  );
};

export default DispatchFullscreenModal;
