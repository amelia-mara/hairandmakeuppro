# Checks Happy — Architecture

Authoritative reference for what Checks Happy is, how the two apps relate, and
the rules that apply to every implementation task. Read this before making
changes that touch data, sync, subscription tiers, or the relationship between
the mobile app and Prep Happy.

This document is the source of truth. If code diverges from it, fix the code —
or update this document and note why in the commit.

Related documents:
- `mobile-pwa/src/docs/DATA_ARCHITECTURE.md` — mobile-app data sources
- `mobile-pwa/src/docs/STORAGE_AUDIT.md` — storage buckets, paths, RLS
- `mobile-pwa/src/docs/AUDIT_REPORT.md` — mobile codebase audit (Feb 2026)
- `supabase/SCHEMA_VERIFICATION_REPORT.md` — live schema verification

---

## 1. What Checks Happy is

Checks Happy is a production management platform for Hair, Makeup, and Costume
departments in the UK film and TV industry. It has two surfaces:

**Mobile app — `mobile-pwa/`**
React 18, Zustand 4, Vite 5, Tailwind 3. Built as a PWA with Capacitor for
iOS/Android. This is the on-set tool. It is feature-complete and in active beta
testing. Users capture continuity, log hours, track scenes, manage budgets, and
run call sheets from their phone on the day of shooting.

**Prep Happy desktop — `prep/`**
React 19, Zustand 5, Vite 7, Tailwind 4. Desktop web app served at `/prep`.
This is the pre-production tool. The UI is substantially built but data is
almost entirely local — it writes to localStorage only, with minimal Supabase
integration. Users set up their project here before a shoot: upload scripts,
run AI breakdown, build lookbooks, plan budgets, manage crew.

Both share one Supabase backend.

---

## 2. Relationship between the two apps

These are **not two separate products**. They are two surfaces of the same
product used at different stages of a production.

### Before the shoot — Prep Happy

The designer uploads the script. AI breaks it down into scenes and characters.
The designer builds lookbooks, assigns looks to characters per scene, sets up
the crew, plans the budget. All preparation work done at a desk.

### During the shoot — Mobile app

The same project appears on the mobile app. The team can see the scenes for
the day, the characters they are responsible for, the looks assigned to each
character. They capture continuity (hair, makeup, wardrobe notes and photos),
log their hours, update scene status, and scan receipts. All on-set work done
under time pressure.

### After each shoot day — back to Prep Happy

The continuity captured on set flows back into Prep. The designer can see what
was actually done versus what was planned. Hours logged by the team appear in
the timesheet for approval. The lookbook updates to show which looks have been
confirmed on set.

### Data flows in both directions

| Direction | Carries |
|-----------|---------|
| Prep → App | scene list, character assignments, look assignments, call times, crew setup |
| App → Prep | continuity entries, scene status updates, look confirmations, hours logged, receipts |

---

## 3. Subscription tier model

There are four tiers. Tier determines what a user can do independently. **It
is never displayed in the product UI** — only visible in account settings.

| Tier | App | Desktop (Prep) | Own Projects | Invite Others |
|------|-----|----------------|--------------|---------------|
| Daily (free) | On joined projects only | No | No | No |
| Artist | Full | No | 1 | No |
| Supervisor | Full | No | Unlimited | Yes |
| Designer | Full | Full | Unlimited | Yes |

### `has_prep_access` is the sync gate

`has_prep_access` is a boolean on the `projects` table, added in migration
`014_prep_sync_prerequisites.sql`. It is set to `true` when a Designer creates
a project. **This single flag drives all sync behaviour — not the user's tier.**

- `has_prep_access = false` → project is app-only. No Prep sync. No Prep
  persistence path applies.
- `has_prep_access = true` → full two-way sync with Prep applies. All sync
  logic must check this flag before sending data to or from Prep.

### Project roles vs tiers

Project roles are separate from tiers. When a user joins a project they select
a production role: Key MUA, Standby Hair, Dresser, etc. This is a **label
only**. It has no effect on permissions. It is the only identity shown
anywhere in the product — tier names never appear in the UI.

