// EMAIL ENGINE SANDBOX - Agent Export Interface (DISABLED - PHASE 2+)
// ============================================================
// STATUS: DISABLED BY DESIGN - Phase 1 Sandbox
// This function is a placeholder for future controlled agent access.
//
// DO NOT activate this function until:
//   1. Agent integration is explicitly designed and approved
//   2. Security review of agent permissions is complete
//   3. Production isolation boundaries are validated
//   4. Manual oversight controls are implemented
//
// This endpoint will NEVER:
//   - Automatically invoke agents
//   - Create production entities (Lead, Customer, etc.)
//   - Send outbound messages automatically
//   - Expose raw credentials
//
// Future use: export sanitized message metadata for supervised agent analysis.
// ============================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  // Always disabled in Phase 1
  return Response.json({
    enabled: false,
    status: 'DISABLED',
    phase: 'PHASE_1_SANDBOX',
    message: 'Agent export is disabled in Phase 1. This endpoint will only be activated when explicit, reviewed agent integration is enabled in a future phase.',
    future_requirements: [
      'Explicit admin approval to enable',
      'Agent permission review',
      'Production isolation validation',
      'Manual oversight controls in place',
    ],
  }, { status: 503 });
});