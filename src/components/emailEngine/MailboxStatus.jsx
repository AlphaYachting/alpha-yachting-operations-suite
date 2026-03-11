import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Wifi, Zap } from 'lucide-react';

export default function MailboxStatus({ onFetchComplete }) {
  const [imapStatus, setImapStatus] = useState(null);
  const [resendStatus, setResendStatus] = useState(null);
  const [fetchResult, setFetchResult] = useState(null);
  const [loading, setLoading] = useState({ imap: false, resend: false, fetch: false });

  const testImap = async () => {
    setLoading(l => ({ ...l, imap: true }));
    try {
      const res = await base44.functions.invoke('emailEngineTestImap', {});
      setImapStatus(res.data);
    } catch (e) {
      setImapStatus({ success: false, error: 'Function call failed' });
    }
    setLoading(l => ({ ...l, imap: false }));
  };

  const testResend = async () => {
    setLoading(l => ({ ...l, resend: true }));
    try {
      const res = await base44.functions.invoke('emailEngineTestResendSend', {});
      setResendStatus(res.data);
    } catch (e) {
      setResendStatus({ success: false, error: 'Function call failed' });
    }
    setLoading(l => ({ ...l, resend: false }));
  };

  const fetchEmails = async () => {
    setLoading(l => ({ ...l, fetch: true }));
    try {
      const res = await base44.functions.invoke('emailEngineFetchMessages', { batch_size: 20 });
      setFetchResult(res.data);
      onFetchComplete?.();
    } catch (e) {
      setFetchResult({ success: false, error: 'Fetch failed' });
    }
    setLoading(l => ({ ...l, fetch: false }));
  };

  const StatusIcon = ({ status }) => {
    if (status === null) return null;
    if (status.success) return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
    return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* IMAP */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-slate-400" />
            IMAP Inbound (SSL/993)
            <StatusIcon status={imapStatus} />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {imapStatus && (
            <p className={`text-xs mb-2 leading-relaxed ${imapStatus.success ? 'text-green-700' : 'text-red-700'}`}>
              {imapStatus.success
                ? `✓ Connected · ${imapStatus.inbox_total ?? '?'} msgs · ${imapStatus.inbox_unseen ?? '?'} unseen`
                : `✗ ${imapStatus.error}`}
            </p>
          )}
          <Button size="sm" variant="outline" onClick={testImap} disabled={loading.imap} className="w-full">
            {loading.imap ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test IMAP Connection'}
          </Button>
        </CardContent>
      </Card>

      {/* Resend API */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Zap className="h-4 w-4 text-slate-400" />
            Resend Outbound (API)
            <StatusIcon status={resendStatus} />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {resendStatus && (
            <p className={`text-xs mb-2 leading-relaxed ${resendStatus.success ? 'text-green-700' : 'text-red-700'}`}>
              {resendStatus.success
                ? `✓ ${resendStatus.message}`
                : `✗ ${resendStatus.error}`}
            </p>
          )}
          <Button size="sm" variant="outline" onClick={testResend} disabled={loading.resend} className="w-full">
            {loading.resend ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test Resend (sends test email)'}
          </Button>
        </CardContent>
      </Card>

      {/* Fetch */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-slate-400" />
            Fetch Emails (batch: 20)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {fetchResult && (
            <p className={`text-xs mb-2 leading-relaxed ${fetchResult.success ? 'text-green-700' : 'text-red-700'}`}>
              {fetchResult.success
                ? `✓ ${fetchResult.summary?.stored ?? 0} stored · ${fetchResult.summary?.duplicates ?? 0} dup · ${fetchResult.summary?.errors ?? 0} err`
                : `✗ ${fetchResult.error}`}
            </p>
          )}
          <Button size="sm" onClick={fetchEmails} disabled={loading.fetch} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {loading.fetch ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Fetching...</> : 'Fetch New Emails'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}