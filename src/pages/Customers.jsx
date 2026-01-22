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
  X
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold shrink-0">
                      {getDisplayName(customer).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
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
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                        {customer.email && (
                          <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-blue-600">
                            <Mail className="h-3.5 w-3.5" />
                            {customer.email}
                          </a>
                        )}
                        {customer.phone && (
                          <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-blue-600">
                            <Phone className="h-3.5 w-3.5" />
                            {customer.phone}
                          </a>
                        )}
                        <div className="flex items-center gap-1">
                          <Ship className="h-3.5 w-3.5" />
                          {getBoatCount(customer.id)} boat{getBoatCount(customer.id) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={createPageUrl('CustomerDetail') + `?id=${customer.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingCustomer(customer); setShowForm(true); }}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(customer.id)}
                          className="text-red-600"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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