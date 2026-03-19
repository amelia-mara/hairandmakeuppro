# Codebase Audit Report — Checks Happy (Hair & Makeup Pro)

**Date:** 2026-03-19
**Branch:** `claude/codebase-audit-report-okER9`

---

## 1. Project Overview

**Checks Happy** is a production management tool for hair & makeup departments in the UK film industry. It consists of two front-end applications and a thin API layer, deployed on Vercel with Supabase as the backend.

| Component | Stack | Lines of Code | Files |
|-----------|-------|---------------|-------|
| **mobile-pwa** | React 18, Zustand 4, Vite 5, Tailwind 3 | ~56,800 | ~190 |
| **prep** (desktop) | React 19, Zustand 5, Vite 7, Tailwind 4 | ~20,100 | ~78 |
| **api** | Vercel serverless functions (Node.js) | ~140 | 2 |
| **supabase** | PostgreSQL migrations | ~37 | 1 |
| **Total** | — | **~77,000** | **~270** |

### Deployment

Single Vercel project (`vercel.json`) builds both apps sequentially:
- `/mobile/*` → mobile-pwa (PWA with Capacitor for iOS/Android)
- `/prep/*` → prep desktop app

### Backend

- **Supabase** for auth, database (PostgreSQL), realtime, and storage
- **Vercel serverless** for AI proxy (`/api/ai.js`) and bug reports (`/api/bug-report.js`)
- **Anthropic Claude API** for AI features (chat assistant, character detection, receipt OCR, synopsis generation)

---

## 2. Architecture

### 2.1 App Structure

Both apps follow a similar pattern:
```
src/
  components/    # React UI components
  stores/        # Zustand state management
  services/      # Supabase data access, sync, AI
  utils/         # Parsers, calculators, helpers
  types/         # TypeScript type definitions
  hooks/         # Custom React hooks (mobile only)
  db/            # IndexedDB/Dexie layer (mobile only)
```

### 2.2 State Management

- **Mobile:** Zustand 4 with `persist` middleware → IndexedDB (via Dexie hybrid storage) for large data, localStorage for small stores
- **Prep:** Zustand 5 with `persist` middleware → localStorage

Key stores: `authStore`, `projectStore` (with 6 slices), `scheduleStore`, `callSheetStore`, `timesheetStore`, `budgetStore`, `billingStore`, `navigationStore`, `syncStore`, `chatStore`, `tutorialStore`, `themeStore`, `productionDetailsStore`

### 2.3 Data Flow

```
User Action → Zustand Store → Local State (IndexedDB)
                                    ↓ (manual sync)
                              Supabase (PostgreSQL)
                                    ↓ (other devices)
                              Pull on app open
```

The mobile app uses **manual sync** (`manualSync.ts`) — explicit upload/download triggered by the user. An older auto-sync system (`syncService.ts`) is deprecated but still present.

### 2.4 Key Features

| Feature | Mobile | Prep |
|---------|--------|------|
| Script breakdown (PDF parse) | ✓ | ✓ |
| Scene/character management | ✓ | ✓ |
| Continuity tracking + photos | ✓ | ✓ |
| Schedule (PDF upload + AI) | ✓ | ✓ |
| Call sheets | ✓ | ✓ |
| Timesheets (BECTU rates) | ✓ | ✓ |
| Budget / receipts | ✓ | ✓ |
| AI chat assistant | ✓ | ✗ |
| Team/project settings | ✓ | ✓ |
| Lookbooks | ✓ | ✓ |
| Project lifecycle (wrap/archive) | ✓ | ✗ |
| PWA + Capacitor native | ✓ | ✗ |

---

## 3. Critical Issues

### 3.1 🔴 Zero Test Coverage

**No test files exist in the entire codebase.** No `.test.ts`, `.spec.ts`, or testing libraries in dependencies.

**Risk:** High. Any refactor, dependency update, or feature addition has no safety net. Regression bugs are undetectable until production.

