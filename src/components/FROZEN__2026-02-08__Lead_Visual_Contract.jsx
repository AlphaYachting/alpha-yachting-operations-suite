# FROZEN: Lead Visual Contract
**Established:** 2026-02-08  
**Status:** LOCKED — No regressions permitted  
**Purpose:** Prevent visual regression loop by locking non-negotiable Lead display behavior

---

## A. MUST-NEVER-CHANGE RULES

### Aging Indicator Thresholds (Border Display)
```
ageDays > 5       → RED BORDER    (border-red-400 border-2)
3 < ageDays ≤ 5   → YELLOW BORDER (border-yellow-400 border-2)
ageDays ≤ 3       → DEFAULT       (hover:border-slate-300)
```

**Immutable:** These thresholds must remain exactly as specified. Any change to these values constitutes a **visual regression** and must be reverted immediately.

### Creation Date Visibility
- **MUST** be displayed in Lead list (Row 2, contact info row)
- **MUST** be visible without opening the lead detail
- **MUST** use format: `"Created MMM d, yyyy"` (e.g., "Created Feb 8, 2026")
- **MUST** appear after location (if present) or as trailing element in Row 2

**Immutable:** Creation date is informational and part of the core Lead list UX. Hiding it, removing it, or changing its location constitutes a **visual regression**.

### Border Styling (Non-Functional)
- Aging borders are **purely visual**
- Aging status is **never** written to database
- Aging status is **never** used in form submission logic
- Aging status is **calculated client-side only** from:
  - `lead.last_activity_at` OR `lead.last_interaction_at` (priority 1)
  - `lead.status_updated_at` (priority 2)
  - `lead.updated_date` (priority 3)
  - `lead.created_date` (fallback)

**Immutable:** Aging calculation must follow the priority order above, without exception.

---

## B. MOVEMENT TIMESTAMP PRIORITY (Aging Basis)

The age of a lead is determined by the **most recent movement timestamp**, checked in this priority:

1. **`lastActivityAt` / `last_interaction_at`**  
   Use if present (represents most recent user interaction, call, email, etc.)

2. **`statusUpdatedAt` / `status_updated_at`**  
   Use if priority 1 is not present (represents last status change by user)

3. **`updatedAt` / `updated_date`**  
   Use if priorities 1–2 are not present (represents last system update)

4. **`createdAt` / `created_date`**  
   Fallback only (represents when lead was initially created)

**Immutable:** This priority must be honored in `getLeadAgingLevel()` and all age-based calculations. Changing priority order is a **functional regression**.

---

## C. FROZEN VS MUTABLE AREAS

### ✅ FROZEN (Do Not Change Without Explicit Approval)
- Aging indicator thresholds (>5 red, 3–5 yellow)
- Creation date display in list
- Timestamp priority for age calculation
- Lead list Row 2 field order: phone → email → boat → location → created date
- Status badge display
- Priority badge display
- Inquiry type badge display
- Name truncation and ellipsis behavior

### ⚠️ MUTABLE (Safe to Change if Explicitly Requested)
- Color hex values (if aging thresholds remain the same conceptually, e.g., "darker red" for >5 days)
- Border thickness (if still visually distinct from default)
- Font sizes, padding, margins (non-critical spacing)
- Label text (e.g., "Created" → "Added" is OK; changes to threshold logic is NOT)
- Sort order of leads (newest first, oldest first, custom order)
- Additional non-critical metadata fields (as long as Row 2 order is preserved)

**Rule:** If you are unsure whether something is mutable, assume it is **FROZEN** and ask first.

---

## D. MANDATORY RULE FOR FUTURE CHANGES

### Before Any Lead-Related Change Is Applied:

**ASSERTION:** "This change does not affect:
1. Aging indicator thresholds (>5 red, 3–5 yellow, ≤3 default)
2. Creation date visibility in Lead list Row 2
3. Timestamp priority for age calculation"

If the assertion **cannot** be made, the change must:
- Include visual regression fix as part of the same PR
- Include before/after screenshots proving visuals are preserved
- Be explicitly documented in a DIFF_NOTES file

### Violation Consequences:
- Change is reverted to FROZEN baseline
- Issue is re-opened
- Process is restarted with visual lock-down

---

## E. VERSION MARKER

This contract is **locked as of 2026-02-08 EOD**.  
Any changes to Lead module visuals must reference this document and justify deviations.

**Next Review Date:** 2026-02-22 (2 weeks) — only after Lead module is fully stabilized.

---

## SIGN-OFF

**Frozen By:** AI Lead Module Stabilization Process  
**Reason:** Prevent regression loop caused by unconstrained visual changes  
**Baseline Date:** 2026-02-08 (commit point for all subsequent validations)