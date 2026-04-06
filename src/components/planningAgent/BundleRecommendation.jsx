import { useState } from 'react';
import { ChevronDown, Package, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BundleRecommendation({ bundling, jobs, locations }) {
  const [expanded, setExpanded] = useState(false);

  if (!bundling?.group?.length) return null;

  const count = bundling.group.length;
  const effort = bundling.effort;
  const tier = bundling.tier;
  const actionable = bundling.actionable || [];
  const excluded = bundling.excluded || [];

  return (
    <div className="mt-3 border border-cyan-200 rounded-lg bg-cyan-50/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-start gap-2 hover:bg-cyan-50/80 transition-colors"
      >
        <Package className="h-4 w-4 text-cyan-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-semibold text-cyan-700">
            Visit Bundling Opportunity
          </p>
          <p className="text-xs text-cyan-600 mt-0.5">
            {count === 1
              ? `Can combine with 1 other WO on ${tier === 'SAME_BOAT' ? 'same vessel' : 'same marina'}`
              : `Can combine with ${count} other WOs on ${tier === 'SAME_BOAT' ? 'same vessel' : 'same marina'}`}
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-cyan-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-cyan-400 flex-shrink-0 rotate-180" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-cyan-200 px-3 py-3 space-y-2.5 bg-white/30">
          {/* Effort estimate — actionable only */}
          <div>
            <p className="text-xs text-cyan-600 font-medium mb-1">Actionable Visit Estimate</p>
            <p className="text-sm font-semibold text-cyan-800">
              {effort.min}–{effort.max} hours
            </p>
            {excluded.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ({actionable.length} actionable · {excluded.length} excluded/blocked)
              </p>
            )}
          </div>

          {/* Actionable group */}
          {actionable.length > 0 && (
            <div>
              <p className="text-xs text-emerald-600 font-medium mb-1.5">✓ Actionable Now</p>
              <div className="flex flex-col gap-1">
                {actionable.slice(0, 4).map((wo, i) => (
                  <div key={wo.id || i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-emerald-100/50 border border-emerald-200/50">
                    <span className="text-xs font-semibold text-emerald-700 min-w-fit">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-emerald-900 leading-snug">{wo.title}</p>
                      {wo.estimated_duration_hours && (
                        <p className="text-xs text-emerald-600 mt-0.5">
                          ~{Math.round(wo.estimated_duration_hours * 10) / 10}h
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {actionable.length > 4 && (
                  <p className="text-xs text-emerald-600 px-2 py-1">
                    +{actionable.length - 4} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Excluded/blocked group */}
          {excluded.length > 0 && (
            <div>
              <p className="text-xs text-amber-600 font-medium mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Excluded/Blocked
              </p>
              <div className="flex flex-col gap-1">
                {excluded.slice(0, 3).map((wo, i) => (
                  <div key={wo.id || i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-amber-100/30 border border-amber-200/50">
                    <span className="text-xs text-amber-600 min-w-fit">—</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-amber-800 leading-snug">{wo.title}</p>
                      <p className="text-xs text-amber-600 mt-0.5">{wo.status}</p>
                    </div>
                  </div>
                ))}
                {excluded.length > 3 && (
                  <p className="text-xs text-amber-600 px-2 py-1">
                    +{excluded.length - 3} more blocked/paused
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Bundling reason */}
          <div>
            <p className="text-xs text-cyan-600 font-medium mb-1">Why Bundle</p>
            <p className="text-xs text-cyan-700 leading-relaxed">{bundling.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}