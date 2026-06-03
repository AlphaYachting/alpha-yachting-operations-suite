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
  Anchor,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  Scan
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
import BoatFromRegistrationDialog from '@/components/boats/BoatFromRegistrationDialog';

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
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [prefillData, setPrefillData] = useState(null);
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
      alert('Failed to save boat: ' + error.message);
      throw error;
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

  const isDataComplete = (boat) => {
    return boat.vessel_name && 
           boat.vessel_type && 
           boat.manufacturer && 
           boat.model && 
           boat.length_m && 
           boat.engine_type &&
           boat.current_location_id;
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowScanDialog(true)}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Scan className="h-4 w-4 mr-2" />
            Aus Zulassungsschein
          </Button>
          <Button 
            onClick={() => { setEditingBoat(null); setPrefillData(null); setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Boat
          </Button>
        </div>
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
        <div className="grid gap-4">
          {filteredBoats.map((boat) => (
            <Card key={boat.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Boat Image */}
                    {boat.photo_url ? (
                      <div className="h-20 w-20 rounded-lg bg-slate-100 flex-shrink-0">
                        <img 
                          src={boat.photo_url} 
                          alt={boat.vessel_name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center flex-shrink-0">
                        <Anchor className="h-8 w-8 text-blue-200" />
                      </div>
                    )}

                    {/* Boat Details */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: Name, Type, Status */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Link 
                          to={createPageUrl('BoatDetail') + `?id=${boat.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {boat.vessel_name}
                        </Link>
                        <Badge className={typeColors[boat.vessel_type]}>{boat.vessel_type}</Badge>
                        {!isDataComplete(boat) && (
                          <Badge className="bg-amber-100 text-amber-700">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Incomplete
                          </Badge>
                        )}
                      </div>

                      {/* Row 2: Manufacturer/Model, Customer, Location, Engine */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                        {(boat.manufacturer || boat.model) && (
                          <span className="font-medium">
                            {boat.manufacturer} {boat.model}
                          </span>
                        )}
                        <span>•</span>
                        <span>{getCustomerName(boat.customer_id)}</span>
                        {boat.current_location_id && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {getLocationName(boat.current_location_id)}
                            </div>
                          </>
                        )}
                        {boat.length_m && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Ruler className="h-3 w-3" />
                              {boat.length_m}m
                            </div>
                          </>
                        )}
                        {boat.engine_type && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Settings className="h-3 w-3" />
                              {boat.engine_type}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="h-7 w-7 p-0"
                    >
                      <Link to={createPageUrl('BoatDetail') + `?id=${boat.id}`}>
                        <Eye className="h-3 w-3" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingBoat(boat); setShowForm(true); }}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(boat.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Boat Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingBoat(null); setPrefillData(null); setSearchParams({}); }}}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBoat ? 'Edit Boat' : 'Add New Boat'}</DialogTitle>
          </DialogHeader>
          <BoatForm
            boat={editingBoat || prefillData}
            customers={customers}
            locations={locations}
            preselectedCustomerId={preselectedCustomerId}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingBoat(null); setPrefillData(null); setSearchParams({}); }}
          />
        </DialogContent>
      </Dialog>

      {/* Scan Registration Dialog */}
      <BoatFromRegistrationDialog
        open={showScanDialog}
        onOpenChange={setShowScanDialog}
        onDataExtracted={(data) => {
          setPrefillData(data);
          setEditingBoat(null);
          setShowForm(true);
        }}
      />
    </div>
  );
}