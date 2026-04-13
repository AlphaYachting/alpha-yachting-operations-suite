/**
 * ============================================================
 * FROZEN COMPONENT — DO NOT EDIT WHEN REORDERING DASHBOARD SECTIONS
 * Dashboard Quick Actions are frozen.
 * Approved button set (in order): Dispatch | E-Mail to Lead | Quick Capture | Note
 * Any change to this file requires explicit approval.
 * ============================================================
 */
import React, { useState } from 'react';
import { Calendar, Mail, Zap, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QuickCaptureModal from '@/components/quickcapture/QuickCaptureModal';

export default function DashboardQuickActions({ onDispatch, onEmailToLead, onNote }) {
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  return (
    <>
      {/* =====================================================
          FROZEN QUICK ACTIONS — DO NOT MODIFY ORDER OR LABELS
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
          onClick={onEmailToLead}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Mail className="h-4 w-4 mr-1" />
          E-Mail to Lead
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

      {/* Quick Capture Modal — opens dialog-first flow */}
      <QuickCaptureModal
        open={showQuickCapture}
        onOpenChange={setShowQuickCapture}
      />
    </>
  );
}