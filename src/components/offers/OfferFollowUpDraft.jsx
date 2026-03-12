import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Mail, Loader2, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function OfferFollowUpDraft({ open, onOpenChange, offer, customer, boat }) {
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState(null);
  const [copied, setCopied] = useState(null);

  const handleOpen = (isOpen) => {
    if (!isOpen) { setDraft(null); setCopied(null); }
    onOpenChange(isOpen);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setDraft(null);
    try {
      const firstName = customer?.first_name || '';
      const lastName  = customer?.last_name  || '';
      const isCompany = customer?.customer_type !== 'Private' || !!customer?.company_name;
      const customerName = customer?.company_name || `${firstName} ${lastName}`.trim();
      const language = offer?.language || 'German';
      const boatInfo = boat
        ? `${boat.vessel_name}${boat.manufacturer ? ` (${boat.manufacturer}${boat.model ? ' ' + boat.model : ''})` : ''}`
        : '';

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are writing a short, polite follow-up email for Alpha Yachting, a professional yacht service company.

Language: ${language}
Customer name: ${customerName || 'Customer'}
Is company customer: ${isCompany}
Customer email: ${customer?.email || ''}
Offer number: ${offer?.offer_number || '(no number)'}
Offer title: ${offer?.title || '(no title)'}
Offer total: ${offer?.total_amount != null ? '€' + Number(offer.total_amount).toFixed(2) : 'not specified'}
Boat: ${boatInfo || 'not specified'}

Generate a JSON with exactly these fields:
- "to": the customer email address
- "subject": ALWAYS start with "Nachfrage zu Angebot" followed by the offer number if available (e.g. "Nachfrage zu Angebot #OFF-2026-0012"). If language is not German, translate "Nachfrage zu Angebot" accordingly (English: "Enquiry regarding Offer", Italian: "Richiesta relativa all'offerta", Croatian: "Upit u vezi ponude", Slovenian: "Povpraševanje glede ponudbe").
- "salutation": the correct formal salutation line only (e.g. "Sehr geehrter Herr Müller," or "Dear Sir or Madam,")
- "body": the FULL email text. It MUST start with the formal salutation on the first line, followed by a blank line, then the message. The email should:
  • Greet the customer
  • Politely ask if they have had a chance to review the offer
  • Offer to answer any questions or provide clarification
  • Friendly, professional closing signed "Ihr Alpha Yachting Team"
  • Maximum 4 sentences total (excl. salutation and closing)
  • NO payment pressure, NO legal language, NO aggressive tone
  • Reference offer number and/or boat naturally if available

Respond ONLY in ${language}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            to:         { type: 'string' },
            subject:    { type: 'string' },
            salutation: { type: 'string' },
            body:       { type: 'string' },
          },
        },
      });

      setDraft({
        to:      result.to      || customer?.email || '',
        subject: result.subject || '',
        body:    result.body    || '',
      });
    } catch (err) {
      console.error(err);
      toast.error('Fehler beim Generieren der E-Mail');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (field, text) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Kopiert');
  };

  const handleOpenMailto = () => {
    if (!draft) return;
    window.open(
      `mailto:${draft.to}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`,
      '_self'
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-sky-600" />
            Follow-up E-Mail generieren
          </DialogTitle>
          <DialogDescription>
            Erstellt einen persönlichen Entwurf — kein automatischer Versand.
          </DialogDescription>
        </DialogHeader>

        {/* Before generation */}
        {!draft && !generating && (
          <div className="py-6 flex flex-col items-center gap-3">
            <p className="text-sm text-slate-600 text-center">
              Generiert Betreff, Anrede und Text basierend auf dem Angebot
              {offer?.offer_number ? ` #${offer.offer_number}` : ''}.
            </p>
            <Button onClick={handleGenerate} className="bg-sky-600 hover:bg-sky-700">
              <Sparkles className="h-4 w-4 mr-2" />
              Jetzt generieren
            </Button>
          </div>
        )}

        {/* Loading */}
        {generating && (
          <div className="py-6 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            <p className="text-sm text-slate-500">Generiere E-Mail-Entwurf…</p>
          </div>
        )}

        {/* Draft result */}
        {draft && !generating && (
          <div className="space-y-4 mt-1">
            <Field label="An" value={draft.to}      field="to"      copied={copied} onCopy={handleCopy} />
            <Field label="Betreff" value={draft.subject} field="subject" copied={copied} onCopy={handleCopy} />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">E-Mail-Text</Label>
                <CopyBtn field="body" copied={copied} onCopy={() => handleCopy('body', draft.body)} />
              </div>
              <Textarea
                value={draft.body}
                readOnly
                className="bg-slate-50 text-sm resize-none leading-relaxed"
                rows={8}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Neu generieren
              </Button>
              <Button
                size="sm"
                onClick={handleOpenMailto}
                className="flex-1 bg-sky-600 hover:bg-sky-700"
              >
                <Mail className="h-3 w-3 mr-1" />
                In E-Mail-Client öffnen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, field, copied, onCopy }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</Label>
        <CopyBtn field={field} copied={copied} onCopy={() => onCopy(field, value)} />
      </div>
      <Input value={value} readOnly className="bg-slate-50 text-sm" />
    </div>
  );
}

function CopyBtn({ field, copied, onCopy }) {
  return (
    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={onCopy}>
      {copied === field
        ? <Check className="h-3 w-3 text-green-600" />
        : <Copy className="h-3 w-3 text-slate-400" />
      }
    </Button>
  );
}