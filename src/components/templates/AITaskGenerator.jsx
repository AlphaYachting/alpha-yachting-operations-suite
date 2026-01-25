import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AITaskGenerator({ onTasksGenerated }) {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState([]);
  const [error, setError] = useState('');
  const [selectedTasks, setSelectedTasks] = useState(new Set());

  const generateTasks = async () => {
    if (!jobDescription.trim()) {
      setError('Please enter a job description');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedTasks([]);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a marine service expert. Generate a detailed task list for the following job: "${jobDescription}"

Return ONLY a valid JSON array of tasks. Each task must have:
- title: brief task name (string)
- description: detailed description (string)
- default_estimated_hours: estimated duration in hours (number)
- default_role: one of: "Mechanic", "Electrician", "Electronics Tech", "Rigging Specialist", "General Technician" (string)
- required_tools_note: tools/materials needed (string, can be empty)
- is_optional: whether task can be skipped (boolean)
- requires_customer_approval: whether task needs approval (boolean)

Generate 4-8 realistic, actionable tasks. Ensure variety in roles and realistic time estimates.
Return ONLY the JSON array, no other text.`,
        response_json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              default_estimated_hours: { type: "number" },
              default_role: { type: "string" },
              required_tools_note: { type: "string" },
              is_optional: { type: "boolean" },
              requires_customer_approval: { type: "boolean" }
            }
          }
        }
      });

      if (Array.isArray(response)) {
        setGeneratedTasks(response);
      } else {
        setError('Unexpected response format from AI');
      }
    } catch (err) {
      console.error('Error generating tasks:', err);
      setError('Failed to generate tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskSelection = (index) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTasks(newSelected);
  };

  const handleAddTasks = () => {
    const tasksToAdd = Array.from(selectedTasks)
      .map(index => generatedTasks[index])
      .sort((a, b) => (a.default_estimated_hours || 0) - (b.default_estimated_hours || 0));
    
    onTasksGenerated(tasksToAdd);
    setGeneratedTasks([]);
    setSelectedTasks(new Set());
    setJobDescription('');
  };

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">
              Describe the job or service
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="e.g., Routine engine maintenance for a 35ft yacht, including oil change, filter replacement, and inspection"
              className="w-full min-h-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              onClick={generateTasks}
              disabled={loading || !jobDescription.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate with AI
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Generated Tasks */}
      {generatedTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              Suggested Tasks ({selectedTasks.size} selected)
            </h3>
            <Button
              onClick={() => {
                setSelectedTasks(new Set(generatedTasks.map((_, i) => i)));
              }}
              variant="outline"
              size="sm"
            >
              Select All
            </Button>
          </div>

          <div className="space-y-2">
            {generatedTasks.map((task, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-all ${
                  selectedTasks.has(index)
                    ? 'border-blue-300 bg-blue-50'
                    : 'hover:border-slate-300'
                }`}
                onClick={() => toggleTaskSelection(index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-5 w-5 rounded border mt-0.5 flex items-center justify-center transition-colors ${
                        selectedTasks.has(index)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedTasks.has(index) && (
                        <Plus className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900">
                        {task.title}
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <Badge variant="outline" className="text-xs">
                          {task.default_estimated_hours}h
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {task.default_role}
                        </Badge>
                        {task.is_optional && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs">
                            Optional
                          </Badge>
                        )}
                        {task.requires_customer_approval && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">
                            Needs Approval
                          </Badge>
                        )}
                      </div>
                      {task.required_tools_note && (
                        <p className="text-xs text-slate-500 mt-2">
                          <span className="font-medium">Tools:</span> {task.required_tools_note}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedTasks.size > 0 && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleAddTasks}
                className="bg-green-600 hover:bg-green-700 flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {selectedTasks.size} Task{selectedTasks.size !== 1 ? 's' : ''}
              </Button>
              <Button
                onClick={() => {
                  setGeneratedTasks([]);
                  setSelectedTasks(new Set());
                }}
                variant="outline"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}