**Current schema note:** `project_members.role` today holds an *internal*
permission role (`designer`/`hod`/`supervisor`/`key`/`floor`/`daily`/`trainee`).
A separate `production_role` column for the user-facing label should be added
during tier/role system work (step 6 of the roadmap). See
`supabase/SCHEMA_VERIFICATION_REPORT.md` §`project_members`.

---

## 4. Current state (audit, March 2026)

### Mobile app

- Fully built, in beta testing.
- Uses Zustand 4 with IndexedDB (Dexie) for large data, localStorage for small
  stores.
- Has a manual sync system — `services/manualSync.ts`. User-triggered
  upload/download to Supabase. This is the sanctioned sync path.
- Has a **deprecated auto-sync system** — `services/syncService.ts` (~1,765
  lines), `services/syncSubscriptions.ts`, `components/SyncStatusBanner.tsx`.
  **Do not use, do not import, do not modify.** Dead code kept only until
  removal is safe.
- Supabase is set up and working for auth and data persistence.
- Most data already flows through Supabase correctly for the mobile app.

### Prep Happy

- UI substantially built across all major pages.
- Almost entirely localStorage only — data does not persist across browsers or
  devices.
- Supabase client and auth were recently added and are working.
- Only a handful of files currently reference Supabase: `lib/supabase.ts`,
  `stores/authStore.ts`, `pages/ScriptBreakdown.tsx`, `pages/BetaCodePage.tsx`.
- 12 Zustand stores packed into one file (`stores/breakdownStore.ts`, 1,400+
  lines). **Do not restructure this unless a task explicitly requires it.**
- `pages/ScriptBreakdown.tsx` is a large page. **Do not restructure unless
  explicitly required.**

### Supabase database

- Schema is set up for the mobile app.
- Migrations live in `supabase/migrations/` (repo root) and
  `mobile-pwa/supabase/migrations/` (legacy location).
- Full schema is verified in `supabase/SCHEMA_VERIFICATION_REPORT.md` — treat
  existing tables as correct, do not drop or alter columns without explicit
  instruction.
- RLS policies exist and have full coverage after migration `011`.

### Version difference — critical

| Dep | Mobile | Prep |
|-----|--------|------|
| React | 18 | 19 |
| Zustand | 4 | 5 |
| Tailwind | 3 | 4 |
| Vite | 5 | 7 |

**Code cannot be copied between them without adaptation.** Zustand 4 and 5
have different APIs — store patterns that work in Prep will not work unchanged
in the mobile app and vice versa. Always check which app you are in before
writing store code.

---

## 5. What good sync looks like

The goal is not complex. A designer sets up their project in Prep. Their team
opens the same project in the app and sees everything the designer prepared.
The team works on set. The designer sees what the team captured without asking
for it.

### The four core sync flows

1. **Scene list and status.** Designer creates scenes in Prep via script
   breakdown. App shows scenes to the team. Team updates scene status on set
   (Upcoming, In Progress, Complete). Designer sees live status in Prep.

2. **Continuity.** Designer assigns looks to characters per scene in Prep
   Lookbook. Team captures continuity on set in the app (hair, makeup,
   wardrobe notes, photos). Continuity appears in Prep Master Breakdown
   without the designer having to ask for it.

3. **Look assignments and confirmation.** Designer assigns a look in Prep,
   team sees it in the app. When the team captures continuity confirming a
   look was used, Prep Lookbook updates that scene badge to confirmed.

4. **Hours and timesheet.** Team logs hours in the app daily. On
   Designer-led projects (`has_prep_access = true`) these appear in Prep
   timesheet for the designer to approve. Once approved, the team member sees
   an Approved status in the app and can export their invoice. On non-Designer
   projects, hours are tracked locally for personal reference only with no
   approval step.

---

## 6. How sync should be implemented

The mobile app already has manual sync working. Prep has nothing yet. The
approach is three strictly ordered steps. **Do not attempt multiple steps at
once.** Each step depends on the previous one being stable.

### Step 1 — Prep persistence

Make Prep read from and write to Supabase. Every piece of data a user enters
in Prep should be saved to Supabase immediately, not just to localStorage.
When they log in from any browser they see exactly what they left.

### Step 2 — Shared data

