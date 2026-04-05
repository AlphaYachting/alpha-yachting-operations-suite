import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Backfill / Reconciliation job.
 *
 * Scans historical WorkOrders and sets them to the correct terminal status
 * if all their Tasks already satisfy the same completion conditions used by
 * the live `autoCompleteWorkOrder` automation.
 *
 * Rules (identical to autoCompleteWorkOrder):
 *   - Terminal task states : Completed | Skipped | Not Possible
 *   - At least ONE task must be "Completed" (not all skipped/not-possible)
 *   - ORGANIZATION WOs  → Completed
 *   - EXECUTION / STANDARD WOs → Ready to Invoice
 *   - Cancelled WOs        → ignored
 *   - Empty-task WOs       → ignored
 *   - Already-correct WOs  → unchanged
 *   - Commercially-advanced WOs (already Invoiced) → ignored
 *
 * Payload:
 *   { dry_run: true }   — report only, no writes (default: true for safety)
 *   { dry_run: false }  — perform updates
 *   { batch_size: N }   — max WOs to process (default: 500)
 */

const TERMINAL_STATES = new Set(['Completed', 'Skipped', 'Not Possible']);
const SKIP_STATUSES   = new Set(['Cancelled', 'Ready to Invoice', 'Completed', 'Invoiced']);
// statuses we NEVER downgrade from
const ADVANCED_STATUSES = new Set(['Invoiced']);

/**
 * Evaluate a single WorkOrder against its tasks.
 * Returns { action, targetStatus, reason }
 */
function evaluateWorkOrder(wo, tasks) {
  // Skip WOs with no tasks
  if (!tasks || tasks.length === 0) {
    return { action: 'skip', reason: 'no tasks' };
  }

  // Skip commercially-advanced states (never touch invoiced WOs)
  if (ADVANCED_STATUSES.has(wo.status)) {
    return { action: 'skip', reason: `commercially advanced status: ${wo.status}` };
  }

  // Skip Cancelled
  if (wo.status === 'Cancelled') {
    return { action: 'skip', reason: 'cancelled' };
  }

  const allDone = tasks.every(t => TERMINAL_STATES.has(t.status));
  if (!allDone) {
    const pending = tasks.filter(t => !TERMINAL_STATES.has(t.status)).length;
    return { action: 'skip', reason: `${pending} task(s) still non-terminal` };
  }

  const hasAtLeastOneCompleted = tasks.some(t => t.status === 'Completed');
  if (!hasAtLeastOneCompleted) {
    return { action: 'skip', reason: 'all tasks skipped/not-possible, none completed' };
  }

  const isOrgWO = wo.workorder_type === 'ORGANIZATION';
  const targetStatus = isOrgWO ? 'Completed' : 'Ready to Invoice';

  // Already at correct status
  if (wo.status === targetStatus) {
    return { action: 'unchanged', reason: `already ${targetStatus}`, targetStatus };
  }

  return { action: 'update', targetStatus, reason: `all ${tasks.length} tasks terminal, at least 1 completed` };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun    = body.dry_run !== false; // default true
    const batchSize = Math.min(body.batch_size || 500, 1000);

    console.log(`[reconcile] Starting — dry_run=${dryRun}, batch_size=${batchSize}`);

    // Load all non-trivially-skippable WorkOrders
    const allWOs = await base44.asServiceRole.entities.WorkOrder.list('-created_date', batchSize);

    const summary = {
      dry_run: dryRun,
      scanned: allWOs.length,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      errors: 0,
      updated_to_ready_to_invoice: [],
      updated_to_completed: [],
      skip_reasons: {},
    };

    for (const wo of allWOs) {
      try {
        // Load tasks for this WO
        const tasks = await base44.asServiceRole.entities.Task.filter({ work_order_id: wo.id });

        const { action, targetStatus, reason } = evaluateWorkOrder(wo, tasks);

        if (action === 'skip') {
          summary.skipped++;
          summary.skip_reasons[reason] = (summary.skip_reasons[reason] || 0) + 1;
          continue;
        }

        if (action === 'unchanged') {
          summary.unchanged++;
          continue;
        }

        // action === 'update'
        if (!dryRun) {
          const updatePayload = {
            status: targetStatus,
            documentation_complete: true,
          };
          // Only set actual_end_time if not already set (preserve existing timestamps)
          if (!wo.actual_end_time) {
            updatePayload.actual_end_time = new Date().toISOString();
          }
          await base44.asServiceRole.entities.WorkOrder.update(wo.id, updatePayload);
        }

        summary.updated++;
        const entry = { id: wo.id, number: wo.work_order_number, title: wo.title, from: wo.status, to: targetStatus };
        if (targetStatus === 'Ready to Invoice') {
          summary.updated_to_ready_to_invoice.push(entry);
        } else {
          summary.updated_to_completed.push(entry);
        }

        console.log(`[reconcile] ${dryRun ? '[DRY] ' : ''}WO ${wo.work_order_number} → ${targetStatus} (was: ${wo.status})`);

      } catch (woErr) {
        console.error(`[reconcile] Error on WO ${wo.id}:`, woErr.message);
        summary.errors++;
      }
    }

    console.log(`[reconcile] Done — updated=${summary.updated}, unchanged=${summary.unchanged}, skipped=${summary.skipped}, errors=${summary.errors}`);

    return Response.json({
      success: true,
      summary,
      message: dryRun
        ? `Dry run complete. ${summary.updated} WO(s) would be updated.`
        : `Reconciliation complete. ${summary.updated} WO(s) updated.`,
    });

  } catch (error) {
    console.error('[reconcile] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});