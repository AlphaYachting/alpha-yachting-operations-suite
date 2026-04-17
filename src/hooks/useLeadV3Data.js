import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// V3-local aging logic — encapsulated, switchable to last_contacted_at later
export function getV3AgingDays(lead) {
  // Prefer last_contacted_at if reliably set, fall back to created_date
  const referenceDate = lead.last_contacted_at || lead.created_date;
  if (!referenceDate) return null;
  const now = new Date();
  return Math.floor((now - new Date(referenceDate)) / (1000 * 60 * 60 * 24));
}

export function getV3AgingLevel(lead) {
  // Terminal statuses — no aging
  if (['Ordered / Confirmed', 'Rejected'].includes(lead.status)) return 'none';
  const days = getV3AgingDays(lead);
  if (days === null) return 'none';
  if (days > 5) return 'danger';
  if (days > 3) return 'warn';
  return 'ok';
}

// V3-local priority sort weight
export function getPriorityWeight(priority) {
  return { Urgent: 0, High: 1, Medium: 2, Low: 3 }[priority] ?? 4;
}

// V3-local sort: priority first, then aging (older = higher up within priority)
export function sortLeadsV3(leads) {
  return [...leads].sort((a, b) => {
    const priorityDiff = getPriorityWeight(a.priority) - getPriorityWeight(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    const aDate = new Date(a.last_contacted_at || a.created_date || 0);
    const bDate = new Date(b.last_contacted_at || b.created_date || 0);
    return aDate - bDate; // older first within same priority
  });
}

export const V3_PHASES = [
  { status: 'New Incoming',        label: 'New Incoming',       color: '#f59e0b', bg: 'bg-amber-500',    light: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  { status: 'Needs Clarification', label: 'Needs Clarification',color: '#f97316', bg: 'bg-orange-500',   light: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  { status: 'Ready to Offer',      label: 'Ready to Offer',     color: '#3b82f6', bg: 'bg-blue-500',     light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  { status: 'Offered',             label: 'Offered',            color: '#6366f1', bg: 'bg-indigo-500',   light: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  { status: 'Ordered / Confirmed', label: 'Confirmed',          color: '#10b981', bg: 'bg-emerald-500',  light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { status: 'Rejected',            label: 'Rejected',           color: '#ef4444', bg: 'bg-red-500',      light: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
];

export function getPhaseConfig(status) {
  return V3_PHASES.find(p => p.status === status) || V3_PHASES[0];
}

export function useLeadV3Data() {
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [allLeads, allUsers] = await Promise.all([
          base44.entities.Lead.list('-created_date', 500),
          base44.entities.User.list(),
        ]);
        if (!cancelled) {
          setLeads(allLeads || []);
          setUsers(allUsers || []);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { leads, users, isLoading };
}