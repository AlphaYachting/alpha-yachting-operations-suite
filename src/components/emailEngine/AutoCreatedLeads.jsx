import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Loader2, CheckCircle2, XCircle, Copy, ExternalLink, Zap, AlertTriangle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

const creationStatusConfig = {
  created:            { label: 'Lead Created',       className: 'bg-green-100 text-green-800' },
  duplicate_blocked:  { label: 'Duplicate Blocked',  className: 'bg-yellow-100 text-yellow-700' },
  failed:             { label: 'Failed',              className: 'bg-red-100 text-red-800' },
  pending:            { label: 'Pending',             className: 'bg-slate-100 text-slate-600' },
};

const dupStatusConfig = {
  unique:                    { label: 'Unique',           className: 'bg-blue-100 text-blue-800' },
  duplicate_by_message_id:   { label: 'Dup (msg-id)',     className: 'bg-orange-100 text-orange-700' },
  duplicate_by_fingerprint:  { label: 'Dup (fingerprint)',className: 'bg-orange-100 text-orange-700' },
  pending:                   { label: 'Pending',          className: 'bg-slate-100 text-slate-600' },
};

const extractionStatusConfig = {
  extracted: { label: 'Full',    className: 'bg-green-100 text-green-800' },
  partial:   { label: 'Partial', className: 'bg-yellow-100 text-yellow-700' },
  error:     { label: 'Error',   className: 'bg-red-100 text-red-800' },
};

