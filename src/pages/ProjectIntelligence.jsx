import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Brain, FileSearch, Lightbulb, TrendingUp, Save, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  // Load config from user profile on mount
  useEffect(() => {
    loadConfig();
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
              disabled={!isWriteAllowed}
              className="justify-start"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Run Suggestions (Draft)
            </Button>
            <Button 
              variant="outline" 
              disabled={!isWriteAllowed}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}