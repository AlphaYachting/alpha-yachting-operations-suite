import React from 'react';
import LeadV3Card from './LeadV3Card';
import { sortLeadsV3, V3_PHASES, getPhaseConfig } from '@/hooks/useLeadV3Data';
import { cn } from '@/lib/utils';

function EmptyPhase({ phase }) {
  const cfg = getPhaseConfig(phase);
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-10 h-10 rounded-full mb-3 opacity-20"
        style={{ backgroundColor: cfg.color }}
      />
      <p className="text-sm text-slate-400 font-medium">No leads in {cfg.label}</p>
    </div>
  );
}

export default function LeadV3List({ leads, users, activePhase, searchTerm, onStatusChange, onAssigned }) {

  // Filter by phase
  const phaseFiltered = activePhase === 'All'
    ? leads
    : leads.filter(l => l.status === activePhase);

  // Filter by search
  const searchFiltered = searchTerm
    ? phaseFiltered.filter(l => {
        const q = searchTerm.toLowerCase();
        return (
          l.name?.toLowerCase().includes(q) ||
          l.boat_name?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.location?.toLowerCase().includes(q)
        );
      })
    : phaseFiltered;

  const sorted = sortLeadsV3(searchFiltered);
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  if (sorted.length === 0) {
    return <EmptyPhase phase={activePhase === 'All' ? 'New Incoming' : activePhase} />;
  }

  // In "All" mode, group by phase
  if (activePhase === 'All') {
    return (
      <div className="space-y-8">
        {V3_PHASES.map(phase => {
          const phaseLeads = sortLeadsV3(sorted.filter(l => l.status === phase.status));
          if (phaseLeads.length === 0) return null;
          return (
            <div key={phase.status}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: phase.color }} />
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {phase.label}
                </span>
                <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 font-medium">
                  {phaseLeads.length}
                </span>
              </div>
              <div className="space-y-3">
                {phaseLeads.map(lead => (
                  <LeadV3Card
                    key={lead.id}
                    lead={lead}
                    assignedUser={userMap[lead.assigned_to_user_id] || null}
                    users={users}
                    onStatusChange={onStatusChange}
                    onAssigned={onAssigned}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map(lead => (
        <LeadV3Card
          key={lead.id}
          lead={lead}
          assignedUser={userMap[lead.assigned_to_user_id] || null}
          users={users}
          onStatusChange={onStatusChange}
          onAssigned={onAssigned}
        />
      ))}
    </div>
  );
}