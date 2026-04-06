import { useState } from 'react';
import { ChevronDown, Package, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BundleRecommendation({ bundling, jobs, locations }) {
  const [expanded, setExpanded] = useState(false);

  if (!bundling?.group?.length) return null;

  const count = bundling.group.length;
  const effort = bundling.effort;
  const tier = bundling.tier;

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
          {/* Effort estimate */}
          <div>
            <p className="text-xs text-cyan-600 font-medium mb-1">Combined Visit Estimate</p>
            <p className="text-sm font-semibold text-cyan-800">
              {effort.min}–{effort.max} hours
            </p>
          </div>

          {/* Bundle group */}
          <div>
            <p className="text-xs text-cyan-600 font-medium mb-1.5">Suggested Group</p>
            <div className="flex flex-col gap-1">
              {bundling.group.slice(0, 4).map((wo, i) => (
                <div key={wo.id || i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-cyan-100/40 border border-cyan-200/50">
                  <span className="text-xs font-semibold text-cyan-700 min-w-fit">{i + 1}.</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-cyan-900 leading-snug">{wo.title}</p>
                    {wo.estimated_duration_hours && (
                      <p className="text-xs text-cyan-600 mt-0.5">
                        ~{Math.round(wo.estimated_duration_hours * 10) / 10}h
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {bundling.group.length > 4 && (
                <p className="text-xs text-cyan-500 px-2 py-1">
                  +{bundling.group.length - 4} more WO{bundling.group.length - 4 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

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