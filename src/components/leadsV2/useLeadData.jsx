import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { notifyLeadAssignment } from '@/components/notifications/notificationUtils';

export function getAgingLevel(lead) {
  if (lead.status === 'Converted' || lead.status === 'Lost') return 'none';
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
  const [users, setUsers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [allLeads, allCustomers, allLocations, allUsers, allBoats] = await Promise.all([
        base44.entities.Lead.list('-created_date'),
        base44.entities.Customer.list(),
        base44.entities.Location.list(),
        base44.entities.User.list(),
        base44.entities.Boat.list(),
      ]);
      
      // Flatten entity structure: merge id, created_date, updated_date from root with data fields
      const flattenEntity = (entity) => ({
        ...entity.data,
        id: entity.id,
        created_date: entity.created_date,
        updated_date: entity.updated_date,
        created_by: entity.created_by
      });
      
      setLeads((allLeads || []).map(flattenEntity));
      setCustomers((allCustomers || []).map(flattenEntity));
      setLocations((allLocations || []).map(flattenEntity));
      setUsers((allUsers || []).map(flattenEntity));
      setBoats((allBoats || []).map(flattenEntity));
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
      const flattenEntity = (entity) => ({
        ...entity.data,
        id: entity.id,
        created_date: entity.created_date,
        updated_date: entity.updated_date,
        created_by: entity.created_by
      });
      setLeads((allLeads || []).map(flattenEntity));
    } catch (err) {
      console.error('Error refetching leads:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const updateLeadStatus = async (leadId, newStatus) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) throw new Error('Lead not found');

    try {
      // Handle conversion to customer
      if (newStatus === 'Converted') {
        // Parse name into first/last
        const nameParts = (lead.name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Create Customer
        const customerData = {
          first_name: firstName,
          last_name: lastName,
          email: lead.email || '',
          phone: lead.phone || '',
          notes: lead.notes || '',
        };
        const newCustomer = await base44.entities.Customer.create(customerData);

        // Create Boat if boat_name exists
        let newBoat = null;
        if (lead.boat_name) {
          const boatData = {
            customer_id: newCustomer.id,
            vessel_name: lead.boat_name,
            current_location_id: lead.location_id || null,
            known_issues: lead.boat_details || '',
          };
          newBoat = await base44.entities.Boat.create(boatData);
        }

        // Update Lead with conversion data
        await base44.entities.Lead.update(leadId, {
          status: 'Converted',
          converted_customer_id: newCustomer.id,
          converted_boat_id: newBoat?.id || null,
          converted_at: new Date().toISOString(),
          customer_id: newCustomer.id,
        });
      } else {
        // Simple status update
        await base44.entities.Lead.update(leadId, { status: newStatus });
      }

      await fetchAllData();
    } catch (err) {
      console.error('Error updating lead status:', err);
      throw err;
    }
  };

  const saveLead = async (leadData) => {
    try {
      const oldLead = leadData.id ? leads.find(l => l.id === leadData.id) : null;
      const previousAssignedUserId = oldLead?.assigned_to_user_id;
      const newAssignedUserId = leadData.assigned_to_user_id;

      let savedLead;
      if (leadData.id) {
        // Edit existing
        await base44.entities.Lead.update(leadData.id, leadData);
        savedLead = { ...leadData };
      } else {
        // Create new
        savedLead = await base44.entities.Lead.create(leadData);
      }

      await fetchLeadsOnly();

      // Trigger notification if assignment changed
      if (newAssignedUserId && newAssignedUserId !== previousAssignedUserId) {
        const assignedUser = users.find(u => u.id === newAssignedUserId);
        if (assignedUser) {
          await notifyLeadAssignment(savedLead, assignedUser);
        }
      }
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
    users,
    boats,
    isLoading,
    error,
    refetchLeads: fetchLeadsOnly,
    refetchAll: fetchAllData,
    updateLeadStatus,
    saveLead,
    deleteLead,
  };
}