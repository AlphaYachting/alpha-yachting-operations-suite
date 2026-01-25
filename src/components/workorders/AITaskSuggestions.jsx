import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function AITaskSuggestions({ 
  formData, 
  jobs, 
  boats,
  customers,
  onTasksAdd,
  onNotesUpdate 
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectedNotes, setSelectedNotes] = useState({});

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      const job = jobs?.find(j => j.id === formData.job_id);
      const boat = boats?.find(b => b.id === job?.boat_id);
      const customer = customers?.find(c => c.id === job?.customer_id);

      const prompt = `You are a marine service expert. Based on the following work order details, suggest:
1. A list of 4-6 specific tasks to be completed
2. Safety precautions or notes
3. Internal notes for technicians

Work Order Details:
- Title: ${formData.title}
- Description: ${formData.description || 'Not provided'}
- Estimated Duration: ${formData.estimated_duration_hours || 'Not specified'} hours
- Job Title: ${job?.title || 'N/A'}
- Job Description: ${job?.description || 'N/A'}
- Boat: ${boat?.vessel_name || 'N/A'} (${boat?.vessel_type || ''}, ${boat?.engine_type || ''})
- Engine: ${boat?.engine_manufacturer} ${boat?.engine_model}
- Electrical System: ${boat?.electrical_system || 'N/A'}
- Service Category: ${job?.service_category || 'General Service'}

Return a JSON object with this structure:
{
  "suggested_tasks": [
    { "title": "Task title", "description": "Brief description of what needs to be done", "estimated_hours": 1.5 },
    ...
  ],
  "safety_notes": "Important safety considerations for this work",
  "internal_notes": "Technical notes and tips for technicians"
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
        response_json_schema: {
          type: 'object',
          properties: {
            suggested_tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  estimated_hours: { type: 'number' }
                }
              }
            },
            safety_notes: { type: 'string' },
            internal_notes: { type: 'string' }
          }
        }
      });

      setSuggestions(result);
      setSelectedTasks(result.suggested_tasks?.map((_, i) => i) || []);
      setSelectedNotes({
        safety: !!result.safety_notes,
        internal: !!result.internal_notes
      });
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Failed to generate AI suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuggestions = () => {
    if (!suggestions) return;

    const tasksToAdd = selectedTasks.map(idx => suggestions.suggested_tasks[idx]);
    
    if (tasksToAdd.length > 0) {
      onTasksAdd?.(tasksToAdd);
    }

    if (selectedNotes.safety && suggestions.safety_notes) {
      onNotesUpdate?.('safety_notes', suggestions.safety_notes);
    }

    if (selectedNotes.internal && suggestions.internal_notes) {
      onNotesUpdate?.('internal_notes', suggestions.internal_notes);
    }

    setShowDialog(false);
    toast.success('Suggestions added to work order');
  };

  const toggleTask = (index) => {
    setSelectedTasks(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <>
      <Button 
        type="button" 
        variant="outline"
        onClick={() => {
          setShowDialog(true);
          generateSuggestions();
        }}
        className="border-purple-200 text-purple-700 hover:bg-purple-50"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        AI Suggest Tasks
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI-Powered Task Suggestions
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600 mr-2" />
              <span className="text-slate-600">Analyzing work order details...</span>
            </div>
          ) : suggestions ? (
            <div className="space-y-6">
              {/* Suggested Tasks */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Suggested Tasks</h3>
                <div className="space-y-2">
                  {suggestions.suggested_tasks?.map((task, idx) => (
                    <label 
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTasks.includes(idx)
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Checkbox
                        checked={selectedTasks.includes(idx)}
                        onCheckedChange={() => toggleTask(idx)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{task.title}</p>
                        <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        {task.estimated_hours && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            ~{task.estimated_hours}h
                          </Badge>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Safety Notes */}
              {suggestions.safety_notes && (
                <div>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer hover:border-amber-300 transition-colors">
                    <Checkbox
                      checked={selectedNotes.safety}
                      onCheckedChange={(v) => setSelectedNotes(prev => ({ ...prev, safety: v }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-amber-900">Safety Notes</p>
                      <p className="text-sm text-amber-800 mt-1">{suggestions.safety_notes}</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Internal Notes */}
              {suggestions.internal_notes && (
                <div>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 cursor-pointer hover:border-blue-300 transition-colors">
                    <Checkbox
                      checked={selectedNotes.internal}
                      onCheckedChange={(v) => setSelectedNotes(prev => ({ ...prev, internal: v }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900">Internal Notes</p>
                      <p className="text-sm text-blue-800 mt-1">{suggestions.internal_notes}</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddSuggestions}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Selected ({selectedTasks.length} tasks)
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}