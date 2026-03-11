import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Plus, Send, CheckCircle, Clock, XCircle, Loader2, RefreshCw, ChevronDown, ChevronUp, Reply } from 'lucide-react';
import { toast } from 'sonner';

const approvalColors = {
  draft: 'bg-gray-100 text-gray-700',
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved_to_send: 'bg-green-100 text-green-800',
  sent: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-600',
};

export default function OutboundDraftPanel({ replyToMessage, onReplyComplete, refreshKey }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedDraft, setExpandedDraft] = useState(null);
  const [form, setForm] = useState({
    to_email: '',
    cc_emails: '',
    draft_subject: '',
    draft_body_text: '',
    conversation_key: '',
    related_message_id: '',
  });

  const user = React.useRef(null);
  useEffect(() => { base44.auth.me().then(u => { user.current = u; }); }, []);

  // Pre-fill form for reply
  useEffect(() => {
    if (replyToMessage) {
      setForm({
        to_email: replyToMessage.from_email || '',
        cc_emails: '',
        draft_subject: `Re: ${replyToMessage.subject || ''}`,
        draft_body_text: `\n\n--- Original message from ${replyToMessage.from_email} ---\n${(replyToMessage.body_text || '').substring(0, 500)}`,
        conversation_key: replyToMessage.conversation_key || replyToMessage.linked_conversation_key || '',
        related_message_id: replyToMessage.message_id || '',
      });
      setShowForm(true);
    }
  }, [replyToMessage]);

  const loadDrafts = async () => {
    setLoading(true);
    const data = await base44.entities.EmailOutboundQueueSandbox.list('-created_date', 50);
    setDrafts(data || []);
    setLoading(false);
  };

  useEffect(() => { loadDrafts(); }, [refreshKey]);

  const saveDraft = async () => {
    const toList = form.to_email.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const ccList = form.cc_emails ? form.cc_emails.split(/[,;]/).map(s => s.trim()).filter(Boolean) : [];
    if (toList.length === 0 || !form.draft_subject || !form.draft_body_text) {
      toast.error('To, Subject, and Body are required');
      return;
    }
    await base44.entities.EmailOutboundQueueSandbox.create({
      to_email: toList,
      cc_emails: ccList,
      bcc_emails: [],
      draft_subject: form.draft_subject,
      draft_body_text: form.draft_body_text,
      conversation_key: form.conversation_key || null,
      related_message_id: form.related_message_id || null,
      approval_status: 'draft',
      sending_mode: 'manual',
      test_mode: true,
      created_by: user.current?.email || 'unknown',
      future_agent_generated: false,
    });
    toast.success('Draft saved');
    setForm({ to_email: '', cc_emails: '', draft_subject: '', draft_body_text: '', conversation_key: '', related_message_id: '' });
    setShowForm(false);
    onReplyComplete?.();
    loadDrafts();
  };

  const submitForReview = async (draft) => {
    await base44.entities.EmailOutboundQueueSandbox.update(draft.id, {
      approval_status: 'pending_review',
      queued_at: new Date().toISOString(),
    });
    toast.success('Submitted for review');
    loadDrafts();
  };

  const approveDraft = async (draft) => {
    await base44.entities.EmailOutboundQueueSandbox.update(draft.id, {
      approval_status: 'approved_to_send',
      approved_at: new Date().toISOString(),
      reviewed_by: user.current?.email || 'unknown',
    });
    toast.success('Draft approved — ready to send');
    loadDrafts();
  };

  const cancelDraft = async (draft) => {
    await base44.entities.EmailOutboundQueueSandbox.update(draft.id, { approval_status: 'cancelled' });
    toast.info('Draft cancelled');
    loadDrafts();
  };

  const sendDraft = async (draft) => {
    if (draft.approval_status !== 'approved_to_send') {
      toast.error('Only "approved_to_send" drafts may be sent. Approve it first.');
      return;
    }
    if (!confirm(`⚠️ SEND EMAIL?\n\nTo: ${(draft.to_email || []).join(', ')}\nSubject: ${draft.draft_subject}\n\nThis will send a real email via SMTP. Continue?`)) return;

    setSending(draft.id);
    try {
      const res = await base44.functions.invoke('emailEngineSendMessage', { outbound_id: draft.id });
      if (res.data?.success) {
        toast.success('Email sent successfully');
      } else {
        toast.error(`Send failed: ${res.data?.error || 'Unknown error'}`);
      }
      loadDrafts();
    } catch (e) {
      toast.error('Send failed: function error');
    }
    setSending(null);
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Outbound Drafts & Queue</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={loadDrafts} className="h-7 w-7 p-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={() => setShowForm(s => !s)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Draft
          </Button>
        </div>
      </div>

      {/* Compose Form */}
      {showForm && (
        <div className="p-4 bg-blue-50 border-b space-y-3">
          <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">
            {replyToMessage ? '↩ Reply Draft' : '✏ New Draft'} — Plain Text Only (Phase 1)
          </div>
          <Input
            placeholder="To (comma separated emails) *"
            value={form.to_email}
            onChange={e => setForm(f => ({ ...f, to_email: e.target.value }))}
            className="text-sm bg-white"
          />
          <Input
            placeholder="CC (optional)"
            value={form.cc_emails}
            onChange={e => setForm(f => ({ ...f, cc_emails: e.target.value }))}
            className="text-sm bg-white"
          />
          <Input
            placeholder="Subject *"
            value={form.draft_subject}
            onChange={e => setForm(f => ({ ...f, draft_subject: e.target.value }))}
            className="text-sm bg-white"
          />
          <Textarea
            placeholder="Message body (plain text) *"
            value={form.draft_body_text}
            onChange={e => setForm(f => ({ ...f, draft_body_text: e.target.value }))}
            rows={6}
            className="text-sm bg-white font-mono"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); onReplyComplete?.(); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveDraft} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save Draft
            </Button>
          </div>
        </div>
      )}

      {/* Draft List */}
      <div className="overflow-y-auto max-h-[500px] divide-y">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No drafts yet.</div>
        ) : drafts.map(draft => (
          <div key={draft.id} className="p-3">
            <div
              className="cursor-pointer"
              onClick={() => setExpandedDraft(expandedDraft === draft.id ? null : draft.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{draft.draft_subject}</div>
                  <div className="text-xs text-slate-500 truncate">
                    To: {(draft.to_email || []).join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge className={`text-xs ${approvalColors[draft.approval_status] || 'bg-gray-100'}`}>
                    {draft.approval_status}
                  </Badge>
                  {expandedDraft === draft.id
                    ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                    : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                </div>
              </div>
            </div>

            {/* Expanded controls */}
            {expandedDraft === draft.id && (
              <div className="mt-3 space-y-2">
                <pre className="text-xs text-slate-700 bg-slate-50 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans">
                  {draft.draft_body_text}
                </pre>
                {draft.send_error_log && (
                  <div className="text-xs bg-red-50 text-red-700 rounded p-2 border border-red-200">
                    ✗ Send Error: {draft.send_error_log}
                  </div>
                )}
                {draft.sent_at && (
                  <div className="text-xs text-slate-400">
                    Sent: {format(new Date(draft.sent_at), 'dd.MM.yyyy HH:mm')}
                    {draft.send_result && ` · ID: ${draft.send_result}`}
                  </div>
                )}

                {/* Action buttons — STRICT APPROVAL FLOW */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {draft.approval_status === 'draft' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => submitForReview(draft)} className="text-xs h-7">
                        <Clock className="h-3 w-3 mr-1" /> Submit for Review
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelDraft(draft)} className="text-xs h-7 text-slate-400">
                        Cancel Draft
                      </Button>
                    </>
                  )}
                  {draft.approval_status === 'pending_review' && (
                    <>
                      <Button size="sm" onClick={() => approveDraft(draft)} className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="h-3 w-3 mr-1" /> Approve to Send
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelDraft(draft)} className="text-xs h-7 text-slate-400">
                        Cancel
                      </Button>
                    </>
                  )}
                  {draft.approval_status === 'approved_to_send' && (
                    <Button
                      size="sm"
                      onClick={() => sendDraft(draft)}
                      disabled={sending === draft.id}
                      className="text-xs h-7 bg-blue-700 hover:bg-blue-800 text-white font-semibold"
                    >
                      {sending === draft.id
                        ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Sending...</>
                        : <><Send className="h-3 w-3 mr-1" /> Send Approved Email</>}
                    </Button>
                  )}
                  {draft.approval_status === 'failed' && (
                    <Button size="sm" onClick={() => approveDraft(draft)} className="text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white">
                      Re-approve & Retry
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}