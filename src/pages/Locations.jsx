import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Plus, 
  Search, 
  MapPin,
  MoreHorizontal,
  Phone,
  Clock,
  Building2,
  Star
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
import LocationForm from '@/components/locations/LocationForm';

const typeColors = {
  Marina: 'bg-blue-100 text-blue-700',
  'Dry Marina': 'bg-amber-100 text-amber-700',
  Anchorage: 'bg-cyan-100 text-cyan-700',
  Yard: 'bg-purple-100 text-purple-700',
  'Alpha Base': 'bg-emerald-100 text-emerald-700',
  Other: 'bg-slate-100 text-slate-700'
};

const regionColors = {
  Istria: 'bg-orange-100 text-orange-700',
  Slovenia: 'bg-green-100 text-green-700',
  'North Italy': 'bg-red-100 text-red-700',
  Other: 'bg-slate-100 text-slate-700'
};

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const locationsData = await base44.entities.Location.list('name');
      setLocations(locationsData);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (locationData) => {
    try {
      if (editingLocation) {
        await base44.entities.Location.update(editingLocation.id, locationData);
      } else {
        await base44.entities.Location.create(locationData);
      }
      await loadData();
      setShowForm(false);
      setEditingLocation(null);
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location: ' + error.message);
      throw error;
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      try {
        await base44.entities.Location.delete(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting location:', error);
      }
    }
  };

  const filteredLocations = locations.filter(location => {
    const searchLower = searchTerm.toLowerCase();
    return location.name?.toLowerCase().includes(searchLower) ||
      location.city?.toLowerCase().includes(searchLower) ||
      location.region?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Locations</h1>
          <p className="text-slate-500 mt-1">{locations.length} marinas & locations</p>
        </div>
        <Button 
          onClick={() => { setEditingLocation(null); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search locations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Locations List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filteredLocations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No locations found</h3>
            <p className="text-slate-500 mt-1">Add your first location to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLocations.map((location) => (
            <Card key={location.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{location.name}</span>
                      {location.is_partner && (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge className={typeColors[location.location_type]}>{location.location_type}</Badge>
                      <Badge className={regionColors[location.region]}>{location.region}</Badge>
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-slate-500">
                      {(location.city || location.address) && (
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="truncate">
                            {location.address && `${location.address}, `}{location.city}
                          </span>
                        </div>
                      )}
                      {location.contact_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0" />
                          <a href={`tel:${location.contact_phone}`} className="hover:text-blue-600">
                            {location.contact_phone}
                          </a>
                        </div>
                      )}
                      {location.opening_hours && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 shrink-0" />
                          <span className="truncate">{location.opening_hours}</span>
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
                      <DropdownMenuItem onClick={() => { setEditingLocation(location); setShowForm(true); }}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(location.id)}
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

      {/* Location Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingLocation(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add New Location'}</DialogTitle>
          </DialogHeader>
          <LocationForm
            location={editingLocation}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingLocation(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}