import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, RefreshCw, Users, ArrowDown, ArrowUp } from 'lucide-react';

const statusColors = {
  open: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-600',
  pending_review: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-slate-100 text-slate-500',
};

const directionIcon = {
  inbound: <ArrowDown className="h-3 w-3 text-green-600" />,
  outbound: <ArrowUp className="h-3 w-3 text-blue-600" />,
  draft: <span className="text-xs text-slate-400">D</span>,
};

export default function ConversationList({ onSelectConversation, selectedConversation, refreshKey }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.EmailConversationSandbox.list('-last_message_at', 50);
    setConversations(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 text-slate-400 border rounded-xl bg-slate-50">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading conversations...
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center p-10 text-slate-400 border rounded-xl bg-slate-50">
        <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium">No conversations yet</p>
        <p className="text-sm mt-1">Fetch emails to see threaded conversations.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          Conversations <span className="text-slate-400 font-normal">({conversations.length})</span>
        </span>
        <Button size="sm" variant="ghost" onClick={load} className="h-7 w-7 p-0">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="overflow-y-auto max-h-[580px] divide-y">
        {conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => onSelectConversation(conv)}
            className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {conv.latest_direction && directionIcon[conv.latest_direction]}
                  <span className="text-sm font-medium text-slate-800 truncate">{conv.primary_subject}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Users className="h-3 w-3 text-slate-400" />
                  <span className="text-xs text-slate-500 truncate">
                    {(conv.participant_summary || []).slice(0, 2).join(', ')}
                    {(conv.participant_summary || []).length > 2 && ` +${conv.participant_summary.length - 2}`}
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate mt-0.5">{conv.latest_preview}</div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-slate-400">
                  {conv.last_message_at ? format(new Date(conv.last_message_at), 'dd.MM HH:mm') : '—'}
                </span>
                <Badge className={`text-xs px-1.5 py-0 ${statusColors[conv.status_internal] || 'bg-gray-100 text-gray-600'}`}>
                  {conv.status_internal}
                </Badge>
                <span className="text-xs text-slate-400">{conv.message_count || 0} msg</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}