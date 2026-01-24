import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Plus, 
  Search, 
  Ship,
  MoreHorizontal,
  MapPin,
  Ruler,
  Settings,
  ChevronRight,
  Anchor
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import BoatForm from '@/components/boats/BoatForm';

const typeColors = {
  Sailboat: 'bg-blue-100 text-blue-700',
  Motorboat: 'bg-amber-100 text-amber-700',
  Yacht: 'bg-purple-100 text-purple-700',
  Catamaran: 'bg-cyan-100 text-cyan-700',
  RIB: 'bg-emerald-100 text-emerald-700',
  Other: 'bg-slate-100 text-slate-700'
};

export default function Boats() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [boats, setBoats] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [editingBoat, setEditingBoat] = useState(null);
  const preselectedCustomerId = searchParams.get('customer');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [boatsData, customersData, locationsData] = await Promise.all([
        base44.entities.Boat.list('-created_date'),
        base44.entities.Customer.list(),
        base44.entities.Location.list()
      ]);
      setBoats(boatsData);
      setCustomers(customersData);
      setLocations(locationsData);
    } catch (error) {
      console.error('Error loading boats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (boatData) => {
    try {
      if (editingBoat) {
        await base44.entities.Boat.update(editingBoat.id, boatData);
      } else {
        await base44.entities.Boat.create(boatData);
      }
      await loadData();
      setShowForm(false);
      setEditingBoat(null);
      setSearchParams({});
    } catch (error) {
      console.error('Error saving boat:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this boat?')) {
      try {
        await base44.entities.Boat.delete(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting boat:', error);
      }
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return 'Unknown';
    return customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  };

  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || '';
  };

  const filteredBoats = boats.filter(boat => {
    const searchLower = searchTerm.toLowerCase();
    return boat.vessel_name?.toLowerCase().includes(searchLower) ||
      boat.model?.toLowerCase().includes(searchLower) ||
      boat.manufacturer?.toLowerCase().includes(searchLower) ||
      boat.engine_number?.toLowerCase().includes(searchLower) ||
      getCustomerName(boat.customer_id).toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Boats</h1>
          <p className="text-slate-500 mt-1">{boats.length} registered vessels</p>
        </div>
        <Button 
          onClick={() => { setEditingBoat(null); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Boat
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search boats..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Boats List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredBoats.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ship className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No boats found</h3>
            <p className="text-slate-500 mt-1">
              {searchTerm ? 'Try a different search term' : 'Add your first boat to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBoats.map((boat) => (
            <Card key={boat.id} className="hover:shadow-md transition-shadow overflow-hidden">
              {boat.photo_url ? (
                <div className="h-32 bg-slate-100">
                  <img 
                    src={boat.photo_url} 
                    alt={boat.vessel_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-32 bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
                  <Anchor className="h-12 w-12 text-blue-200" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link 
                        to={createPageUrl('BoatDetail') + `?id=${boat.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors truncate"
                      >
                        {boat.vessel_name}
                      </Link>
                      <Badge className={typeColors[boat.vessel_type]}>{boat.vessel_type}</Badge>
                    </div>
                    
                    {(boat.manufacturer || boat.model) && (
                      <p className="text-sm text-slate-600 mt-1 truncate">
                        {boat.manufacturer} {boat.model}
                      </p>
                    )}

                    <p className="text-sm text-slate-500 mt-1 truncate">
                      {getCustomerName(boat.customer_id)}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                      {boat.length_m && (
                        <div className="flex items-center gap-1">
                          <Ruler className="h-3 w-3" />
                          {boat.length_m}m
                        </div>
                      )}
                      {boat.current_location_id && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {getLocationName(boat.current_location_id)}
                        </div>
                      )}
                      {boat.engine_type && (
                        <div className="flex items-center gap-1">
                          <Settings className="h-3 w-3" />
                          {boat.engine_type}
                        </div>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={createPageUrl('BoatDetail') + `?id=${boat.id}`}>
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditingBoat(boat); setShowForm(true); }}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={createPageUrl('Jobs') + `?new=true&boat=${boat.id}`}>
                          Create Job
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(boat.id)}
                        className="text-red-600"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Boat Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingBoat(null); setSearchParams({}); }}}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBoat ? 'Edit Boat' : 'Add New Boat'}</DialogTitle>
          </DialogHeader>
          <BoatForm
            boat={editingBoat}
            customers={customers}
            locations={locations}
            preselectedCustomerId={preselectedCustomerId}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingBoat(null); setSearchParams({}); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}