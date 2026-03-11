import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Paperclip, RefreshCw, Mail, AlertTriangle } from 'lucide-react';

const securityColors = {
  normal: 'bg-green-100 text-green-800',
  suspicious: 'bg-yellow-100 text-yellow-800',
  malformed: 'bg-orange-100 text-orange-800',
  oversized: 'bg-blue-100 text-blue-800',
  unsupported_encoding: 'bg-purple-100 text-purple-800',
  script_detected: 'bg-red-100 text-red-800',
  remote_content_detected: 'bg-orange-100 text-orange-800',
};

const statusColors = {
  stored: 'bg-green-100 text-green-800',
  duplicate: 'bg-gray-100 text-gray-600',
  malformed: 'bg-orange-100 text-orange-800',
  error: 'bg-red-100 text-red-800',
  suspicious: 'bg-yellow-100 text-yellow-800',
};

export default function InboxList({ onSelectMessage, selectedMessage, refreshKey }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.EmailMessageSandbox.filter({ direction: 'inbound' }, '-received_at', 50);
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 text-slate-400 border rounded-xl bg-slate-50">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading inbox...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center p-10 text-slate-400 border rounded-xl bg-slate-50">
        <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium">Inbox empty</p>
        <p className="text-sm mt-1">Use "Fetch New Emails" above to load messages.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Inbox <span className="text-slate-400 font-normal">({messages.length})</span></span>
        <Button size="sm" variant="ghost" onClick={load} className="h-7 w-7 p-0">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="overflow-y-auto max-h-[580px] divide-y">
        {messages.map(msg => (
          <div
            key={msg.id}
            onClick={() => onSelectMessage(msg)}
            className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedMessage?.id === msg.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {msg.from_name || msg.from_email}
                  </span>
                  {msg.has_attachments && <Paperclip className="h-3 w-3 text-slate-400 flex-shrink-0" />}
                  {msg.security_flag && msg.security_flag !== 'normal' && (
                    <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                <div className="text-sm text-slate-700 truncate">{msg.subject}</div>
                <div className="text-xs text-slate-400 truncate mt-0.5">{msg.body_preview}</div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[80px]">
                <span className="text-xs text-slate-400">
                  {msg.received_at ? format(new Date(msg.received_at), 'dd.MM HH:mm') : '—'}
                </span>
                <Badge className={`text-xs px-1.5 py-0 ${securityColors[msg.security_flag] || 'bg-gray-100 text-gray-600'}`}>
                  {msg.security_flag || 'normal'}
                </Badge>
                <Badge className={`text-xs px-1.5 py-0 ${statusColors[msg.processing_status] || 'bg-gray-100 text-gray-600'}`}>
                  {msg.processing_status || '—'}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}