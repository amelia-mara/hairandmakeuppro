# Checks Happy — Deep Storage & RLS Audit

**Date:** 28 February 2026
**Scope:** Complete data flow from upload → storage → sync → display
**Migration:** `011_fix_rls_policies.sql`
**App Fixes:** `syncService.ts`, `syncSubscriptions.ts`

---

## PHASE 1: COMPLETE DATA MODEL

### 1.1 Database Tables

| Table | PK | Foreign Keys | Purpose | RLS |
|-------|-----|-------------|---------|-----|
| `users` | `id` (→ auth.users) | — | User profiles | Yes |
| `projects` | `id` | `created_by → users.id` | Production projects | Yes |
| `project_members` | `id` | `project_id → projects.id`, `user_id → users.id` | Team roster + ownership | Yes |
| `characters` | `id` | `project_id → projects.id` | Character definitions | Yes |
| `scenes` | `id` | `project_id → projects.id` | Scene breakdowns | Yes |
| `scene_characters` | `id` | `scene_id → scenes.id`, `character_id → characters.id` | Junction: scenes ↔ characters | Yes |
| `looks` | `id` | `project_id → projects.id`, `character_id → characters.id` | Hair/makeup looks | Yes |
| `look_scenes` | `id` | `look_id → looks.id` | Junction: looks ↔ scenes | Yes |
| `continuity_events` | `id` | `scene_id → scenes.id`, `character_id → characters.id`, `look_id → looks.id` | On-set continuity tracking | Yes |
| `photos` | `id` | `continuity_event_id → continuity_events.id`, `taken_by → users.id` | Photo metadata + storage path | Yes |
| `schedule_data` | `id` | `project_id → projects.id` | Parsed production schedules | Yes |
| `call_sheet_data` | `id` | `project_id → projects.id` | Parsed call sheets | Yes |
| `script_uploads` | `id` | `project_id → projects.id`, `uploaded_by → users.id` | Script PDF version tracking | Yes |
| `lookbooks` | `id` | `project_id → projects.id`, `character_id → characters.id` | Generated lookbook metadata | Yes |
| `timesheets` | `id` | `project_id → projects.id`, `user_id → users.id` | Weekly time entries | Yes |

### 1.2 Storage Buckets

**BUCKET: `continuity-photos`**
- Purpose: Continuity reference photos (on-set captures)
- Path pattern: `{project_id}/{character_id}/{uuid}.{ext}`
- Who uploads: `supabaseStorage.uploadPhoto()` via `syncCapturePhotos()`
- Who downloads: `supabaseStorage.downloadPhoto()` via `downloadAndCachePhoto()`
- Private: Yes
- Access: Project members only (via `can_access_project_storage()`)

**BUCKET: `project-documents`**
- Purpose: PDFs — scripts, schedules, call sheets, lookbooks, exports
- Path pattern: `{project_id}/{folder}/{uuid}.pdf`
- Folders: `scripts/`, `schedules/`, `call-sheets/`, `lookbooks/`, `exports/`
- Who uploads: `supabaseStorage.uploadDocument()` / `uploadBase64Document()`
- Who downloads: `supabaseStorage.downloadDocumentAsDataUri()`
- Private: Yes
- Access: Project members only (via `can_access_project_storage()`)

---

## PHASE 2: SCRIPT UPLOAD FLOWS

### 2.1 Path A: Script Upload During Project Creation (Home.tsx)

