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
    
    parts.push(`You are an expert marine services business analyst. Analyze this customer inquiry and extract structured information.`);
    parts.push(`\n📧 CUSTOMER INQUIRY:`);
    if (lead.name) parts.push(`Name: ${lead.name}`);
    if (lead.email) parts.push(`Email: ${lead.email}`);
    if (lead.phone) parts.push(`Phone: ${lead.phone}`);
    if (lead.description) parts.push(`\nMessage:\n${lead.description}`);
    if (lead.boat_name) parts.push(`\nBoat: ${lead.boat_name}`);
    if (lead.location) parts.push(`Location mentioned: ${lead.location}`);
    
    parts.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    parts.push(`🎯 YOUR TASK:`);
    parts.push(`1. EXTRACT all information the customer HAS PROVIDED`);
    parts.push(`2. IDENTIFY what critical information is MISSING to fulfill their SPECIFIC request`);
    parts.push(`3. UNDERSTAND the customer's motivation/context (WHY do they need this?)`);
    parts.push(`4. ASSESS their buying intent and urgency`);
    parts.push(`5. GENERATE a professional follow-up email in the SAME LANGUAGE as the inquiry`);
    parts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    parts.push(`🔴 CRITICAL RULES - READ CAREFULLY:`);
    parts.push(`\n1. CHECK WHAT CUSTOMER ALREADY PROVIDED:`);
    parts.push(`   • If they mentioned location → DO NOT ASK FOR LOCATION`);
    parts.push(`   • If they mentioned boat type → DO NOT ASK FOR BOAT TYPE`);
    parts.push(`   • If they mentioned engine model → DO NOT ASK FOR ENGINE MODEL`);
    parts.push(`   • Example: "ACI Marina Pomer" = LOCATION PROVIDED ✓`);
    parts.push(`\n2. ASK ONLY SERVICE-SPECIFIC QUESTIONS:`);
    parts.push(`   • Compression test → WHY? (Symptoms: hard start, smoke, power loss?), TIMELINE, ACCESS`);
    parts.push(`   • Antifouling → TIMELINE, boat length only if not mentioned`);
    parts.push(`   • Engine parts → ENGINE SERIAL NUMBER (mandatory!)`);
    parts.push(`   • Repair → PROBLEM DESCRIPTION, symptoms, when did it start?`);
    parts.push(`\n3. NEVER ASK:`);
    parts.push(`   • "Wo liegt das Boot?" if location already mentioned`);
    parts.push(`   • "Bootstyp/Hersteller/Modell" for simple service tasks (compression test, inspection)`);
    parts.push(`   • "Bootslänge" unless it's pricing-relevant (antifouling, painting, transport)`);
    parts.push(`\n4. LANGUAGE & TONE:`);
    parts.push(`   • Match customer's language exactly (German ↔ German)`);
    parts.push(`   • Professional but warm tone\n`);

    parts.push(`Return ONLY valid JSON:
{
  "extracted_info": {
    "boat_location": "<marina/harbor name if mentioned, or null>",
    "boat_type": "<sailboat/motorboat/etc if mentioned, or null>",
    "boat_length": "<length in meters if mentioned, or null>",
    "boat_brand": "<manufacturer if mentioned, or null>",
    "engine_details": "<engine type/model if mentioned, or null>",
    "service_requested": "<what they want done>",
    "timeline": "<when they need it, or null>",
    "customer_motivation": "<why they need this service, or null>"
  },
  "missing_critical_info": [
    "<specific question 1>",
    "<specific question 2>"
  ],
  "intent_score": <0-100>,
  "deal_probability": <0-100>,
  "urgency_level": <"Low" | "Medium" | "High" | "Urgent">,
  "lead_type": <"Hot Lead" | "Qualified Prospect" | "Information Seeker" | "Price Shopper">,
  "analysis_explanation": "<1-2 sentence analysis>",
  "reply_email_draft": "<complete professional email in customer's language>"
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
            missing_critical_info: {
              type: 'array',
              items: { type: 'string' }
            },
            intent_score: { type: 'number' },
            deal_probability: { type: 'number' },
            urgency_level: { type: 'string' },
            lead_type: { type: 'string' },
            analysis_explanation: { type: 'string' },
            reply_email_draft: { type: 'string' }
          }
        }
      });
      
      console.log('✅ AI Analysis complete:', result);
      
      // Format for UI display
      result.missing_information = result.missing_critical_info || [];
      result.verification_questions = [{
        group: 'AI-Identified Missing Information',
        questions: result.missing_critical_info || []
      }];
      
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
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Missing Information
                    {analysis._debug_extracted_count !== undefined && (
                      <span className="ml-2 text-purple-600">
                        [Backend extracted: {analysis._debug_extracted_count} items]
                      </span>
                    )}
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