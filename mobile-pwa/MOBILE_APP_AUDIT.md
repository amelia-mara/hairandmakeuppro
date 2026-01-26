# Mobile App Audit Report

**Date:** 2026-01-26
**Audited by:** Claude Code
**App:** Hair & Makeup Pro Mobile PWA

---

## Executive Summary

The Hair & Makeup Pro mobile PWA is a well-structured React TypeScript application using Zustand for state management, Dexie (IndexedDB) for persistence, and Tailwind CSS for styling. The codebase follows modern React patterns and has good separation of concerns.

**Overall Assessment:** The codebase is functional with no critical bugs or infinite loops detected. There are several areas for improvement in efficiency, type safety, and potential edge cases that should be addressed.

---

## 1. BUGS & ERRORS FOUND

### 1.1 Missing Dependency in useEffect (App.tsx:67)
**File:** `src/App.tsx:67`
**Severity:** Medium
**Issue:** The useEffect hook has an empty dependency array but references `hasCompletedOnboarding`, `isAuthenticated`, `currentProject`, `guestProjectCode`, and `setScreen`.
```tsx
useEffect(() => {
  if (hasCompletedOnboarding && !isAuthenticated && !currentProject && !guestProjectCode) {
    setScreen('hub');
  }
}, []); // Missing dependencies
```
**Recommendation:** This appears intentional (run once on mount), but should use `// eslint-disable-next-line react-hooks/exhaustive-deps` comment or properly handle dependencies.

### 1.2 Potential Stale Closure in useEffect (App.tsx:74)
**File:** `src/App.tsx:74`
**Severity:** Low
**Issue:** Using filter inside dependency array creates a new array on every render, causing unnecessary effect runs.
```tsx
useEffect(() => {
  if (currentProject) {
    checkWrapTrigger();
  }
}, [currentProject?.scenes.filter(s => s.isComplete).length]);
```
**Recommendation:** Use a memoized value or move the filter logic inside the effect.

### 1.3 Missing Error Boundary
**File:** `src/App.tsx`
**Severity:** Medium
**Issue:** No error boundary wrapping the app. Uncaught errors will crash the entire app.
**Recommendation:** Add a React Error Boundary component to gracefully handle runtime errors.

### 1.4 Unsafe Non-Null Assertion (projectStore.ts:219)
**File:** `src/stores/projectStore.ts:219`
**Severity:** Low
**Issue:** Non-null assertion used without proper guard:
```tsx
project: s.currentProject!,
```
**Recommendation:** Add explicit null check before the assertion or handle the null case.

### 1.5 Event Listener Cleanup Issue (useCamera.ts:46-50)
**File:** `src/hooks/useCamera.ts:46-50`
**Severity:** Low
**Issue:** The stopCamera function is called in cleanup but isn't included in the dependency array.
```tsx
useEffect(() => {
  return () => {
    stopCamera();
  };
}, []); // stopCamera not in deps
```
**Recommendation:** Use `useCallback` for `stopCamera` and include it in dependencies, or use a ref pattern.

### 1.6 Permission Query Event Listener Not Cleaned (useCamera.ts:221)
**File:** `src/hooks/useCamera.ts:210-230`
**Severity:** Low
**Issue:** Event listener added to permission result is never removed.
```tsx
result.addEventListener('change', () => {
  setPermission(result.state);
});
// No cleanup
```
**Recommendation:** Store the listener reference and remove it in the cleanup function.

---

## 2. POTENTIAL PERFORMANCE ISSUES

### 2.1 Large State Object Persistence
**File:** `src/stores/projectStore.ts:1155-1165`
**Severity:** Medium
**Issue:** The entire project state including all scene captures is persisted to localStorage on every state change. For projects with many photos/scenes, this could cause performance issues.
```tsx
partialize: (state) => ({
  currentProject: state.currentProject,
  sceneCaptures: state.sceneCaptures, // Could be very large
  lifecycle: state.lifecycle,
  savedProjects: state.savedProjects,
  archivedProjects: state.archivedProjects,
}),
```
**Recommendation:**
- Debounce persistence operations
- Consider storing large binary data (photos) in IndexedDB separately
- Use selective persistence for critical data only

### 2.2 Redundant Map Operations (Today.tsx:37-73)
**File:** `src/components/today/Today.tsx:37-73`
**Severity:** Low
**Issue:** Multiple `useMemo` hooks chain operations that could be combined.
**Recommendation:** Consolidate memoized computations where possible.

### 2.3 Inline Object Creation in Props (BottomNav.tsx:15-29)
**File:** `src/components/navigation/BottomNav.tsx:15-29`
**Severity:** Low
**Issue:** Tabs array is recreated on every render inside the component.
```tsx
const tabs = [
  ...bottomNavItems.map(id => { ... }),
  { id: 'more' as NavTab, ... },
];
```
**Recommendation:** Use `useMemo` to memoize the tabs array.

### 2.4 Database Not Used for Primary Storage
**File:** `src/db/index.ts`
**Severity:** Medium (Architectural)
**Issue:** IndexedDB (Dexie) is set up but the app primarily uses localStorage via Zustand persist. This is a missed opportunity for better performance with large data sets.
**Recommendation:** Migrate large data (scene captures, photos) to IndexedDB while keeping navigation state in localStorage.

---

## 3. COMMUNICATION ISSUES BETWEEN COMPONENTS

