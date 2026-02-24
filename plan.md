# Real-Time Sync Implementation Plan

## Overview
Wire up Supabase real-time sync so all team members on a project see changes instantly. Personal data (timesheets, billing, budget) stays local only.

## What Syncs (Shared Project Data)
- **Scenes** → `scenes` table + `scene_characters` junction
- **Characters** → `characters` table
- **Looks** → `looks` table + `look_scenes` junction
- **Scene Captures** → `continuity_events` table (flags, notes, SFX, status)
- **Photos** → `photos` table metadata + Supabase Storage blobs
- **Schedule** → `schedule_data` table

## What Stays Local (Personal Data)
- Timesheets / day rate / hours
- Billing & bank details
- Budget & receipts
- UI state, navigation, preferences

## Architecture

### New File: `src/services/syncService.ts`
Central sync service that manages:
1. **Initial pull** – On project load, fetch all data from Supabase and merge into local stores
2. **Push on change** – Debounced (500ms) push of local changes to Supabase after state mutations
3. **Real-time subscriptions** – Supabase Realtime channels listening for INSERT/UPDATE/DELETE on all synced tables, filtered by `project_id`
4. **Photo sync** – Upload photos to Supabase Storage on capture, download on pull
5. **Sync status tracking** – Expose `syncing | synced | error | offline` state

### New File: `src/stores/syncStore.ts`
Small Zustand store to track sync state:
- `status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'`
- `lastSyncedAt: Date | null`
- `pendingChanges: number`
- `error: string | null`

### Integration Points

#### Step 1: Create syncStore (sync status tracking)
- New Zustand store for UI status display
- Replaces hardcoded `'offline'` in Lookbooks etc.

#### Step 2: Create syncService (core engine)
- `startSync(projectId)` – Called when project loads
- `stopSync()` – Called when leaving project
- `pushChanges(table, data)` – Debounced push
- `setupRealtimeSubscriptions(projectId)` – Subscribe to all project tables
- `handleRemoteChange(table, payload)` – Apply incoming changes to local stores

#### Step 3: Wire push triggers into projectStore
- After every mutation that changes scenes/characters/looks/captures, call `syncService.pushChanges()`
- Use Zustand `subscribe()` to detect changes and trigger push
- Compare previous vs current state to determine what changed (dirty tracking)

#### Step 4: Wire push triggers into scheduleStore
- After schedule processing completes, push schedule_data to Supabase

#### Step 5: Initial pull on project load
- In App.tsx `handleProjectReady()` or when restoring a saved project
- Fetch from Supabase, merge with local (server wins for conflicts)
- Also pull when user selects a project from ProjectHubScreen

#### Step 6: Real-time subscriptions
- Subscribe to postgres_changes on: scenes, characters, looks, scene_characters, look_scenes, continuity_events, photos, schedule_data
- Filter by project_id
- On incoming change: update local store, skip if change originated from this client

#### Step 7: Photo sync
- On photo capture: upload blob to Supabase Storage, save path in photos table
- On pull: download photos from Storage, cache in IndexedDB
- Use signed URLs for display

#### Step 8: Update sync status UI
- Replace placeholder `SyncBanner` in Lookbooks with real status from syncStore
- Add subtle sync indicator to ProjectHeader (small dot or icon)

## Implementation Order
1. `syncStore.ts` – Status tracking (small, foundational)
2. `syncService.ts` – Core push/pull/realtime engine
3. Wire into `projectStore` – Push on mutations
4. Wire into `scheduleStore` – Push schedule data
5. Initial pull on project load – Fetch + merge
6. Real-time subscriptions – Live updates
7. Photo sync – Storage upload/download
8. UI updates – Replace placeholder banners

## Data Mapping (Local → Supabase)

### Scene (local) → scenes (DB)
| Local | DB Column |
|-------|-----------|
| id | id |
| sceneNumber | scene_number |
| intExt | int_ext |
| slugline | location |
| timeOfDay | time_of_day |
| synopsis | synopsis |
| pageCount | page_count |
| storyDay | story_day |
| shootingDay | shooting_day |
| filmingStatus | filming_status |
| filmingNotes | filming_notes |
| isComplete | is_complete |
| completedAt | completed_at |
| characters[] | → scene_characters junction |

### Character (local) → characters (DB)
| Local | DB Column |
|-------|-----------|
| id | id |
| name | name |
| actorName | actor_name |
| initials | initials |
| avatarColour | avatar_colour |

### Look (local) → looks (DB)
| Local | DB Column |
|-------|-----------|
| id | id |
| characterId | character_id |
| name | name |
| description | description |
| estimatedTime | estimated_time |
| makeup | makeup_details (JSON) |
| hair | hair_details (JSON) |
| scenes[] | → look_scenes junction |

### SceneCapture (local) → continuity_events (DB)
| Local | DB Column |
|-------|-----------|
| id | id |
| sceneId | scene_id |
| characterId | character_id |
| lookId | look_id |
| notes | general_notes |
| applicationTime | application_time |
| continuityFlags | continuity_flags (JSON) |
| continuityEvents | continuity_events_data (JSON) |
| sfxDetails | sfx_details (JSON) |
| photos | → photos table + Storage |

## Conflict Resolution
- **Last-write-wins** with server timestamp
- Changes from this client get a `_clientId` tag so we can skip our own real-time echoes
- If offline, queue changes and push when reconnected