**Recommendation:** Start with integration tests for critical paths:
1. Script parsing (`scriptParser.ts`)
2. BECTU timesheet calculations (`bectuCalculations.ts`)
3. Supabase data mappers in `manualSync.ts`
4. Auth flows in `authStore.ts`

### 3.2 🔴 XSS Vulnerability in Bug Report API

`api/bug-report.js` interpolates user input directly into HTML email body without sanitization:

```javascript
// Line 46-56: User-supplied values injected directly into HTML
<div>...${description}...</div>
<td>${userName} (${userEmail})</td>
<td>${url}</td>
```

An attacker could inject script tags or malicious HTML via the bug report form.

**Recommendation:** Sanitize all user inputs before HTML interpolation (escape `<`, `>`, `&`, `"`, `'`).

### 3.3 🔴 No Input Validation on AI API Proxy

`api/ai.js` forwards the entire `messages` array and optional `system` prompt to the Anthropic API with no validation of content, size, or structure. Any authenticated user (or anyone if no auth check) can:
- Send arbitrarily large payloads
- Inject any system prompt
- Choose any model (including expensive ones)

**Recommendation:** Add request validation (max message count, max token length, allowlisted models, rate limiting).

### 3.4 🔴 Major Framework Version Split

The two apps run fundamentally different dependency versions:

| Dependency | mobile-pwa | prep |
|------------|-----------|------|
| React | 18.2 | **19.2** |
| Zustand | 4.4 | **5.0** |
| Vite | 5.0 | **7.3** |
| Tailwind | 3.3 | **4.2** |
| TypeScript | 5.2 | **5.9** |
| pdfjs-dist | 3.11 | **5.5** |

**Risk:** Code cannot be shared between apps without adaptation. API differences between Zustand 4 and 5 are significant. Duplicated utilities drift apart over time.

---

## 4. High-Priority Issues

### 4.1 🟠 Significant Code Duplication Between Apps

Both apps independently implement:
- `scriptParser.ts` — mobile: 1,508 lines, prep: 1,265 lines
- `bectuCalculations.ts` — different versions in each app
- `timesheetStore.ts` — parallel implementations
- `scheduleParser.ts` — parallel implementations
- Type definitions (`types/index.ts`) — large overlap
- Auth flows and Supabase client setup

**Recommendation:** Extract shared logic into a `packages/shared` workspace package using a monorepo tool (turborepo, nx, or npm workspaces).

### 4.2 🟠 Deprecated Code Still in Codebase

Three files are explicitly marked `DEPRECATED` but remain:
- `mobile-pwa/src/services/syncService.ts` (1,765 lines) — replaced by `manualSync.ts`
- `mobile-pwa/src/services/syncSubscriptions.ts` — replaced
- `mobile-pwa/src/components/sync/SyncStatusBanner.tsx` — replaced by `SyncIcon.tsx` + `SyncSheet.tsx`

**Risk:** ~2,000 lines of dead code that confuses developers, increases bundle size, and could be accidentally imported.

**Recommendation:** Remove deprecated files and verify no runtime imports remain.

### 4.3 🟠 Oversized Components

Several components exceed 1,000 lines, combining UI, business logic, and data fetching:

| File | Lines |
|------|-------|
| `mobile-pwa/src/components/more/More.tsx` | 2,179 |
| `mobile-pwa/src/components/budget/Budget.tsx` | 1,840 |
| `mobile-pwa/src/components/today/Today.tsx` | 1,802 |
| `mobile-pwa/src/components/auth/ProjectHubScreen.tsx` | 1,225 |
| `mobile-pwa/src/components/breakdown/Breakdown.tsx` | 1,094 |
| `mobile-pwa/src/components/home/Home.tsx` | 1,049 |
| `prep/src/pages/ScriptBreakdown.tsx` | 2,842 |

**Recommendation:** Extract sub-components and custom hooks. A component over ~400 lines typically needs splitting.

### 4.4 🟠 Excessive Console Logging

