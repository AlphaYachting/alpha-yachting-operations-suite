import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

// Target hours constants
const TARGET_HOURS = {
  today: 8,
  week: 40,
  month: 160
};

export default function CapacityModal({ open, onOpenChange }) {
  const [timeRange, setTimeRange] = useState('today');
  const [capacityData, setCapacityData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFullTable, setShowFullTable] = useState(false);

  useEffect(() => {
    if (open) {
      loadCapacityData();
    }
  }, [open, timeRange]);

  const getDateRange = () => {
    const now = new Date();
    
    switch (timeRange) {
      case 'today':
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case 'week':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }), // Monday
          end: endOfWeek(now, { weekStartsOn: 1 })
        };
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const loadCapacityData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { start, end } = getDateRange();
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      // Load all technicians
      const technicians = await base44.entities.Technician.list();

      // Load only work orders within the date range with assigned technicians
      // Query: scheduled_date between start and end, status not completed/cancelled
      const allWorkOrders = await base44.entities.WorkOrder.list('-scheduled_date', 500);
      
      const filteredWorkOrders = allWorkOrders.filter(wo => {
        if (!wo.scheduled_date) return false;
        if (['Completed', 'Cancelled'].includes(wo.status)) return false;
        
        const woDate = parseISO(wo.scheduled_date);
        return woDate >= start && woDate <= end;
      });

      // Calculate capacity per technician
      const capacityMap = {};

      technicians.forEach(tech => {
        capacityMap[tech.id] = {
          technician: tech,
          plannedHours: 0,
          workOrderCount: 0
        };
      });

      // Sum planned hours per technician
      filteredWorkOrders.forEach(wo => {
        if (!wo.assigned_technicians || wo.assigned_technicians.length === 0) return;

        // Calculate planned hours for this work order
        let plannedHours = 0;
        
        if (wo.estimated_duration_hours && wo.estimated_duration_hours > 0) {
          // Prefer estimated_duration_hours if available
          plannedHours = wo.estimated_duration_hours;
        } else if (wo.scheduled_start_time && wo.scheduled_end_time) {
          // Calculate from start/end times
          const [startHour, startMin] = wo.scheduled_start_time.split(':').map(Number);
          const [endHour, endMin] = wo.scheduled_end_time.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          plannedHours = (endMinutes - startMinutes) / 60;
        }

        // Assign to all assigned technicians
        wo.assigned_technicians.forEach(techId => {
          if (capacityMap[techId]) {
            capacityMap[techId].plannedHours += plannedHours;
            capacityMap[techId].workOrderCount += 1;
          }
        });
      });

      // Convert to array and calculate utilization
      const targetHours = TARGET_HOURS[timeRange];
      const dataArray = Object.values(capacityMap).map(item => {
        const { technician, plannedHours, workOrderCount } = item;
        
        let utilization = 'Free';
        if (plannedHours === 0) {
          utilization = 'Free';
        } else if (plannedHours < targetHours) {
          utilization = 'Planned';
        } else {
          utilization = 'Full';
        }

        return {
          technicianName: `${technician.first_name} ${technician.last_name}`,
          plannedHours: Math.round(plannedHours * 10) / 10, // Round to 1 decimal
          utilization,
          workOrderCount,
          isActive: technician.status === 'Active'
        };
      });

      // Sort: active first, then by name
      dataArray.sort((a, b) => {
        if (a.isActive !== b.isActive) return b.isActive - a.isActive;
        return a.technicianName.localeCompare(b.technicianName);
      });

      setCapacityData(dataArray);
    } catch (err) {
      console.error('Error loading capacity data:', err);
      setError('Failed to load capacity data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getUtilizationColor = (utilization) => {
    switch (utilization) {
      case 'Free':
        return 'bg-slate-100 text-slate-700';
      case 'Planned':
        return 'bg-blue-100 text-blue-700';
      case 'Full':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const displayData = showFullTable ? capacityData : capacityData.slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Capacity</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-slate-500">
              Target: {TARGET_HOURS[timeRange]}h
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-900">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadCapacityData}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-8 text-slate-500">
              Loading capacity data...
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-slate-700">Technician</th>
                      <th className="text-right p-3 text-sm font-medium text-slate-700">Planned Hours</th>
                      <th className="text-center p-3 text-sm font-medium text-slate-700">Utilization</th>
                      <th className="text-center p-3 text-sm font-medium text-slate-700">Work Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.map((item, idx) => (
                      <tr key={idx} className={`border-b last:border-0 ${!item.isActive ? 'opacity-50' : ''}`}>
                        <td className="p-3 text-sm text-slate-900">
                          {item.technicianName}
                          {!item.isActive && (
                            <span className="text-xs text-slate-500 ml-2">(Inactive)</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-slate-900 text-right font-medium">
                          {item.plannedHours}h
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={getUtilizationColor(item.utilization)}>
                            {item.utilization}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-slate-600 text-center">
                          {item.workOrderCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Show full table button */}
              {!showFullTable && capacityData.length > 10 && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowFullTable(true)}
                >
                  Ganze Statistik anzeigen ({capacityData.length} total)
                </Button>
              )}

              {/* Summary */}
              <div className="text-sm text-slate-500 text-center">
                {capacityData.filter(d => d.isActive).length} active technicians
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}