```
1. User selects script file
   → Home.tsx:handleFileSelect() (line 287)
   → Captures File object, extracts project name from filename

2. User clicks "Start Processing"
   → Home.tsx:handleStartWithFiles() (line 305)
   → Calls processScriptFast()

3. Script is parsed (regex, no AI)
   → Home.tsx:processScriptFast() (line 48)
   → scriptParser.ts:parseScenesFast() (line 1113)
   → Output: FastParsedScript { title, scenes[], rawText }

4. PDF encoded to base64
   → Home.tsx (line 108-113)
   → FileReader.readAsDataURL(file)
   → Stored as scriptPdfBase64 BEFORE setProject (critical timing)

5. Project object created with scenes + scriptPdfData
   → Home.tsx (line 100-127)
   → id: currentProject?.id || uuidv4()
   → scenes: mapped from FastParsedScene[] with new UUIDs
   → characters: [] (detected in background)
   → scriptPdfData: base64 string

6. Project stored in local Zustand store
   → projectStore.setProject(project)

7. Background character detection starts
   → Home.tsx:startBackgroundCharacterDetection() (line 159)
   → detectCharactersForScenesBatch() (regex-based)
   → Updates scenes with suggestedCharacters

8. App navigates to main view
   → onProjectReady() callback (line 149)

9. Sync starts (async, via useEffect in App.tsx)
   → syncService.startSync(projectId, userId)
   → pullProjectData() — empty for new project
   → subscribeToProject() — sets activeProjectId
   → pushInitialData() — pushes scenes, characters, script PDF
   → flushPendingSyncPushes() — forces immediate execution

10. Script PDF uploaded to storage
    → syncService.pushScriptPdf() (line 1075)
    → supabaseStorage.uploadBase64Document(projectId, 'scripts', data)
    → Bucket: project-documents, Path: {projectId}/scripts/{uuid}.pdf

11. script_uploads record created
    → syncService.pushScriptPdf() (line 1114-1126)
    → Fields SET: project_id, storage_path, file_name, file_size,
                  is_active=true, status='uploaded', uploaded_by, scene_count
    → Trigger deactivates previous active scripts automatically
```

### 2.2 Path B: Script Re-Upload Inside Project (More.tsx)

```
1. User is already in project (sync active, activeProjectId set)

2. User clicks "Upload New Draft" in Script tab
   → More.tsx:ScriptViewer component (line 963)

3. File is read and parsed
   → More.tsx:handleRevisedScriptUpload() (line 845)
   → parseScenesFast(file) — same parser as Path A
   → PDF encoded to base64 → setPendingScriptPdf(base64)

4. Script compared against existing breakdown
   → scriptAmendmentService.compareScriptAmendment() (line 97)
   → Calculates Jaccard similarity per scene
   → Returns AmendmentResult: new[], modified[], deleted[], unchanged[]

5. Amendment Review Modal shown
   → AmendmentReviewModal component
   → User selects which changes to apply

6. User confirms → scenes updated in store
   → More.tsx:handleApplyAmendment() (line 882)
   → applyAmendmentToScenes() — preserves ALL breakdown data
   → setScriptPdf(pendingScriptPdf) — updates PDF in store

7. Sync subscriptions detect changes → push automatically
   → syncSubscriptions.ts detects scenes changed → pushScenes()
   → syncSubscriptions.ts detects scriptPdfData changed → pushScriptPdf()
   → Both debounced 800ms, flushed on visibility change
```

### 2.3 Path Comparison

| Step | Path A (Home.tsx) | Path B (More.tsx) | Same? |
|------|-------------------|-------------------|-------|
| PDF encoding | FileReader.readAsDataURL | FileReader.readAsDataURL | YES |
| PDF storage upload | pushScriptPdf → uploadBase64Document | pushScriptPdf → uploadBase64Document | YES |
| Scene save | pushInitialData → pushScenes | syncSubscriptions → pushScenes | Different trigger, same push fn |
| Character save | pushInitialData → pushCharacters | syncSubscriptions → pushCharacters | Different trigger, same push fn |
| script_uploads | pushScriptPdf inserts record | pushScriptPdf inserts record | YES |
| Sync active during upload | NO (starts after) | YES | DIFFERENT |

**Key difference:** In Path A, sync starts AFTER the project is created, so `pushInitialData` catches everything. In Path B, sync is already running, so `syncSubscriptions` handles the push automatically.

---

## PHASE 3: PARSED DATA FLOW

### 3.1 Scene Breakdown

```
SCENES:
  Created by: scriptParser.parseScenesFast() in Home.tsx
  Stored locally in: projectStore.currentProject.scenes
  Pushed to Supabase by: syncService.pushScenes()
  Table: scenes
  Key fields: id, project_id, scene_number, int_ext, location,
              time_of_day, synopsis, script_content, shooting_day,
              filming_status, is_complete

SCENE → CHARACTER ASSIGNMENTS:
  Created by: User confirmation or background detection
  Stored locally in: scene.characters[] (array of character IDs)
  Pushed to Supabase by: pushScenes() → RPC sync_scene_characters()
  Table: scene_characters
  Pattern: Atomic delete-then-reinsert via SECURITY DEFINER RPC
```

### 3.2 Character Profiles

