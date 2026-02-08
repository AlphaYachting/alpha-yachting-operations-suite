import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function getAgingLevel(lead) {
  if (!lead.created_date) return 'none';
  const createdDate = new Date(lead.created_date);
  const now = new Date();
  const daysSinceCreated = (now - createdDate) / (1000 * 60 * 60 * 24);
  
  if (daysSinceCreated > 5) return 'danger';
  if (daysSinceCreated > 3) return 'warn';
  return 'none';
}

export function useLeadData() {
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [allLeads, allCustomers, allLocations] = await Promise.all([
        base44.entities.Lead.list('-created_date'),
        base44.entities.Customer.list(),
        base44.entities.Location.list(),
      ]);
      setLeads(allLeads);
      setCustomers(allCustomers);
      setLocations(allLocations);
    } catch (err) {
      setError(err.message);
      console.error('Error loading lead data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeadsOnly = async () => {
    try {
      const allLeads = await base44.entities.Lead.list('-created_date');
      setLeads(allLeads);
    } catch (err) {
      console.error('Error refetching leads:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      await base44.entities.Lead.update(leadId, { status: newStatus });
      await fetchLeadsOnly();
    } catch (err) {
      console.error('Error updating lead status:', err);
      throw err;
    }
  };

  const saveLead = async (leadData) => {
    try {
      if (leadData.id) {
        // Edit existing
        await base44.entities.Lead.update(leadData.id, leadData);
      } else {
        // Create new
        await base44.entities.Lead.create(leadData);
      }
      await fetchLeadsOnly();
    } catch (err) {
      console.error('Error saving lead:', err);
      throw err;
    }
  };

  const deleteLead = async (leadId) => {
    try {
      await base44.entities.Lead.delete(leadId);
      setLeads(leads.filter((l) => l.id !== leadId));
    } catch (err) {
      console.error('Error deleting lead:', err);
      throw err;
    }
  };

  return {
    leads,
    customers,
    locations,
    isLoading,
    error,
    refetchLeads: fetchLeadsOnly,
    refetchAll: fetchAllData,
    updateLeadStatus,
    saveLead,
    deleteLead,
  };
}