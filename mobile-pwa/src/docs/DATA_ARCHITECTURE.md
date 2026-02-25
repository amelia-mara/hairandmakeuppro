# Data Architecture Reference

Reference map of all data sources in Hair & Makeup Pro. Use this to determine
where the AI chat assistant should query for each type of information.

---

## Supabase (Cloud Database)

Data that syncs between devices and team members.

| Table | Contents | Access | Notes |
|-------|----------|--------|-------|
| `users` | Auth profile, tier, stripe customer ID | `supabase.auth` / `supabase.from('users')` | Created on sign-up |
| `projects` | Name, production type, status, invite code | `supabase.from('projects')` | Core project metadata |
| `project_members` | Team roster, roles, ownership | `supabase.from('project_members')` | Links users to projects |
| `scenes` | Scene number, INT/EXT, location, time of day, synopsis, page count, story day, shooting day, filming status | `supabase.from('scenes')` | Per project |
| `characters` | Name, actor name, initials, avatar colour, base look description | `supabase.from('characters')` | Per project |
| `looks` | Look definitions per character | `supabase.from('looks')` | Per project |
| `scene_characters` | Scene-to-character junction | `supabase.from('scene_characters')` | Many-to-many |
| `look_scenes` | Look-to-scene junction | `supabase.from('look_scenes')` | Many-to-many |
| `continuity_events` | Continuity capture records | `supabase.from('continuity_events')` | Via syncService |
| `photos` | Photo metadata for continuity | `supabase.from('photos')` | Via syncService |
| `schedule_data` | Synced production schedule | `supabase.from('schedule_data')` | Via syncService |

**Service files:**
- `src/services/supabaseAuth.ts` - Authentication operations
- `src/services/supabaseProjects.ts` - Project CRUD, membership, scene/character/look sync
- `src/services/syncService.ts` - Full bidirectional sync engine

---

## IndexedDB (Local - via Dexie + Zustand Hybrid Storage)

Large or frequently-written data persisted locally. Stores registered in
`INDEXEDDB_STORES` in `src/db/zustandStorage.ts` use debounced IndexedDB writes
with localStorage fallback on page unload.

| Store | Storage Key | Contents | Hook | Persisted Fields |
|-------|-------------|----------|------|------------------|
| projectStore | `hair-makeup-pro-storage` | Current project, scenes, characters, scene captures, lifecycle, saved/archived projects | `useProjectStore()` | currentProject, sceneCaptures, lifecycle, savedProjects, archivedProjects, needsSetup |
| scheduleStore | `hair-makeup-schedule` | Parsed production schedule, saved schedules per project | `useScheduleStore()` | schedule, savedSchedules |
| callSheetStore | `hair-makeup-callsheets` | Parsed call sheet data (structured, not raw PDF) | `useCallSheetStore()` | callSheets, activeCallSheetId |
| timesheetStore | `hair-makeup-timesheet-storage` | Rate card, timesheet entries keyed by date | `useTimesheetStore()` | rateCard, entries |
| budgetStore | `hair-makeup-budget` | Budget total, float received, receipts, currency | `useBudgetStore()` | budgetTotal, floatReceived, receipts, currency |

**Dexie direct tables** (in `src/db/index.ts`):

| Table | Contents | Access |
|-------|----------|--------|
| `photoBlobs` | Actual image binary data + thumbnail | `db.photoBlobs` / `savePhotoBlob()` / `getPhotoBlob()` |
| `projects` | Full serialised Project objects | `db.projects` |
| `sceneCaptures` | Capture metadata with photo ID references | `db.sceneCaptures` |
| `storeBackups` | Serialised Zustand store states | `db.storeBackups` (used by hybrid storage) |

---

## localStorage (Small & Fast)

Small data requiring synchronous, instant access. These stores use Zustand
`persist` middleware with `createJSONStorage(() => localStorage)`.

| Store | Storage Key | Contents | Hook |
|-------|-------------|----------|------|
| authStore | `checks-happy-auth-storage` | isAuthenticated, user, currentScreen, hasCompletedOnboarding, hasSelectedPlan, subscription, projectMemberships | `useAuthStore()` |
| billingStore | `checks-happy-billing` | billingDetails (fullName, businessName, address, phone, email, bankDetails, vatSettings, paymentTerms) | `useBillingStore()` |
| chatStore | `hair-makeup-chat-storage` | messages (last 50), isOpen | `useChatStore()` |
| navigationStore | `hair-makeup-navigation` | bottomNavItems | `useNavigationStore()` |
| themeStore | `hair-makeup-theme-storage` | theme, resolvedTheme | `useThemeStore()` |
| productionDetailsStore | `hmk-production-details` | projectDetails (per-project invoicing info) | `useProductionDetailsStore()` |
| Supabase Auth | `checks-happy-auth` | Session token (managed by Supabase SDK) | `supabase.auth` |