```
CHARACTERS:
  Created by: Background detection + user confirmation
  Stored locally in: projectStore.currentProject.characters
  Pushed to Supabase by: syncService.pushCharacters()
  Table: characters
  Key fields: id, project_id, name, initials, avatar_colour

LOOKS:
  Created by: User in breakdown UI
  Stored locally in: projectStore.currentProject.looks
  Pushed to Supabase by: syncService.pushLooks()
  Table: looks
  Key fields: id, project_id, character_id, name, estimated_time,
              makeup_details (JSONB), hair_details (JSONB)
  Linked to scenes via: look_scenes junction (RPC sync_look_scenes)
```

### 3.3 Continuity Tracking

```
CONTINUITY EVENTS:
  Created by: projectStore.getOrCreateSceneCapture(sceneId, characterId)
  Stored locally in: projectStore.sceneCaptures["{sceneId}-{characterId}"]
  Pushed to Supabase by: syncService.pushSceneCapture()
  Table: continuity_events
  Key fields: scene_id, character_id, look_id, continuity_flags (JSONB),
              continuity_events_data (JSONB), sfx_details (JSONB),
              general_notes, application_time

PHOTOS:
  Captured by: useCamera hook → HTML5 Canvas → JPEG blob
  Stored locally in: IndexedDB via db/index.ts savePhotoBlob()
  Uploaded to Supabase Storage by: syncCapturePhotos() → uploadPhoto()
  Bucket: continuity-photos
  Path pattern: {project_id}/{character_id}/{uuid}.jpg
  Photo record: photos table (id, continuity_event_id, storage_path, angle)
  Linked to continuity_event via: FK continuity_event_id
```

---

## PHASE 4: RLS POLICY AUDIT — ISSUES FOUND

### Issue 1: CRITICAL — Realtime Echo Loop Causing Data Churn

```
COMPONENT: syncService.ts realtime handlers + syncSubscriptions.ts
PROBLEM: handleSceneChange/handleCharacterChange/handleLookChange used
         setProject() which:
         (a) Resets lifecycle state (needsSetup, showWrapPopup, etc.)
         (b) Triggers syncSubscriptions → pushes same data back to server
         (c) Server broadcasts again → infinite echo loop between devices
IMPACT: Wasted bandwidth, potential data loss if changes collide,
        lifecycle state constantly reset
FIX APPLIED: Changed all three handlers to use mergeServerData() +
             receivingFromServer flag to prevent pushback
```

### Issue 2: CRITICAL — Helper Functions Missing STABLE Marker

```
FUNCTIONS: is_project_member(), is_project_owner()
PROBLEM: Without STABLE, PostgreSQL treats them as VOLATILE and calls
         them for every row in every query. Since these are used in
         RLS policies on EVERY table, this means N function calls per
         query instead of 1.
IMPACT: Slow queries, especially on tables with many rows (scenes,
        photos, continuity_events)
FIX: Added STABLE marker to both functions in migration 011
```

### Issue 3: HIGH — RPC Functions Had No Authorization

```
FUNCTIONS: sync_scene_characters(), sync_look_scenes()
PROBLEM: SECURITY DEFINER RPCs with NO membership check. Any
         authenticated user could delete/insert scene_characters
         or look_scenes for ANY project.
IMPACT: Security vulnerability — unauthorized data modification
FIX: Added is_project_member() check in migration 011
```

### Issue 4: HIGH — Missing SECURITY DEFINER on search_path

```
FUNCTIONS: All SECURITY DEFINER functions
PROBLEM: No SET search_path directive. Vulnerable to search_path
         injection if a malicious schema is prepended.
IMPACT: Theoretical security vulnerability
FIX: Added SET search_path = public to all functions in migration 011
```

### Issue 5: MEDIUM — Missing UPDATE Policies

```
TABLES: scene_characters, look_scenes, photos
PROBLEM: No UPDATE RLS policy existed. Any UPDATE attempt would be
         silently blocked by RLS.
IMPACT: UPDATE operations would fail silently. Currently the app
        uses delete-then-insert for junctions, so minimal impact,
        but photo notes updates would fail.
FIX: Added UPDATE policies in migration 011
```

### Issue 6: MEDIUM — Stale Closure in Realtime Handlers

```
COMPONENT: syncService.ts handleSceneChange, handleLookChange
PROBLEM: The `project` variable was captured in the outer scope, but
         used inside an async .then() callback. By the time the
         callback fires, the project may have been updated by another
         event, causing stale data to overwrite current state.
IMPACT: Race condition — concurrent realtime events could overwrite
        each other's changes
FIX APPLIED: Re-read useProjectStore.getState().currentProject inside
             the .then() callback
```

