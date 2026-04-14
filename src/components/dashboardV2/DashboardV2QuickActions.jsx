/**
 * DASHBOARD V2 — FROZEN QUICK ACTIONS
 * Approved set (exact order): Dispatch | E-Mail to Lead | Quick Capture | Note
 * DO NOT MODIFY order, labels, or button behavior here.
 * All state for modals owned by DashboardV2 and passed as callbacks.
 */
import React, { useState } from 'react';
import { Calendar, Mail, Zap, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QuickCaptureModal from '@/components/quickcapture/QuickCaptureModal';

export default function DashboardV2QuickActions({ onDispatch, onEmailToLead, onNote }) {
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  return (
    <>
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

        {/* 2. E-Mail to Lead — opens parser dialog, NOT navigation */}
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

      <QuickCaptureModal
        open={showQuickCapture}
        onOpenChange={setShowQuickCapture}
      />
    </>
  );
}