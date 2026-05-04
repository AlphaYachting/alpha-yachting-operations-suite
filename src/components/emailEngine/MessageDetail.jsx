import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { X, Eye, EyeOff, Paperclip, AlertTriangle, Shield, Reply, FileText, Code, RefreshCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function MessageDetail({ message, conversationKey, onClose, onReply }) {
  const [showHtml, setShowHtml] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const [notes, setNotes] = useState(message?.internal_notes || '');
  const [saving, setSaving] = useState(false);
  const [threadMessages, setThreadMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [localMessage, setLocalMessage] = useState(message);

  // Thread mode: load all messages for a conversation
  useEffect(() => {
    if (conversationKey && !message) {
      setLoadingThread(true);
      base44.entities.EmailMessageSandbox
        .filter({ conversation_key: conversationKey }, '-received_at', 50)
        .then(data => { setThreadMessages(data || []); setLoadingThread(false); });
    }
  }, [conversationKey, message]);

  // Sync localMessage when prop changes
  useEffect(() => { setLocalMessage(message); }, [message]);

  const retryAndProcess = async (createLead) => {
    if (!localMessage?.id) return;
    setRetrying(true);
    try {
      const res = await base44.functions.invoke('emailRetryAndProcess', {
        sandbox_record_id: localMessage.id,
        create_lead: createLead,
      });
      const d = res.data;
      if (!d.success) {
        toast.error(`Fehler: ${d.error}`);
        return;
      }
      // Update local message to show new body
      const updated = await base44.entities.EmailMessageSandbox.filter({ id: localMessage.id });
      if (updated?.[0]) setLocalMessage(updated[0]);

      if (d.body_fetched) {
        if (createLead && d.lead_result?.created) {
          toast.success(`Lead erstellt: ${d.lead_result.name} (${d.lead_result.email})`);
        } else if (createLead && d.lead_result?.skipped) {
          toast.info(`Body geladen. Lead übersprungen: ${d.lead_result.reason}`);
        } else {
          toast.success(`Body erfolgreich geladen (${d.body_length} Zeichen)`);
        }
      } else {
        toast.warning('Body konnte nicht geladen werden — IMAP Timeout. Später erneut versuchen.');
      }
    } catch (err) {
      toast.error(`Fehler beim Abrufen: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  const saveNotes = async () => {
    if (!message) return;
    setSaving(true);
    await base44.entities.EmailMessageSandbox.update(message.id, { internal_notes: notes, reviewed_manually: true });
    setSaving(false);
  };

  const securityColor = {
    normal: 'bg-green-100 text-green-800',
    suspicious: 'bg-yellow-100 text-yellow-800',
    malformed: 'bg-orange-100 text-orange-800',
    oversized: 'bg-blue-100 text-blue-800',
    script_detected: 'bg-red-200 text-red-900',
    remote_content_detected: 'bg-orange-100 text-orange-800',
  };

  const renderMessage = (msg) => (
    <div key={msg.id} className="border rounded-lg overflow-hidden mb-4">
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 border-b">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-slate-800">
              {msg.from_name ? `${msg.from_name} <${msg.from_email}>` : msg.from_email}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              To: {(msg.to_email || []).join(', ')}
              {msg.cc_emails?.length > 0 && ` · CC: ${msg.cc_emails.join(', ')}`}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {msg.received_at ? format(new Date(msg.received_at), 'dd.MM.yyyy HH:mm:ss') : ''}
              {msg.sent_at ? ` · Sent: ${format(new Date(msg.sent_at), 'dd.MM.yyyy HH:mm')}` : ''}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={`text-xs ${securityColor[msg.security_flag] || 'bg-gray-100 text-gray-600'}`}>
              <Shield className="h-3 w-3 mr-1" />{msg.security_flag || 'normal'}
            </Badge>
            <Badge variant="outline" className="text-xs">{msg.direction}</Badge>
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-800 mt-2">{msg.subject}</div>
      </div>

      {/* Security Warning */}
      {msg.security_flag && msg.security_flag !== 'normal' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-xs text-amber-800 font-medium">
            Security flag: {msg.security_flag} — HTML preview restricted. Plain text display only.
          </span>
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        {/* Plain text — DEFAULT and always shown */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Plain Text (Default)</span>
          </div>
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg p-3 max-h-96 overflow-y-auto">
            {msg.body_text || '(no plain text content)'}
          </pre>
        </div>

        {/* HTML — only if no security flag and user explicitly requests it */}
        {msg.body_html_sanitized && msg.security_flag === 'normal' && (
          <div className="mb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHtml(s => !s)}
              className="mb-2 text-xs"
            >
              {showHtml ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {showHtml ? 'Hide' : 'Show'} Sanitized HTML Preview (sandboxed)
            </Button>
            {showHtml && (
              <div className="border-2 border-amber-300 rounded-lg overflow-hidden">
                <div className="bg-amber-50 px-3 py-1.5 text-xs text-amber-800 font-medium flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  SANDBOXED PREVIEW — Scripts blocked · Remote assets blocked · No navigation
                </div>
                {/* Sandboxed iframe - all restrictions applied */}
                <iframe
                  srcDoc={msg.body_html_sanitized}
                  sandbox=""
                  className="w-full h-80 bg-white"
                  title="Sanitized HTML (sandboxed)"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}

        {/* Attachments */}
        {msg.has_attachments && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Paperclip className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Attachments ({msg.attachment_count}) — Metadata Only
              </span>
            </div>
            <div className="space-y-1">
              {(msg.attachments_meta_json || []).map((att, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded px-3 py-1.5 text-xs text-slate-700">
                  <Paperclip className="h-3 w-3 text-slate-400" />
                  <span className="font-medium">{att.filename}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{att.content_type}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{att.size ? `${Math.round(att.size / 1024)} KB` : 'unknown size'}</span>
                  <span className="ml-auto text-amber-600 font-medium">NOT EXECUTED</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw Headers */}
        {msg.raw_headers_json && Object.keys(msg.raw_headers_json).length > 0 && (
          <div className="mb-3">
            <Button size="sm" variant="ghost" onClick={() => setShowHeaders(s => !s)} className="text-xs p-0 h-auto text-slate-400 hover:text-slate-600">
              <Code className="h-3 w-3 mr-1" />
              {showHeaders ? 'Hide' : 'Show'} Safe Headers
            </Button>
            {showHeaders && (
              <pre className="mt-2 text-xs text-slate-600 bg-slate-100 rounded p-3 overflow-x-auto max-h-48">
                {JSON.stringify(msg.raw_headers_json, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Thread mode
  if (conversationKey && !message) {
    return (
      <div className="border rounded-xl overflow-hidden bg-white">
        <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Conversation Thread</span>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0"><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[650px]">
          {loadingThread ? (
            <div className="text-center text-slate-400 py-8">Loading thread...</div>
          ) : threadMessages.length === 0 ? (
            <div className="text-center text-slate-400 py-8">No messages in this thread.</div>
          ) : (
            threadMessages.map(renderMessage)
          )}
        </div>
      </div>
    );
  }

  if (!localMessage) return null;

  const bodyMissing = !localMessage.body_text || localMessage.body_text.trim() === '';

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Message Detail</span>
        <div className="flex items-center gap-2">
          {onReply && localMessage.direction === 'inbound' && (
            <Button size="sm" variant="outline" onClick={() => onReply(localMessage)} className="text-xs">
              <Reply className="h-3 w-3 mr-1" /> Reply
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0"><X className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="overflow-y-auto max-h-[650px]">
        <div className="p-4">
          {/* Retry Banner — shown when body is empty */}
          {bodyMissing && localMessage.direction === 'inbound' && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-800">E-Mail Body fehlt</span>
                <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">Status: {localMessage.processing_status}</Badge>
              </div>
              <p className="text-xs text-amber-700">
                Der Body wurde nicht geladen (IMAP Timeout beim Abrufen). Hier manuell neu abrufen — dauert bis zu 60 Sek.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retryAndProcess(false)}
                  disabled={retrying}
                  className="text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                  {retrying ? 'Lädt...' : 'Nur Body laden'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => retryAndProcess(true)}
                  disabled={retrying}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  {retrying ? 'Lädt...' : 'Body laden + Lead erstellen'}
                </Button>
              </div>
            </div>
          )}
          {renderMessage(localMessage)}

          {/* Internal Notes */}
          <div className="mt-4">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
              Internal Notes (sandbox only)
            </label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add internal notes..."
              rows={3}
              className="text-sm"
            />
            <Button size="sm" variant="outline" onClick={saveNotes} disabled={saving} className="mt-2 text-xs">
              {saving ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>
          
          {/* Retry section for messages WITH body — allow manual lead creation */}
          {!bodyMissing && localMessage.direction === 'inbound' && localMessage.processing_status !== 'stored' && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryAndProcess(true)}
                disabled={retrying}
                className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <UserPlus className={`h-3 w-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Verarbeite...' : 'Als Lead verarbeiten'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}