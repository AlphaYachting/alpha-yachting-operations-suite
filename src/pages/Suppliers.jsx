import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Building2, Package, Wrench, Globe, Mail, Phone, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SupplierForm from '@/components/suppliers/SupplierForm';

const typeColors = {
  PRODUCT: 'bg-blue-100 text-blue-800',
  WORK: 'bg-purple-100 text-purple-800',
  BOTH: 'bg-green-100 text-green-800'
};

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-slate-100 text-slate-600'
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [hasPortalFilter, setHasPortalFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [suppliersData, contactsData, portalsData] = await Promise.all([
        base44.entities.Supplier.list('-created_date'),
        base44.entities.SupplierContact.list(),
        base44.entities.SupplierPortal.list()
      ]);
      setSuppliers(suppliersData);
      setContacts(contactsData);
      setPortals(portalsData);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
    setLoading(false);
  };

  const getPrimaryContact = (supplierId) => {
    const supplierContacts = contacts.filter(c => c.supplier_id === supplierId);
    const primary = supplierContacts.find(c => c.is_primary);
    return primary || supplierContacts[0];
  };

  const hasPortal = (supplierId) => {
    return portals.some(p => p.supplier_id === supplierId);
  };

  const countries = [...new Set(suppliers.map(s => s.country).filter(Boolean))].sort();

  const filteredSuppliers = suppliers.filter(supplier => {
    // Search filter
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || 
      supplier.supplier_name?.toLowerCase().includes(searchLower) ||
      supplier.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
      contacts.filter(c => c.supplier_id === supplier.id)
        .some(c => c.name?.toLowerCase().includes(searchLower)) ||
      portals.filter(p => p.supplier_id === supplier.id)
        .some(p => p.portal_name?.toLowerCase().includes(searchLower) || p.username?.toLowerCase().includes(searchLower));

    // Type filter
    const matchesType = typeFilter === 'all' || supplier.type === typeFilter;

    // Status filter
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;

    // Country filter
    const matchesCountry = countryFilter === 'all' || supplier.country === countryFilter;

    // Has portal filter
    const matchesPortal = hasPortalFilter === 'all' || 
      (hasPortalFilter === 'yes' && hasPortal(supplier.id)) ||
      (hasPortalFilter === 'no' && !hasPortal(supplier.id));

    return matchesSearch && matchesType && matchesStatus && matchesCountry && matchesPortal;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading suppliers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Supplier Hub</h1>
          <p className="text-slate-500 mt-1">Manage suppliers, contacts, portals, and terms</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search suppliers, tags, contacts, portals..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PRODUCT">Product</SelectItem>
                <SelectItem value="WORK">Work</SelectItem>
                <SelectItem value="BOTH">Both</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map(country => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={hasPortalFilter} onValueChange={setHasPortalFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Portal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Has Portal</SelectItem>
                <SelectItem value="no">No Portal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-slate-500">
        {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''} found
      </div>

      {/* Suppliers Grid */}
      <div className="grid gap-4">
        {filteredSuppliers.map(supplier => {
          const primaryContact = getPrimaryContact(supplier.id);
          const supplierPortals = portals.filter(p => p.supplier_id === supplier.id);

          return (
            <Link
              key={supplier.id}
              to={createPageUrl('SupplierDetail') + `?id=${supplier.id}`}
              className="block"
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Building2 className="w-5 h-5 text-slate-400" />
                        <h3 className="text-lg font-semibold text-slate-900">
                          {supplier.supplier_name}
                        </h3>
                        <Badge className={typeColors[supplier.type]}>
                          {supplier.type}
                        </Badge>
                        <Badge className={statusColors[supplier.status]}>
                          {supplier.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Country</div>
                          <div className="text-sm font-medium">{supplier.country}</div>
                        </div>

                        {primaryContact && (
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Primary Contact</div>
                            <div className="text-sm font-medium">{primaryContact.name}</div>
                            {primaryContact.email && (
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3" />
                                {primaryContact.email}
                              </div>
                            )}
                          </div>
                        )}

                        {supplierPortals.length > 0 && (
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Portal Access</div>
                            <div className="text-sm font-medium flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {supplierPortals.length} portal{supplierPortals.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        )}
                      </div>

                      {supplier.tags && supplier.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {supplier.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {filteredSuppliers.length === 0 && (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No suppliers found</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or add a new supplier</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
          </DialogHeader>
          <SupplierForm
            onSuccess={() => {
              setDialogOpen(false);
              loadData();
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}