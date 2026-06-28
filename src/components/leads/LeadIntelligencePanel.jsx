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

export default function LeadIntelligencePanel({ lead, currentUser, onLeadUpdated }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // Append a traceable follow-up note to the lead's notes
  const logFollowUpNote = async (channel) => {
    try {
      const ts = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Zagreb' });
      const who = currentUser?.full_name || currentUser?.email || 'Unbekannt';
      const category = analysis?.request_category ? ` (${analysis.request_category})` : '';
      const entry = `📋 NACHFRAGE-VERMERK — ${ts} — ${who} — KI-Analyse Rückfrage per ${channel}${category}`;
      const existing = lead.notes ? lead.notes + '\n' : '';
      await base44.entities.Lead.update(lead.id, { notes: existing + entry });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
      if (onLeadUpdated) onLeadUpdated();
    } catch (e) {
      console.error('Error logging follow-up note:', e);
    }
  };

  // Extract context-based questions from backend-generated notes (ONCE, shared across functions)
  const extractCriticalMissingInfo = () => {
    const criticalMissingInfo = [];
    if (lead.notes) {
      const notesLines = lead.notes.split('\n');
      let inNachfragenSection = false;
      
      for (const line of notesLines) {
        // Start marker
        if (line.includes('--- NACHFRAGEN (KI-ANALYSE) ---')) {
          inNachfragenSection = true;
          continue;
        }
        
        // End markers
        if (line.startsWith('Conversation key:') || line.startsWith('---')) {
          inNachfragenSection = false;
          continue;
        }
        
        // Extract lines that contain the missing info marker
        if (inNachfragenSection && line.trim() && line.includes('⚠️ FEHLENDE INFO:')) {
          criticalMissingInfo.push(line.trim());
        }
      }
    }
    return criticalMissingInfo;
  };

  const buildAnalysisPrompt = () => {
    const parts = [];
    
    parts.push(`ROLE`);
    parts.push(`You are a senior marine surveyor and yacht service coordinator working for Alpha Yachting.`);
    parts.push(`Your task is to analyze incoming customer inquiries and prepare a structured technical clarification.\n`);
    
    parts.push(`GOAL`);
    parts.push(`1. Understand the customer's request.`);
    parts.push(`2. Identify the likely technical problem.`);
    parts.push(`3. Detect missing information required to prepare a service quote.`);
    parts.push(`4. Generate a clear and friendly response email asking only the necessary questions.\n`);
    
    parts.push(`CONTEXT`);
    parts.push(`Alpha Yachting provides yacht service, repair and maintenance for motorboats and sailing yachts up to approx. 20m.`);
    parts.push(`Typical services include:`);
    parts.push(`• engine diagnostics`);
    parts.push(`• antifouling and hull service`);
    parts.push(`• polishing and detailing`);
    parts.push(`• electrical systems`);
    parts.push(`• electronics`);
    parts.push(`• propulsion systems`);
    parts.push(`• leak diagnostics`);
    parts.push(`• mechanical repairs`);
    parts.push(`• retrofit installations`);
    parts.push(`• marina service support\n`);
    
    parts.push(`Customers often provide incomplete information.`);
    parts.push(`The AI must therefore identify missing technical and logistical data required for an estimate.\n`);
    
    parts.push(`INPUT`);
    parts.push(`Customer inquiry:`);
    if (lead.name) parts.push(`Name: ${lead.name}`);
    if (lead.email) parts.push(`Email: ${lead.email}`);
    if (lead.phone) parts.push(`Phone: ${lead.phone}`);
    if (lead.description) parts.push(`\nMessage:\n${lead.description}`);
    if (lead.boat_name) parts.push(`\nBoat: ${lead.boat_name}`);
    if (lead.boat_details) parts.push(`Boat details: ${lead.boat_details}`);
    if (lead.location) parts.push(`Location: ${lead.location}`);
    parts.push(`\n`);
    
    parts.push(`ANALYSIS TASKS\n`);
    
    parts.push(`Step 1 — Request Classification`);
    parts.push(`Determine the main category of the request:`);
    parts.push(`Possible categories: Engine problem, Electrical problem, Hull/antifouling, Polishing/detailing, Mechanical repair, Leak/water ingress, Electronics, Installation/retrofit, General service, Unknown\n`);
    
    parts.push(`Step 2 — Problem Interpretation`);
    parts.push(`Explain briefly what the customer's problem most likely means from a technical perspective.\n`);
    
    parts.push(`Step 3 — Missing Information Detection`);
    parts.push(`Identify missing information required to prepare a quotation or schedule a technician.`);
    parts.push(`Typical required information:`);
    parts.push(`Boat Information: boat brand, boat model, boat length, engine type and brand, engine power`);
    parts.push(`Location: marina/harbor, country, berth number if known`);
    parts.push(`Technical details: symptoms, when the problem occurs, error messages, previous repairs, photos or videos available`);
    parts.push(`Service context: urgency, boat currently in water or on land, accessibility of the boat\n`);
    
    parts.push(`Step 4 — Work Complexity Estimation`);
    parts.push(`Classify the likely work scope: small service task, medium repair, complex diagnostic case, unclear/requires inspection\n`);
    
    parts.push(`Step 5 — Generate Clarification Questions`);
    parts.push(`Generate 5–10 concise questions that will help Alpha Yachting prepare an offer or plan the service.`);
    parts.push(`Questions must be: simple, technical but understandable, directly relevant for diagnosis or pricing\n`);
    
    parts.push(`Step 6 — Write Reply Email`);
    parts.push(`Write a short professional reply email in the SAME LANGUAGE as the customer inquiry that:`);
    parts.push(`• thanks the customer`);
    parts.push(`• briefly acknowledges the problem`);
    parts.push(`• asks the generated questions`);
    parts.push(`• keeps a friendly tone`);
    parts.push(`• invites the customer to send photos if helpful\n`);
    
    parts.push(`EMAIL STYLE: Professional, clear and helpful. Avoid technical jargon where possible.\n`);
    
    parts.push(`Return ONLY valid JSON:
{
  "request_category": "<category>",
  "technical_interpretation": "<short explanation>",
  "missing_information": ["item1", "item2"],
  "work_complexity": "<assessment>",
  "clarification_questions": ["q1", "q2", "q3", "q4", "q5"],
  "reply_email_draft": "<complete ready-to-send email>",
  "extracted_info": {
    "boat_location": "<if mentioned>",
    "boat_type": "<if mentioned>",
    "boat_length": "<if mentioned>",
    "boat_brand": "<if mentioned>",
    "engine_details": "<if mentioned>",
    "service_requested": "<what they want>",
    "timeline": "<if mentioned>",
    "customer_motivation": "<if mentioned>"
  },
  "intent_score": <0-100>,
  "deal_probability": <0-100>,
  "urgency_level": "<Low|Medium|High|Urgent>",
  "lead_type": "<Hot Lead|Qualified Prospect|Information Seeker|Price Shopper>",
  "analysis_explanation": "<1-2 sentences>"
}`);

    return parts.join('\n');
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      console.log('🤖 Starting AI-powered lead analysis...');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: buildAnalysisPrompt(),
        response_json_schema: {
          type: 'object',
          properties: {
            request_category: { type: 'string' },
            technical_interpretation: { type: 'string' },
            missing_information: {
              type: 'array',
              items: { type: 'string' }
            },
            work_complexity: { type: 'string' },
            clarification_questions: {
              type: 'array',
              items: { type: 'string' }
            },
            reply_email_draft: { type: 'string' },
            extracted_info: {
              type: 'object',
              properties: {
                boat_location: { type: ['string', 'null'] },
                boat_type: { type: ['string', 'null'] },
                boat_length: { type: ['string', 'null'] },
                boat_brand: { type: ['string', 'null'] },
                engine_details: { type: ['string', 'null'] },
                service_requested: { type: 'string' },
                timeline: { type: ['string', 'null'] },
                customer_motivation: { type: ['string', 'null'] }
              }
            },
            intent_score: { type: 'number' },
            deal_probability: { type: 'number' },
            urgency_level: { type: 'string' },
            lead_type: { type: 'string' },
            analysis_explanation: { type: 'string' }
          }
        }
      });
      
      console.log('✅ AI Analysis complete:', result);
      
      // Format for UI display (backward compatibility)
      if (!result.missing_information && result.missing_critical_info) {
        result.missing_information = result.missing_critical_info;
      }
      
      result.verification_questions = [];
      
      // Add clarification questions as primary section
      if (result.clarification_questions?.length > 0) {
        result.verification_questions.push({
          group: 'Clarification Questions',
          questions: result.clarification_questions
        });
      }
      
      // Add missing information
      if (result.missing_information?.length > 0) {
        result.verification_questions.push({
          group: 'Missing Information',
          questions: result.missing_information
        });
      }
      
      // Add extracted info display
      if (result.extracted_info) {
        const extractedItems = Object.entries(result.extracted_info)
          .filter(([_, value]) => value !== null && value !== '')
          .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`);
        
        if (extractedItems.length > 0) {
          result.verification_questions.unshift({
            group: 'Information Already Provided by Customer',
            questions: extractedItems
          });
        }
      }
      
      setAnalysis(result);
    } catch (e) {
      console.error('LeadIntelligencePanel analysis error:', e);
      setAnalysis({ _error: true, _errorMessage: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmailDraft = () => {
    if (!lead.email) return alert('No customer email address available.');
    if (!analysis?.reply_email_draft) return alert('No reply draft available. Please generate the draft first.');

    const subject = encodeURIComponent(`Re: ${lead.inquiry_type || 'Your inquiry'} – ${lead.boat_name || lead.name}`);
    const body = encodeURIComponent(analysis.reply_email_draft);
    logFollowUpNote('E-Mail');
    window.location.href = `mailto:${lead.email}?subject=${subject}&body=${body}`;
  };

  const handleCopyDraft = () => {
    if (!analysis?.reply_email_draft) return;
    navigator.clipboard.writeText(analysis.reply_email_draft);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
    logFollowUpNote('Kopie/Manuell');
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

          {/* Follow-up note confirmation */}
          {noteSaved && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Nachfrage-Vermerk in den Lead-Notizen gespeichert.
            </div>
          )}

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

              {/* Section 2 — Analysis Details */}
              {(analysis.request_category || analysis.technical_interpretation || analysis.work_complexity) && (
                <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  {analysis.request_category && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category: </span>
                      <span className="text-sm text-slate-700">{analysis.request_category}</span>
                    </div>
                  )}
                  {analysis.technical_interpretation && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Technical Assessment: </span>
                      <p className="text-sm text-slate-700 mt-0.5">{analysis.technical_interpretation}</p>
                    </div>
                  )}
                  {analysis.work_complexity && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Complexity: </span>
                      <span className="text-sm text-slate-700">{analysis.work_complexity}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Missing Information */}
              {analysis.missing_information?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Missing Information
                  </p>
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