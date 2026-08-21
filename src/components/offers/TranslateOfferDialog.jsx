import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Languages, Loader2 } from 'lucide-react';

const LANGUAGES = ['English', 'German', 'Italian', 'Slovenian', 'Croatian'];

export default function TranslateOfferDialog({ open, onOpenChange, formData, tasks, onTranslated }) {
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const payload = {
        title: formData.title || '',
        description: formData.description || '',
        customer_notes: formData.customer_notes || '',
        safety_compliance_clause: formData.safety_compliance_clause || '',
        payment_schedule: formData.payment_schedule || '',
        retention_of_title_text: formData.retention_of_title_text || '',
        tasks: tasks.map(t => ({
          title: t.title || '',
          description: t.description || '',
          notes: t.notes || '',
        })),
      };

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a professional translator for yacht service offers.
Translate ALL texts in the following JSON into ${targetLanguage}.

Rules:
- Keep the exact same JSON structure and the same number of tasks in the same order.
- Translate professionally using correct nautical/technical terminology.
- Keep numbers, prices, units, product names, brand names and boat names unchanged.
- If a field is an empty string, return it as an empty string.
- Return ONLY the translated JSON.

JSON to translate:
${JSON.stringify(payload, null, 2)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            customer_notes: { type: 'string' },
            safety_compliance_clause: { type: 'string' },
            payment_schedule: { type: 'string' },
            retention_of_title_text: { type: 'string' },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      });

      onTranslated(result, targetLanguage);
      toast.success(`Angebot auf ${targetLanguage} übersetzt — bitte prüfen und speichern.`);
      onOpenChange(false);
    } catch (err) {
      console.error('Translation error:', err);
      toast.error('Übersetzung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-purple-600" />
            Angebot übersetzen (KI)
          </DialogTitle>
          <DialogDescription>
            Übersetzt alle Angebotstexte — Titel, Einleitung, Kundennotizen, Klauseln und sämtliche Positionen — in die gewählte Sprache. Die Übersetzung wird ins Formular übernommen und kann vor dem Speichern geprüft werden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Zielsprache</Label>
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={translating}>
            Abbrechen
          </Button>
          <Button onClick={handleTranslate} disabled={translating} className="bg-purple-600 hover:bg-purple-700">
            {translating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Übersetze...
              </>
            ) : (
              <>
                <Languages className="h-4 w-4 mr-2" />
                Übersetzen
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}