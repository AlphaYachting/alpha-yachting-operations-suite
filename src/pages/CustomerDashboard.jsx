import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import CustomerHeader from '@/components/customer/CustomerHeader';
import CustomerWelcome from '@/components/customer/CustomerWelcome';
import CustomerJobList from '@/components/customer/CustomerJobList';

export default function CustomerDashboard() {
  const [customer, setCustomer] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const customerData = await base44.entities.Customer.filter({ email: user.email });
      
      if (customerData.length > 0) {
        const cust = customerData[0];
        setCustomer(cust);

        const [jobsData, photosData, commentsData] = await Promise.all([
          base44.entities.Job.filter({ customer_id: cust.id }),
          base44.entities.WorkOrderPhoto.list(),
          base44.entities.WorkOrderComment.list()
        ]);

        setJobs(jobsData);
        setPhotos(photosData);
        setComments(commentsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <CustomerHeader />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 pt-16 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }

  if (!customer) {
    return (
      <>
        <CustomerHeader />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 pt-16 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No Customer Account</h2>
            <p className="text-slate-600">
              No customer account found for your email address.
            </p>
          </div>
        </div>
      </>
    );
  }

  const customerName = customer.company_name || 
    `${customer.first_name || ''} ${customer.last_name || ''}`.trim();

  return (
    <>
      <CustomerHeader />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 pt-16">
        <div className="max-w-6xl mx-auto p-6">
          <CustomerWelcome customerName={customerName} />
          <CustomerJobList jobs={jobs} photos={photos} comments={comments} />
        </div>
      </div>
    </>
  );
}