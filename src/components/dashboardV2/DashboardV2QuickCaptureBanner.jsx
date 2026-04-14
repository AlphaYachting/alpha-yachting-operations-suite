/**
 * DASHBOARD V2 — QUICK CAPTURE REVIEW BANNER (isolated)
 * Compact banner shown below KPI area when pending Quick Capture entries exist.
 * Only visible when count > 0.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardV2QuickCaptureBanner({ count }) {
  if (!count || count === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
        <Zap className="h-4 w-4 text-amber-600" />
        <span>{count} Quick Capture{count === 1 ? '' : 's'} need review</span>
      </div>
      <Button size="sm" asChild className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
        <Link to={createPageUrl('QuickCaptureReview')}>Review</Link>
      </Button>
    </div>
  );
}