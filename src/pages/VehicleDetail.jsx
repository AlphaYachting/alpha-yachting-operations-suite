import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Truck, User, Calendar, Clock, AlertCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

const statusColors = {
  Active: 'bg-green-100 text-green-700',
  Maintenance: 'bg-amber-100 text-amber-700',
  Retired: 'bg-slate-100 text-slate-700'
};

export default function VehicleDetail() {
  const [searchParams] = useSearchParams();
  const vehicleId = searchParams.get('id');
  const [vehicle, setVehicle] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState({ technician_id: '', assigned_from: '', assigned_to: '' });

  useEffect(() => {
    if (vehicleId) loadData();
  }, [vehicleId]);

  const loadData = async () => {
    try {
      const [vehicleData, assignmentsData, reservationsData, techsData] = await Promise.all([
        base44.entities.InventoryItem.filter({ id: vehicleId }),
        base44.entities.InventoryAssignment.filter({ inventory_item_id: vehicleId }),
        base44.entities.InventoryReservation.filter({ inventory_item_id: vehicleId, status: 'Reserved' }, '-start_datetime'),
        base44.entities.Technician.list()
      ]);
      if (vehicleData.length > 0) setVehicle(vehicleData[0]);
      setAssignments(assignmentsData);
      setReservations(reservationsData);
      setTechnicians(techsData);
    } catch (error) {
      console.error('Error loading vehicle details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignForm.technician_id) {
      toast.error('Please select a technician');
      return;
    }
    try {
      const activeAssignments = assignments.filter(a => a.status === 'Active');
      if (activeAssignments.length > 0) {
        await base44.entities.InventoryAssignment.update(activeAssignments[0].id, { status: 'Ended', assigned_to: new Date().toISOString() });
      }
      await base44.entities.InventoryAssignment.create({
        inventory_item_id: vehicleId,
        technician_id: assignForm.technician_id,
        assigned_from: assignForm.assigned_from || new Date().toISOString(),
        assigned_to: assignForm.assigned_to || null,
        status: 'Active'
      });
      await loadData();
      setShowAssignDialog(false);
      setAssignForm({ technician_id: '', assigned_from: '', assigned_to: '' });
      toast.success('Vehicle assigned');
    } catch (error) {
      console.error('Error assigning vehicle:', error);
      toast.error('Failed to assign vehicle');
    }
  };

  const handleUnassign = async (assignmentId) => {
    try {
      await base44.entities.InventoryAssignment.update(assignmentId, { status: 'Ended', assigned_to: new Date().toISOString() });
      await loadData();
      toast.success('Vehicle unassigned');
    } catch (error) {
      console.error('Error unassigning vehicle:', error);
      toast.error('Failed to unassign vehicle');
    }
  };

  const getTechnicianName = (techId) => {
    const tech = technicians.find(t => t.id === techId);
    return tech ? `${tech.first_name} ${tech.last_name}` : 'Unknown';
  };

  const activeAssignment = assignments.find(a => a.status === 'Active');

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">Vehicle not found</h3>
        <Button asChild className="mt-4"><Link to={createPageUrl('Vehicles')}><ArrowLeft className="h-4 w-4 mr-2" />Back to Vehicles</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Button asChild variant="ghost" size="sm" className="mb-3">
            <Link to={createPageUrl('Vehicles')}><ArrowLeft className="h-4 w-4 mr-2" />Back to Vehicles</Link>
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{vehicle.name}</h1>
            <Badge className={statusColors[vehicle.status]}>{vehicle.status}</Badge>
            {vehicle.license_plate && <Badge variant="outline" className="font-mono">{vehicle.license_plate}</Badge>}
          </div>
          <p className="text-slate-500 mt-1">{vehicle.make} {vehicle.model} {vehicle.year && `• ${vehicle.year}`}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Truck className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Vehicle Type</p>
                <p className="text-sm font-semibold text-slate-900">{vehicle.vehicle_type || 'Not specified'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><User className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Assigned To</p>
                <p className="text-sm font-semibold text-slate-900">{activeAssignment ? getTechnicianName(activeAssignment.technician_id) : 'Unassigned'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100"><Calendar className="h-5 w-5 text-violet-600" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Upcoming Reservations</p>
                <p className="text-sm font-semibold text-slate-900">{reservations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Vehicle Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {vehicle.vin && <div className="grid grid-cols-4 gap-2"><span className="text-sm font-medium text-slate-700">VIN:</span><span className="text-sm text-slate-600 col-span-3">{vehicle.vin}</span></div>}
          {vehicle.fuel_type && <div className="grid grid-cols-4 gap-2"><span className="text-sm font-medium text-slate-700">Fuel Type:</span><span className="text-sm text-slate-600 col-span-3">{vehicle.fuel_type}</span></div>}
          {vehicle.location_base && <div className="grid grid-cols-4 gap-2"><span className="text-sm font-medium text-slate-700">Base Location:</span><span className="text-sm text-slate-600 col-span-3">{vehicle.location_base}</span></div>}
          {vehicle.capacity_notes && <div className="grid grid-cols-4 gap-2"><span className="text-sm font-medium text-slate-700">Capacity:</span><span className="text-sm text-slate-600 col-span-3">{vehicle.capacity_notes}</span></div>}
          {vehicle.insurance_expiry && <div className="grid grid-cols-4 gap-2"><span className="text-sm font-medium text-slate-700">Insurance Expiry:</span><span className="text-sm text-slate-600 col-span-3">{format(parseISO(vehicle.insurance_expiry), 'MMM d, yyyy')}</span></div>}
          {vehicle.maintenance_due_date && <div className="grid grid-cols-4 gap-2"><span className="text-sm font-medium text-slate-700">Maintenance Due:</span><span className="text-sm text-slate-600 col-span-3">{format(parseISO(vehicle.maintenance_due_date), 'MMM d, yyyy')}</span></div>}
          {vehicle.notes && <div className="grid grid-cols-4 gap-2"><span className="text-sm font-medium text-slate-700">Notes:</span><span className="text-sm text-slate-600 col-span-3">{vehicle.notes}</span></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Assignment</CardTitle>
          <Button onClick={() => setShowAssignDialog(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />Assign Technician
          </Button>
        </CardHeader>
        <CardContent>
          {activeAssignment ? (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{getTechnicianName(activeAssignment.technician_id)}</p>
                  <p className="text-sm text-slate-600 mt-1">Assigned {format(parseISO(activeAssignment.assigned_from || activeAssignment.created_date), 'MMM d, yyyy')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleUnassign(activeAssignment.id)}>Unassign</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">Not currently assigned to any technician</p>
          )}
          {assignments.filter(a => a.status === 'Ended').length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-slate-500 font-medium uppercase mb-2">Assignment History</p>
              <div className="space-y-2">
                {assignments.filter(a => a.status === 'Ended').slice(0, 5).map(a => (
                  <div key={a.id} className="text-sm text-slate-600">
                    {getTechnicianName(a.technician_id)} • {format(parseISO(a.assigned_from || a.created_date), 'MMM d')} - {a.assigned_to ? format(parseISO(a.assigned_to), 'MMM d, yyyy') : 'Now'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Upcoming Reservations ({reservations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No upcoming reservations</p>
          ) : (
            <div className="space-y-3">
              {reservations.map(res => (
                <div key={res.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{format(parseISO(res.start_datetime), 'MMM d, yyyy h:mm a')} - {format(parseISO(res.end_datetime), 'h:mm a')}</p>
                      {res.work_order_id && <p className="text-sm text-slate-600 mt-1">Work Order #{res.work_order_id.slice(-6)}</p>}
                      {res.notes && <p className="text-sm text-slate-500 mt-1">{res.notes}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Vehicle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Technician *</Label>
              <Select value={assignForm.technician_id} onValueChange={(v) => setAssignForm(prev => ({ ...prev, technician_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                <SelectContent>
                  {technicians.filter(t => t.status === 'Active').map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>{tech.first_name} {tech.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From (Optional)</Label>
                <Input type="datetime-local" value={assignForm.assigned_from} onChange={(e) => setAssignForm(prev => ({ ...prev, assigned_from: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>To (Optional)</Label>
                <Input type="datetime-local" value={assignForm.assigned_to} onChange={(e) => setAssignForm(prev => ({ ...prev, assigned_to: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
              <Button onClick={handleAssign} className="bg-blue-600 hover:bg-blue-700">Assign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}