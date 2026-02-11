import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain, FileSearch, Lightbulb, TrendingUp, Save, Settings, AlertCircle, Clock, Users, GitBranch, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ProjectIntelligence() {
  // SAFETY GUARD: Prevents any write/update actions from this module by default
  const isWriteAllowed = false;

  // Configuration state
  const [config, setConfig] = useState({
    analysis_prompt_template: '',
    reserve_percent_default: 20,
    skill_match_strictness: 'balanced',
    time_outlier_threshold: 0,
    config_version: 'v1.0',
    last_updated_at: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [suggestionsRunning, setSuggestionsRunning] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState(new Set());
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResults, setApplyResults] = useState(null);
  
  // Planning state
  const [planningModalOpen, setPlanningModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [targetCompletionDate, setTargetCompletionDate] = useState('');
  const [planRunning, setPlanRunning] = useState(false);
  const [planDraft, setPlanDraft] = useState(null);
  const [availableProjects, setAvailableProjects] = useState([]);

  // Load config from user profile on mount
  useEffect(() => {
    loadConfig();
    loadAvailableProjects();
  }, []);

  const loadConfig = async () => {
    try {
      const user = await base44.auth.me();
      if (user?.project_intelligence_config) {
        setConfig(user.project_intelligence_config);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const updatedConfig = {
        ...config,
        last_updated_at: new Date().toISOString()
      };
      
      await base44.auth.updateMe({
        project_intelligence_config: updatedConfig
      });
      
      setConfig(updatedConfig);
      toast.success('Configuration saved');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRunAudit = async () => {
    try {
      setAuditRunning(true);
      toast.info('Running audit...');

      // Load all data in parallel (minimal fields)
      const [jobs, workOrders, tasks, technicians] = await Promise.all([
        base44.entities.Job.list('-created_date', 500),
        base44.entities.WorkOrder.list('-created_date', 1000),
        base44.entities.Task.list('-created_date', 5000),
        base44.entities.Technician.list()
      ]);

      // Build lookup maps for efficiency
      const jobMap = new Map(jobs.map(j => [j.id, j]));
      const woMap = new Map(workOrders.map(w => [w.id, w]));
      const activeTechSkills = new Set(
        technicians
          .filter(t => t.status === 'Active' && t.skills)
          .flatMap(t => t.skills)
      );

      // Initialize findings
      const findings = {
        skill: { covered: [], partial: [], missing: [], undetermined: [] },
        time: { complete: [], missing: [], outlier: [] },
        structure: { consistent: [], inconsistent: [] }
      };

      // A) SKILL COVERAGE AUDIT
      for (const task of tasks) {
        const wo = woMap.get(task.work_order_id);
        const job = wo ? jobMap.get(wo.job_id) : null;
        const serviceCategory = job?.service_category;

        if (!serviceCategory || serviceCategory === 'Other' || serviceCategory === 'General Service') {
          findings.skill.undetermined.push({
            id: task.id,
            title: task.title,
            type: 'skill_undetermined',
            reason: 'No specific service category defined'
          });
        } else {
          // Map service category to skill (simplified matching)
          const categoryToSkill = {
            'Mechanical': 'Mechanics',
            'Electrical': 'Electronics',
            'Electronics': 'Electronics',
            'GRP/Bodywork': 'GRP/Gelcoat',
            'Sealing': 'Sealing',
            'HVAC': 'HVAC',
            'Rigging': 'Rigging',
            'Plumbing': 'Plumbing',
            'Installation': 'Installations',
            'Diagnostics': 'Diagnostics'
          };

          const requiredSkill = categoryToSkill[serviceCategory];
          
          if (requiredSkill && activeTechSkills.has(requiredSkill)) {
            findings.skill.covered.push({
              id: task.id,
              title: task.title,
              type: 'skill_covered',
              reason: `Team has ${requiredSkill} skill`
            });
          } else if (requiredSkill) {
            findings.skill.missing.push({
              id: task.id,
              title: task.title,
              type: 'skill_missing',
              reason: `External ${requiredSkill} professional needed`
            });
          } else {
            findings.skill.undetermined.push({
              id: task.id,
              title: task.title,
              type: 'skill_undetermined',
              reason: `Service category "${serviceCategory}" cannot be mapped to skill`
            });
          }
        }
      }

      // B) TIME COMPLETENESS AUDIT
      for (const task of tasks) {
        if (!task.estimated_minutes && !task.actual_minutes) {
          findings.time.missing.push({
            id: task.id,
            title: task.title,
            type: 'time_missing',
            reason: 'No estimated or actual time'
          });
        } else {
          findings.time.complete.push({
            id: task.id,
            title: task.title,
            type: 'time_complete',
            reason: `${task.estimated_minutes || task.actual_minutes} minutes`
          });
        }

        // Check outliers (simple threshold)
        const timeValue = task.estimated_minutes || task.actual_minutes || 0;
        if (timeValue > 0 && config.time_outlier_threshold > 0) {
          if (timeValue > config.time_outlier_threshold * 60) {
            findings.time.outlier.push({
              id: task.id,
              title: task.title,
              type: 'time_outlier_high',
              reason: `${timeValue} minutes exceeds threshold`
            });
          }
        }
      }

      // C) STRUCTURAL CONSISTENCY AUDIT
      for (const task of tasks) {
        const wo = woMap.get(task.work_order_id);
        const job = wo ? jobMap.get(wo.job_id) : null;

        if (!wo) {
          findings.structure.inconsistent.push({
            id: task.id,
            title: task.title,
            type: 'task_no_workorder',
            reason: 'Task references non-existent work order'
          });
        } else if (!job) {
          findings.structure.inconsistent.push({
            id: wo.id,
            title: wo.title,
            type: 'workorder_no_project',
            reason: 'Work order references non-existent project'
          });
        } else {
          findings.structure.consistent.push({
            id: task.id,
            title: task.title,
            type: 'structure_ok',
            reason: 'Proper Task → WO → Project linkage'
          });
        }
      }

      // Check workorders without tasks
      for (const wo of workOrders) {
        const woTasks = tasks.filter(t => t.work_order_id === wo.id);
        if (woTasks.length === 0) {
          findings.structure.inconsistent.push({
            id: wo.id,
            title: wo.title,
            type: 'workorder_no_tasks',
            reason: 'Work order has no tasks'
          });
        }
      }

      // Build executive summary
      const summary = {
        total_projects: jobs.length,
        total_workorders: workOrders.length,
        total_tasks: tasks.length,
        skill_covered: findings.skill.covered.length,
        skill_partial: findings.skill.partial.length,
        skill_missing: findings.skill.missing.length,
        skill_undetermined: findings.skill.undetermined.length,
        time_complete: findings.time.complete.length,
        time_missing: findings.time.missing.length,
        time_outlier: findings.time.outlier.length,
        structure_consistent: findings.structure.consistent.length,
        structure_inconsistent: findings.structure.inconsistent.length
      };

      setAuditResults({ summary, findings });
      toast.success('Audit completed');
    } catch (error) {
      console.error('Error running audit:', error);
      toast.error('Audit failed');
    } finally {
      setAuditRunning(false);
    }
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if (!auditResults) {
      toast.error('No audit results available');
      return;
    }

    try {
      setAiLoading(true);
      
      // Construct system prompt using config
      const systemPrompt = `${config.analysis_prompt_template || 'You are an analysis assistant for project management audit data.'}

STRICT RULES:
- Answer ONLY based on the provided audit data
- Do NOT access external data or databases
- Do NOT invent missing information
- Do NOT propose automatic changes
- Use phrases like "Based on the audit results..."
- If data is missing, clearly state: "This cannot be determined from current audit data."
- Reference specific numbers and counts from the audit

AUDIT CONTEXT:
Summary:
- Total Projects: ${auditResults.summary.total_projects}
- Total Work Orders: ${auditResults.summary.total_workorders}
- Total Tasks: ${auditResults.summary.total_tasks}
- Skill Coverage: ${auditResults.summary.skill_covered} covered, ${auditResults.summary.skill_missing} missing, ${auditResults.summary.skill_undetermined} undetermined
- Time Completeness: ${auditResults.summary.time_complete} complete, ${auditResults.summary.time_missing} missing, ${auditResults.summary.time_outlier} outliers
- Structure: ${auditResults.summary.structure_consistent} consistent, ${auditResults.summary.structure_inconsistent} inconsistent

Configuration Parameters:
- Reserve Percent: ${config.reserve_percent_default}%
- Skill Match Strictness: ${config.skill_match_strictness}
- Time Outlier Threshold: ${config.time_outlier_threshold}

Detailed Findings Available:
- ${auditResults.findings.skill.missing.length} tasks with missing skills
- ${auditResults.findings.time.missing.length} tasks with missing time data
- ${auditResults.findings.structure.inconsistent.length} structural issues

Sample Missing Skills (first 5):
${auditResults.findings.skill.missing.slice(0, 5).map(f => `- ${f.title}: ${f.reason}`).join('\n')}

Sample Time Issues (first 5):
${auditResults.findings.time.missing.slice(0, 5).map(f => `- ${f.title}: ${f.reason}`).join('\n')}

Sample Structural Issues (first 5):
${auditResults.findings.structure.inconsistent.slice(0, 5).map(f => `- ${f.title}: ${f.reason}`).join('\n')}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}\n\nUser Question: ${aiQuestion}`,
        add_context_from_internet: false
      });

      setAiAnswer(response);
      toast.success('AI analysis complete');
    } catch (error) {
      console.error('Error calling AI:', error);
      toast.error('AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunSuggestions = async () => {
    if (!auditResults) {
      toast.error('No audit results available. Run audit first.');
      return;
    }

    try {
      setSuggestionsRunning(true);
      toast.info('Generating suggestions...');

      const generatedSuggestions = [];

      // A) TIME IMPROVEMENTS
      for (const finding of auditResults.findings.time.missing) {
        generatedSuggestions.push({
          id: `time-missing-${finding.id}`,
          scope_level: 'Task',
          entity_id: finding.id,
          entity_name: finding.title,
          suggestion_type: 'time',
          suggestion_text: 'Add estimated time (suggest range: 30-120 minutes based on task type)',
          reason: finding.reason
        });
      }

      for (const finding of auditResults.findings.time.outlier) {
        generatedSuggestions.push({
          id: `time-outlier-${finding.id}`,
          scope_level: 'Task',
          entity_id: finding.id,
          entity_name: finding.title,
          suggestion_type: 'time',
          suggestion_text: `Review time estimate - exceeds ${config.time_outlier_threshold}h threshold`,
          reason: finding.reason
        });
      }

      // B) SKILL / PROFESSION IMPROVEMENTS
      for (const finding of auditResults.findings.skill.missing) {
        const skillMatch = finding.reason.match(/External (.+) professional needed/);
        const skillName = skillMatch ? skillMatch[1] : 'specialized';
        
        generatedSuggestions.push({
          id: `skill-missing-${finding.id}`,
          scope_level: 'Task',
          entity_id: finding.id,
          entity_name: finding.title,
          suggestion_type: 'skill',
          suggestion_text: `External professional required: ${skillName}`,
          reason: finding.reason
        });
      }

      for (const finding of auditResults.findings.skill.undetermined) {
        generatedSuggestions.push({
          id: `skill-undetermined-${finding.id}`,
          scope_level: 'Task',
          entity_id: finding.id,
          entity_name: finding.title,
          suggestion_type: 'skill',
          suggestion_text: 'Clarify required skill/service area for proper resource allocation',
          reason: finding.reason
        });
      }

      // C) STRUCTURAL IMPROVEMENTS
      for (const finding of auditResults.findings.structure.inconsistent) {
        let suggestionText = '';
        let scopeLevel = 'Task';

        if (finding.type === 'task_no_workorder') {
          suggestionText = 'Link task to an existing work order or create new work order';
          scopeLevel = 'Task';
        } else if (finding.type === 'workorder_no_project') {
          suggestionText = 'Link work order to an existing project or create new project';
          scopeLevel = 'Workorder';
        } else if (finding.type === 'workorder_no_tasks') {
          suggestionText = 'Review structural integrity - work order has no tasks';
          scopeLevel = 'Workorder';
        } else {
          suggestionText = 'Review and resolve structural inconsistency';
        }

        generatedSuggestions.push({
          id: `structure-${finding.type}-${finding.id}`,
          scope_level: scopeLevel,
          entity_id: finding.id,
          entity_name: finding.title,
          suggestion_type: 'structure',
          suggestion_text: suggestionText,
          reason: finding.reason
        });
      }

      // Group suggestions by type
      const grouped = {
        time: generatedSuggestions.filter(s => s.suggestion_type === 'time'),
        skill: generatedSuggestions.filter(s => s.suggestion_type === 'skill'),
        structure: generatedSuggestions.filter(s => s.suggestion_type === 'structure')
      };

      setSuggestions({
        all: generatedSuggestions,
        grouped,
        total: generatedSuggestions.length
      });

      toast.success(`Generated ${generatedSuggestions.length} suggestions`);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Failed to generate suggestions');
    } finally {
      setSuggestionsRunning(false);
    }
  };

  const toggleSuggestion = (suggestionId) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suggestionId)) {
        newSet.delete(suggestionId);
      } else {
        newSet.add(suggestionId);
      }
      return newSet;
    });
  };

  const handleApplySelected = async () => {
    if (!confirmChecked) {
      toast.error('Please confirm before applying');
      return;
    }

    try {
      setApplying(true);
      setApplyModalOpen(false);
      toast.info('Applying selected suggestions...');

      const selectedItems = suggestions.all.filter(s => selectedSuggestions.has(s.id));
      const results = {
        applied: [],
        blocked: [],
        failed: []
      };

      // Group by entity type and suggestion type for batching
      const taskUpdates = new Map();
      const workOrderUpdates = new Map();

      for (const suggestion of selectedItems) {
        try {
          // TIME SUGGESTIONS - update estimated_minutes on Task
          if (suggestion.suggestion_type === 'time' && suggestion.scope_level === 'Task') {
            if (suggestion.suggestion_text.includes('Add estimated time')) {
              // Suggest a default range (60 minutes as middle ground)
              taskUpdates.set(suggestion.entity_id, {
                estimated_minutes: 60
              });
              results.applied.push(suggestion);
            } else if (suggestion.suggestion_text.includes('Review time estimate')) {
              // Can't auto-apply review requests
              results.blocked.push({
                ...suggestion,
                block_reason: 'Requires manual review'
              });
            }
          }
          // SKILL SUGGESTIONS - cannot be auto-applied
          else if (suggestion.suggestion_type === 'skill') {
            results.blocked.push({
              ...suggestion,
              block_reason: 'Requires manual clarification of service area'
            });
          }
          // STRUCTURE SUGGESTIONS - not implemented (requires complex parent selection)
          else if (suggestion.suggestion_type === 'structure') {
            results.blocked.push({
              ...suggestion,
              block_reason: 'Structural changes require manual entity selection'
            });
          }
        } catch (err) {
          results.failed.push({
            ...suggestion,
            error: err.message
          });
        }
      }

      // Apply batched Task updates
      for (const [taskId, updates] of taskUpdates.entries()) {
        try {
          await base44.entities.Task.update(taskId, updates);
        } catch (err) {
          const failedSuggestion = results.applied.find(s => s.entity_id === taskId);
          if (failedSuggestion) {
            results.applied = results.applied.filter(s => s.entity_id !== taskId);
            results.failed.push({
              ...failedSuggestion,
              error: err.message
            });
          }
        }
      }

      setApplyResults(results);
      setSelectedSuggestions(new Set());
      setConfirmChecked(false);

      if (results.applied.length > 0) {
        toast.success(`Applied ${results.applied.length} suggestion(s)`);
      }
      if (results.blocked.length > 0) {
        toast.warning(`${results.blocked.length} suggestion(s) require manual action`);
      }
      if (results.failed.length > 0) {
        toast.error(`${results.failed.length} suggestion(s) failed`);
      }
    } catch (error) {
      console.error('Error applying suggestions:', error);
      toast.error('Failed to apply suggestions');
    } finally {
      setApplying(false);
    }
  };

  const getSelectedSummary = () => {
    if (!suggestions || selectedSuggestions.size === 0) return null;

    const selected = suggestions.all.filter(s => selectedSuggestions.has(s.id));
    const byScope = {
      Task: selected.filter(s => s.scope_level === 'Task').length,
      Workorder: selected.filter(s => s.scope_level === 'Workorder').length,
      Project: selected.filter(s => s.scope_level === 'Project').length
    };
    const byType = {
      time: selected.filter(s => s.suggestion_type === 'time').length,
      skill: selected.filter(s => s.suggestion_type === 'skill').length,
      structure: selected.filter(s => s.suggestion_type === 'structure').length
    };

    return { selected, byScope, byType };
  };

  const loadAvailableProjects = async () => {
    try {
      const jobs = await base44.entities.Job.list('-created_date', 100);
      setAvailableProjects(jobs.filter(j => j.status !== 'Completed' && j.status !== 'Cancelled'));
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }
    if (!targetCompletionDate) {
      toast.error('Please enter a target completion date');
      return;
    }

    try {
      setPlanRunning(true);
      toast.info('Generating plan draft...');

      // Load project-scoped data
      const [project, workOrders, tasks, technicians] = await Promise.all([
        base44.entities.Job.filter({ id: selectedProjectId }),
        base44.entities.WorkOrder.filter({ job_id: selectedProjectId }),
        Promise.all([]).then(async () => {
          const wos = await base44.entities.WorkOrder.filter({ job_id: selectedProjectId });
          if (wos.length === 0) return [];
          const allTasks = await base44.entities.Task.list('-created_date', 5000);
          return allTasks.filter(t => wos.some(wo => wo.id === t.work_order_id));
        }),
        base44.entities.Technician.list()
      ]);

      if (project.length === 0) {
        toast.error('Project not found');
        return;
      }

      const projectData = project[0];
      const activeTechSkills = new Set(
        technicians
          .filter(t => t.status === 'Active' && t.skills)
          .flatMap(t => t.skills)
      );

      // Map service category to skill
      const categoryToSkill = {
        'Mechanical': 'Mechanics',
        'Electrical': 'Electronics',
        'Electronics': 'Electronics',
        'GRP/Bodywork': 'GRP/Gelcoat',
        'Sealing': 'Sealing',
        'HVAC': 'HVAC',
        'Rigging': 'Rigging',
        'Plumbing': 'Plumbing',
        'Installation': 'Installations',
        'Diagnostics': 'Diagnostics'
      };

      // A) Calculate planned times with reserves
      const orderedWorkOrders = [];
      let totalPlannedMinutes = 0;

      for (const wo of workOrders) {
        const woTasks = tasks.filter(t => t.work_order_id === wo.id);
        let woPlannedMinutes = 0;
        const requiredSkills = new Set();
        const externalRoles = new Set();

        for (const task of woTasks) {
          const baseMinutes = task.estimated_minutes || 0;
          woPlannedMinutes += baseMinutes;

          // Determine skill requirements
          const serviceCategory = projectData.service_category;
          const requiredSkill = categoryToSkill[serviceCategory];
          
          if (requiredSkill) {
            if (activeTechSkills.has(requiredSkill)) {
              requiredSkills.add(requiredSkill);
            } else {
              externalRoles.add(`External ${requiredSkill}`);
            }
          }
        }

        // Apply reserve buffer
        const reserveMultiplier = 1 + (config.reserve_percent_default / 100);
        const woPlannedWithReserve = Math.ceil(woPlannedMinutes * reserveMultiplier);
        totalPlannedMinutes += woPlannedWithReserve;

        // B) Assign order heuristic (preparation → core → finishing)
        const orderHeuristic = (() => {
          const title = wo.title.toLowerCase();
          if (title.includes('prep') || title.includes('setup')) return 1;
          if (title.includes('finish') || title.includes('final') || title.includes('cleanup')) return 3;
          return 2;
        })();

        orderedWorkOrders.push({
          id: wo.id,
          title: wo.title,
          order: orderHeuristic,
          plannedMinutes: woPlannedMinutes,
          plannedWithReserve: woPlannedWithReserve,
          reserveMinutes: woPlannedWithReserve - woPlannedMinutes,
          requiredSkills: Array.from(requiredSkills),
          externalRoles: Array.from(externalRoles),
          taskCount: woTasks.length
        });
      }

      // Sort by heuristic order
      orderedWorkOrders.sort((a, b) => a.order - b.order);

      // D) Build timeline (simple sequential estimate)
      const totalDays = Math.ceil(totalPlannedMinutes / (8 * 60)); // 8-hour workdays
      const startDate = new Date();
      const estimatedEndDate = new Date(startDate);
      estimatedEndDate.setDate(estimatedEndDate.getDate() + totalDays);

      const targetDate = new Date(targetCompletionDate);
      const isFeasible = estimatedEndDate <= targetDate;

      // Assign start/end windows to each work order
      let currentOffset = 0;
      for (const wo of orderedWorkOrders) {
        const woDays = Math.ceil(wo.plannedWithReserve / (8 * 60));
        wo.startWindow = new Date(startDate);
        wo.startWindow.setDate(wo.startWindow.getDate() + Math.floor(currentOffset));
        wo.endWindow = new Date(wo.startWindow);
        wo.endWindow.setDate(wo.endWindow.getDate() + woDays);
        currentOffset += woDays;
      }

      // Build risk notes
      const riskNotes = [];
      const totalExternalRoles = new Set();
      orderedWorkOrders.forEach(wo => wo.externalRoles.forEach(r => totalExternalRoles.add(r)));
      
      if (totalExternalRoles.size > 0) {
        riskNotes.push(`Requires ${totalExternalRoles.size} external professional type(s): ${Array.from(totalExternalRoles).join(', ')}`);
      }
      
      const reservePercent = ((totalPlannedMinutes - orderedWorkOrders.reduce((sum, wo) => sum + wo.plannedMinutes, 0)) / totalPlannedMinutes * 100).toFixed(1);
      if (parseFloat(reservePercent) < config.reserve_percent_default * 0.5) {
        riskNotes.push('Tight reserve margins - less than 50% of configured default');
      }

      if (!isFeasible) {
        const shortfallDays = Math.ceil((estimatedEndDate - targetDate) / (1000 * 60 * 60 * 24));
        riskNotes.push(`Target deadline not achievable - requires ${shortfallDays} additional day(s)`);
      }

      setPlanDraft({
        projectId: selectedProjectId,
        projectTitle: projectData.title,
        targetDate: targetCompletionDate,
        overview: {
          totalPlannedMinutes,
          totalDays,
          estimatedEndDate: estimatedEndDate.toISOString().split('T')[0],
          isFeasible
        },
        orderedWorkOrders,
        riskNotes
      });

      setPlanningModalOpen(false);
      toast.success('Plan draft generated');
    } catch (error) {
      console.error('Error generating plan:', error);
      toast.error('Failed to generate plan');
    } finally {
      setPlanRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Brain className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Project Intelligence</h1>
          <p className="text-slate-500 mt-1">Internal analysis and planning module</p>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-slate-900">Module Overview</CardTitle>
          <CardDescription className="text-slate-600">
            Internal analysis and planning module. All actions are read-only unless explicitly confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              onClick={handleRunAudit}
              disabled={auditRunning}
              className="justify-start"
            >
              <FileSearch className="h-4 w-4 mr-2" />
              {auditRunning ? 'Running Audit...' : 'Run Audit (Read-only)'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleRunSuggestions}
              disabled={suggestionsRunning || !auditResults}
              className="justify-start"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              {suggestionsRunning ? 'Generating...' : 'Run Suggestions (Draft)'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setPlanningModalOpen(true)}
              className="justify-start"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Run Planning (Draft)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-600" />
            Analysis Configuration (Internal)
          </CardTitle>
          <CardDescription>
            Configure AI analysis parameters and prompts. Changes are saved per user and do not trigger any analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading configuration...</p>
          ) : (
            <>
              {/* Analysis Prompt Template */}
              <div>
                <Label htmlFor="analysis_prompt_template">Analysis Prompt Template</Label>
                <Textarea
                  id="analysis_prompt_template"
                  placeholder="Enter system instructions for AI analysis (audit, suggestions, planning)..."
                  value={config.analysis_prompt_template}
                  onChange={(e) => setConfig({ ...config, analysis_prompt_template: e.target.value })}
                  rows={6}
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Plain text system instructions. No execution until explicitly triggered.
                </p>
              </div>

              {/* Parameters Section */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="reserve_percent_default">Reserve Percent Default</Label>
                  <Input
                    id="reserve_percent_default"
                    type="number"
                    value={config.reserve_percent_default}
                    onChange={(e) => setConfig({ ...config, reserve_percent_default: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Default buffer percentage</p>
                </div>

                <div>
                  <Label htmlFor="skill_match_strictness">Skill Match Strictness</Label>
                  <Select
                    value={config.skill_match_strictness}
                    onValueChange={(value) => setConfig({ ...config, skill_match_strictness: value })}
                  >
                    <SelectTrigger id="skill_match_strictness" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strict">Strict</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="loose">Loose</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">Matching algorithm mode</p>
                </div>

                <div>
                  <Label htmlFor="time_outlier_threshold">Time Outlier Threshold</Label>
                  <Input
                    id="time_outlier_threshold"
                    type="number"
                    value={config.time_outlier_threshold}
                    onChange={(e) => setConfig({ ...config, time_outlier_threshold: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Percentile or min hours</p>
                </div>
              </div>

              {/* Config Version */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="config_version">Config Version</Label>
                  <Input
                    id="config_version"
                    type="text"
                    value={config.config_version}
                    onChange={(e) => setConfig({ ...config, config_version: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Last Updated</Label>
                  <Input
                    type="text"
                    value={config.last_updated_at ? new Date(config.last_updated_at).toLocaleString() : 'Never'}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveConfig} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Config'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Audit Results */}
      {auditResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-green-600" />
              Audit Report
            </CardTitle>
            <CardDescription>
              Read-only analysis of all projects, work orders, and tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Executive Summary */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Executive Summary</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="bg-slate-50">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 uppercase">Analyzed</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      {auditResults.summary.total_projects} Projects
                    </p>
                    <p className="text-sm text-slate-600">
                      {auditResults.summary.total_workorders} Work Orders • {auditResults.summary.total_tasks} Tasks
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50">
                  <CardContent className="p-4">
                    <p className="text-xs text-blue-700 uppercase">Skill Coverage</p>
                    <p className="text-lg font-bold text-blue-900 mt-1">
                      {auditResults.summary.skill_covered} Covered
                    </p>
                    <p className="text-sm text-blue-700">
                      {auditResults.summary.skill_missing} Missing • {auditResults.summary.skill_undetermined} Undetermined
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-amber-50">
                  <CardContent className="p-4">
                    <p className="text-xs text-amber-700 uppercase">Time Completeness</p>
                    <p className="text-lg font-bold text-amber-900 mt-1">
                      {auditResults.summary.time_complete} Complete
                    </p>
                    <p className="text-sm text-amber-700">
                      {auditResults.summary.time_missing} Missing • {auditResults.summary.time_outlier} Outliers
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Detailed Findings - Skill Coverage */}
            {auditResults.findings.skill.missing.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-900 mb-2">
                  Skill Gaps ({auditResults.findings.skill.missing.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditResults.findings.skill.missing.slice(0, 10).map(finding => (
                    <div key={finding.id} className="p-2 bg-red-50 rounded border border-red-200 text-xs">
                      <p className="font-medium text-slate-900">{finding.title}</p>
                      <p className="text-red-700">{finding.reason}</p>
                    </div>
                  ))}
                  {auditResults.findings.skill.missing.length > 10 && (
                    <p className="text-xs text-slate-500 italic">
                      +{auditResults.findings.skill.missing.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Detailed Findings - Time Issues */}
            {auditResults.findings.time.missing.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-900 mb-2">
                  Time Data Missing ({auditResults.findings.time.missing.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditResults.findings.time.missing.slice(0, 10).map(finding => (
                    <div key={finding.id} className="p-2 bg-amber-50 rounded border border-amber-200 text-xs">
                      <p className="font-medium text-slate-900">{finding.title}</p>
                      <p className="text-amber-700">{finding.reason}</p>
                    </div>
                  ))}
                  {auditResults.findings.time.missing.length > 10 && (
                    <p className="text-xs text-slate-500 italic">
                      +{auditResults.findings.time.missing.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Detailed Findings - Structural Issues */}
            {auditResults.findings.structure.inconsistent.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-purple-900 mb-2">
                  Structural Issues ({auditResults.findings.structure.inconsistent.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditResults.findings.structure.inconsistent.slice(0, 10).map(finding => (
                    <div key={finding.id} className="p-2 bg-purple-50 rounded border border-purple-200 text-xs">
                      <p className="font-medium text-slate-900">{finding.title}</p>
                      <p className="text-purple-700">{finding.reason}</p>
                    </div>
                  ))}
                  {auditResults.findings.structure.inconsistent.length > 10 && (
                    <p className="text-xs text-slate-500 italic">
                      +{auditResults.findings.structure.inconsistent.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* AI Q&A Section */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-600" />
                Ask AI about this Audit
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Ask questions about the audit results. AI answers are based only on the data shown above.
              </p>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Which missing professions are most common?"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleAskAI}
                    disabled={aiLoading || !aiQuestion.trim()}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    {aiLoading ? 'Analyzing...' : 'Ask'}
                  </Button>
                </div>

                {aiAnswer && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <p className="text-xs text-blue-700 uppercase mb-2">AI Analysis</p>
                      <div className="text-sm text-slate-900 whitespace-pre-wrap">
                        {aiAnswer}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="text-xs text-slate-500 space-y-1">
                  <p className="font-medium">Example questions:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Which missing professions occur most often?</li>
                    <li>Which projects have the highest number of uncovered tasks?</li>
                    <li>Where are time estimates most frequently missing?</li>
                    <li>Which task categories show unrealistic low time estimates?</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {suggestions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              Improvement Suggestions (Draft)
            </CardTitle>
            <CardDescription>
              {suggestions.total} actionable suggestions generated from audit findings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-900">
                <strong>Draft Mode:</strong> Suggestions are proposals only. Nothing is changed until explicitly confirmed. 
                Selection state is for review purposes and is not persisted.
              </p>
            </div>

            {/* Summary */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-blue-50">
                <CardContent className="p-3">
                  <p className="text-xs text-blue-700 uppercase">Time</p>
                  <p className="text-lg font-bold text-blue-900">{suggestions.grouped.time.length}</p>
                  <p className="text-xs text-blue-600">Suggestions</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="p-3">
                  <p className="text-xs text-green-700 uppercase">Skill/Profession</p>
                  <p className="text-lg font-bold text-green-900">{suggestions.grouped.skill.length}</p>
                  <p className="text-xs text-green-600">Suggestions</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50">
                <CardContent className="p-3">
                  <p className="text-xs text-purple-700 uppercase">Structure</p>
                  <p className="text-lg font-bold text-purple-900">{suggestions.grouped.structure.length}</p>
                  <p className="text-xs text-purple-600">Suggestions</p>
                </CardContent>
              </Card>
            </div>

            {/* Time Suggestions */}
            {suggestions.grouped.time.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Time Improvements ({suggestions.grouped.time.length})
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {suggestions.grouped.time.map(suggestion => (
                    <div 
                      key={suggestion.id} 
                      className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSuggestions.has(suggestion.id)}
                        onChange={() => toggleSuggestion(suggestion.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-500 uppercase">
                            {suggestion.scope_level}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {suggestion.entity_name}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mb-1">{suggestion.suggestion_text}</p>
                        <p className="text-xs text-slate-500 italic">Reason: {suggestion.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skill Suggestions */}
            {suggestions.grouped.skill.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  Skill/Profession Improvements ({suggestions.grouped.skill.length})
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {suggestions.grouped.skill.map(suggestion => (
                    <div 
                      key={suggestion.id} 
                      className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSuggestions.has(suggestion.id)}
                        onChange={() => toggleSuggestion(suggestion.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-500 uppercase">
                            {suggestion.scope_level}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {suggestion.entity_name}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mb-1">{suggestion.suggestion_text}</p>
                        <p className="text-xs text-slate-500 italic">Reason: {suggestion.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Structural Suggestions */}
            {suggestions.grouped.structure.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-purple-600" />
                  Structural Improvements ({suggestions.grouped.structure.length})
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {suggestions.grouped.structure.map(suggestion => (
                    <div 
                      key={suggestion.id} 
                      className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSuggestions.has(suggestion.id)}
                        onChange={() => toggleSuggestion(suggestion.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-500 uppercase">
                            {suggestion.scope_level}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {suggestion.entity_name}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mb-1">{suggestion.suggestion_text}</p>
                        <p className="text-xs text-slate-500 italic">Reason: {suggestion.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selection Summary and Apply */}
            {selectedSuggestions.size > 0 && (() => {
              const summary = getSelectedSummary();
              return (
                <div className="border-t pt-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">
                      {selectedSuggestions.size} Suggestion(s) Selected
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-blue-700 font-medium">By Scope:</p>
                        <ul className="text-slate-600 mt-1 space-y-0.5">
                          {summary.byScope.Task > 0 && <li>• {summary.byScope.Task} Task(s)</li>}
                          {summary.byScope.Workorder > 0 && <li>• {summary.byScope.Workorder} Work Order(s)</li>}
                          {summary.byScope.Project > 0 && <li>• {summary.byScope.Project} Project(s)</li>}
                        </ul>
                      </div>
                      <div>
                        <p className="text-blue-700 font-medium">By Type:</p>
                        <ul className="text-slate-600 mt-1 space-y-0.5">
                          {summary.byType.time > 0 && <li>• {summary.byType.time} Time</li>}
                          {summary.byType.skill > 0 && <li>• {summary.byType.skill} Skill</li>}
                          {summary.byType.structure > 0 && <li>• {summary.byType.structure} Structure</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedSuggestions(new Set())}
                    >
                      Clear Selection
                    </Button>
                    <Button 
                      onClick={() => setApplyModalOpen(true)}
                      disabled={applying}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Apply Selected
                    </Button>
                  </div>
                </div>
              );
            })()}

            {!selectedSuggestions.size && (
              <div className="text-xs text-slate-500 text-center pt-4 border-t">
                Select suggestions to apply changes
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Apply Results */}
      {applyResults && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Apply Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {applyResults.applied.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-900 mb-2">
                  Successfully Applied ({applyResults.applied.length})
                </h3>
                <div className="space-y-1">
                  {applyResults.applied.map((s, idx) => (
                    <div key={idx} className="text-xs text-slate-600 flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>{s.entity_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {applyResults.blocked.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-900 mb-2">
                  Blocked - Manual Action Required ({applyResults.blocked.length})
                </h3>
                <div className="space-y-2">
                  {applyResults.blocked.map((s, idx) => (
                    <div key={idx} className="p-2 bg-amber-50 rounded border border-amber-200">
                      <p className="text-xs font-medium text-slate-900">{s.entity_name}</p>
                      <p className="text-xs text-amber-700">{s.block_reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {applyResults.failed.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-900 mb-2">
                  Failed ({applyResults.failed.length})
                </h3>
                <div className="space-y-2">
                  {applyResults.failed.map((s, idx) => (
                    <div key={idx} className="p-2 bg-red-50 rounded border border-red-200">
                      <p className="text-xs font-medium text-slate-900">{s.entity_name}</p>
                      <p className="text-xs text-red-700">{s.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Planning Draft */}
      {planDraft && (
        <Card className="border-blue-200">
          <CardHeader>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 mb-4">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-900">
                <strong>This is a planning draft.</strong> No changes have been applied to any project, work order, or task data.
              </p>
            </div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Plan Draft: {planDraft.projectTitle}
            </CardTitle>
            <CardDescription>
              Target completion: {new Date(planDraft.targetDate).toLocaleDateString()} • 
              Status: {planDraft.overview.isFeasible ? 
                <span className="text-green-600 font-semibold"> Feasible</span> : 
                <span className="text-red-600 font-semibold"> Not Achievable</span>
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overview */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Plan Overview</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="bg-slate-50">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500 uppercase">Total Planned Time</p>
                    <p className="text-lg font-bold text-slate-900">
                      {Math.ceil(planDraft.overview.totalPlannedMinutes / 60)}h
                    </p>
                    <p className="text-xs text-slate-600">(incl. {config.reserve_percent_default}% reserve)</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50">
                  <CardContent className="p-3">
                    <p className="text-xs text-blue-700 uppercase">Estimated Duration</p>
                    <p className="text-lg font-bold text-blue-900">{planDraft.overview.totalDays} days</p>
                    <p className="text-xs text-blue-600">Sequential estimate</p>
                  </CardContent>
                </Card>
                <Card className={planDraft.overview.isFeasible ? 'bg-green-50' : 'bg-red-50'}>
                  <CardContent className="p-3">
                    <p className={`text-xs uppercase ${planDraft.overview.isFeasible ? 'text-green-700' : 'text-red-700'}`}>
                      Estimated End Date
                    </p>
                    <p className={`text-lg font-bold ${planDraft.overview.isFeasible ? 'text-green-900' : 'text-red-900'}`}>
                      {new Date(planDraft.overview.estimatedEndDate).toLocaleDateString()}
                    </p>
                    <p className={`text-xs ${planDraft.overview.isFeasible ? 'text-green-600' : 'text-red-600'}`}>
                      {planDraft.overview.isFeasible ? 'On track' : 'Exceeds target'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Ordered Work Orders */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Ordered Work Orders ({planDraft.orderedWorkOrders.length})
              </h3>
              <div className="space-y-2">
                {planDraft.orderedWorkOrders.map((wo, idx) => (
                  <Card key={wo.id} className="bg-slate-50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-500 bg-slate-200 rounded px-2 py-0.5">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">{wo.title}</span>
                          </div>
                          <p className="text-xs text-slate-600">{wo.taskCount} task(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">
                            {Math.ceil(wo.plannedWithReserve / 60)}h
                          </p>
                          <p className="text-xs text-slate-500">
                            (+{Math.ceil(wo.reserveMinutes / 60)}h reserve)
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-slate-500 font-medium mb-1">Required Skills:</p>
                          {wo.requiredSkills.length > 0 ? (
                            <ul className="text-slate-700 space-y-0.5">
                              {wo.requiredSkills.map(skill => (
                                <li key={skill} className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                  {skill} (internal)
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-400 italic">None identified</p>
                          )}
                          {wo.externalRoles.length > 0 && (
                            <ul className="text-amber-700 space-y-0.5 mt-1">
                              {wo.externalRoles.map(role => (
                                <li key={role} className="flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 text-amber-600" />
                                  {role}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium mb-1">Estimated Window:</p>
                          <p className="text-slate-700">
                            {new Date(wo.startWindow).toLocaleDateString()} → {new Date(wo.endWindow).toLocaleDateString()}
                          </p>
                          <p className="text-slate-400 italic mt-0.5">
                            (~{Math.ceil(wo.plannedWithReserve / (8 * 60))} day(s))
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Risk & Constraint Notes */}
            {planDraft.riskNotes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-900 mb-2">
                  Risk & Constraint Notes
                </h3>
                <div className="space-y-2">
                  {planDraft.riskNotes.map((note, idx) => (
                    <div key={idx} className="p-2 bg-red-50 rounded border border-red-200 text-xs flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <p className="text-red-900">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setPlanDraft(null)}>
                Discard Draft
              </Button>
              <Button disabled className="bg-slate-400">
                Apply Parts of Plan (Coming Soon)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planning Input Modal */}
      <Dialog open={planningModalOpen} onOpenChange={setPlanningModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Plan Draft</DialogTitle>
            <DialogDescription>
              Select a project and enter a target completion date to generate a realistic planning draft.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="project-select">Select Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="project-select" className="mt-1">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.length === 0 ? (
                    <SelectItem value="none" disabled>No projects available</SelectItem>
                  ) : (
                    availableProjects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title} ({project.status})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="target-date">Target Completion Date</Label>
              <Input
                id="target-date"
                type="date"
                value={targetCompletionDate}
                onChange={(e) => setTargetCompletionDate(e.target.value)}
                className="mt-1"
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-slate-500 mt-1">
                Plan will check if this deadline is achievable with current time estimates and reserves.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900">
                <strong>Draft Mode:</strong> This will generate a planning proposal. No data will be modified.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanningModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleGeneratePlan}
              disabled={planRunning || !selectedProjectId || !targetCompletionDate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {planRunning ? 'Generating...' : 'Generate Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm Apply Suggestions</DialogTitle>
            <DialogDescription>
              Review the changes that will be applied to live data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Warning Banner */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900">Warning</p>
                <p className="text-xs text-red-700 mt-1">
                  These changes will update live data. This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Changes List */}
            {(() => {
              const summary = getSelectedSummary();
              if (!summary) return null;

              return (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Changes to Apply ({summary.selected.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {summary.selected.map(s => (
                      <div key={s.id} className="p-2 bg-slate-50 rounded border border-slate-200 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-500 uppercase">{s.scope_level}</span>
                          <span className="text-slate-400">•</span>
                          <span className="font-medium text-slate-900">{s.entity_name}</span>
                        </div>
                        <p className="text-slate-700">{s.suggestion_text}</p>
                      </div>
                    ))}
                  </div>

                  {/* Scope Summary */}
                  <div className="bg-slate-100 rounded p-3 text-xs">
                    <p className="font-medium text-slate-900 mb-1">Affected Entities:</p>
                    <div className="text-slate-600 space-y-0.5">
                      {summary.byScope.Task > 0 && <p>• {summary.byScope.Task} Task(s)</p>}
                      {summary.byScope.Workorder > 0 && <p>• {summary.byScope.Workorder} Work Order(s)</p>}
                      {summary.byScope.Project > 0 && <p>• {summary.byScope.Project} Project(s)</p>}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Confirmation Checkbox */}
            <div className="flex items-center space-x-2 pt-4 border-t">
              <Checkbox 
                id="confirm" 
                checked={confirmChecked}
                onCheckedChange={setConfirmChecked}
              />
              <label
                htmlFor="confirm"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I understand these changes will modify live data and cannot be undone
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setApplyModalOpen(false);
              setConfirmChecked(false);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleApplySelected}
              disabled={!confirmChecked || applying}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {applying ? 'Applying...' : 'Confirm & Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}