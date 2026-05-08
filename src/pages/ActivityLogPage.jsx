import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO, subDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Activity, Search } from 'lucide-react';

const ACTION_COLORS = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
};

const ENTITY_LABELS = {
  WorkOrder: 'Work Order',
  Job: 'Project',
  Offer: 'Offer',
  Lead: 'Lead',
  Customer: 'Customer',
  Boat: 'Boat',
  Task: 'Task',
  CustomerMaterialEntry: 'Material Entry',
  ImportDocument: 'Import Doc',
};

export default function ActivityLogPage() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity_logs'],
    queryFn: () => base44.entities.ActivityLog.list('-occurred_at', 200),
    staleTime: 30 * 1000,
  });

  const filtered = logs.filter(log => {
    const matchesSearch = !search ||
      log.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_label?.toLowerCase().includes(search.toLowerCase());
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesEntity && matchesAction;
  });

  const entityTypes = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-slate-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>
          <p className="text-sm text-slate-500">Who did what and when</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by user or record..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {entityTypes.map(t => (
              <SelectItem key={t} value={t}>{ENTITY_LABELS[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Created</SelectItem>
            <SelectItem value="update">Updated</SelectItem>
            <SelectItem value="delete">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Activity className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p>No activity logs yet</p>
            <p className="text-xs mt-1">Logs will appear here once users start making changes</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(log => (
              <div key={log.id} className="flex items-start gap-4 px-5 py-3 hover:bg-slate-50">
                <div className="flex-shrink-0 pt-0.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                    {log.action}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">
                    <span className="font-semibold">{log.user_email}</span>
                    {' '}{log.action === 'create' ? 'created' : log.action === 'update' ? 'updated' : 'deleted'}{' '}
                    <span className="font-medium text-slate-700">{ENTITY_LABELS[log.entity_type] || log.entity_type}</span>
                    {log.entity_label && <span className="text-slate-500"> — {log.entity_label}</span>}
                  </p>
                  {log.changed_fields?.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Changed: {log.changed_fields.join(', ')}
                    </p>
                  )}
                  {log.new_values && Object.keys(log.new_values).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(log.new_values).slice(0, 4).map(([k, v]) => (
                        <span key={k} className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                          {k}: <span className="text-slate-400 line-through mr-1">{String(log.old_values?.[k] ?? '—').slice(0, 20)}</span>
                          <span className="text-slate-800">{String(v ?? '—').slice(0, 20)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-xs text-slate-400 whitespace-nowrap">
                  {log.occurred_at ? format(parseISO(log.occurred_at), 'dd.MM.yy HH:mm') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}