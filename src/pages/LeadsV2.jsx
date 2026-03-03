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
import { Plus, Clock, PhoneCall, CheckCircle2, XCircle, Search, Mail } from 'lucide-react';
import { useLeadData, getAgingLevel } from '@/components/leadsV2/useLeadData';
import LeadsList from '@/components/leadsV2/LeadsList';
import LeadForm from '@/components/leadsV2/LeadForm';
import EmailToLeadParser from '@/components/leadsV2/EmailToLeadParser';

export default function LeadsV2() {
  const { leads, customers, locations, users, boats, isLoading, updateLeadStatus, saveLead, deleteLead, refetchAll } = useLeadData();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [showEmailParser, setShowEmailParser] = useState(false);

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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
          <p className="text-slate-600">Loading leads...</p>
        </div>
      </div>
    );
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 text-sm mt-1">Manage customer inquiries and opportunities</p>
        </div>
        <Button
          onClick={() => {
            setEditingLead(null);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pending, icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
          { label: 'Contacted', value: stats.contacted, icon: PhoneCall, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
          { label: 'Converted', value: stats.converted, icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { label: 'Lost', value: stats.lost, icon: XCircle, iconBg: 'bg-slate-50', iconColor: 'text-slate-400' },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`${stat.iconBg} rounded-full p-3`}>
                  <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
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
            users={users}
            boats={boats}
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