import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerNotesGenerator({ formData, tasks, onGenerated }) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!hint.trim()) return;
    setLoading(true);
    const taskList = (tasks || []).filter(t => t.item_type !== 'Chapter').map(t => `- ${t.title}`).join('\n');
    const text = await base44.integrations.Core.InvokeLLM({
      prompt: `You write the "customer notes" section of a boat service offer from Alpha Yachting.
Write in ${formData.language || 'German'}. Tone: friendly, professional, personal (use formal "Sie" in German).
Keep it concise (2-5 sentences), plain text only, no greeting line, no signature, no prices unless the hint mentions them.

The author's instruction / what should be said:
"${hint}"

Offer context:
Title: ${formData.title || '-'}
Description: ${formData.description || '-'}
Positions:
${taskList || '-'}

Return only the final note text.`
    });
    onGenerated(String(text).trim());
    setLoading(false);
    setOpen(false);
    setHint('');
    toast.success('Customer Notes erstellt');
  };

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}
        className="text-purple-600 border-purple-300 hover:bg-purple-50">
        <Sparkles className="h-3 w-3 mr-1" />
        Generate Text
      </Button>
    );
  }

  return (
    <div className="flex gap-2 w-full">
      <Input autoFocus value={hint} onChange={(e) => setHint(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && generate()}
        placeholder="Hinweis, z. B. Termin nur nach Kranung möglich, Material wird bestellt…" />
      <Button type="button" size="sm" onClick={generate} disabled={loading || !hint.trim()}
        className="bg-purple-600 hover:bg-purple-700">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Erstellen'}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
        Abbrechen
      </Button>
    </div>
  );
}