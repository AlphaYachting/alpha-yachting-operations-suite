import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function AIOfferGenerator({ formData, customers, boats, jobs, onTasksGenerated, onDescriptionGenerated, existingTasks = [] }) {
  const [prompt, setPrompt] = useState('');
  const [defaultUnitPrice, setDefaultUnitPrice] = useState(70);
  const [detailedExplanations, setDetailedExplanations] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [pendingDescription, setPendingDescription] = useState('');
  const [keepExisting, setKeepExisting] = useState(true);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description of the work needed');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const customer = customers.find(c => c.id === formData.customer_id);
      const boat = boats.find(b => b.id === formData.boat_id);
      const job = jobs.find(j => j.id === formData.job_id);

      const languageMap = {
        'German': 'German (Deutsch)',
        'English': 'English',
        'Italian': 'Italian (Italiano)',
        'Slovenian': 'Slovenian (Slovenščina)',
        'Croatian': 'Croatian (Hrvatski)'
      };

      const context = `
IMPORTANT: Generate ALL content in ${languageMap[formData.language] || 'German'}.

Customer: ${customer?.company_name || `${customer?.first_name} ${customer?.last_name}`}
${boat ? `Boat: ${boat.vessel_name} (${boat.manufacturer} ${boat.model}, ${boat.year})` : ''}
${boat?.engine_manufacturer ? `Engine: ${boat.engine_manufacturer} ${boat.engine_model || ''}` : ''}
${job ? `Related Job: ${job.title}` : ''}

Work Description:
${prompt}

Generate a detailed list of tasks for this service offer. For each task, provide:
- A clear, concise title in ${languageMap[formData.language] || 'German'} (max 60 characters)
- ${detailedExplanations ? 'A detailed technical description with proper structure:\n  • Use bullet points with "• " at the start of each point\n  • Put each bullet point on a new line\n  • Group related steps under clear subtopics\n  • Keep each bullet point concise but complete\n  • Separate main sections with a blank line' : 'A brief, simple description that a non-technical customer can understand. If using bullet points, start each with "• " and put each on a new line'}
- Quantity needed (e.g., hours for labor, pieces for parts, square meters for surface work, etc.)
- Appropriate unit type (Hour, Piece, Square Meter, Linear Meter, Liter, Kilogram, Set, or Lump Sum)

Be practical and realistic with estimates. Consider travel time if it's mobile service work.

REMEMBER: Write everything in ${languageMap[formData.language] || 'German'}.
`.trim();

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: context,
        response_json_schema: {
          type: 'object',
          properties: {
            client_description: {
              type: 'string',
              description: 'A brief, professional description for the client explaining the issue and proposed solution (2-4 sentences)'
            },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  unit_type: { type: 'string' },
                  quantity: { type: 'number' }
                },
                required: ['title', 'quantity']
              }
            }
          },
          required: ['client_description', 'tasks']
        }
      });

      if (response.tasks && Array.isArray(response.tasks)) {
        const tasksWithPrices = response.tasks.map(task => ({
          ...task,
          unit_type: task.unit_type || 'Hour',
          unit_price: defaultUnitPrice,
          total_amount: task.quantity * defaultUnitPrice
        }));
        
        // Check if there are existing tasks
        if (existingTasks && existingTasks.length > 0) {
          setPendingTasks(tasksWithPrices);
          setPendingDescription(response.client_description || '');
          setShowConfirmDialog(true);
          setGenerating(false);
        } else {
          // No existing tasks, apply directly
          onTasksGenerated(tasksWithPrices);
          if (response.client_description && onDescriptionGenerated) {
            onDescriptionGenerated(response.client_description);
          }
          setGenerating(false);
          setPrompt('');
        }
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (err) {
      console.error('AI generation error:', err);
      setError(err.message || 'Failed to generate tasks. Please try again.');
      setGenerating(false);
    }
  };

  const handleConfirmApply = () => {
    const finalTasks = keepExisting 
      ? [...existingTasks, ...pendingTasks]
      : pendingTasks;
    
    onTasksGenerated(finalTasks);
    
    if (pendingDescription && onDescriptionGenerated) {
      onDescriptionGenerated(pendingDescription);
    }
    
    setShowConfirmDialog(false);
    setPendingTasks([]);
    setPendingDescription('');
    setPrompt('');
    setKeepExisting(true);
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Describe the Work Needed</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Annual engine service for a 40hp Yamaha outboard, including oil change, filter replacement, spark plugs, and general inspection..."
          rows={6}
          disabled={generating}
        />
        <p className="text-xs text-slate-500">
          Be specific about the type of work, equipment involved, and any special requirements
        </p>
      </div>

      <div className="space-y-2">
        <Label>Default Unit Price (€)</Label>
        <Input
          type="number"
          step="1"
          min="0"
          value={defaultUnitPrice}
          onChange={(e) => setDefaultUnitPrice(parseFloat(e.target.value) || 70)}
          disabled={generating}
        />
        <p className="text-xs text-slate-500">
          This price will be applied to all generated tasks (you can adjust individual tasks later)
        </p>
      </div>

      <div className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg">
        <Checkbox
          id="detailed-explanations"
          checked={detailedExplanations}
          onCheckedChange={setDetailedExplanations}
          disabled={generating}
        />
        <div className="flex-1">
          <Label htmlFor="detailed-explanations" className="cursor-pointer font-medium">
            Generate detailed technical explanations
          </Label>
          <p className="text-xs text-slate-500 mt-1">
            Include technical specifications and procedures (recommended for technically knowledgeable clients)
          </p>
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating Tasks...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Tasks with AI
          </>
        )}
      </Button>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bestehende Tasks gefunden</DialogTitle>
            <DialogDescription>
              Es gibt bereits {existingTasks.length} Task(s) in diesem Angebot. 
              Möchten Sie die bestehenden Tasks behalten und die neuen hinzufügen?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="keep-existing"
                checked={keepExisting}
                onCheckedChange={setKeepExisting}
              />
              <label
                htmlFor="keep-existing"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Bestehende Tasks behalten ({existingTasks.length} Task(s))
              </label>
            </div>
            
            <div className="text-sm text-slate-600">
              {keepExisting ? (
                <p>✓ Die {pendingTasks.length} neuen Task(s) werden zu den bestehenden hinzugefügt.</p>
              ) : (
                <p className="text-amber-600">⚠ Die bestehenden Tasks werden durch {pendingTasks.length} neue ersetzt.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleConfirmApply} className="bg-blue-600 hover:bg-blue-700">
              Anwenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}