Once both apps are reading from the same Supabase database, sync is largely
already happening — they share the same data. The remaining work is making
changes on one surface appear on the other without requiring a manual
refresh.

### Step 3 — Realtime

Subscribe to relevant table changes scoped to the active project. When the
app writes a continuity entry, Prep receives it via Realtime and updates the
Master Breakdown. When Prep assigns a look, the app receives it via Realtime
and updates the look label on the scene character row.

---

## 7. Implementation rules (apply to every task)

1. **Never modify the mobile app's Supabase schema or RLS policies** unless
   explicitly instructed. The mobile app is in beta with real users. Schema
   changes require migration files.

2. **Never import from or modify the deprecated sync files** in the mobile
   app: `syncService.ts`, `syncSubscriptions.ts`, `SyncStatusBanner.tsx`.
   They are dead code.

3. **Do not restructure `breakdownStore.ts` or `ScriptBreakdown.tsx`** unless
   a task explicitly requires it. They are large but working. Restructuring
   creates risk without adding value to the sync goal.

4. **Respect the version difference.** Zustand 4 patterns (mobile) differ
   from Zustand 5 (Prep). Do not copy store code between apps without
   adapting it. Check which app you are in before writing any store code.

5. **`has_prep_access` is the sync gate.** Every piece of sync logic that
   sends data to or from Prep must check `project.has_prep_access === true`
   before proceeding. Non-Designer projects do not sync with Prep.

6. **800 ms debounce on all Prep writes.** No manual save buttons in Prep.
   Auto-save is the contract. The "✓ Saved" indicator pattern already exists
   in the Timesheet page — extend it to all pages.

7. **Optimistic updates for on-set actions.** Scene status updates and
   continuity capture happen under time pressure on a film set. They must
   feel instant. Update local state first, write to Supabase in the
   background, roll back on failure.

8. **One Realtime channel per project per surface.** Mobile uses
   `app:project:{projectId}`. Prep uses `prep:project:{projectId}`. Never
   create multiple channels for the same project on the same surface.

9. **Tier names never appear in the UI.** Daily, Artist, Supervisor, Designer
   are billing relationships only. Users are identified by their project
   role everywhere in the product.

10. **Read before writing.** Both apps are substantially built. The most
    common mistake is writing code that duplicates or conflicts with
    something that already exists. Always audit the relevant files before
    implementing.

---

## 8. Order of work

The work is strictly sequential. Do not skip ahead — each step must be stable
before the next begins.

1. ~~Beta access gate~~ — done (migration `20260318_beta_access_gate.sql`).
2. ~~Supabase client and auth for Prep~~ — done.
3. ~~Supabase storage and schema verification~~ — done
   (`supabase/SCHEMA_VERIFICATION_REPORT.md`). All critical gaps resolved.
4. **Prep persistence.** Connect all Prep stores to Supabase so data
   survives across sessions and devices.
5. **Sync.** Connect the two apps via shared Supabase data and Realtime
   subscriptions.
6. **Tier and role system.** Implement subscription tiers and project role
   selection (including the `production_role` column on `project_members`).

---

## 9. Repo layout

```
hairandmakeuppro/
├── ARCHITECTURE.md            ← this file
├── api/                       ← Vercel serverless functions (ai, bug-report)
├── mobile-pwa/                ← React 18 / Zustand 4 mobile PWA
│   ├── src/docs/              ← mobile-specific audits and data map
│   └── supabase/migrations/   ← legacy mobile migration location
├── prep/                      ← React 19 / Zustand 5 Prep Happy desktop
│   └── src/
│       ├── lib/supabase.ts
│       ├── stores/            ← 10 store files (breakdownStore is the big one)
│       └── pages/
├── supabase/
│   ├── SCHEMA_VERIFICATION_REPORT.md
│   └── migrations/            ← canonical migrations (014 onwards)
├── index.html                 ← marketing / landing
└── vercel.json
```

---

## 10. When this document changes

Update this document in the same PR as any change that affects:

- The relationship between the two apps
- The list of sync flows
- The subscription tier model or what drives sync
- The implementation rules
- The order of work

Small corrections (typos, file paths, line counts) can be made directly.
Architectural changes must be agreed with the project owner before the
document is updated.
