import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import CustomerHeader from '@/components/customer/CustomerHeader';
import CustomerWelcome from '@/components/customer/CustomerWelcome';
import CustomerJobList from '@/components/customer/CustomerJobList';

export default function CustomerDashboard() {
  const [customer, setCustomer] = useState(null);
  const [boats, setBoats] = useState([]);
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

        const [boatsData, jobsData, photosData, commentsData] = await Promise.all([
          base44.entities.Boat.filter({ customer_id: cust.id }),
          base44.entities.Job.filter({ customer_id: cust.id }),
          base44.entities.WorkOrderPhoto.list(),
          base44.entities.WorkOrderComment.list()
        ]);

        setBoats(boatsData);
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

  const activeJobs = jobs.filter(j => j.status !== 'Cancelled');
  const welcomeMessage = `Welcome, ${customerName}! You have ${activeJobs.length} ${activeJobs.length === 1 ? 'project' : 'projects'} on your ${boats.length} ${boats.length === 1 ? 'vessel' : 'vessels'}`;

  return (
    <>
      <CustomerHeader 
        jobCount={activeJobs.length} 
        welcomeMessage={welcomeMessage}
        customerName={customerName}
      />
      <div className="min-h-screen bg-slate-50 pt-44">
        <div className="max-w-4xl mx-auto p-4">
          <CustomerJobList jobs={jobs} photos={photos} comments={comments} boats={boats} />
        </div>
      </div>
    </>
  );
}