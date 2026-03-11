import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';

export default function AuditLog({ refreshKey }) {
  const [messages, setMessages] = useState([]);
  const [outbound, setOutbound] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('inbound');

  const load = async () => {
    setLoading(true);
    const [msgs, outs] = await Promise.all([
      base44.entities.EmailMessageSandbox.filter({ direction: 'inbound' }, '-received_at', 100),
      base44.entities.EmailOutboundQueueSandbox.list('-created_date', 50),
    ]);
    setMessages(msgs || []);
    setOutbound(outs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const statusColors = {
    stored: 'bg-green-100 text-green-800',
    duplicate: 'bg-gray-100 text-gray-600',
    malformed: 'bg-orange-100 text-orange-800',
    error: 'bg-red-100 text-red-800',
    suspicious: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
  };

  const stats = {
    stored: messages.filter(m => m.processing_status === 'stored').length,
    duplicates: messages.filter(m => m.processing_status === 'duplicate' || m.duplicate_status === 'duplicate').length,
    errors: messages.filter(m => m.processing_status === 'error').length,
    suspicious: messages.filter(m => m.security_flag && m.security_flag !== 'normal').length,
    sent: outbound.filter(o => o.approval_status === 'sent').length,
    failed: outbound.filter(o => o.approval_status === 'failed').length,
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Audit / Logs</span>
        <Button size="sm" variant="ghost" onClick={load} className="h-7 w-7 p-0">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 p-3 bg-slate-50 border-b">
        {[
          { label: 'Stored', value: stats.stored, color: 'text-green-700' },
          { label: 'Duplicates', value: stats.duplicates, color: 'text-slate-500' },
          { label: 'Errors', value: stats.errors, color: 'text-red-600' },
          { label: 'Flagged', value: stats.suspicious, color: 'text-amber-600' },
          { label: 'Sent', value: stats.sent, color: 'text-blue-600' },
          { label: 'Failed', value: stats.failed, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {['inbound', 'outbound'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${tab === t ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'inbound' ? `Inbound (${messages.length})` : `Outbound (${outbound.length})`}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto max-h-[400px]">
        {tab === 'inbound' && (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {['Date', 'From', 'Subject', 'Status', 'Security', 'Dup'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {messages.map(msg => (
                <tr key={msg.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">
                    {msg.received_at ? format(new Date(msg.received_at), 'dd.MM HH:mm') : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-slate-700 max-w-[140px] truncate">{msg.from_email}</td>
                  <td className="px-3 py-1.5 text-slate-600 max-w-[180px] truncate">{msg.subject}</td>
                  <td className="px-3 py-1.5">
                    <Badge className={`text-xs px-1.5 py-0 ${statusColors[msg.processing_status] || 'bg-gray-100 text-gray-600'}`}>
                      {msg.processing_status}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5">
                    {msg.security_flag && msg.security_flag !== 'normal' && (
                      <Badge className="text-xs px-1.5 py-0 bg-amber-100 text-amber-800">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{msg.security_flag}
                      </Badge>
                    )}
                    {msg.security_flag === 'normal' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={msg.duplicate_status === 'duplicate' ? 'text-amber-600 font-medium' : 'text-slate-300'}>
                      {msg.duplicate_status === 'duplicate' ? 'DUP' : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'outbound' && (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {['Created', 'To', 'Subject', 'Status', 'Sent At', 'Error'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {outbound.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">
                    {item.created_date ? format(new Date(item.created_date), 'dd.MM HH:mm') : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-slate-700 max-w-[140px] truncate">{(item.to_email || []).join(', ')}</td>
                  <td className="px-3 py-1.5 text-slate-600 max-w-[180px] truncate">{item.draft_subject}</td>
                  <td className="px-3 py-1.5">
                    <Badge className={`text-xs px-1.5 py-0 ${statusColors[item.approval_status] || 'bg-gray-100 text-gray-600'}`}>
                      {item.approval_status}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">
                    {item.sent_at ? format(new Date(item.sent_at), 'dd.MM HH:mm') : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-red-600 max-w-[160px] truncate">
                    {item.send_error_log || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}