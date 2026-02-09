# ROLLBACK SNAPSHOT - pages/LeadsV2.jsx BEFORE

Date: 2026-02-09
Purpose: Style-only changes to match new design screenshot

```jsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useLeadData, getAgingLevel } from '@/components/leadsV2/useLeadData';
import LeadsList from '@/components/leadsV2/LeadsList';
import LeadForm from '@/components/leadsV2/LeadForm';

export default function LeadsV2() {
  const { leads, customers, locations, isLoading, updateLeadStatus, saveLead, deleteLead, refetchAll } = useLeadData();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  const handleEditLead = (lead) => {
    setEditingLead(lead);
    setShowForm(true);
  };

  const handleSaveLead = async (formData) => {
    try {
      await saveLead(formData);
      setShowForm(false);
      setEditingLead(null);
    } catch (err) {
      console.error('Error saving lead:', err);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (window.confirm('Delete this lead?')) {
      try {
        await deleteLead(leadId);
      } catch (err) {
        console.error('Error deleting lead:', err);
      }
    }
  };

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await updateLeadStatus(leadId, newStatus);
    } catch (err) {
      console.error('Error changing status:', err);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  // Stats
  const stats = {
    pending: leads.filter((l) => l.status === 'Pending').length,
    contacted: leads.filter((l) => l.status === 'Contacted').length,
    converted: leads.filter((l) => l.status === 'Converted').length,
    lost: leads.filter((l) => l.status === 'Lost').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Leads (V2)</h1>
        <Button
          onClick={() => {
            setEditingLead(null);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: stats.pending },
          { label: 'Contacted', value: stats.contacted },
          { label: 'Converted', value: stats.converted },
          { label: 'Lost', value: stats.lost },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3">
              <p className="text-xs text-slate-500 mb-0.5">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Search by name, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Contacted">Contacted</SelectItem>
                <SelectItem value="Converted">Converted</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads List */}
      <LeadsList
        leads={leads}
        customers={customers}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        onEdit={handleEditLead}
        onDelete={handleDeleteLead}
        onStatusChange={handleStatusChange}
        onViewDetail={() => {}}
        getAgingLevel={getAgingLevel}
      />

      {/* Lead Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'New Lead'}</DialogTitle>
          </DialogHeader>
          <LeadForm
            lead={editingLead}
            customers={customers}
            locations={locations}
            onSave={handleSaveLead}
            onCancel={() => {
              setShowForm(false);
              setEditingLead(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
``