### Issue 7: MEDIUM — Timesheets UPDATE Policy Missing Membership Check

```
TABLE: timesheets
PROBLEM: Old UPDATE policy only checked auth.uid() = user_id, not
         project membership. A user could update timesheets after
         leaving a project.
IMPACT: Stale access after project departure
FIX: Added is_project_member(project_id) check in migration 011
```

### Issue 8: LOW — deactivate_previous_scripts Not SECURITY DEFINER

```
FUNCTION: deactivate_previous_scripts() trigger
PROBLEM: Runs as the invoking user. If RLS somehow blocked the UPDATE
         on other script_uploads rows, old scripts wouldn't be
         deactivated, leaving multiple "active" scripts.
IMPACT: Potential for multiple active scripts per project
FIX: Made SECURITY DEFINER in migration 011
```

### Issue 9: LOW — Continuity/Photo Subscriptions Unfiltered

```
COMPONENT: syncService.ts subscribeToProject()
PROBLEM: continuity_events and photos subscriptions have no
         server-side project_id filter. ALL changes for ALL projects
         are sent to ALL clients, filtered client-side.
CAUSE: These tables have no direct project_id column
IMPACT: Performance — unnecessary data transfer. Not a data leak
        because RLS prevents reading other projects' data.
NOTE: Not fixed in this migration — would require adding project_id
      columns to continuity_events and photos tables (schema change).
```

---

## PHASE 5: DATA FLOW VERIFICATION

### Storage Connection Chain: Script PDF

```
Upload → supabaseStorage.uploadBase64Document()
       → Bucket: project-documents
       → Path: {projectId}/scripts/{uuid}.pdf
       → RLS: can_access_project_storage(name) ✓

DB Record → script_uploads table
          → Fields: storage_path, file_name, file_size, is_active
          → RLS: is_project_member(project_id) ✓

Download → supabaseStorage.downloadDocumentAsDataUri()
         → Reads from project-documents bucket
         → RLS: can_access_project_storage(name) ✓

Display → projectStore.currentProject.scriptPdfData
        → Rendered in More.tsx ScriptViewer
```

### Storage Connection Chain: Continuity Photos

```
Capture → useCamera hook → Canvas → JPEG blob

Local Cache → IndexedDB via savePhotoBlob()

Upload → syncCapturePhotos() → supabaseStorage.uploadPhoto()
       → Bucket: continuity-photos
       → Path: {projectId}/{characterId}/{uuid}.jpg
       → RLS: can_access_project_storage(name) ✓

DB Record → photos table
          → Fields: id, continuity_event_id, storage_path, angle
          → RLS: via continuity_events → scenes → is_project_member ✓

Download → downloadAndCachePhoto() → supabaseStorage.downloadPhoto()
         → Cached in IndexedDB
         → RLS: can_access_project_storage(name) ✓
```

### Storage Connection Chain: Schedule PDF

```
Upload → pushSchedulePdf() → uploadBase64Document()
       → Bucket: project-documents
       → Path: {projectId}/schedules/{uuid}.pdf
       → RLS: can_access_project_storage(name) ✓

DB Record → schedule_data table (storage_path column)
          → RLS: is_project_member(project_id) ✓

Download → downloadSchedulePdf() → downloadDocumentAsDataUri()
         → RLS: can_access_project_storage(name) ✓
```

### Storage Connection Chain: Call Sheet PDF

```
Upload → pushCallSheetPdf() → uploadBase64Document()
       → Bucket: project-documents
       → Path: {projectId}/call-sheets/{uuid}.pdf
       → RLS: can_access_project_storage(name) ✓

DB Record → call_sheet_data table (storage_path column)
          → RLS: is_project_member(project_id) ✓

Download → downloadDocumentAsDataUri()
         → RLS: can_access_project_storage(name) ✓
```

---

## PHASE 6: MIGRATION APPLIED

**File:** `mobile-pwa/supabase/migrations/011_fix_rls_policies.sql`

