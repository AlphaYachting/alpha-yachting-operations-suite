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
              disabled={!isWriteAllowed}
              className="justify-start"
            >
              <FileSearch className="h-4 w-4 mr-2" />
              Run Audit (Read-only)
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
    </div>
  );
}