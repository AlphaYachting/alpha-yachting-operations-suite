import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Parses a raw email / free text via AI into customer form fields.
 * Props: onCustomerParsed(customerData), onCancel()
 */
export default function EmailToCustomerParser({ onCustomerParsed, onCancel }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract structured customer master data from the text below (usually an email or signature). Leave a field null if it cannot be determined.

Rules:
- customer_type: "Private" for individuals, otherwise "Business", "Charter Company" or "Marina Partner"
- preferred_language: language the text is written in, one of German, English, Italian, Slovenian, Croatian
- vat_number: VAT-ID / OIB / Steuernummer
- notes: short 1-sentence summary of relevant context (not the whole text)

Text:
---
${text}
---`,
        response_json_schema: {
          type: 'object',
          properties: {
            company_name: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            phone_secondary: { type: 'string' },
            customer_type: { type: 'string' },
            preferred_language: { type: 'string' },
            billing_address: { type: 'string' },
            billing_postal_code: { type: 'string' },
            billing_city: { type: 'string' },
            billing_country: { type: 'string' },
            vat_number: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      });

      const parsed = (result && typeof result === 'object' && !Array.isArray(result)) ? result : {};
      const cleaned = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== null && v !== undefined && v !== '') cleaned[k] = v;
      }
      setPreview(cleaned);
    } catch (err) {
      setError('Analyse fehlgeschlagen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>E-Mail / Text einfügen</Label>
        <Textarea
          placeholder="E-Mail-Inhalt oder Signatur hier einfügen..."
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
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
            ['Firma', preview.company_name],
            ['Vorname', preview.first_name],
            ['Nachname', preview.last_name],
            ['E-Mail', preview.email],
            ['Telefon', preview.phone],
            ['Telefon 2', preview.phone_secondary],
            ['Typ', preview.customer_type],
            ['Sprache', preview.preferred_language],
            ['Adresse', preview.billing_address],
            ['PLZ', preview.billing_postal_code],
            ['Ort', preview.billing_city],
            ['Land', preview.billing_country],
            ['VAT / OIB', preview.vat_number],
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
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        {!preview ? (
          <Button type="button" onClick={handleParse} disabled={loading || !text.trim()}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysiere...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Text analysieren</>
            )}
          </Button>
        ) : (
          <Button type="button" onClick={() => onCustomerParsed(preview)} className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Formular ausfüllen
          </Button>
        )}
      </div>
    </div>
  );
}