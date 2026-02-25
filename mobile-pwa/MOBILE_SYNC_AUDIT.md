# Mobile-to-Mobile Sync Audit

Audit of how the sync system works when two (or more) mobile app accounts collaborate on the same project.

---

## Architecture Overview

The mobile app is a **Capacitor-wrapped PWA** (React + TypeScript + Vite) that uses **Supabase** as its cloud backend. Sync between mobile accounts works through a hub-and-spoke model:

```
Mobile App A  <-->  Supabase (PostgreSQL + Realtime + Storage)  <-->  Mobile App B
```

There is **no direct peer-to-peer sync**. All data flows through Supabase. Two mobile users working on the same project are kept in sync via:

1. **Push** - Local changes are debounced and upserted to Supabase
2. **Pull** - On project load, the full dataset is fetched from Supabase
3. **Realtime** - Supabase Postgres Changes stream live updates to all connected clients

---

## How Two Mobile Users Connect to the Same Project

### Project Creation & Invite Codes

1. **User A** creates a project via `supabaseProjects.createProject()` (`src/services/supabaseProjects.ts:30`)
   - A unique invite code is generated (format: `XXX-XXXX`, e.g., `TMK-4827`)
   - User A is added to `project_members` with `role: 'designer'` and `is_owner: true`

2. **User B** joins via `authStore.joinProject(code)` (`src/stores/authStore.ts:352`)
   - The invite code is looked up in the `projects` table
   - User B is added to `project_members` with `role: 'floor'` and `is_owner: false`
   - If User B is already a member, the join is a no-op (returns the existing project)

### Roles

Roles from `project_members`: `designer`, `hod`, `supervisor`, `key`, `floor`, `daily`, `trainee`. Roles are used for RLS and can be updated by the owner.

---

## Sync Lifecycle (Per Project Session)

When a user opens a project, the sync lifecycle is managed in `src/services/syncService.ts`:

### 1. `startSync(projectId, userId)` (line 1065)

```
startSync()
  ├── Check navigator.onLine
  │   └── If offline → set status 'offline', listen for 'online' event
  ├── pullProjectData(projectId)       ← Full pull from Supabase
  ├── subscribeToProject(projectId)    ← Realtime subscriptions
  └── Register online/offline event listeners
```

### 2. Pull Phase - `pullProjectData()` (line 243)

Fetches all project data from Supabase in 3 phases:

| Phase | Tables Fetched | Scoping |
|-------|---------------|---------|
| 1 | `scenes`, `characters`, `looks`, `schedule_data` | `WHERE project_id = ?` |
| 2 | `scene_characters`, `look_scenes`, `continuity_events` | `WHERE scene_id IN (...)` / `WHERE look_id IN (...)` |
| 3 | `photos` | `WHERE continuity_event_id IN (...)` |

**Merge strategy: Server wins, but local-only fields are preserved.** When merging, the DB record overwrites the local record, except for fields that only exist locally (e.g., `scriptContent`, `masterReference`, `continuityFlags` on looks, `hasScheduleDiscrepancy`).

For photos: each photo is checked against the local IndexedDB cache. If not cached, the binary is downloaded from Supabase Storage and saved locally.

### 3. Push Phase - Triggered by Zustand Store Subscriptions

`src/services/syncSubscriptions.ts` sets up Zustand `subscribe()` watchers on `projectStore` and `scheduleStore`. When state changes:

| Change Detected | Push Function | Debounce |
|----------------|---------------|----------|
| `scenes` array changed | `pushScenes()` | 800ms |
| `characters` array changed | `pushCharacters()` | 800ms |
| `looks` array changed | `pushLooks()` | 800ms |
| `sceneCaptures` changed | `pushSceneCapture()` | 800ms per capture |
| `schedule` changed | `pushScheduleData()` | 800ms |

Each push function:
- Uses `supabase.from(table).upsert(..., { onConflict: 'id' })`
- For junction tables (`scene_characters`, `look_scenes`): deletes existing rows, then re-inserts
- Photos are uploaded to Supabase Storage (`continuity-photos` bucket) if not already present

### 4. Realtime Subscriptions - `subscribeToProject()` (line 712)

A single Supabase Realtime channel `project:{projectId}` subscribes to `postgres_changes` on:

