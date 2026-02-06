import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Eye, Search } from 'lucide-react';

export default function CustomerPortalTest() {
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersData, boatsData] = await Promise.all([
        base44.entities.Customer.list(),
        base44.entities.Boat.list()
      ]);
      setCustomers(customersData);
      setBoats(boatsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCustomerBoats = (customerId) => {
    return boats.filter(b => b.customer_id === customerId);
  };



  const filteredCustomers = customers.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    return (
      c.company_name?.toLowerCase().includes(searchLower) ||
      c.first_name?.toLowerCase().includes(searchLower) ||
      c.last_name?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Customer Portal Test</h1>
        <p className="text-slate-600 mt-1">Simulate customer portal view for any customer</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <div className="grid gap-4">
        {filteredCustomers.map(customer => {
          const customerBoats = getCustomerBoats(customer.id);
          const displayName = customer.company_name || 
            `${customer.first_name || ''} ${customer.last_name || ''}`.trim();

          return (
            <Card key={customer.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center flex-shrink-0">
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 mb-1">{displayName}</h3>
                      <p className="text-sm text-slate-600 mb-2">{customer.email}</p>
                      <p className="text-xs text-slate-500">
                        {customerBoats.length} boat{customerBoats.length !== 1 ? 's' : ''} registered
                      </p>
                    </div>
                  </div>
                  <Link to={createPageUrl('CustomerPortalSimulate') + '?customerId=' + customer.id}>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Eye className="h-4 w-4 mr-2" />
                      View Portal
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}