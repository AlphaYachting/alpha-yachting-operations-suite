import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Ship, Anchor } from 'lucide-react';

export default function CustomerPortal() {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // Find customer by email
      const customers = await base44.entities.Customer.filter({ email: userData.email });
      if (customers.length > 0) {
        const customerData = customers[0];
        setCustomer(customerData);

        // Load boats for this customer
        const boatsData = await base44.entities.Boat.filter({ customer_id: customerData.id });
        setBoats(boatsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Anchor className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome</h2>
            <p className="text-slate-600">
              No customer account found for {user?.email}. Please contact Alpha Yachting to set up your account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Welcome, {customer.first_name || customer.company_name}
          </h1>
          <p className="text-slate-600 text-lg">
            View the status of work on your vessels
          </p>
        </div>

        {/* Boats Grid */}
        {boats.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Ship className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-slate-900 mb-2">No Boats Found</h3>
              <p className="text-slate-600">
                No vessels are registered to your account yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boats.map(boat => (
              <Link key={boat.id} to={createPageUrl('CustomerBoatDetail') + `?boatId=${boat.id}`}>
                <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                        <Ship className="h-8 w-8 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-slate-900 mb-1">
                          {boat.vessel_name}
                        </h3>
                        <p className="text-sm text-slate-600 mb-2">
                          {boat.manufacturer} {boat.model}
                        </p>
                        {boat.year && (
                          <p className="text-xs text-slate-500">
                            {boat.year} • {boat.length_m}m
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}