| Table | Filter | Handler |
|-------|--------|---------|
| `scenes` | `project_id=eq.{id}` | `handleSceneChange()` |
| `characters` | `project_id=eq.{id}` | `handleCharacterChange()` |
| `looks` | `project_id=eq.{id}` | `handleLookChange()` |
| `continuity_events` | *unfiltered* (client-side filter) | `handleContinuityEventChange()` |
| `photos` | *unfiltered* (client-side filter) | `handlePhotoChange()` |
| `schedule_data` | `project_id=eq.{id}` | `handleScheduleChange()` |

**Echo prevention:** A `pushingTables` Set tracks which tables are currently being pushed. If a realtime event arrives for a table that is mid-push, it's ignored to prevent feedback loops.

**Presence tracking:** The channel also uses Supabase Presence to track how many team members are online. The `SyncStatusBanner` component (`src/components/sync/SyncStatusBanner.tsx`) shows an online count and a colored dot for sync status.

---

## What Data Syncs Between Mobile Accounts

### Synced via Supabase (shared across all team members)

| Data | Storage | Sync Method |
|------|---------|-------------|
| Scenes (scene number, INT/EXT, location, time of day, synopsis, filming status) | `scenes` table | Push/Pull/Realtime |
| Characters (name, initials, avatar colour) | `characters` table | Push/Pull/Realtime |
| Scene-Character assignments | `scene_characters` junction | Push/Pull (via parent) |
| Looks (name, scenes, estimated time, makeup details, hair details) | `looks` table | Push/Pull/Realtime |
| Look-Scene assignments | `look_scenes` junction | Push/Pull (via parent) |
| Continuity events / Scene captures (flags, SFX, notes, application time) | `continuity_events` table | Push/Pull/Realtime |
| Photos (front/left/right/back/additional) | `photos` table + Supabase Storage bucket | Push/Pull/Realtime |
| Production schedule (cast list, shooting days, raw text) | `schedule_data` table | Push/Pull/Realtime |
| Project metadata (name, type, status, invite code) | `projects` table | Via `supabaseProjects` service |
| Team membership & roles | `project_members` table | Via `supabaseProjects` service |

### NOT synced (local-only per device)

| Data | Storage | Why |
|------|---------|-----|
| Timesheets / rate cards | IndexedDB (`timesheetStore`) | Per-user personal data |
| Budget / receipts | IndexedDB (`budgetStore`) | Per-user personal data |
| Call sheets (parsed PDF) | IndexedDB (`callSheetStore`) | Per-device upload |
| Chat messages | localStorage (`chatStore`) | Per-device AI conversation |
| Billing details | localStorage (`billingStore`) | Per-user personal data |
| Navigation preferences | localStorage (`navigationStore`) | Per-device UI state |
| Theme / dark mode | localStorage (`themeStore`) | Per-device UI state |
| Script content / masterContext | localStorage (desktop only) | Desktop-only feature |
| Look master reference photos | Local only (preserved on merge) | Not mapped to DB |
| Look continuity flags/events | Local only (preserved on merge) | Not mapped to DB (only on SceneCapture) |

---

## Conflict Resolution

### Strategy: **Last-Write-Wins (server-side)**

The sync system uses Supabase `upsert` with `onConflict: 'id'`, which means:

1. If two users edit the same scene simultaneously, **the last upsert wins** at the row level
2. There is **no field-level merge** - the entire row is overwritten
3. There is **no timestamp-based conflict detection** or version vectors

### Pull merge behavior

During `pullProjectData()`:
- Server data **overwrites** local data for all DB-mapped fields
- Local-only fields (e.g., `scriptContent`, `masterReference`) are **preserved** from the existing local record

### Realtime change handling

When a realtime event arrives (INSERT/UPDATE/DELETE):
- The local store is patched directly - existing record is replaced or a new record is added
- For updates to `scenes` and `looks`, the handler fetches related junction data (`scene_characters`, `look_scenes`) before updating local state

### Schedule merge

`mergeScheduleData()` (`syncService.ts:464`): If local schedule already has data (`days.length > 0`), the server data is **ignored**. Only empty/missing local schedules get populated from the server.

---

## Authentication & Authorization