### 3.1 Dual State Sources for Filming Status
**Files:**
- `src/stores/projectStore.ts` (updateSceneFilmingStatus)
- `src/stores/callSheetStore.ts` (updateSceneFilmingStatus)
- `src/components/today/Today.tsx` (local overrides)

**Severity:** Medium
**Issue:** Filming status is tracked in three places:
1. Project store scenes
2. Call sheet store
3. Local state in Today component

This creates potential synchronization issues.
**Recommendation:** Establish a single source of truth. Use the project store as primary and derive call sheet view from it, or vice versa.

### 3.2 Manual State Sync Pattern
**File:** `src/components/today/Today.tsx:200-231`
**Severity:** Low
**Issue:** Manual synchronization between callSheetStore and projectStore:
```tsx
// Persist to callSheetStore so changes survive navigation
persistSceneFilmingStatus(baseCallSheet.id, sceneNumber, filmingStatus, filmingNotes);
// Sync to project store for Breakdown view
syncFilmingStatus(sceneNumber, filmingStatus, filmingNotes);
```
**Recommendation:** Use a single store action that updates both, or use a middleware/subscription pattern.

---

## 4. EFFICIENCY IMPROVEMENTS

### 4.1 Scene Lookup Optimization
**File:** `src/components/today/Today.tsx:167-169`
```tsx
const getSceneData = (sceneNumber: string) => {
  return currentProject?.scenes.find(s => s.sceneNumber === sceneNumber);
};
```
**Recommendation:** Create a memoized Map for O(1) lookups:
```tsx
const sceneMap = useMemo(() =>
  new Map(currentProject?.scenes.map(s => [s.sceneNumber, s]) || []),
  [currentProject?.scenes]
);
```

### 4.2 Character Lookup in Scene (Today.tsx:172-178)
**Issue:** Nested loops for character lookup on each scene render.
**Recommendation:** Pre-compute character assignments using memoization.

### 4.3 Redundant Re-renders in TodaySceneCard
**File:** `src/components/today/Today.tsx:526+`
**Issue:** TodaySceneCard is a large component that may re-render unnecessarily.
**Recommendation:** Use `React.memo` with a custom comparison function to prevent unnecessary re-renders.

### 4.4 Subscription Store Pattern
**File:** `src/stores/projectStore.ts`
**Recommendation:** Consider using Zustand's `subscribeWithSelector` for more granular subscriptions to avoid re-renders when unrelated state changes.

---

## 5. TYPE SAFETY IMPROVEMENTS

### 5.1 Loose Type in Permission Level Check (types/index.ts:1303-1318)
**File:** `src/types/index.ts:1314`
```tsx
case 'key_plus':
  return roleLevel >= 4; // Key artist and above
case 'supervisor_plus':
  return roleLevel >= 5; // Supervisor and above
```
**Issue:** Magic numbers for role levels could get out of sync with TEAM_MEMBER_ROLES.
**Recommendation:** Use constants derived from TEAM_MEMBER_ROLES.

### 5.2 Type Assertion Without Validation (App.tsx:172)
```tsx
currentTier={user?.tier as SubscriptionTier | undefined}
```
**Recommendation:** Validate or use a type guard instead of direct assertion.

---

## 6. CODE QUALITY OBSERVATIONS

### 6.1 Well-Structured Architecture
- Clean separation between stores, components, services, and utilities
- Consistent naming conventions
- Good TypeScript coverage with comprehensive type definitions

### 6.2 Good Patterns Used
- Zustand for state management with persistence
- Custom hooks for camera functionality
- Factory functions for creating empty objects (createEmptyMakeupDetails, etc.)
- Centralized type definitions

### 6.3 Potential Dead Code
**File:** `src/db/index.ts`
Some database helper functions appear unused in the current implementation since state is persisted via localStorage. Confirm if these are needed or can be removed.

---

## 7. SECURITY CONSIDERATIONS

### 7.1 Local Storage for Sensitive Data
**Severity:** Low
**Issue:** Project data stored in localStorage is accessible to any script on the page.
**Recommendation:** For sensitive production data, consider encryption or moving to IndexedDB with appropriate access controls.

### 7.2 PDF Parsing
**Files:** `src/utils/scriptParser.ts`, `src/utils/scheduleParser.ts`
**Severity:** Low
**Issue:** PDF parsing relies on PDF.js which is generally safe, but ensure the library is kept updated to patch any vulnerabilities.

---

## 8. RECOMMENDATIONS SUMMARY

### High Priority
1. Add Error Boundary to App.tsx
2. Consolidate filming status state to single source of truth
3. Optimize large state persistence (debounce or use IndexedDB)

### Medium Priority
4. Fix useEffect dependency warnings
5. Use memoized Maps for O(1) scene/character lookups
6. Apply React.memo to large list item components
7. Clean up event listeners in useCamera hooks

### Low Priority
8. Consolidate redundant memoization
9. Remove unused database helper functions or integrate them
10. Add type guards instead of type assertions

---

## 9. CONCLUSION

The Hair & Makeup Pro mobile app codebase is well-organized and follows modern React patterns. No critical bugs or infinite loops were detected. The main areas for improvement are:

1. **State synchronization** - Multiple sources of truth for filming status
2. **Performance optimization** - Large state persistence and lookup operations
3. **Minor memory leaks** - Event listener cleanup in camera hooks

The app is production-ready with the above items being improvements rather than blockers. The architecture supports future scaling and the TypeScript types provide good documentation and safety.
