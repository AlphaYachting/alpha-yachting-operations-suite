import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  ShieldCheck,
  RefreshCw,
  Loader2,
  Mail,
  Copy,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Phone,
  Ship,
  MapPin,
  Send,
} from 'lucide-react';

const AREA_META = {
  contact: { label: 'Kontaktdaten', icon: Phone },
  boat: { label: 'Boots-/Auftragsdaten', icon: Ship },
  location: { label: 'Standort / Einsatzgebiet', icon: MapPin },
};

const STATUS_META = {
  ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  missing: { label: 'Fehlt', cls: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  unclear: { label: 'Unklar', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: HelpCircle },
};

const COMPLETENESS_META = {
  complete: { label: 'Vollständig', cls: 'bg-emerald-100 text-emerald-700' },
  incomplete: { label: 'Unvollständig', cls: 'bg-amber-100 text-amber-700' },
  unclear: { label: 'Unklar', cls: 'bg-orange-100 text-orange-700' },
};

function DraftBlock({ title, accent, subject, body, email, onSend, onCopy, copied, sent }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className={`px-3 py-2 flex items-center justify-between ${accent}`}>
        <span className="text-sm font-semibold flex items-center gap-1.5">
          {title}
          {sent && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
              <CheckCircle2 className="h-3 w-3" />
              Gesendet
            </span>
          )}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={onCopy}>
            <Copy className="h-3 w-3 mr-1" />
            {copied ? 'Kopiert!' : 'Kopieren'}
          </Button>
          {email && (
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={onSend}>
              <Send className="h-3 w-3 mr-1" />
              Senden
            </Button>
          )}
        </div>
      </div>
      <div className="p-3 space-y-2">
        {subject && (
          <p className="text-xs text-slate-500">
            <span className="font-medium text-slate-600">Betreff:</span> {subject}
          </p>
        )}
        <div className="bg-slate-50 border border-slate-100 rounded-md p-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
          {body}
        </div>
      </div>
    </div>
  );
}