### Auth Flow
- Supabase Auth with email/password (`src/services/supabaseAuth.ts`)
- Session persisted in localStorage under key `checks-happy-auth`
- Auto-refresh tokens enabled
- Auth state listener re-initializes on `SIGNED_IN`, `TOKEN_REFRESHED`, `USER_UPDATED`, `SIGNED_OUT` events

### Row-Level Security (RLS)

All tables have RLS enabled (`002_rls_policies.sql`). Key policies:

| Table | Read | Write | Delete |
|-------|------|-------|--------|
| `scenes`, `characters`, `looks` | Any project member | Any project member | Any project member |
| `scene_characters`, `look_scenes` | Via parent scene/look membership check | Via parent scene/look membership check | Via parent |
| `continuity_events` | Via scene → project membership | Via scene → project membership | Via scene → project membership |
| `photos` | Via continuity_event → scene → project membership | Same | Same |
| `projects` | Project members + any authenticated user (for invite code lookup) | Creator only | Owner only |
| `project_members` | Project members | Self-insert only | Owner or self |
| `timesheets` | Own timesheets + owner sees all | Own only | Own only |

Helper functions: `is_project_member(project_uuid)` and `is_project_owner(project_uuid)` using `auth.uid()`.

### Photo Storage

Photos stored in Supabase Storage bucket `continuity-photos` with path structure:
```
{projectId}/{characterId}/{uuid}.jpg
```

---

## Error Handling & Retry Logic

### Push errors
- Each debounced push is wrapped in try/catch
- On failure: error is logged, `syncStore.setError()` is called with a message like `"Failed to sync scenes"`
- **No automatic retry** on push failure - the error state persists until the next change triggers a new push

### Pull errors
- `pullProjectData()` returns `false` on failure and sets error state
- **No automatic retry** on pull failure

### Network state
- `startSync()` checks `navigator.onLine` before starting
- Registers `offline` event listener → sets status to `'offline'`
- Registers `online` event listener → triggers full re-pull + re-subscribe
- **No exponential backoff or retry queue**

### Realtime reconnection
- Supabase Realtime SDK handles WebSocket reconnection internally
- Channel status callback updates `realtimeConnected` state on `SUBSCRIBED`, `CLOSED`, `CHANNEL_ERROR`
- **No custom reconnection logic** beyond what Supabase provides

---

## Identified Issues & Gaps

### 1. Last-Write-Wins Can Cause Silent Data Loss
**Severity: High**

Two users editing the same scene/character/look simultaneously will result in one user's changes being silently overwritten. There is no merge, no conflict detection, and no notification to the user whose data was lost.

