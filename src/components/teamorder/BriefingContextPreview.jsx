import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Eye, Zap } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Preview & review component for BriefingContext
 * Shows structured data that will be used for external worker briefing
 * Allows admin to review before any AI or external use
 */
export default function BriefingContextPreview({ teamOrderId, isAdmin }) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState(null);

  const handleGeneratePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('buildBriefingContext', {
        teamOrderId
      });
      setContext(response.data);
      setDialogOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to generate preview');
      toast.error('Failed to generate briefing context');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Card className="border-l-4 border-l-amber-500 bg-amber-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-sm">Briefing Context</CardTitle>
            </div>
            <Button
              onClick={handleGeneratePreview}
              disabled={loading}
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              <Eye className="h-4 w-4 mr-2" />
              {loading ? 'Generating...' : 'Preview Context'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-slate-600">
          <p>
            Review the structured context that will be used for external worker
            briefing generation.
          </p>
          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Briefing Context Preview</DialogTitle>
          </DialogHeader>
          {context && <BriefingContextDisplay context={context} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Display the structured context in readable format
 */
function BriefingContextDisplay({ context }) {
  if (!context) return null;

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
        <p className="font-semibold text-slate-900">Generated At</p>
        <p className="text-slate-600">
          {new Date(context.meta.generated_at).toLocaleString()}
        </p>
      </div>

      {/* External Worker */}
      <Section title="External Worker" data={context.external_worker} />

      {/* Work Order */}
      <Section
        title="Work Order"
        data={{
          number: context.work_order.number,
          title: context.work_order.title,
          status: context.work_order.status,
          scheduled: context.work_order.scheduled_date,
          type: context.work_order.type
        }}
      />

      {/* Job */}
      <Section
        title="Project / Job"
        data={{
          title: context.job.title,
          status: context.job.status,
          priority: context.job.priority,
          category: context.job.service_category
        }}
      />

      {/* Customer */}
      <Section
        title="Customer"
        data={{
          name: context.customer.name,
          email: context.customer.email,
          phone: context.customer.phone,
          language: context.customer.preferred_language
        }}
      />

      {/* Boat */}
      <Section
        title="Boat / Asset"
        data={{
          name: context.boat.name,
          type: context.boat.type,
          length: context.boat.length_m ? `${context.boat.length_m}m` : 'Unknown',
          berth: context.boat.berth || 'Not specified'
        }}
      />

      {/* Location */}
      <Section
        title="Location"
        data={{
          name: context.location.name,
          address: context.location.address,
          access_notes: context.location.access_notes
        }}
      />

      {/* Tasks */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-3">Tasks ({context.tasks.length})</h4>
        <div className="space-y-2">
          {context.tasks.map((task, idx) => (
            <div
              key={task.id}
              className="p-3 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-sm text-slate-900">
                  {idx + 1}. {task.title}
                </p>
                <Badge variant="outline" className="text-xs">
                  {task.task_stream}
                </Badge>
              </div>
              {task.description && (
                <p className="text-xs text-slate-600 mb-1">{task.description}</p>
              )}
              <div className="flex gap-2">
                <span className="text-xs text-slate-500">
                  Status: {task.status}
                </span>
                {task.estimated_minutes && (
                  <span className="text-xs text-slate-500">
                    Est: {Math.floor(task.estimated_minutes / 60)}h
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget Policy */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-3">Budget & Policies</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Total Approved</p>
            <p className="font-semibold text-slate-900">
              €{context.budget_policy.approved_budget_total.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Labor</p>
            <p className="font-semibold text-slate-900">
              €{context.budget_policy.labor_budget.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Travel</p>
            <p className="font-semibold text-slate-900">
              €{context.budget_policy.travel_budget.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Accommodation</p>
            <p className="font-semibold text-slate-900">
              €{context.budget_policy.accommodation_budget.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Cost Policies */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Covered Costs</p>
          <div className="space-y-1 text-xs text-slate-600">
            {context.budget_policy.accommodation_paid && (
              <p>
                ✓ Accommodation: up to €
                {context.budget_policy.accommodation_max_per_night}/night
              </p>
            )}
            {context.budget_policy.meals_per_diem_paid && (
              <p>
                ✓ Per Diem: €
                {context.budget_policy.per_diem_rate_per_day}/day
              </p>
            )}
            {context.budget_policy.mileage_paid && (
              <p>
                ✓ Mileage: €
                {context.budget_policy.mileage_rate_per_km}/km
              </p>
            )}
            {context.budget_policy.travel_time_paid && (
              <p>✓ Travel time: Paid</p>
            )}
          </div>
        </div>
      </div>

      {/* Scope Summary */}
      {context.external_notes?.scope_summary && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Scope of Work</h4>
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-900">
              {context.external_notes.scope_summary}
            </p>
          </div>
        </div>
      )}

      {/* External Notes */}
      {(context.external_notes.partner_notes ||
        context.external_notes.customer_visible_notes) && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Notes for Partner</h4>
          <div className="space-y-2">
            {context.external_notes.partner_notes && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-1">
                  Partner Instructions
                </p>
                <p className="text-sm text-blue-800">
                  {context.external_notes.partner_notes}
                </p>
              </div>
            )}
            {context.external_notes.customer_visible_notes && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs font-semibold text-green-900 mb-1">
                  Customer Visible Notes
                </p>
                <p className="text-sm text-green-800">
                  {context.external_notes.customer_visible_notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quality Flags */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-3">Data Completeness</h4>
        <div className="space-y-1 text-sm">
          {context.quality_flags.missing_job_description && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <span className="text-amber-700">
                Missing project description
              </span>
            </div>
          )}
          {context.quality_flags.missing_scope_context && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <span className="text-amber-700">Missing scope context</span>
            </div>
          )}
          {context.quality_flags.missing_task_descriptions && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <span className="text-amber-700">
                Some tasks missing descriptions
              </span>
            </div>
          )}
          {!context.quality_flags.missing_job_description &&
            !context.quality_flags.missing_scope_context &&
            !context.quality_flags.missing_task_descriptions && (
              <div className="p-2 bg-green-50 border border-green-200 rounded">
                <p className="text-green-700 text-sm">
                  ✓ Context appears complete for briefing generation
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

/**
 * Generic section renderer
 */
function Section({ title, data }) {
  return (
    <div>
      <h4 className="font-semibold text-slate-900 mb-2">{title}</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(data || {}).map(([key, value]) => (
          <div key={key} className="p-2 bg-slate-50 rounded border border-slate-200">
            <p className="text-xs text-slate-600 mb-0.5 capitalize">
              {key.replace(/_/g, ' ')}
            </p>
            <p className="font-medium text-slate-900 text-sm">
              {value || '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}