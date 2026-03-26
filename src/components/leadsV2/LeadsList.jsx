import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import LeadCard from './LeadCard';

export default function LeadsList({
  leads,
  customers,
  users,
  searchTerm,
  statusFilter,
  onEdit,
  onDelete,
  onStatusChange,
  onViewDetail,
  getAgingLevel,
}) {
  console.log('🔍 LEADS IN LIST COMPONENT:', leads);
  console.log('🔍 FIRST LEAD IN LIST:', leads?.[0]);
  
  const filteredLeads = leads
    .filter((lead) => {
      // Handle both flat structure (old) and nested structure (new SDK format)
      const leadData = lead.data || lead;
      
      const matchesSearch =
        leadData.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leadData.phone?.includes(searchTerm) ||
        leadData.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leadData.boat_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'All' || leadData.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aData = a.data || a;
      const bData = b.data || b;
      const getPriority = (status) => {
        if (status === 'Pending' || status === 'Contacted') return 0;
        if (status === 'Won' || status === 'Converted') return 1;
        return 2; // Lost, Rejected, etc.
      };
      const aPriority = getPriority(aData.status);
      const bPriority = getPriority(bData.status);
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aDate = a.created_date || a.data?.created_date;
      const bDate = b.created_date || b.data?.created_date;
      return new Date(bDate) - new Date(aDate);
    });

  if (filteredLeads.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-slate-500 text-sm">No leads found</p>
        </CardContent>
      </Card>
    );
  }

  console.log('🔍 FILTERED LEADS COUNT:', filteredLeads.length);

  return (
    <div className="space-y-1.5">
      {filteredLeads.map((lead) => {
        // Handle both flat and nested structure
        const leadData = lead.data || lead;
        const leadId = lead.id;
        
        const customer = customers.find((c) => {
          const cId = c.id || c.data?.id;
          const custId = leadData.customer_id;
          return cId === custId;
        });
        
        const assignedUser = users?.find((u) => {
          const uId = u.id || u.data?.id;
          const assignedId = leadData.assigned_to_user_id;
          return uId === assignedId;
        });
        
        const agingLevel = getAgingLevel(lead);
        
        return (
          <LeadCard
            key={leadId}
            lead={lead}
            customer={customer}
            agingLevel={agingLevel}
            assignedUser={assignedUser}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onViewDetail={onViewDetail}
          />
        );
      })}
    </div>
  );
}