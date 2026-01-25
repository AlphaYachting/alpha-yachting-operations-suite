import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Search, Truck, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import VehicleForm from '@/components/inventory/VehicleForm';

const statusColors = {
  Active: 'bg-green-100 text-green-700',
  Maintenance: 'bg-amber-100 text-amber-700',
  Retired: 'bg-slate-100 text-slate-700'
};

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vehiclesData, assignmentsData, techsData] = await Promise.all([
        base44.entities.InventoryItem.filter({ item_type: 'VEHICLE' }),
        base44.entities.InventoryAssignment.filter({ status: 'Active' }),
        base44.entities.Technician.list()
      ]);
      setVehicles(vehiclesData);
      setAssignments(assignmentsData);
      setTechnicians(techsData);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (vehicleData) => {
    try {
      if (editingVehicle) {
        await base44.entities.InventoryItem.update(editingVehicle.id, vehicleData);
      } else {
        await base44.entities.InventoryItem.create(vehicleData);
      }
      await loadData();
      setShowForm(false);
      setEditingVehicle(null);
    } catch (error) {
      console.error('Error saving vehicle:', error);
    }
  };

  const getAssignedTechnician = (vehicleId) => {
    const assignment = assignments.find(a => a.inventory_item_id === vehicleId);
    if (!assignment) return null;
    const tech = technicians.find(t => t.id === assignment.technician_id);
    return tech ? `${tech.first_name} ${tech.last_name}` : null;
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.make?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vehicles</h1>
          <p className="text-slate-500 mt-1">{vehicles.length} total vehicles</p>
        </div>
        <Button onClick={() => { setEditingVehicle(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search vehicles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Maintenance">Maintenance</SelectItem>
            <SelectItem value="Retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : filteredVehicles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No vehicles found</h3>
            <p className="text-slate-500 mt-1">Add your first vehicle to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredVehicles.map((vehicle) => {
            const assignedTech = getAssignedTechnician(vehicle.id);
            return (
              <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          to={createPageUrl('VehicleDetail') + `?id=${vehicle.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {vehicle.name}
                        </Link>
                        <Badge className={statusColors[vehicle.status]}>{vehicle.status}</Badge>
                        {vehicle.license_plate && (
                          <Badge variant="outline" className="font-mono">{vehicle.license_plate}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        {vehicle.make && <span>{vehicle.make} {vehicle.model}</span>}
                        {vehicle.year && <span>• {vehicle.year}</span>}
                        {vehicle.vehicle_type && <span>• {vehicle.vehicle_type}</span>}
                      </div>
                      {assignedTech && (
                        <div className="mt-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Assigned to: {assignedTech}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingVehicle(vehicle); setShowForm(true); }}
                    >
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingVehicle(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
          </DialogHeader>
          <VehicleForm
            vehicle={editingVehicle}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingVehicle(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}