**180 `console.log/error/warn` calls across 30 files.** Notable offenders:
- `autoSave.ts`: 44 console calls
- `supabaseProjects.ts`: 28 console calls
- `ProjectHubScreen.tsx`: 21 console calls
- `authStore.ts`: 17 console calls

**Risk:** Leaks internal state, Supabase queries, and user data to browser console in production.

**Recommendation:** Replace with a logger utility that respects environment (`import.meta.env.DEV`). Strip or silence in production builds.

### 4.5 🟠 Single Supabase Migration

Only one migration exists (`20260318_beta_access_gate.sql`). The full database schema is not version-controlled.

**Risk:** No way to recreate the database from scratch. Schema drift between environments. No review process for schema changes.

**Recommendation:** Export current schema as a baseline migration. All future changes should go through migration files.

---

## 5. Medium-Priority Issues

### 5.1 🟡 `dangerouslySetInnerHTML` in Chat Component

`mobile-pwa/src/components/chat/ChatAssistant.tsx` uses `dangerouslySetInnerHTML` to render AI responses.

**Risk:** If the AI model returns content containing `<script>` tags or event handlers, it could execute in the user's browser.

**Recommendation:** Use a markdown renderer (e.g., `react-markdown`) instead of raw HTML injection, or sanitize with DOMPurify.

### 5.2 🟡 `as any` Type Assertions (12 occurrences)

Found in `autoSave.ts`, `manualSync.ts`, `authStore.ts`, `ProjectHubScreen.tsx`, `BetaCodeScreen.tsx`, and others. The Supabase client itself uses `SupabaseClient<any>`.

**Recommendation:** Generate Supabase types from the database schema (`supabase gen types typescript`) and replace `any` casts.

### 5.3 🟡 No Monorepo Tooling

The project is a multi-app repository without workspace configuration:
- No root `package.json`
- No npm/pnpm workspaces
- Each app installs dependencies independently
- Build orchestration done via shell commands in `vercel.json`

**Recommendation:** Add a root `package.json` with workspaces. Consider turborepo for build caching.

### 5.4 🟡 Prep App Has Minimal Supabase Integration

The prep (desktop) app only references Supabase in 4 files:
- `lib/supabase.ts` (client setup)
- `stores/authStore.ts` (auth only)
- `pages/ScriptBreakdown.tsx` (3 calls)
- `pages/BetaCodePage.tsx` (beta code check)

Most prep stores use only `persist` to localStorage with no server sync. This means:
- Data entered on the prep app stays local to that browser
- No collaboration features work on prep
- Mobile and prep data don't sync

**Recommendation:** Either integrate the same sync services, or clearly document that prep is local-only.

### 5.5 🟡 Missing Error Boundaries

Only one `ErrorBoundary.tsx` exists (mobile). No granular error boundaries around critical sections (photo capture, PDF parsing, Supabase operations).

**Recommendation:** Add error boundaries around route-level components and complex features (script upload, photo capture, sync operations).

### 5.6 🟡 No Rate Limiting on API Endpoints

The `/api/ai.js` and `/api/bug-report.js` endpoints have no rate limiting, authentication checks, or CORS restrictions.

**Recommendation:** Add rate limiting (Vercel Edge Middleware or in-function throttling), validate auth tokens, and restrict CORS origins.

---

## 6. Low-Priority / Maintenance Items

### 6.1 🔵 IndexedDB + localStorage Hybrid Storage

`zustandStorage.ts` implements a custom hybrid storage layer using Dexie (IndexedDB) with debounced writes and localStorage fallback. This is well-engineered but complex (the file has 6 try/catch blocks).

**Note:** This works but should be well-tested — an IndexedDB corruption could lose all local project data.

### 6.2 🔵 Capacitor Dependencies Present but Unused in PWA Mode

`@capacitor/android`, `@capacitor/ios`, `@capacitor/cli`, and `@capacitor/core` are in mobile-pwa dependencies. If native builds aren't being produced, these add unnecessary install weight.

### 6.3 🔵 PDF.js Version Mismatch

