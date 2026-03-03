/**
 * React Islands — Main Entry Point
 *
 * This is the single entry point for all React islands. It:
 * 1. Waits for the legacy app to initialize
 * 2. Patches legacy functions to trigger React re-renders
 * 3. Mounts React components into designated DOM elements
 *
 * Each island targets a specific <div id="island-*"> in the HTML.
 * Islands are additive — they enhance the existing page without replacing
 * the vanilla JS functionality.
 *
 * Built via: cd desktop && npm run build:islands
 * Output:   /islands-dist/islands.js + islands.css
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { patchLegacyFunctions, notifyStateChange, isLegacyReady } from './bridge';
import BreakdownProgress from './BreakdownProgress';
import SceneNavigator from './SceneNavigator';
import ScriptUpload from './ScriptUpload';

// ── Island registry ─────────────────────────────────────────────────────────

interface IslandConfig {
  /** DOM element ID to mount into */
  mountId: string;
  /** React component to render */
  component: React.ComponentType;
}

const ISLANDS: IslandConfig[] = [
  {
    mountId: 'island-breakdown-progress',
    component: BreakdownProgress,
  },
  {
    mountId: 'island-scene-navigator',
    component: SceneNavigator,
  },
  {
    mountId: 'island-script-upload',
    component: ScriptUpload,
  },
];

// ── Mount logic ─────────────────────────────────────────────────────────────

const mountedRoots: Root[] = [];

function mountIslands(): void {
  for (const island of ISLANDS) {
    const el = document.getElementById(island.mountId);
    if (!el) {
      // Mount point doesn't exist on this page — skip silently
      continue;
    }

    // Don't double-mount
    if (el.dataset.islandMounted === 'true') continue;

    try {
      const Component = island.component;
      const root = createRoot(el);
      root.render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );
      mountedRoots.push(root);
      el.dataset.islandMounted = 'true';
      console.log(`[Islands] Mounted: ${island.mountId}`);
    } catch (err) {
      console.error(`[Islands] Failed to mount ${island.mountId}:`, err);
    }
  }
}

// ── Bootstrap ───────────────────────────────────────────────────────────────

function bootstrap(): void {
  console.log('[Islands] Bootstrapping React islands...');

  // Patch legacy global functions to trigger React bridge notifications
  patchLegacyFunctions();

  // Mount all islands whose mount points exist on this page
  mountIslands();

  // Set up a MutationObserver in case mount points appear later (e.g. after
  // a dynamic render by legacy JS)
  const observer = new MutationObserver(() => {
    mountIslands();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Clean up observer after 30 seconds — mount points should exist by then
  setTimeout(() => observer.disconnect(), 30_000);

  console.log('[Islands] Bootstrap complete');
}

// ── Entry ───────────────────────────────────────────────────────────────────

// Wait for DOM to be ready, then wait for legacy app to initialize
function waitForLegacyAndBoot(): void {
  if (isLegacyReady()) {
    bootstrap();
    return;
  }

  // Poll until window.state.isInitialized becomes true
  let attempts = 0;
  const maxAttempts = 100; // 10 seconds max
  const interval = setInterval(() => {
    attempts++;
    if (isLegacyReady() || attempts >= maxAttempts) {
      clearInterval(interval);
      bootstrap();
    }
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForLegacyAndBoot);
} else {
  // DOM already ready — wait a tick for legacy modules to load
  setTimeout(waitForLegacyAndBoot, 50);
}
