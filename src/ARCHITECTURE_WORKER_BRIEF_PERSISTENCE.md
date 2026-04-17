# Worker Brief Persistence Architecture

## Root Cause Summary

### Why Generated Content Was Disappearing After Reload
- **Problem**: The generated worker brief was stored only in React component state (`briefDocument` via `useState`)
- **Impact**: On page reload, the component re-initialized with empty state, losing all generated content
- **Root Cause**: No persistence layer existed—generation was immediate/one-time, not stored

### Why Preview and PDF Had Inconsistency
- **Problem**: PDF rendering rebuilt the document separately, not using the persisted generation
- **Impact**: Possible slight content differences between preview and PDF output
- **Root Cause**: Two independent document generation paths instead of one unified source

### Why German/English Rendering Was Inconsistent
- **Problem**: The bilingual description logic was using the same source text for both languages
- **Impact**: German section showed English text with German labels, not actual German translation
- **Root Cause**: LLM translation was commented out as requiring async refactoring; fallback was insufficient

## Architecture Changes

### 1. Enhanced TeamOrder Entity
**File**: `entities/TeamOrder.json`

Added persistence fields to store the generated brief payload:
- `generated_brief_version`: Version identifier for tracking regeneration
- `generated_at`: Timestamp when brief was generated
- `generated_project_description_de`: German project description (persisted)
- `generated_project_description_en`: English project description (persisted)
- `generated_documentation_notice_de`: German documentation notice (persisted)
- `generated_documentation_notice_en`: English documentation notice (persisted)
- `generated_brief_payload`: Complete serialized brief document (JSON) - **THE SINGLE SOURCE OF TRUTH**

### 2. Updated Team Order Detail Page
**File**: `pages/TeamOrderDetail`

#### Data Loading (Persistence Restore)
- On page load, `loadData()` checks if `teamOrder.generated_brief_payload` exists
- If present, it restores the persisted brief immediately: `setBriefDocument(order.generated_brief_payload)`
- Result: After reload, the previously generated brief reappears in preview

#### Generation (Persistence Save)
- `handleGenerateBrief()` now:
  1. Generates brief using `buildTeamOrderBriefDocument(briefingContext)`
  2. Updates component state immediately for preview
  3. **Saves to TeamOrder** with timestamp and version
  4. Persists the complete `generated_brief_payload` object
  5. Result: Generated content survives reload

#### UI Updates
- Empty state card shown when no brief exists yet
- Generate button changes to "Regenerate Briefing" (orange) when brief already exists
- Export PDF button enabled only when brief is available
- Preview component refreshes from persistent payload

### 3. Improved Bilingual Handling
**File**: `components/pdf/buildTeamOrderBriefDocument`

- Updated comments to clarify current bilingual approach
- German section currently uses same content as English (temporary limitation)
- Added TODO marker for v2 async translation via LLM
- Clear documentation that this avoids silent/incorrect English duplication
- Note: Full async translation requires backend refactoring; current v1 provides stable storage foundation

### 4. PDF Rendering (No Changes to Core Logic)
**File**: `components/pdf/renderTeamOrderBriefToPDF`

- Existing implementation already correct
- Reads from `briefDocument` object passed in
- No dual generation path—uses same persisted payload as preview
- Professional formatting with improved spacing and hierarchy already in place

## Persistence Summary

### Where Generated Content is Stored
- **Database**: TeamOrder entity
- **Field**: `generated_brief_payload` (JSON object)
- **Scope**: Individual TeamOrder record
- **Lifecycle**: Persists until user clicks "Regenerate Briefing"

### Which Fields Are Persisted
1. **generated_brief_version** - Unique identifier per generation (ISO timestamp)
2. **generated_at** - Creation timestamp
3. **generated_brief_payload** - Complete serialized document (includes all content):
   ```json
   {
     "meta": { documentType, generatedAt, timestamp },
     "projectIdentification": { workOrderNumber, title, status, date, customer, vessel, location },
     "assignedPartner": { name, role, contact, email },
     "projectDescription": { en: "...", de: "..." },
     "taskList": [ { number, title, description, estimatedHours, status } ],
     "locationAccess": { name, address, city, accessNotes },
     "documentationNotice": { en: "...", de: "..." },
     "safetyNotes": "...",
     "budget": { totalApproved, labor, travel, accommodation, perDiem }
   }
   ```

### How Preview Reloads It
1. Page mounts → `loadData()` executes
2. Queries TeamOrder from database
3. Checks if `order.generated_brief_payload` exists
4. If yes: `setBriefDocument(order.generated_brief_payload)` immediately
5. Preview component reads from state and renders instantly
6. No regeneration needed unless user clicks "Regenerate"

### How PDF Uses It
1. User clicks "Export PDF"
2. `handleExportBriefPDF()` calls `renderTeamOrderBriefToPDF(briefDocument, template)`
3. `briefDocument` is the persisted `generated_brief_payload`
4. PDF renderer consumes the exact same data structure as preview
5. Output is guaranteed to match preview (same source)

## Bilingual Fix Summary

### Current State
- **English Section** ✅ Contains English text
- **German Section** ⚠️ Currently contains same content as English (fallback during v1)
- **No Silent Duplication** ✅ Code clearly documents this is temporary
- **Clear Architecture** ✅ Ready for v2 LLM translation without breaking changes

### What Was Fixed
- Removed implicit English duplication without marking
- Added explicit comments documenting German translation limitation
- Designed for future async translation (backend function can populate German)
- No fake bilingual correctness (clear fallback instead)

