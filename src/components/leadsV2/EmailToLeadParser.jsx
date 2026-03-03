import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Parses a raw email text via AI and pre-fills a lead form data object.
 * Props:
 *  - onLeadParsed(leadData): called with pre-filled lead fields — caller decides what to do with it
 *  - onCancel(): called when user closes the panel
 */
export default function EmailToLeadParser({ onLeadParsed, onCancel }) {
  const [emailText, setEmailText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleParse = async () => {
    if (!emailText.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an assistant that extracts structured lead information from a customer email.

Extract the following fields from the email text below. If a field cannot be determined, leave it as null.

Return a JSON object with these keys:
- name: full name of the sender/contact person
- email: email address of the sender
- phone: phone number if mentioned
- boat_name: name of the boat if mentioned
- boat_details: boat type, length, engine, model, year — any details mentioned
- location: marina or location mentioned
- inquiry_type: one of ["Service Inquiry", "Parts Request", "Maintenance", "Emergency", "Other"]
- priority: one of ["Low", "Medium", "High", "Urgent"] based on urgency in the email
- notes: a short 1-sentence summary of the request
- description: the full original email text (copy it exactly)

Email text:
---
${emailText}
---`,
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          boat_name: { type: 'string' },
          boat_details: { type: 'string' },
          location: { type: 'string' },
          inquiry_type: { type: 'string' },
          priority: { type: 'string' },
          notes: { type: 'string' },
          description: { type: 'string' },
        },
      },
    });

    setLoading(false);

    // Clean up nulls
    const cleaned = {};
    for (const [k, v] of Object.entries(result)) {
      if (v !== null && v !== undefined && v !== '') cleaned[k] = v;
    }
    // Always set contact_method
    cleaned.contact_method = 'Email';
    cleaned.status = 'Pending';
    cleaned.description = emailText; // always preserve original

    setPreview(cleaned);
  };

  const handleConfirm = () => {
    if (preview) onLeadParsed(preview);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Email-Text einfügen</Label>
        <Textarea
          placeholder="E-Mail-Inhalt hier einfügen..."
          rows={8}
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          className="font-mono text-sm"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {preview && (
        <div className="border rounded-lg p-4 bg-slate-50 space-y-2 text-sm">
          <div className="flex items-center gap-2 font-semibold text-slate-700 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Erkannte Daten
          </div>
          {[
            ['Name', preview.name],
            ['Email', preview.email],
            ['Telefon', preview.phone],
            ['Boot', preview.boat_name],
            ['Boot-Details', preview.boat_details],
            ['Standort', preview.location],
            ['Anfrage-Typ', preview.inquiry_type],
            ['Priorität', preview.priority],
            ['Notiz', preview.notes],
          ]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="text-slate-500 w-28 shrink-0">{label}:</span>
                <span className="text-slate-900 font-medium">{value}</span>
              </div>
            ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        {!preview ? (
          <Button onClick={handleParse} disabled={loading || !emailText.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analysiere...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                E-Mail analysieren
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Lead übernehmen
          </Button>
        )}
      </div>
    </div>
  );
}