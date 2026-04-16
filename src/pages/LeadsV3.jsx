import React, { useState } from 'react';
import { useLeadV3Data, V3_PHASES } from '@/hooks/useLeadV3Data';
import LeadV3PhaseNav from '@/components/leadsV3/LeadV3PhaseNav';
import LeadV3List from '@/components/leadsV3/LeadV3List';
import { Input } from '@/components/ui/input';
import { Search, Layers } from 'lucide-react';

export default function LeadsV3() {
  const { leads, users, isLoading } = useLeadV3Data();
  const [activePhase, setActivePhase] = useState('New Incoming');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Active count for header
  const activeCount = leads.filter(l => !['Ordered / Confirmed', 'Rejected'].includes(l.status)).length;
  const phaseCount = activePhase === 'All'
    ? leads.length
    : leads.filter(l => l.status === activePhase).length;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-5 w-5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Lead Workspace</span>
            <span className="text-xs bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">V3</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeCount} active lead{activeCount !== 1 ? 's' : ''} across pipeline
          </p>
        </div>
      </div>

      {/* Phase navigation */}
      <LeadV3PhaseNav
        leads={leads}
        activePhase={activePhase}
        onPhaseSelect={setActivePhase}
      />

      {/* Search + count bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, boat, location…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-slate-200 text-sm h-9"
          />
        </div>
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
          {phaseCount} lead{phaseCount !== 1 ? 's' : ''}
          {searchTerm ? ' matching' : activePhase === 'All' ? ' total' : ` in ${activePhase}`}
        </span>
      </div>

      {/* Card list */}
      <LeadV3List
        leads={leads}
        users={users}
        activePhase={activePhase}
        searchTerm={searchTerm}
      />
    </div>
  );
}