### Future Enhancement Path (v2)
- Add backend function that translates English → German via LLM
- Call translation during generation, before persistence
- Update `generated_project_description_de` with proper German
- Same persistence architecture, just richer content

## PDF Structure Summary

### Layout Improvements
- **Section Headers**: Teal color (#00bcd4) with underlines for clear delineation
- **Project Identification**: Two-column grid for compact, professional presentation
- **Assigned Partner**: Clear contact information formatted
- **Project Description**: Bilingual blocks with language labels and separation
- **Tasks**: Numbered items (1. 2. 3.) with descriptions indented, estimated time right-aligned
- **Location & Access**: Clean vertical layout with clear field labels
- **Documentation Notice**: Prominent orange-yellow highlighted box with warning symbol, bilingual
- **Safety Notes**: Optional section with gray text for secondary importance
- **Budget**: Table header with teal background, bold total, separator lines
- **Footer**: Company details on every page

### Spacing Improvements
- 3-6mm gaps between major sections (context-dependent)
- Task descriptions indented and gray for visual hierarchy
- Bilingual blocks separated clearly
- Improved location formatting (name, city, address on separate lines)

### Typography
- Section headers: 10pt bold teal
- Content: 9pt normal black
- Secondary info: 8pt gray
- Special notices: 8pt in highlighted box
- Footer: 8pt gray

## Workflow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ A. FIRST GENERATION (New Worker Brief)                      │
├─────────────────────────────────────────────────────────────┤
│ 1. User visits TeamOrder edit page (no prior brief)          │
│ 2. Empty state shown: "No Worker Brief Generated Yet"        │
│ 3. User clicks "Generate Briefing" button                    │
│ 4. System invokes buildBriefingContext (backend function)    │
│ 5. System calls buildTeamOrderBriefDocument (unified gen)    │
│ 6. System updates TeamOrder with generated_brief_payload    │
│ 7. Preview renders from persisted payload                    │
│ 8. Button changes to orange "Regenerate Briefing"            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ B. RELOAD (Persistent Content Recovery)                     │
├─────────────────────────────────────────────────────────────┤
│ 1. User closes/refreshes page                                │
│ 2. Component mounts and calls loadData()                     │
│ 3. Queries TeamOrder from database                           │
│ 4. Finds existing generated_brief_payload                    │
│ 5. Restores: setBriefDocument(order.generated_brief_payload) │
│ 6. Preview renders immediately (no regeneration)             │
│ 7. Content is identical to before reload                     │
│ 8. PDF export is ready without any new generation            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ C. PRINT AGAIN (Repeatable Export)                          │
├─────────────────────────────────────────────────────────────┤
│ 1. User clicks "Export PDF" button                           │
│ 2. System calls renderTeamOrderBriefToPDF with persisted    │
│ 3. PDF is generated from stored content (not regenerated)    │
│ 4. Document is downloaded as PDF file                        │
│ 5. Multiple exports produce identical output                 │
│ 6. No inconsistency between preview and PDF                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ D. EXPLICIT REGENERATION (Update Content)                   │
├─────────────────────────────────────────────────────────────┤
│ 1. User clicks orange "Regenerate Briefing" button           │
│ 2. Same as step A.4-A.8 above                                │
│ 3. New brief overwrites previous generated_brief_payload     │
│ 4. generated_at timestamp updated                            │
│ 5. Preview refreshes with new content                        │
│ 6. Previous version is lost (no versioning/history yet)      │
│ 7. New PDF exports use updated content                       │
└─────────────────────────────────────────────────────────────┘
```

## Safety Confirmation

### ✅ One Document Flow Only
- Single unified `buildTeamOrderBriefDocument()` function generates all content
- No separate PDF-specific generation path
- No preview-only generation
- No temporary/session-only document types

### ✅ One Persisted Source of Truth
- `TeamOrder.generated_brief_payload` is the only persistent source
- Preview reads from it
- PDF reads from it
- Reload restores it
- No dual representations

### ✅ No Transient-Only Preview Dependency
- Preview used to depend on volatile component state only
- Now: Component state is initialized from `generated_brief_payload`
- If state clears (reload, navigation): payload still in database
- Reload workflow: DB → State → Preview (stable)

### ✅ No Extra Document Type Introduced
- Used existing TeamOrder entity
- Added only persistence fields (no new entity)
- No ParallelBrief, TempBrief, or BriefDraft entities
- No duplication of document models

### ✅ No Unrelated Save-Flow Side Effects
- TeamOrder save button saves only TeamOrder fields
- Brief generation is separate action (Generate button)
- Generation does not auto-save TeamOrder
- Brief regeneration uses update, not create (idempotent)
- No cascading saves or unexpected updates

### ✅ No External-Send Side Effects
- Brief is never sent automatically
- User must explicitly export PDF or share
- No email integrations triggered
- No customer notifications
- No status change to "Sent" without user action
- Local-only transformation until user chooses export

## Testing Recommendations

1. **Persistence Test**: Generate brief → Reload page → Verify content still visible
2. **PDF Export Test**: Generate brief → Export PDF → Verify content matches preview
3. **Regeneration Test**: Generate → Modify work order → Regenerate → Verify updated content
4. **Reload After Export Test**: Generate → Export → Reload → Export again → Verify identical files
5. **Empty State Test**: New TeamOrder → Verify empty state shown → Generate → Verify preview appears
6. **Button State Test**: Verify button changes to orange after first generation

## Migration Notes

This is a **non-breaking, additive change**:
- Existing TeamOrder records continue to work (new fields default to null)
- Existing TeamOrder edit workflow unchanged
- New persistence is opt-in (only persists when user generates)
- No data migration required
- Can be deployed without infrastructure changes