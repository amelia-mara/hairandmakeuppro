/**
 * State Bridge — connects the legacy vanilla JS `window.state` to React islands.
 *
 * The legacy app exposes a mutable `window.state` object. React components need
 * a reactive way to read from it. This bridge provides:
 *
 * 1. `useLegacyState(selector)` — a React hook that returns selected state and
 *    re-renders when it changes.
 * 2. `notifyStateChange()` — call from legacy JS (or patched functions) to
 *    trigger React re-renders.
 * 3. Auto-patching of key legacy render functions so React stays in sync.
 */

import { useSyncExternalStore, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

/** Shape of the legacy window.state (partial — only fields islands care about) */
export interface LegacyState {
  currentProject: any | null;
  scenes: any[];
  currentScene: number | null;
  characters: Set<string>;
  detectedCharacters: any[];
  confirmedCharacters: Set<string>;
  sceneBreakdowns: Record<number, any>;
  castProfiles: Record<string, any>;
  characterStates: Record<number, Record<string, any>>;
  characterLooks: Record<string, any>;
  continuityEvents: Record<string, any[]>;
  sceneTimeline: Record<number, any>;
  scriptTags: Record<number, any[]>;
  activeCenterTab: string;
  characterTabs: string[];
  activeTab: string;
  aiProvider: string;
  apiKey: string;
  anthropicModel: string;
  isInitialized: boolean;
  autoSaveEnabled: boolean;
}

// ── Subscription system ─────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshotVersion = 0;

/** Subscribe to state changes. Returns unsubscribe function. */
function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Notify all React islands that state has changed. */
export function notifyStateChange(): void {
  snapshotVersion++;
  listeners.forEach((fn) => fn());
}

/** Get current snapshot version (for useSyncExternalStore). */
function getSnapshot(): number {
  return snapshotVersion;
}

// ── React hook ──────────────────────────────────────────────────────────────

/**
 * Hook to read from legacy window.state with automatic re-renders.
 *
 * @example
 * const scenes = useLegacyState(s => s.scenes);
 * const currentScene = useLegacyState(s => s.currentScene);
 */
export function useLegacyState<T>(selector: (state: LegacyState) => T): T {
  // useSyncExternalStore re-renders when getSnapshot() returns a new value
  useSyncExternalStore(subscribe, getSnapshot);

  const state = getLegacyState();
  return selector(state);
}

/**
 * Hook to get the full legacy state object. Use sparingly — prefer selectors.
 */
export function useLegacyStateAll(): LegacyState {
  useSyncExternalStore(subscribe, getSnapshot);
  return getLegacyState();
}

// ── State access ────────────────────────────────────────────────────────────

/** Get the current legacy state object (window.state). */
export function getLegacyState(): LegacyState {
  return (window as any).state || {} as LegacyState;
}

/** Check if the legacy app has been initialized. */
export function isLegacyReady(): boolean {
  return !!(window as any).state?.isInitialized;
}

// ── Legacy function patching ────────────────────────────────────────────────

/**
 * Patch legacy global functions to trigger React re-renders after execution.
 * This is called once during island bootstrap.
 */
export function patchLegacyFunctions(): void {
  const win = window as any;

  // List of global functions that modify state and should trigger re-renders
  const functionsToWrap = [
    'selectScene',
    'navigateToScene',
    'renderSceneList',
    'renderBreakdownPanel',
    'renderCharacterTabs',
    'renderCharacterTabPanels',
    'switchCenterTab',
  ];

  for (const fnName of functionsToWrap) {
    if (typeof win[fnName] === 'function') {
      const original = win[fnName];
      win[fnName] = function (...args: any[]) {
        const result = original.apply(this, args);
        // Notify React after the legacy function runs
        notifyStateChange();
        return result;
      };
    }
  }

  // Also listen for storage events (cross-tab sync)
  window.addEventListener('storage', () => notifyStateChange());

  console.log('[Islands] Legacy functions patched for React bridge');
}

// ── Utility: call legacy functions safely ───────────────────────────────────

/** Safely call a legacy global function by name. */
export function callLegacy(fnName: string, ...args: any[]): any {
  const fn = (window as any)[fnName];
  if (typeof fn === 'function') {
    return fn(...args);
  }
  console.warn(`[Islands] Legacy function "${fnName}" not found on window`);
}

/**
 * Dispatch a custom event that legacy JS can listen for.
 * Allows React islands to communicate back to vanilla JS.
 */
export function dispatchIslandEvent(eventName: string, detail?: any): void {
  window.dispatchEvent(new CustomEvent(`island:${eventName}`, { detail }));
}

/**
 * Listen for custom events from legacy JS.
 * Returns cleanup function.
 */
export function onLegacyEvent(eventName: string, handler: (detail: any) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(`legacy:${eventName}`, listener);
  return () => window.removeEventListener(`legacy:${eventName}`, listener);
}
