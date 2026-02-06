import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Ship, Anchor, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function CustomerPortalSimulate() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const customerId = searchParams.get('customerId');

  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndLoad();
  }, [customerId]);

  const checkAuthAndLoad = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser?.role !== 'admin') {
        setLoading(false);
        return;
      }

      if (customerId) {
        await loadData();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth error:', error);
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const customerData = await base44.entities.Customer.filter({ id: customerId });
      if (customerData.length > 0) {
        setCustomer(customerData[0]);
        const boatsData = await base44.entities.Boat.filter({ customer_id: customerId });
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

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">Admin access required to view customer portal test.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Customer Not Found</h2>
            <p className="text-slate-600">Invalid customer ID</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = customer.company_name || 
    `${customer.first_name || ''} ${customer.last_name || ''}`.trim();

  const welcomeMessage = `Welcome, ${displayName}! You have ${boats.length} ${boats.length === 1 ? 'vessel' : 'vessels'}`;

  return (
    <>
      {/* Header with Technician Style */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{boats.length}</div>
                <div className="text-xs text-white/90">vessels</div>
              </div>
            </div>
            <div className="text-center flex-1 mx-4">
              <div className="text-3xl font-bold text-white">
                {format(new Date(), 'HH:mm')}
              </div>
              <div className="text-sm text-white/90">
                {format(new Date(), 'EEE, MMM d')}
              </div>
            </div>
            <div className="h-16 w-16 flex items-center justify-center">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972766f1bd9af32693610c1/c0a60bb17_AlphaYachtingLogoWhite.png"
                alt="Alpha Yachting"
                className="h-12 object-contain"
              />
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4">
            <p className="text-white text-center font-medium">{welcomeMessage}</p>
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-slate-50 pt-44">
        <div className="max-w-4xl mx-auto p-4">
          {/* Test Mode Banner */}
          <div className="mb-4 bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-700" />
              <p className="text-yellow-700 font-medium">
                TEST MODE - Viewing as: {displayName} ({customer.email})
              </p>
            </div>
          </div>

          {/* Boats List */}
          {boats.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <Ship className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-slate-900 mb-2">No Boats Found</h3>
              <p className="text-slate-600">
                No vessels are registered to this customer account.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 mb-4 px-1">Your Vessels</h2>
              {boats.map(boat => (
                <Link 
                  key={boat.id} 
                  to={createPageUrl('CustomerBoatDetailSimulate') + `?boatId=${boat.id}&customerId=${customerId}`}
                >
                  <Card className="hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                          <Ship className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-slate-900 mb-1">
                            {boat.vessel_name}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {boat.manufacturer} {boat.model} • {boat.year} • {boat.length_m}m
                          </p>
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
    </>
  );
}