export default function LeadScreeningPanel({ lead, onLeadUpdated }) {
  const [screening, setScreening] = useState(false);
  const [copied, setCopied] = useState(null);

  const runScreening = async () => {
    setScreening(true);
    try {
      await base44.functions.invoke('screenIncomingLead', { lead_id: lead.id });
      if (onLeadUpdated) await onLeadUpdated();
    } catch (e) {
      console.error('Screening error:', e);
    } finally {
      setScreening(false);
    }
  };

  // Persist the manual response action on the lead. 'sent' never gets downgraded to 'drafted'.
  const markResponse = async (which, newStatus) => {
    const updates = {
      email_response_type: which,
      email_response_at: new Date().toISOString(),
    };
    // Only upgrade status: sent > drafted > none
    if (newStatus === 'sent' || lead.email_response_status !== 'sent') {
      updates.email_response_status = newStatus;
    }
    try {
      await base44.entities.Lead.update(lead.id, updates);
      if (onLeadUpdated) await onLeadUpdated();
    } catch (e) {
      console.error('Failed to persist email response status:', e);
    }
  };

  const copyDraft = (which, subject, body) => {
    navigator.clipboard.writeText(`${subject ? subject + '\n\n' : ''}${body || ''}`);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
    markResponse(which, 'drafted');
  };

  const sendDraft = (which, subject, body) => {
    if (!lead.email) return alert('Keine E-Mail-Adresse für diesen Lead vorhanden.');
    const s = encodeURIComponent(subject || '');
    const b = encodeURIComponent(body || '');
    window.location.href = `mailto:${lead.email}?subject=${s}&body=${b}`;
    markResponse(which, 'sent');
  };

  const hasScreening = lead.screening_status === 'screened' &&
    (lead.draft_followup_body || lead.draft_rejection_body);
  const comp = COMPLETENESS_META[lead.screening_completeness];

  return (
    <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-blue-800">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Automatische Lead-Prüfung
            <Badge className="bg-blue-100 text-blue-700 text-xs font-normal">Auto</Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={runScreening}
            disabled={screening}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {screening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {screening ? 'Prüfe...' : 'Erneut prüfen'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Response status banner */}
        {lead.email_response_status && lead.email_response_status !== 'none' && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            lead.email_response_status === 'sent'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}>
            {lead.email_response_status === 'sent'
              ? <Send className="h-4 w-4 flex-shrink-0" />
              : <Copy className="h-4 w-4 flex-shrink-0" />}
            <span className="font-medium">
              {lead.email_response_status === 'sent' ? 'Antwort gesendet' : 'Entwurf kopiert'}
              {lead.email_response_type === 'followup' && ' · Nachfrage'}
              {lead.email_response_type === 'rejection' && ' · Absage'}
            </span>
            {lead.email_response_at && (
              <span className="text-xs opacity-70 ml-auto">
                {format(new Date(lead.email_response_at), 'dd.MM.yyyy HH:mm')}
              </span>
            )}
          </div>
        )}

        {!hasScreening && !screening && (
          <p className="text-sm text-slate-400 italic">
            Noch keine Prüfung vorhanden. Neue Leads werden automatisch geprüft — oder jetzt manuell „Erneut prüfen".
          </p>
        )}

        {hasScreening && (
          <>
            {/* Verdict + summary */}
            <div className="flex flex-wrap items-center gap-2">
              {comp && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${comp.cls}`}>
                  {comp.label}
                </span>
              )}
              {lead.screening_language && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  Sprache: {lead.screening_language}
                </span>
              )}
            </div>

            {lead.screening_summary && (
              <p className="text-sm text-slate-600 leading-relaxed">{lead.screening_summary}</p>
            )}

            {/* Per-area checks */}
            {Array.isArray(lead.screening_checks) && lead.screening_checks.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {lead.screening_checks.map((check, i) => {
                  const area = AREA_META[check.area] || { label: check.area, icon: HelpCircle };
                  const st = STATUS_META[check.status] || STATUS_META.unclear;
                  const AreaIcon = area.icon;
                  const StatusIcon = st.icon;
                  return (
                    <div key={i} className={`rounded-lg border p-2.5 ${st.cls}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          <AreaIcon className="h-3.5 w-3.5" />
                          {area.label}
                        </span>
                        <StatusIcon className="h-3.5 w-3.5" />
                      </div>
                      {check.note && <p className="text-xs opacity-90 leading-snug">{check.note}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Missing info */}
            {Array.isArray(lead.screening_missing_info) && lead.screening_missing_info.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Fehlende / unklare Angaben
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {lead.screening_missing_info.map((item, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Drafts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
              <DraftBlock
                title="✉️ Nachfrage / Verifizierung"
                accent="bg-blue-50 text-blue-800"
                subject={lead.draft_followup_subject}
                body={lead.draft_followup_body}
                email={lead.email}
                onSend={() => sendDraft('followup', lead.draft_followup_subject, lead.draft_followup_body)}
                onCopy={() => copyDraft('followup', lead.draft_followup_subject, lead.draft_followup_body)}
                copied={copied === 'followup'}
                sent={lead.email_response_status === 'sent' && lead.email_response_type === 'followup'}
              />
              <DraftBlock
                title="✉️ Höfliche Absage"
                accent="bg-rose-50 text-rose-800"
                subject={lead.draft_rejection_subject}
                body={lead.draft_rejection_body}
                email={lead.email}
                onSend={() => sendDraft('rejection', lead.draft_rejection_subject, lead.draft_rejection_body)}
                onCopy={() => copyDraft('rejection', lead.draft_rejection_subject, lead.draft_rejection_body)}
                copied={copied === 'rejection'}
                sent={lead.email_response_status === 'sent' && lead.email_response_type === 'rejection'}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}