---

## localStorage (Legacy Desktop App - Script Breakdown)

The `/js/script-breakdown/` module stores deep script analysis in localStorage.
This is the desktop/web app's Master Context system.

| Key | Contents | Access | Written By |
|-----|----------|--------|------------|
| `masterContext` | Full deep analysis: character profiles (physical, visual, continuity), story structure (timeline, flashbacks), environments, interactions, emotional beats, dialogue references, appearance changes, wardrobe mentions | `localStorage.getItem('masterContext')` / `getMasterContext()` / `window.masterContext` | `analyzeScript()` in `script-analysis.js` via 5-phase pipeline |
| `scriptMasterContext` | Duplicate of masterContext (backup) | `localStorage.getItem('scriptMasterContext')` | `export-script-import.js` |

**Utility functions** (in `js/script-breakdown/master-context-utils.js`):
- `getMasterContext()` - Returns full master context (memory or localStorage)
- `saveMasterContext(context)` - Persists to both `window` and localStorage
- `getCharacterProfile(name)` - Single character's full profile
- `getSceneContext(sceneNumber)` - Scene data with story day, environment, interactions, emotional beats
- `getAllCharacterNames()` - List of all character names
- `getCharacterScriptDescriptions(name)` - Raw script description excerpts
- `getCharacterPhysicalProfile(name)` - Age, gender, hair, build etc.
- `getCharacterVisualProfile(name)` - Vibe, style, grooming, makeup
- `getCharacterContinuityNotes(name)` - Key looks, transformations, signature

**Also available as globals:** `window.getMasterContext`, `window.getCharacterProfile`, `window.getSceneContext`

---

## sessionStorage

| Key | Contents | Written By |
|-----|----------|------------|
| `currentScriptContext` | Copy of masterContext for current session | `narrative-analyzer.js` |

---

## Memory Only (Not Persisted)

| Store | Contents | Notes |
|-------|----------|-------|
| syncStore | Sync status, pending changes count, realtime connection, online members | Resets on reload. `useSyncStore()` |
| projectSettingsStore | Project settings, team members, project stats, shooting days | Computed/refreshed from Supabase. `useProjectSettingsStore()` |

---

## Data Flow Patterns

### Script Import (Desktop)
```
User imports PDF
  -> detectScenes() extracts structure
  -> analyzeScript() runs 5-phase analysis
  -> buildMasterContext() creates deep analysis
  -> Stored: window.masterContext + localStorage('masterContext')
  -> populateInitialData() fills state with cast, scenes, timeline
  -> createTagsFromMasterContext() generates initial tags
```

### Call Sheet Upload (Mobile)
```
PDF uploaded
  -> parseCallSheetPDF() extracts structured data
  -> Stored: callSheetStore (IndexedDB)
  -> Auto-fills timesheet entries via autoFillFromCallSheet()
  -> Scene synopses sync to projectStore
  -> NOT sent to Supabase
```

### Photo Capture (Mobile)
```
Photo taken
  -> base64 URI in memory
  -> Photo blob saved to IndexedDB (db.photoBlobs)
  -> SceneCapture stored with photo ID references
  -> On sync: uploaded to Supabase photos table
```

### Budget Receipt (Mobile)
```
Receipt scanned/entered
  -> AI extraction via receiptAIService (if photo)
  -> Stored: budgetStore (IndexedDB)
  -> NOT sent to Supabase
```

---

## AI Chat Data Access Summary

For the AI chat assistant to provide context-aware responses, it should query:

| Question Type | Primary Source | Fallback |
|---------------|---------------|----------|
| Character appearance/profile | masterContext (localStorage) | projectStore characters |
| Scene details/breakdown | masterContext + projectStore scenes | Supabase scenes |
| Today's schedule | callSheetStore | scheduleStore |
| Budget/spending | budgetStore | - |
| Team/crew | projectSettingsStore | Supabase project_members |
| Timesheet/hours | timesheetStore | - |
| Continuity notes | projectStore sceneCaptures | masterContext continuityNotes |
| Story timeline | masterContext.storyStructure | - |
| Production details | productionDetailsStore | - |