### What it does:
1. Drops ALL existing RLS policies (clean slate)
2. Drops ALL existing storage policies
3. Recreates helper functions with `STABLE`, `SET search_path`, `public.` schema refs
4. Enables RLS on all 15 tables
5. Creates complete RLS policies for every table (SELECT/INSERT/UPDATE/DELETE)
6. Creates storage policies for both buckets
7. Fixes RPC functions with authorization checks
8. Includes verification queries

### Policy naming convention:
Old: `"Project members can view scenes"` (verbose, inconsistent)
New: `"scenes_select"` (concise, predictable: `{table}_{operation}`)

---

## PHASE 7: APP-SIDE FIXES APPLIED

### Fix 1: Realtime Echo Loop Prevention

**Files changed:** `syncService.ts`, `syncSubscriptions.ts`

**What:** Added `receivingFromServer` flag. Set to `true` before updating
local stores from realtime events, checked in syncSubscriptions to
skip pushing when the change came from the server.

**Before:**
```
Server event → handleSceneChange → setProject() →
  syncSubscriptions → pushScenes() → server broadcasts → LOOP
```

**After:**
```
Server event → handleSceneChange → receivingFromServer=true →
  mergeServerData() → syncSubscriptions checks flag → SKIPS push →
  receivingFromServer=false → NO LOOP
```

### Fix 2: setProject → mergeServerData in Realtime Handlers

**File:** `syncService.ts`

**What:** Changed `handleSceneChange`, `handleCharacterChange`, and
`handleLookChange` from `projectStore.setProject()` to
`projectStore.mergeServerData()`.

**Why:** `setProject()` resets lifecycle state (needsSetup, showWrapPopup,
wrapTriggerReason) on every realtime event. `mergeServerData()` only
updates the specific fields provided.

### Fix 3: Stale Closure Fix in Async Handlers

**File:** `syncService.ts`

**What:** In `handleSceneChange` and `handleLookChange`, the `project`
variable was captured in the outer scope but used inside `.then()`.
Now re-reads `useProjectStore.getState().currentProject` inside the
callback to get current state.

---

## PHASE 8: TEST PLAN

### Test 1: Create Project with Script on Device A
1. Sign in on Device A
2. Create new project
3. Upload script PDF
4. Wait for sync indicator to show "Synced"
5. **Verify in Supabase:**
   - `projects` table: row exists with correct name
   - `project_members` table: row exists with user_id, is_owner=true
   - `scenes` table: rows exist with project_id
   - `characters` table: rows exist after confirmation
   - `scene_characters` table: junction rows exist
   - `script_uploads` table: row with is_active=true, storage_path set
   - Storage → project-documents bucket: PDF file at `{projectId}/scripts/`

### Test 2: Log Out and Back In — Data Persists
1. Sign out on Device A
2. Sign back in
3. **Verify:** Project appears in hub, can open it
4. **Verify:** Scenes, characters, looks all present
5. **Verify:** Script PDF viewable in Script tab

### Test 3: Log In on Device B — Data Syncs
1. Sign in on Device B with same account
2. **Verify:** Project appears in hub
3. Open project
4. **Verify:** All scenes load with correct scene numbers
5. **Verify:** Characters present
6. **Verify:** Script PDF viewable in Script tab
7. **Verify:** Schedule data (if uploaded) present

### Test 4: Continuity Photo Cross-Device
1. On Device A: Navigate to a scene, open continuity
2. Capture a continuity photo (front angle)
3. Wait for sync
4. On Device B: Navigate to same scene/character
5. **Verify:** Photo appears (may take a moment to download)
6. **Verify:** Photo angle correct (front)

### Test 5: Script Re-Upload (Path B)
1. On Device A: Go to More → Script tab
2. Click "Upload New Draft"
3. Upload revised script
4. Review amendment modal
5. Apply changes
6. **Verify:** Scenes updated locally
7. **Verify:** script_uploads table has new active record
8. **Verify:** Old script record has is_active=false
9. On Device B: **Verify:** New script appears via realtime

### Test 6: Call Sheet Upload
1. Upload a call sheet PDF
2. **Verify:** call_sheet_data row created in Supabase
3. **Verify:** PDF stored in project-documents bucket at `{projectId}/call-sheets/`
4. **Verify:** storage_path column populated
5. On Device B: **Verify:** Call sheet data appears

### Test 7: No Echo Loop
1. Open browser dev tools Network tab on Device A
2. Make a change (edit a scene)
3. **Verify:** Only ONE push to Supabase (not repeated pushes)
4. **Verify:** No repeated requests to the same table endpoint