**Recommendation:** Add `updated_at` timestamps to records and implement optimistic concurrency (reject writes if `updated_at` doesn't match). At minimum, show a "conflict detected" notification.

### 2. Junction Table Delete-Then-Reinsert Is Not Atomic
**Severity: High**

`pushScenes()` and `pushLooks()` delete all `scene_characters`/`look_scenes` for the relevant IDs, then re-insert. If User A pushes scenes while User B pushes scenes simultaneously:
- User A deletes scene_characters for scenes [1,2,3] and reinserts
- User B deletes scene_characters for scenes [1,2,3] and reinserts
- Race condition: User A's inserts could be deleted by User B's delete step

**Recommendation:** Use a database transaction or compare-and-swap approach. Alternatively, use individual INSERT/DELETE operations rather than bulk delete-then-reinsert.

### 3. Continuity Events and Photos Have No Server-Side Project Filter
**Severity: Medium**

Realtime subscriptions for `continuity_events` and `photos` subscribe to **all changes** across the entire table (no `project_id` filter). Filtering is done client-side by checking if the `scene_id` belongs to the current project. This means:
- Every client receives change events for every project
- This will not scale as the user base grows

**Recommendation:** Add `project_id` to the `continuity_events` table (or use a Postgres function to derive it) so server-side filtering can be applied.

### 4. No Push Retry / Offline Queue
**Severity: Medium**

If a push fails (network error, Supabase down), the data stays in local state but is never retried. The user sees an error banner but there's no queued retry. Changes made while offline are only pushed if the user makes another edit after coming back online.

**Recommendation:** Implement an outbound queue that persists failed operations to IndexedDB and retries them with exponential backoff when connectivity returns.

### 5. Schedule Merge Favors Local Over Server
**Severity: Medium**

`mergeScheduleData()` at line 464 skips server data if local data exists. If User A uploads a new schedule and User B already has an older schedule locally, User B will never see User A's update until they clear their local data.

**Recommendation:** Use timestamp comparison. If server schedule is newer than local, prefer server data (or prompt the user).

### 6. Several Look Fields Don't Round-Trip Through Sync
**Severity: Medium**

The `Look` type has fields that are preserved locally but never pushed to or pulled from Supabase:
- `masterReference` (reference photos on the look itself)
- `continuityFlags` (flags on the look, separate from SceneCapture flags)
- `continuityEvents` (events on the look, separate from SceneCapture events)
- `sfxDetails` (SFX on the look, separate from SceneCapture SFX)

These are marked with `// Preserve local-only fields` in `dbToLook()`. User B will never see these if User A sets them.

**Recommendation:** Add corresponding columns to the `looks` table or serialize them into existing JSONB fields.

### 7. No Role-Based Write Restrictions in Push Logic
**Severity: Low**

The client-side push functions don't check the user's role before pushing. A `trainee` role user can push scene edits, character changes, etc. just like a `designer`. RLS policies on the server allow any project member to write, so the role field is effectively unused for authorization.

**Recommendation:** If role-based restrictions are desired, implement them in RLS policies (e.g., only `designer`/`hod`/`supervisor` can modify scenes).

### 8. Photos Not Cleaned Up on Delete
**Severity: Low**

When a continuity event is deleted via realtime, the associated photos in Supabase Storage are not cleaned up. The `photos` table rows are cascade-deleted via FK, but the actual files in the `continuity-photos` bucket remain as orphans.

**Recommendation:** Add a Supabase Edge Function or database trigger that deletes Storage objects when `photos` rows are deleted.

### 9. `CLIENT_ID` Echo Filter Is Per-Tab, Not Per-User
**Severity: Low**

The `CLIENT_ID` (line 46) is a `uuidv4()` generated per module load (per browser tab). It's used in presence tracking but **not** used to filter realtime echoes. Echo filtering relies on `pushingTables`, which only works if the push and the realtime echo arrive within the same debounce window. If they don't, the same user's own change could trigger a redundant local state update.

### 10. Timesheet Data Is Not Synced
**Severity: Informational**

Timesheets are stored only in local IndexedDB. The `timesheets` Supabase table exists in the schema but is never written to by the sync service. Each user's timesheet is entirely local to their device.

---

## Data Flow Diagram: Mobile A Edits a Look, Mobile B Receives It

```
Mobile A                          Supabase                         Mobile B
────────                          ────────                         ────────
1. User edits look
   └─ projectStore.setProject()
      └─ Zustand subscribe() fires
         └─ pushLooks(projectId, looks)
            └─ debouncedPush('looks', ...)
               ├─ [800ms debounce]
               ├─ pushingTables.add('looks')
               ├─ supabase.from('looks')
               │  .upsert(dbLooks)  ──────────►  2. Row updated
               ├─ DELETE look_scenes             │  in looks table
               │  WHERE look_id IN (...)         │
               ├─ INSERT look_scenes  ──────────►  3. Junction updated
               └─ pushingTables.delete('looks')
                                                  4. Postgres emits
                                                     change event
                                                     on 'looks' table
                                                           │
                                                           ▼
                                              5. Realtime channel
                                                 delivers payload
                                                 to Mobile B
                                                           │
                                                           ▼
                                                  6. handleLookChange()
                                                     ├─ Check pushingTables
                                                     │  (not pushing → proceed)
                                                     ├─ fetchLookScenes(lookId)
                                                     ├─ dbToLook(payload, scenes, existing)
                                                     └─ projectStore.setProject(updated)
                                                        └─ UI re-renders with new look
```

---

## Summary

The mobile-to-mobile sync is functional and covers the core collaborative data (scenes, characters, looks, continuity, photos, schedules). The architecture is straightforward hub-and-spoke through Supabase with realtime for low-latency updates.

The main risks are around **concurrent edits** (last-write-wins with no conflict notification), **non-atomic junction table updates**, and **missing sync for several Look-level fields**. The system also lacks retry logic for failed pushes and has scalability concerns with unfiltered realtime subscriptions on `continuity_events` and `photos`.
