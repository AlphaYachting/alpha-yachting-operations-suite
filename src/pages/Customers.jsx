import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Plus, 
  Search, 
  Users,
  Phone,
  Mail,
  Building2,
  MoreHorizontal,
  Ship,
  ChevronRight,
  X,
  AlertCircle,
  Eye,
  Edit,
  Trash2
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
import CustomerForm from '@/components/customers/CustomerForm';

const statusColors = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-slate-100 text-slate-700',
  VIP: 'bg-amber-100 text-amber-700',
  Blocked: 'bg-red-100 text-red-700'
};

export default function Customers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [editingCustomer, setEditingCustomer] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersData, boatsData] = await Promise.all([
        base44.entities.Customer.list('-created_date'),
        base44.entities.Boat.list()
      ]);
      setCustomers(customersData);
      setBoats(boatsData);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (customerData) => {
    try {
      if (editingCustomer) {
        await base44.entities.Customer.update(editingCustomer.id, customerData);
      } else {
        await base44.entities.Customer.create(customerData);
      }
      await loadData();
      setShowForm(false);
      setEditingCustomer(null);
      setSearchParams({});
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await base44.entities.Customer.delete(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting customer:', error);
      }
    }
  };

  const getBoatCount = (customerId) => {
    return boats.filter(b => b.customer_id === customerId).length;
  };

  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    const name = `${customer.first_name || ''} ${customer.last_name || ''} ${customer.company_name || ''}`.toLowerCase();
    return name.includes(searchLower) || customer.email?.toLowerCase().includes(searchLower);
  });

  const getDisplayName = (customer) => {
    if (customer.company_name) return customer.company_name;
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unnamed';
  };

  const isDataComplete = (customer) => {
    // Check if all required fields are filled
    return customer.first_name && 
           customer.last_name && 
           customer.email && 
           customer.phone && 
           customer.billing_address && 
           customer.billing_city &&
           customer.billing_country;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 mt-1">{customers.length} total customers</p>
        </div>
        <Button 
          onClick={() => { setEditingCustomer(null); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No customers found</h3>
            <p className="text-slate-500 mt-1">
              {searchTerm ? 'Try a different search term' : 'Add your first customer to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Customer Avatar */}
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-xl flex-shrink-0">
                      {getDisplayName(customer).charAt(0).toUpperCase()}
                    </div>

                    {/* Customer Details */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: Name, Status, Type, Incomplete Badge */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Link 
                          to={createPageUrl('CustomerDetail') + `?id=${customer.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {getDisplayName(customer)}
                        </Link>
                        <Badge className={statusColors[customer.status]}>{customer.status}</Badge>
                        {customer.customer_type && customer.customer_type !== 'Private' && (
                          <Badge variant="outline">{customer.customer_type}</Badge>
                        )}
                        {!isDataComplete(customer) && (
                          <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Incomplete
                          </Badge>
                        )}
                      </div>

                      {/* Row 2: Contact Info & Boat Count */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                        {customer.email && (
                          <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-blue-600">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </a>
                        )}
                        {customer.phone && (
                          <>
                            {customer.email && <span>•</span>}
                            <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-blue-600">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </a>
                          </>
                        )}
                        {(customer.email || customer.phone) && <span>•</span>}
                        <div className="flex items-center gap-1">
                          <Ship className="h-3 w-3" />
                          <span>{getBoatCount(customer.id)} boat{getBoatCount(customer.id) !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Row 3: Location (if available) */}
                      {(customer.billing_city || customer.billing_country) && (
                        <div className="mt-1 text-xs text-slate-500">
                          <Building2 className="h-3 w-3 inline mr-1" />
                          {customer.billing_city && customer.billing_country && `${customer.billing_city}, ${customer.billing_country}`}
                          {customer.billing_city && !customer.billing_country && customer.billing_city}
                          {!customer.billing_city && customer.billing_country && customer.billing_country}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link to={createPageUrl('CustomerDetail') + `?id=${customer.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingCustomer(customer); setShowForm(true); }}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(customer.id)}
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

      {/* Customer Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingCustomer(null); setSearchParams({}); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={editingCustomer}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingCustomer(null); setSearchParams({}); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}