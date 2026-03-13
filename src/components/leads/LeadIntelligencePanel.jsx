import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  RefreshCw,
  Mail,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Copy,
  Sparkles
} from 'lucide-react';

const LEAD_TYPE_COLORS = {
  'Hot Lead':           'bg-red-100 text-red-700 border-red-200',
  'Qualified Prospect': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Information Seeker': 'bg-blue-100 text-blue-700 border-blue-200',
  'Price Shopper':      'bg-amber-100 text-amber-700 border-amber-200',
};

function ScoreBar({ value, color }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function LeadIntelligencePanel({ lead }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  // Extract context-based questions from backend-generated notes (ONCE, shared across functions)
  const extractCriticalMissingInfo = () => {
    const criticalMissingInfo = [];
    if (lead.notes) {
      const notesLines = lead.notes.split('\n');
      let inNachfragenSection = false;
      
      for (const line of notesLines) {
        if (line.includes('--- NACHFRAGEN (KI-ANALYSE) ---')) {
          inNachfragenSection = true;
          continue;
        }
        if (line.startsWith('Conversation key:') || line.startsWith('[') || line.startsWith('---')) {
          inNachfragenSection = false;
        }
        if (inNachfragenSection && line.trim() && line.includes('⚠️ FEHLENDE INFO:')) {
          criticalMissingInfo.push(line.trim());
        }
      }
    }
    return criticalMissingInfo;
  };

  const buildPrompt = (criticalMissingInfo) => {
    const parts = [];
    
    // Determine inquiry context from lead data
    const fullText = `${lead.description || ''} ${lead.notes || ''}`.toLowerCase();
    const isPartsRequest = fullText.includes('teil') || fullText.includes('part') || fullText.includes('ersatz');
    const isServiceRequest = fullText.includes('reparatur') || fullText.includes('service') || fullText.includes('wartung');
    
    let roleContext = 'marine services sales representative';
    if (isPartsRequest) roleContext = 'marine parts specialist';
    else if (isServiceRequest) roleContext = 'marine service advisor';
    
    parts.push(`You are a ${roleContext}. Your job is to qualify this lead and write a professional follow-up email.`);
    parts.push(`\nCUSTOMER INQUIRY:`);
    if (lead.name) parts.push(`Name: ${lead.name}`);
    if (lead.description) parts.push(`\n${lead.description}`);
    
    parts.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    parts.push(`🎯 YOUR TASK: Write a professional email reply that:`);
    parts.push(`1. Thanks the customer for their inquiry`);
    parts.push(`2. Asks for the following REQUIRED information (${criticalMissingInfo.length} items):`);
    parts.push(``);
    criticalMissingInfo.forEach((info, idx) => {
      const cleanInfo = info.replace('⚠️ FEHLENDE INFO:', '').trim();
      parts.push(`   ${idx + 1}. ${cleanInfo}`);
    });
    parts.push(``);
    parts.push(`3. Explains why this information is needed (to serve them better)`);
    parts.push(`4. Maintains a helpful, professional tone`);
    parts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    parts.push(`\n🔴 CRITICAL RULES:`);
    parts.push(`• You MUST ask for ALL ${criticalMissingInfo.length} items listed above`);
    parts.push(`• Do NOT skip or replace any item, especially "Motornummer" if listed`);
    parts.push(`• Write in the SAME LANGUAGE as the customer inquiry (German/English/etc.)`);
    parts.push(`• Keep it concise but complete`);
    parts.push(`• Use the customer's name if provided\n`);

    parts.push(`Return ONLY valid JSON with this structure:
{
  "intent_score": <0-100, estimate customer's buying intent>,
  "deal_probability": <0-100, likelihood of conversion>,
  "lead_type": <"Hot Lead" | "Qualified Prospect" | "Information Seeker" | "Price Shopper">,
  "analysis_explanation": <brief 1-sentence analysis>,
  "reply_email_draft": "<the complete email text>"
}`);

    return parts.join('\n');
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const criticalMissingInfo = extractCriticalMissingInfo();
      const criticalMissingInfoClean = criticalMissingInfo.map(info => 
        info.replace('⚠️ FEHLENDE INFO:', '').trim()
      );

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: buildPrompt(),
        response_json_schema: {
          type: 'object',
          properties: {
            intent_score:           { type: 'number' },
            deal_probability:       { type: 'number' },
            lead_type:              { type: 'string' },
            analysis_explanation:   { type: 'string' },
            missing_information:    { type: 'array', items: { type: 'string' } },
            verification_questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  group:     { type: 'string' },
                  questions: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            reply_email_draft: { type: 'string' }
          }
        }
      });
      
      // CRITICAL: Override missing_information with backend-extracted critical info
      // This ensures the UI always displays the context-specific requirements (e.g., Motornummer for parts)
      if (criticalMissingInfoClean.length > 0) {
        result.missing_information = criticalMissingInfoClean;
      }
      
      setAnalysis(result);
    } catch (e) {
      console.error('LeadIntelligencePanel analysis error:', e);
      setAnalysis({ _error: true });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmailDraft = () => {
    if (!lead.email) return alert('No customer email address available.');
    if (!analysis?.reply_email_draft) return alert('No reply draft available. Please generate the draft first.');

    const subject = encodeURIComponent(`Re: ${lead.inquiry_type || 'Your inquiry'} – ${lead.boat_name || lead.name}`);
    const body = encodeURIComponent(analysis.reply_email_draft);
    window.location.href = `mailto:${lead.email}?subject=${subject}&body=${body}`;
  };

  const handleCopyDraft = () => {
    if (!analysis?.reply_email_draft) return;
    navigator.clipboard.writeText(analysis.reply_email_draft);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const intentColor  = analysis?.intent_score >= 70  ? 'bg-emerald-500' : analysis?.intent_score >= 40 ? 'bg-amber-400' : 'bg-red-400';
  const dealColor    = analysis?.deal_probability >= 70 ? 'bg-emerald-500' : analysis?.deal_probability >= 40 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <Card className="border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-purple-800">
            <Brain className="h-5 w-5 text-purple-600" />
            Lead Intelligence
            <Badge className="bg-purple-100 text-purple-700 text-xs font-normal">AI</Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-5 pt-0">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!analysis ? (
              <Button
                onClick={runAnalysis}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="sm"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {loading ? 'Analysing...' : 'Run Analysis'}
              </Button>
            ) : (
              <Button
                onClick={runAnalysis}
                disabled={loading}
                variant="outline"
                size="sm"
                className="border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {loading ? 'Refreshing...' : 'Refresh Analysis'}
              </Button>
            )}

            {analysis && !analysis._error && (
              <Button
                onClick={handleCreateEmailDraft}
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Mail className="h-4 w-4 mr-2" />
                Create Email Draft
              </Button>
            )}
          </div>

          {/* Error state */}
          {analysis?._error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Analysis failed. Please try again.
            </div>
          )}

          {/* Not yet run */}
          {!analysis && !loading && (
            <p className="text-sm text-slate-400 italic">
              Click "Run Analysis" to qualify this lead with AI assistance.
            </p>
          )}

          {/* Results */}
          {analysis && !analysis._error && (
            <>
              {/* Section 1 — Scores */}
              <div className="space-y-3 p-3 bg-white rounded-lg border border-purple-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${LEAD_TYPE_COLORS[analysis.lead_type] || 'bg-slate-100 text-slate-700'}`}>
                    {analysis.lead_type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                      <span>Intent Score</span>
                      <span className="font-semibold text-slate-700">{analysis.intent_score}/100</span>
                    </div>
                    <ScoreBar value={analysis.intent_score} color={intentColor} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                      <span>Deal Probability</span>
                      <span className="font-semibold text-slate-700">{analysis.deal_probability}/100</span>
                    </div>
                    <ScoreBar value={analysis.deal_probability} color={dealColor} />
                  </div>
                </div>

                {analysis.analysis_explanation && (
                  <p className="text-xs text-slate-500 italic leading-relaxed">{analysis.analysis_explanation}</p>
                )}
              </div>

              {/* Section 2 — Missing Information */}
              {analysis.missing_information?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Missing Information</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.missing_information.map((item, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3 — Verification Questions */}
              {analysis.verification_questions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Suggested Questions</p>
                  <div className="space-y-3">
                    {analysis.verification_questions.map((group, gi) => (
                      <div key={gi}>
                        <p className="text-xs font-semibold text-slate-700 mb-1">{group.group}</p>
                        <ul className="space-y-1">
                          {group.questions.map((q, qi) => (
                            <li key={qi} className="flex items-start gap-2 text-xs text-slate-600">
                              <CheckCircle2 className="h-3.5 w-3.5 text-purple-400 mt-0.5 shrink-0" />
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4 — Reply Email Draft */}
              {analysis.reply_email_draft && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reply Email Draft</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-slate-400 hover:text-slate-700 px-2"
                      onClick={handleCopyDraft}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copyDone ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                    {analysis.reply_email_draft}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}