export default function AutoCreatedLeads({ refreshKey }) {
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [selectedBridge, setSelectedBridge] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.EmailLeadBridgeSandbox.list('-auto_created_at', 100);
    setBridges(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const runAutoCreate = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await base44.functions.invoke('emailEngineAutoCreateLead', {});
      setRunResult(res.data);
      load();
    } catch (e) {
      setRunResult({ success: false, error: 'Function call failed' });
    }
    setRunning(false);
  };

  const stats = bridges.reduce((acc, b) => {
    acc[b.creation_status] = (acc[b.creation_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header + Trigger */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Auto-Created Leads from Website Inbox
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Every inbound email from the website inquiry mailbox automatically creates one Lead.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-8">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={runAutoCreate}
            disabled={running}
            className="h-8 bg-amber-500 hover:bg-amber-600 text-white"
          >
            {running
              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Processing...</>
              : <><Zap className="h-3.5 w-3.5 mr-1" />Run Auto-Create Now</>
            }
          </Button>
        </div>
      </div>

      {/* Run Result Banner */}
      {runResult && (
        <div className={`rounded-lg px-4 py-3 text-sm border flex items-start gap-3 ${runResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {runResult.success
            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            : <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          }
          <div>
            {runResult.success ? (
              <>
                <span className="font-medium">Done.</span>
                {' '}Processed: {runResult.processed ?? 0}.
                {runResult.summary && Object.entries(runResult.summary).map(([k, v]) => (
                  <span key={k} className="ml-2">{k}: {v}</span>
                ))}
              </>
            ) : (
              <span>{runResult.error || 'Unknown error'}</span>
            )}
          </div>
        </div>
      )}

      {/* Stats Row */}
      {bridges.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-green-700">{stats.created || 0}</div>
            <div className="text-xs text-green-600">Leads Created</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-yellow-700">{stats.duplicate_blocked || 0}</div>
            <div className="text-xs text-yellow-600">Duplicates Blocked</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-red-700">{stats.failed || 0}</div>
            <div className="text-xs text-red-600">Failed</div>
          </div>
        </div>
      )}

      {/* Bridge Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading bridge records...
        </div>
      ) : bridges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Zap className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No bridge records yet</p>
            <p className="text-sm mt-1">Fetch emails, then click "Run Auto-Create Now".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white">
          <div className="bg-slate-50 px-4 py-2 border-b">
            <span className="text-sm font-semibold text-slate-700">
              Bridge Records <span className="text-slate-400 font-normal">({bridges.length})</span>
            </span>
          </div>
          <div className="overflow-y-auto max-h-[520px] divide-y">
            {bridges.map(bridge => {
              const cs = creationStatusConfig[bridge.creation_status] || creationStatusConfig.pending;
              const ds = dupStatusConfig[bridge.duplicate_check_status] || dupStatusConfig.pending;
              const es = extractionStatusConfig[bridge.extraction_status] || extractionStatusConfig.partial;
              return (
                <div
                  key={bridge.id}
                  onClick={() => setSelectedBridge(bridge)}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]">
                          {bridge.source_from_name || bridge.source_from_email}
                        </span>
                        <span className="text-xs text-slate-400 truncate max-w-[160px]">
                          {bridge.source_from_email}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 truncate mt-0.5">
                        {bridge.source_subject}
                      </div>
                      {bridge.created_lead_id && (
                        <div className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                          Lead ID: <code className="bg-blue-50 px-1 rounded">{bridge.created_lead_id.substring(0, 12)}…</code>
                          <a
                            href={createPageUrl('LeadsV2')}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="hover:text-blue-800"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {bridge.creation_error_log && (
                        <div className="text-xs text-red-600 mt-0.5 truncate">{bridge.creation_error_log}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-slate-400">
                        {bridge.auto_created_at ? format(new Date(bridge.auto_created_at), 'dd.MM HH:mm') : '—'}
                      </span>
                      <Badge className={`text-xs px-1.5 py-0 ${cs.className}`}>{cs.label}</Badge>
                      <Badge className={`text-xs px-1.5 py-0 ${ds.className}`}>{ds.label}</Badge>
                      <Badge className={`text-xs px-1.5 py-0 ${es.className}`}>{es.label}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedBridge} onOpenChange={() => setSelectedBridge(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Bridge Detail</DialogTitle>
          </DialogHeader>
          {selectedBridge && (
            <div className="space-y-4 text-sm">
              {/* Status row */}
              <div className="flex flex-wrap gap-2">
                <Badge className={`${(creationStatusConfig[selectedBridge.creation_status] || creationStatusConfig.pending).className}`}>
                  {(creationStatusConfig[selectedBridge.creation_status] || creationStatusConfig.pending).label}
                </Badge>
                <Badge className={`${(dupStatusConfig[selectedBridge.duplicate_check_status] || dupStatusConfig.pending).className}`}>
                  Dup: {(dupStatusConfig[selectedBridge.duplicate_check_status] || dupStatusConfig.pending).label}
                </Badge>
                <Badge className={`${(extractionStatusConfig[selectedBridge.extraction_status] || extractionStatusConfig.partial).className}`}>
                  Extraction: {(extractionStatusConfig[selectedBridge.extraction_status] || extractionStatusConfig.partial).label}
                </Badge>
              </div>

              {/* Source info */}
              <div className="border rounded-lg p-3 space-y-2 bg-slate-50">
                <div className="font-semibold text-slate-700 mb-1">Source Email</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-slate-500">From:</span> {selectedBridge.source_from_name}</div>
                  <div><span className="text-slate-500">Email:</span> {selectedBridge.source_from_email}</div>
                  <div className="col-span-2"><span className="text-slate-500">Subject:</span> {selectedBridge.source_subject}</div>
                  <div><span className="text-slate-500">Received:</span> {selectedBridge.source_received_at ? format(new Date(selectedBridge.source_received_at), 'dd.MM.yyyy HH:mm') : '—'}</div>
                  <div><span className="text-slate-500">Auto-created:</span> {selectedBridge.auto_created_at ? format(new Date(selectedBridge.auto_created_at), 'dd.MM.yyyy HH:mm') : '—'}</div>
                </div>
                {selectedBridge.source_email_message_id && (
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    Msg-ID: <code className="bg-white px-1 rounded border">{selectedBridge.source_email_message_id}</code>
                    <button onClick={() => { navigator.clipboard.writeText(selectedBridge.source_email_message_id); toast.success('Copied'); }} className="hover:text-slate-600">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Lead info */}
              {selectedBridge.created_lead_id && (
                <div className="border rounded-lg p-3 bg-green-50 border-green-200">
                  <div className="font-semibold text-green-800 mb-1">Created Lead</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-white px-2 py-1 rounded border border-green-200">{selectedBridge.created_lead_id}</code>
                    <a
                      href={createPageUrl('LeadsV2')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-700 hover:text-green-900 flex items-center gap-1"
                    >
                      Open Leads <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Error log */}
              {selectedBridge.creation_error_log && (
                <div className="border rounded-lg p-3 bg-red-50 border-red-200">
                  <div className="font-semibold text-red-700 mb-1">Error Log</div>
                  <pre className="text-xs text-red-600 whitespace-pre-wrap">{selectedBridge.creation_error_log}</pre>
                </div>
              )}

              {/* Extracted payload */}
              {selectedBridge.extracted_lead_payload_json && (
                <div className="border rounded-lg p-3">
                  <div className="font-semibold text-slate-700 mb-2">Extracted Lead Payload</div>
                  <pre className="text-xs bg-slate-50 p-2 rounded overflow-auto max-h-64 text-slate-700 whitespace-pre-wrap">
                    {JSON.stringify(selectedBridge.extracted_lead_payload_json, null, 2)}
                  </pre>
                </div>
              )}

              {/* Fingerprint note */}
              {selectedBridge.internal_notes && (
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {selectedBridge.internal_notes}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}