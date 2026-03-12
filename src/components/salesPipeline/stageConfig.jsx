export const STAGES = [
  { id: 'New Lead',                  color: '#64748b', bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-200' },
  { id: 'Reviewing Inquiry',         color: '#3b82f6', bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200' },
  { id: 'Qualified',                 color: '#10b981', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  { id: 'Waiting for Customer Info', color: '#f59e0b', bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200' },
  { id: 'Offer Preparation',         color: '#8b5cf6', bg: 'bg-violet-50',   text: 'text-violet-700',  border: 'border-violet-200' },
  { id: 'Offer Sent',                color: '#6366f1', bg: 'bg-indigo-50',   text: 'text-indigo-700',  border: 'border-indigo-200' },
  { id: 'Follow-up',                 color: '#f97316', bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200' },
  { id: 'Negotiation',               color: '#ec4899', bg: 'bg-pink-50',     text: 'text-pink-700',    border: 'border-pink-200' },
  { id: 'Won',                       color: '#22c55e', bg: 'bg-green-50',    text: 'text-green-700',   border: 'border-green-200' },
  { id: 'Lost',                      color: '#ef4444', bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200' },
  { id: 'Archived',                  color: '#94a3b8', bg: 'bg-slate-50',    text: 'text-slate-400',   border: 'border-slate-100' },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]));