import React, { useState, useCallback } from 'react';
import SandboxBanner from '@/components/emailEngine/SandboxBanner';
import MailboxStatus from '@/components/emailEngine/MailboxStatus';
import InboxList from '@/components/emailEngine/InboxList';
import ConversationList from '@/components/emailEngine/ConversationList';
import MessageDetail from '@/components/emailEngine/MessageDetail';
import OutboundDraftPanel from '@/components/emailEngine/OutboundDraftPanel';
import AuditLog from '@/components/emailEngine/AuditLog';
import AutoCreatedLeads from '@/components/emailEngine/AutoCreatedLeads';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Inbox, MessageSquare, Send, ClipboardList, Zap } from 'lucide-react';

export default function EmailEngineSandbox() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('inbox');

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    setSelectedMessage(null);
    setSelectedConversation(null);
  }, []);

  const handleSelectMessage = useCallback((msg) => {
    setSelectedMessage(msg);
    setSelectedConversation(null);
  }, []);

  const handleSelectConversation = useCallback((conv) => {
    setSelectedConversation(conv);
    setSelectedMessage(null);
  }, []);

  const handleReply = useCallback((msg) => {
    setReplyToMessage(msg);
    setActiveTab('outbound');
  }, []);

  const handleReplyComplete = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 p-4 lg:p-6">
      {/* Sandbox Warning Banner */}
      <SandboxBanner />

      {/* Mailbox Controls */}
      <MailboxStatus onFetchComplete={handleRefresh} />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 h-10 p-1">
          <TabsTrigger value="inbox" className="text-xs flex items-center gap-1.5">
            <Inbox className="h-4 w-4" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="conversations" className="text-xs flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" /> Conversations
          </TabsTrigger>
          <TabsTrigger value="outbound" className="text-xs flex items-center gap-1.5">
            <Send className="h-4 w-4" /> Outbound
            {replyToMessage && (
              <span className="bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                1
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" /> Audit Log
          </TabsTrigger>
          <TabsTrigger value="leads" className="text-xs flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" /> Auto Leads
          </TabsTrigger>
        </TabsList>

        {/* INBOX TAB */}
        <TabsContent value="inbox">
          <div className={`grid gap-4 ${selectedMessage ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            <InboxList
              onSelectMessage={handleSelectMessage}
              selectedMessage={selectedMessage}
              refreshKey={refreshKey}
            />
            {selectedMessage && (
              <MessageDetail
                message={selectedMessage}
                onClose={() => setSelectedMessage(null)}
                onReply={handleReply}
              />
            )}
          </div>
        </TabsContent>

        {/* CONVERSATIONS TAB */}
        <TabsContent value="conversations">
          <div className={`grid gap-4 ${selectedConversation ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            <ConversationList
              onSelectConversation={handleSelectConversation}
              selectedConversation={selectedConversation}
              refreshKey={refreshKey}
            />
            {selectedConversation && (
              <MessageDetail
                conversationKey={selectedConversation.conversation_key}
                onClose={() => setSelectedConversation(null)}
                onReply={handleReply}
              />
            )}
          </div>
        </TabsContent>

        {/* OUTBOUND TAB */}
        <TabsContent value="outbound">
          <OutboundDraftPanel
            replyToMessage={replyToMessage}
            onReplyComplete={handleReplyComplete}
            refreshKey={refreshKey}
          />
        </TabsContent>

        {/* AUDIT TAB */}
        <TabsContent value="audit">
          <AuditLog refreshKey={refreshKey} />
        </TabsContent>

        {/* AUTO LEADS TAB */}
        <TabsContent value="leads">
          <AutoCreatedLeads refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}