mobile-pwa uses `pdfjs-dist@3.11` while prep uses `pdfjs-dist@5.5`. Both have their own `scriptParser.ts`. This could cause different parsing behavior for the same PDF.

### 6.4 🔵 No CI/CD Pipeline Visible

No GitHub Actions, CircleCI, or other CI configuration found. Builds and deploys appear to be Vercel-only with no pre-merge checks.

### 6.5 🔵 No Linting in CI

Both apps have `lint` scripts in package.json, but with no CI pipeline, linting is only run manually.

---

## 7. Security Summary

| Issue | Severity | Status |
|-------|----------|--------|
| XSS in bug-report.js email HTML | 🔴 Critical | Unmitigated |
| No input validation on AI proxy | 🔴 Critical | Unmitigated |
| No rate limiting on API endpoints | 🟠 High | Unmitigated |
| No auth check on API endpoints | 🟠 High | Unmitigated |
| `dangerouslySetInnerHTML` for AI output | 🟡 Medium | Unmitigated |
| 180 console.log calls in production | 🟡 Medium | Unmitigated |
| Supabase client uses `<any>` types | 🟡 Medium | Unmitigated |
| Single RLS policy (public read on app_config) | 🟡 Medium | Partially mitigated (RLS exists) |

---

## 8. Dependency Health

### mobile-pwa
- **React 18.2** — Stable, but React 19 is available
- **Zustand 4.4** — Works, but v5 has better TypeScript support
- **Vite 5.0** — Vite 7 is the latest
- **Tailwind 3.3** — Tailwind 4 is available
- **pdfjs-dist 3.11** — Major version behind

### prep
- **React 19.2** — Latest
- **Zustand 5.0** — Latest
- **Vite 7.3** — Latest
- **Tailwind 4.2** — Latest
- **pdfjs-dist 5.5** — Latest

**Assessment:** The prep app is modern. The mobile app's dependencies are 1-3 major versions behind across the board.

---

## 9. Recommended Action Plan (Priority Order)

### Immediate (Week 1-2)
1. **Fix XSS in `api/bug-report.js`** — Sanitize all user inputs before HTML interpolation
2. **Add input validation to `api/ai.js`** — Allowlist models, cap message size, validate structure
3. **Add rate limiting** to both API endpoints
4. **Remove deprecated sync files** (~2,000 lines of dead code)

### Short-term (Week 3-4)
5. **Export full Supabase schema** as a baseline migration
6. **Generate Supabase TypeScript types** and eliminate `as any` casts
7. **Replace `dangerouslySetInnerHTML`** in ChatAssistant with a markdown renderer
8. **Add a production logger** that strips console output in production

### Medium-term (Month 2)
9. **Add test infrastructure** — Vitest + React Testing Library, start with utility functions
10. **Set up monorepo workspaces** — Extract shared types, utils, and services
11. **Split oversized components** — Target files over 800 lines
12. **Add CI pipeline** — Lint, typecheck, and test on PR

### Long-term (Month 3+)
13. **Align mobile-pwa dependencies** with prep (React 19, Zustand 5, Vite 7, Tailwind 4)
14. **Integrate prep app with Supabase sync** or document it as local-only
15. **Add E2E tests** for critical user flows (project creation, script upload, sync)

---

## 10. Codebase Metrics Summary

| Metric | Value |
|--------|-------|
| Total TypeScript files | 268 |
| Total lines of code | ~77,000 |
| Test files | **0** |
| Test coverage | **0%** |
| Deprecated files still present | 3 (~2,000 lines) |
| `console.*` calls | 180 across 30 files |
| `as any` type assertions | 12 |
| `dangerouslySetInnerHTML` usage | 1 |
| Supabase migrations | 1 |
| API endpoints | 2 |
| Zustand stores | 14 (mobile) + 11 (prep) |
| Largest component | `ScriptBreakdown.tsx` (2,842 lines) |
| Largest store | `authStore.ts` (1,039 lines) |
| Largest service | `syncService.ts` (1,765 lines, deprecated) |

---

*Report generated by automated codebase audit.*
