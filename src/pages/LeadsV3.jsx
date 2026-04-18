import React, { useState, useEffect } from 'react';
import { useLeadV3Data, V3_PHASES } from '@/hooks/useLeadV3Data';
import LeadV3PhaseNav from '@/components/leadsV3/LeadV3PhaseNav';
import LeadV3List from '@/components/leadsV3/LeadV3List';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Layers, Clock, PhoneCall, CheckCircle2, XCircle, AlertCircle, Eye, Mail, Plus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import EmailToLeadParser from '@/components/leadsV2/EmailToLeadParser';
import { base44 } from '@/api/base44Client';

export default function LeadsV3() {
  const { leads: rawLeads, users, isLoading } = useLeadV3Data();
  const { user: currentUser } = useAuth();
  const [leads, setLeads] = useState([]);
  const [activePhase, setActivePhase] = useState('New Incoming');
  const [searchTerm, setSearchTerm] = useState('');
  // 'me' | 'all' | '<userId>'
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [showEmailToLead, setShowEmailToLead] = useState(false);

  // Sync from hook whenever raw data changes
  React.useEffect(() => { setLeads(rawLeads); }, [rawLeads]);

  const handleStatusChange = (leadId, newStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
  };

  const handleAssigned = (leadId, userId) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to_user_id: userId, accepted_by_assignee: false } : l));
  };

  const handleEmailLeadParsed = async (leadData) => {
    const created = await base44.entities.Lead.create(leadData);
    setLeads(prev => [created, ...prev]);
    setShowEmailToLead(false);
    setActivePhase('New Incoming');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading leads…</p>
        </div>
      </div>
    );
  }

  // Apply owner filter
  const ownerFilteredLeads = leads.filter(l => {
    if (ownerFilter === 'all') return true;
    if (ownerFilter === 'me') return l.assigned_to_user_id === currentUser?.id;
    return l.assigned_to_user_id === ownerFilter;
  });

  // Active count for header
  const activeCount = ownerFilteredLeads.filter(l => !['Ordered / Confirmed', 'Rejected'].includes(l.status)).length;
  const phaseCount = activePhase === 'All'
    ? ownerFilteredLeads.length
    : ownerFilteredLeads.filter(l => l.status === activePhase).length;

  // Stats with icons (like V2)
  const stats = [
    { label: 'New Incoming', value: ownerFilteredLeads.filter(l => l.status === 'New Incoming').length, icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', phase: 'New Incoming' },
    { label: 'Needs Clarification', value: ownerFilteredLeads.filter(l => l.status === 'Needs Clarification').length, icon: AlertCircle, iconBg: 'bg-orange-50', iconColor: 'text-orange-600', phase: 'Needs Clarification' },
    { label: 'Ready to Offer', value: ownerFilteredLeads.filter(l => l.status === 'Ready to Offer').length, icon: Eye, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', phase: 'Ready to Offer' },
    { label: 'Offered', value: ownerFilteredLeads.filter(l => l.status === 'Offered').length, icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', phase: 'Offered' },
    { label: 'Rejected', value: ownerFilteredLeads.filter(l => l.status === 'Rejected').length, icon: XCircle, iconBg: 'bg-red-50', iconColor: 'text-red-400', phase: 'Rejected' },
  ];

  return (
    <div className="space-y-5">
      {/* Page header — aligned with Dashboard V2 / V2 leads header style */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} active lead{activeCount !== 1 ? 's' : ''} across pipeline
          </p>
        </div>
        <Button onClick={() => setShowEmailToLead(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Mail className="h-4 w-4" />
          Email to Lead
        </Button>
      </div>

      {/* Email to Lead Dialog */}
      <Dialog open={showEmailToLead} onOpenChange={setShowEmailToLead}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              E-Mail zu Lead konvertieren
            </DialogTitle>
          </DialogHeader>
          <EmailToLeadParser
            onLeadParsed={handleEmailLeadParsed}
            onCancel={() => setShowEmailToLead(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Status icons — clickable filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <button
            key={stat.phase}
            onClick={() => setActivePhase(stat.phase)}
            className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
              activePhase === stat.phase
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`${stat.iconBg} rounded-full p-2`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-600">{stat.label}</p>
                <p className="text-lg font-bold text-slate-900">{stat.value}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Search + owner filter + count bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, boat, location…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-slate-200 text-sm h-9"
          />
        </div>

        {/* Owner filter */}
        <select
          value={ownerFilter}
          onChange={e => setOwnerFilter(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white text-sm text-slate-700 px-2.5 pr-7 focus:outline-none focus:ring-1 focus:ring-slate-300 cursor-pointer"
        >
          <option value="all">All Leads</option>
          <option value="me">My Leads</option>
          {users.filter(u => u.id !== currentUser?.id).map(u => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>

        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
          {phaseCount} lead{phaseCount !== 1 ? 's' : ''}
          {searchTerm ? ' matching' : activePhase === 'All' ? ' total' : ` in ${activePhase}`}
        </span>
      </div>

      {/* Card list */}
      <LeadV3List
        leads={ownerFilteredLeads}
        users={users}
        activePhase={activePhase}
        searchTerm={searchTerm}
        onStatusChange={handleStatusChange}
        onAssigned={handleAssigned}
      />
    </div>
  );
}