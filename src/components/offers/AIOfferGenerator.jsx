import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';

export default function AIOfferGenerator({ formData, customers, boats, jobs, onTasksGenerated }) {
  const [prompt, setPrompt] = useState('');
  const [defaultUnitPrice, setDefaultUnitPrice] = useState(50);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

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

      const context = `
Customer: ${customer?.company_name || `${customer?.first_name} ${customer?.last_name}`}
${boat ? `Boat: ${boat.vessel_name} (${boat.manufacturer} ${boat.model}, ${boat.year})` : ''}
${boat?.engine_manufacturer ? `Engine: ${boat.engine_manufacturer} ${boat.engine_model || ''}` : ''}
${job ? `Related Job: ${job.title}` : ''}

Work Description:
${prompt}

Generate a detailed list of tasks for this service offer. For each task, provide:
- A clear, specific title
- A brief description of what the task involves
- Estimated hours to complete the task

Be practical and realistic with time estimates. Consider travel time if it's mobile service work.
`.trim();

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: context,
        response_json_schema: {
          type: 'object',
          properties: {
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
          required: ['tasks']
        }
      });

      if (response.tasks && Array.isArray(response.tasks)) {
        const tasksWithPrices = response.tasks.map(task => ({
          ...task,
          unit_type: task.unit_type || 'Hour',
          unit_price: defaultUnitPrice,
          total_amount: task.quantity * defaultUnitPrice
        }));
        onTasksGenerated(tasksWithPrices);
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (err) {
      console.error('AI generation error:', err);
      setError(err.message || 'Failed to generate tasks. Please try again.');
      setGenerating(false);
    }
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
          onChange={(e) => setDefaultUnitPrice(parseFloat(e.target.value) || 50)}
          disabled={generating}
        />
        <p className="text-xs text-slate-500">
          This price will be applied to all generated tasks (you can adjust individual tasks later)
        </p>
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
    </div>
  );
}