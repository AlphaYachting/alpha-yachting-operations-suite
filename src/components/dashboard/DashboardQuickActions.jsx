/**
 * ============================================================
 * ISOLATED QUICK ACTIONS — SOURCE OF TRUTH FOR DASHBOARD HEADER
 * Approved button set (in order): Dispatch | E-Mail to Lead | Quick Capture | Note
 * Edit ONLY this file to change Dashboard quick-actions.
 * Do NOT add inline buttons to pages/Dashboard.
 * ============================================================
 */
import React, { useState } from 'react';
import { Calendar, Mail, Zap, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import QuickCaptureModal from '@/components/quickcapture/QuickCaptureModal';

export default function DashboardQuickActions({ onDispatch, onNote }) {
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  return (
    <>
      {/* =====================================================
          ISOLATED QUICK ACTIONS — DO NOT MODIFY ORDER OR LABELS
          Order: 1. Dispatch  2. E-Mail to Lead  3. Quick Capture  4. Note
          ===================================================== */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 1. Dispatch */}
        <Button
          size="sm"
          onClick={onDispatch}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Calendar className="h-4 w-4 mr-1" />
          Dispatch
        </Button>

        {/* 2. E-Mail to Lead */}
        <Button
          size="sm"
          asChild
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Link to={createPageUrl('LeadsV2')}>
            <Mail className="h-4 w-4 mr-1" />
            E-Mail to Lead
          </Link>
        </Button>

        {/* 3. Quick Capture */}
        <Button
          size="sm"
          onClick={() => setShowQuickCapture(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Zap className="h-4 w-4 mr-1" />
          Quick Capture
        </Button>

        {/* 4. Note */}
        <Button
          size="sm"
          onClick={onNote}
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          <StickyNote className="h-4 w-4 mr-1" />
          Note
        </Button>
      </div>

      {/* Quick Capture Modal */}
      <QuickCaptureModal
        open={showQuickCapture}
        onOpenChange={setShowQuickCapture}
      />
    </>
  );
}