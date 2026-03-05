import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import LeadCard from './LeadCard';

export default function LeadsList({
  leads,
  customers,
  searchTerm,
  statusFilter,
  onEdit,
  onDelete,
  onStatusChange,
  onViewDetail,
  getAgingLevel,
}) {
  const agingPriority = (lead) => {
    const level = getAgingLevel(lead);
    if (level === 'danger') return 0;
    if (level === 'warn') return 1;
    return 2;
  };

  const filteredLeads = leads
    .filter((lead) => {
      const matchesSearch =
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.boat_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const agingDiff = agingPriority(a) - agingPriority(b);
      if (agingDiff !== 0) return agingDiff;
      // Within same aging group, newest first
      return new Date(b.created_date) - new Date(a.created_date);
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

  return (
    <div className="space-y-1.5">
      {filteredLeads.map((lead) => {
        const customer = customers.find((c) => c.id === lead.customer_id);
        const agingLevel = getAgingLevel(lead);
        return (
          <LeadCard
            key={lead.id}
            lead={lead}
            customer={customer}
            agingLevel={agingLevel}
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