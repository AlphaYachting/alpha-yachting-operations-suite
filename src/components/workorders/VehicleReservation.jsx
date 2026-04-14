import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, AlertCircle, Clock, CheckCircle2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function VehicleReservation({ workOrder, onReservationChange }) {
   const [reservation, setReservation] = useState(null);
   const [vehicles, setVehicles] = useState([]);
   const [loading, setLoading] = useState(true);
   const [showDialog, setShowDialog] = useState(false);
   const [selectedVehicle, setSelectedVehicle] = useState('');
   const [availableVehicles, setAvailableVehicles] = useState([]);
   const [checkingAvailability, setCheckingAvailability] = useState(false);
   const [conflicts, setConflicts] = useState([]);

   const hasSchedule = !!(workOrder?.scheduled_date && workOrder?.scheduled_start_time && workOrder?.scheduled_end_time);

  const getPlannedWindow = () => {
    if (!workOrder?.scheduled_date || !workOrder?.scheduled_start_time || !workOrder?.scheduled_end_time) return null;
    try {
      const startDatetime = `${workOrder.scheduled_date}T${workOrder.scheduled_start_time}:00`;
      const endDatetime = `${workOrder.scheduled_date}T${workOrder.scheduled_end_time}:00`;
      const startDate = new Date(startDatetime);
      const endDate = new Date(endDatetime);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
      return { start: startDatetime, end: endDatetime };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (workOrder?.id) {
      loadData();
    }
  }, [workOrder?.id]);

  const loadData = async () => {
    try {
      const [reservationsData, vehiclesData] = await Promise.all([
        base44.entities.InventoryReservation.filter({ 
          work_order_id: workOrder.id, 
          status: 'Reserved' 
        }),
        base44.entities.InventoryItem.filter({ item_type: 'VEHICLE', status: 'Active' })
      ]);
      if (reservationsData.length > 0) setReservation(reservationsData[0]);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Error loading vehicle data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = async () => {
    const window = getPlannedWindow();
    if (!window) return;

    setCheckingAvailability(true);
    try {
      const allReservations = await base44.entities.InventoryReservation.filter({ status: 'Reserved' });
      
      const available = [];
      const conflictMap = {};

      for (const vehicle of vehicles) {
        const vehicleReservations = allReservations.filter(r => 
          r.inventory_item_id === vehicle.id &&
          r.id !== reservation?.id // Exclude current reservation
        );

        const hasConflict = vehicleReservations.some(r => {
          const rStart = new Date(r.start_datetime).getTime();
          const rEnd = new Date(r.end_datetime).getTime();
          const wStart = new Date(window.start).getTime();
          const wEnd = new Date(window.end).getTime();
          
          return (wStart < rEnd && wEnd > rStart);
        });

        if (!hasConflict) {
          available.push(vehicle);
        } else {
          conflictMap[vehicle.id] = vehicleReservations.filter(r => {
            const rStart = new Date(r.start_datetime).getTime();
            const rEnd = new Date(r.end_datetime).getTime();
            const wStart = new Date(window.start).getTime();
            const wEnd = new Date(window.end).getTime();
            return (wStart < rEnd && wEnd > rStart);
          });
        }
      }

      setAvailableVehicles(available);
      setConflicts(conflictMap);
    } catch (error) {
      console.error('Error checking availability:', error);
      toast.error('Failed to check vehicle availability');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleOpenDialog = () => {
    if (!hasSchedule) {
      toast.error('Please set scheduled date and time first');
      return;
    }
    setShowDialog(true);
    checkAvailability();
  };

  const handleReserve = async () => {
    if (!selectedVehicle) {
      toast.error('Please select a vehicle');
      return;
    }

    const window = getPlannedWindow();
    if (!window) {
      toast.error('Invalid time window');
      return;
    }

    try {
      if (reservation) {
        await base44.entities.InventoryReservation.update(reservation.id, {
          inventory_item_id: selectedVehicle,
          start_datetime: window.start,
          end_datetime: window.end
        });
        toast.success('Vehicle reservation updated');
      } else {
        await base44.entities.InventoryReservation.create({
          inventory_item_id: selectedVehicle,
          work_order_id: workOrder.id,
          start_datetime: window.start,
          end_datetime: window.end,
          status: 'Reserved',
          quantity: 1
        });
        toast.success('Vehicle reserved');
      }
      
      await loadData();
      setShowDialog(false);
      setSelectedVehicle('');
      onReservationChange?.();
    } catch (error) {
      console.error('Error reserving vehicle:', error);
      toast.error('Failed to reserve vehicle');
    }
  };

  const handleRemove = async () => {
    if (!reservation) return;
    
    if (!confirm('Remove vehicle reservation?')) return;

    try {
      await base44.entities.InventoryReservation.update(reservation.id, { status: 'Cancelled' });
      setReservation(null);
      toast.success('Vehicle reservation removed');
      onReservationChange?.();
    } catch (error) {
      console.error('Error removing reservation:', error);
      toast.error('Failed to remove reservation');
    }
  };

  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.name} ${vehicle.license_plate ? `(${vehicle.license_plate})` : ''}` : 'Unknown';
  };

  if (!workOrder) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Vehicle Reservation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-12 bg-slate-100 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Vehicle Reservation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasSchedule ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Schedule required</p>
                <p className="text-sm text-slate-600">
                  Vehicle can be assigned only after scheduled date, start time, and end time are set.
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Edit this work order to set the schedule first.
                </p>
              </AlertDescription>
            </Alert>
          ) : reservation ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="font-semibold text-slate-900">Vehicle Reserved</p>
                  </div>
                  <p className="text-sm text-slate-700 mb-1">{getVehicleName(reservation.inventory_item_id)}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="h-3 w-3" />
                    <span>
                      {reservation?.start_datetime && format(parseISO(reservation.start_datetime), 'MMM d, yyyy h:mm a')} - 
                      {reservation?.end_datetime && format(parseISO(reservation.end_datetime), 'h:mm a')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleOpenDialog}>
                    Change
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRemove}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600 mb-3">No vehicle currently reserved for this work order.</p>
              <Button onClick={handleOpenDialog} className="bg-blue-600 hover:bg-blue-700">
                Reserve Vehicle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reserve Vehicle</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {(() => {
              const plannedWindow = getPlannedWindow();
              if (!plannedWindow) return <p className="text-sm text-red-600">Invalid time window</p>;
              return (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-1">Scheduled Time Window</p>
                  <p className="text-sm text-blue-700">
                    {format(parseISO(plannedWindow.start), 'MMM d, yyyy h:mm a')} - 
                    {format(parseISO(plannedWindow.end), 'h:mm a')}
                  </p>
                </div>
              );
            })()}

            {checkingAvailability ? (
              <div className="text-center py-8 text-slate-500">Checking availability...</div>
            ) : (
              <>
                {availableVehicles.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium">No vehicles available</p>
                      <p className="text-sm text-slate-600 mt-1">
                        All vehicles are reserved for this time window. Please adjust the schedule or check back later.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <Label>Select Vehicle *</Label>
                    <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an available vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVehicles.map(vehicle => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.name} {vehicle.license_plate && `(${vehicle.license_plate})`}
                            {vehicle.vehicle_type && ` - ${vehicle.vehicle_type}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      {availableVehicles.length} vehicle{availableVehicles.length !== 1 ? 's' : ''} available in this time window
                    </p>
                  </div>
                )}

                {Object.keys(conflicts).length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs font-medium text-slate-700 mb-2">Unavailable vehicles:</p>
                    <div className="space-y-1">
                      {Object.entries(conflicts).map(([vehicleId, conflictReservations]) => (
                        <div key={vehicleId} className="text-xs text-slate-600">
                          <span className="font-medium">{getVehicleName(vehicleId)}</span>: 
                          <span className="text-red-600 ml-1">{conflictReservations.length} conflict{conflictReservations.length !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleReserve} 
                disabled={!selectedVehicle || checkingAvailability}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {reservation ? 'Update Reservation' : 'Reserve Vehicle'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}