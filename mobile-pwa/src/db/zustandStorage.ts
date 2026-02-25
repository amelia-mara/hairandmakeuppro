/**
 * Custom Zustand storage adapter that uses IndexedDB for large data
 * with debounced persistence to prevent excessive writes.
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { saveStoreBackup, getStoreBackup, db } from './index';

// Debounce timers per store
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const pendingWrites: Record<string, unknown> = {};

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 500;

// Stores that should use IndexedDB (large data)
const INDEXEDDB_STORES = new Set([
  'hair-makeup-pro-storage', // projectStore - contains photos, captures
  'hair-makeup-callsheets', // callSheetStore - parsed PDF data
  'hair-makeup-schedule', // scheduleStore - production schedules
  'hair-makeup-timesheet-storage', // timesheetStore - time entries
  'hair-makeup-budget', // budgetStore - receipts & budget data
]);

// Note: Stores not in INDEXEDDB_STORES will automatically use localStorage
// This includes: auth, theme, navigation, chat (small, fast access needed)

/**
 * Debounced write to storage
 * Batches rapid successive writes into a single operation
 */
function debouncedWrite(
  name: string,
  value: unknown,
  writeFunction: (name: string, value: unknown) => Promise<void>
): void {
  // Store the pending value
  pendingWrites[name] = value;

  // Clear existing timer
  if (debounceTimers[name]) {
    clearTimeout(debounceTimers[name]);
  }

  // Set new timer
  debounceTimers[name] = setTimeout(async () => {
    const valueToWrite = pendingWrites[name];
    delete pendingWrites[name];
    delete debounceTimers[name];

    try {
      await writeFunction(name, valueToWrite);
    } catch (error) {
      console.error(`Failed to write store ${name}:`, error);
    }
  }, DEBOUNCE_DELAY);
}

/**
 * Flush all pending writes immediately
 * Useful before page unload or critical operations
 */
export async function flushPendingWrites(): Promise<void> {
  const promises: Promise<void>[] = [];

  for (const [name, value] of Object.entries(pendingWrites)) {
    // Clear the timer
    if (debounceTimers[name]) {
      clearTimeout(debounceTimers[name]);
      delete debounceTimers[name];
    }

    // Write immediately
    if (INDEXEDDB_STORES.has(name)) {
      promises.push(
        saveStoreBackup(name, value).catch((error) =>
          console.error(`Failed to flush store ${name}:`, error)
        )
      );
    } else {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch (error) {
        console.error(`Failed to flush store ${name} to localStorage:`, error);
      }
    }
  }

  // Clear pending writes
  Object.keys(pendingWrites).forEach((key) => delete pendingWrites[key]);

  await Promise.all(promises);
}

/**
 * Create a Zustand storage adapter that uses IndexedDB for large stores
 * and localStorage for small, frequently accessed stores.
 */
export function createHybridStorage<S>(storeName: string): PersistStorage<S> {
  const useIndexedDB = INDEXEDDB_STORES.has(storeName);

  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      if (useIndexedDB) {
        try {
          // Wait for database to be ready
          await db.open();
          const state = await getStoreBackup(name);
          if (state) return state as StorageValue<S>;
          // IndexedDB was empty — check localStorage backup
          const localData = localStorage.getItem(name);
          return localData ? JSON.parse(localData) : null;
        } catch (error) {
          console.error(`Failed to read store ${name} from IndexedDB:`, error);
          // Fall back to localStorage
          const localData = localStorage.getItem(name);
          return localData ? JSON.parse(localData) : null;
        }
      } else {
        const localData = localStorage.getItem(name);
        return localData ? JSON.parse(localData) : null;
      }
    },

    setItem: (name: string, value: StorageValue<S>): void => {
      if (useIndexedDB) {
        // Debounced write to IndexedDB + synchronous localStorage backup
        debouncedWrite(name, value, async (n, v) => {
          // Write localStorage backup first (synchronous, survives tab close)
          try {
            localStorage.setItem(n, JSON.stringify(v));
          } catch {
            // localStorage might be full for large stores — that's OK
          }
          await saveStoreBackup(n, v);
        });
      } else {
        // Debounced write to localStorage
        debouncedWrite(name, value, async (n, v) => {
          localStorage.setItem(n, JSON.stringify(v));
        });
      }
    },

    removeItem: async (name: string): Promise<void> => {
      // Clear any pending writes
      if (debounceTimers[name]) {
        clearTimeout(debounceTimers[name]);
        delete debounceTimers[name];
      }
      delete pendingWrites[name];

      if (useIndexedDB) {
        try {
          await db.storeBackups.delete(name);
        } catch (error) {
          console.error(`Failed to remove store ${name} from IndexedDB:`, error);
        }
      }
      localStorage.removeItem(name);
    },
  };
}

/**
 * Create a storage adapter with custom debounce delay
 */
export function createDebouncedStorage<S>(
  storeName: string,
  debounceMs: number = DEBOUNCE_DELAY
): PersistStorage<S> {
  const storage = createHybridStorage<S>(storeName);

  // Override setItem with custom debounce
  const originalSetItem = storage.setItem;
  const customTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  const customPending: Record<string, StorageValue<S>> = {};

  storage.setItem = (name: string, value: StorageValue<S>): void => {
    customPending[name] = value;

    if (customTimers[name]) {
      clearTimeout(customTimers[name]);
    }

    customTimers[name] = setTimeout(() => {
      const valueToWrite = customPending[name];
      delete customPending[name];
      delete customTimers[name];
      originalSetItem(name, valueToWrite);
    }, debounceMs);
  };

  return storage;
}

/**
 * Migrate data from localStorage to IndexedDB
 * Call this once during app initialization
 */
export async function migrateToIndexedDB(): Promise<{
  migrated: string[];
  errors: string[];
}> {
  const migrated: string[] = [];
  const errors: string[] = [];

  await db.open();

  for (const storeName of INDEXEDDB_STORES) {
    try {
      const localData = localStorage.getItem(storeName);
      if (localData) {
        // Check if already migrated to IndexedDB
        const existingInDb = await getStoreBackup(storeName);
        if (!existingInDb) {
          // Parse and save to IndexedDB
          const parsed = JSON.parse(localData);
          await saveStoreBackup(storeName, parsed);
          migrated.push(storeName);

          // Remove from localStorage after successful migration
          localStorage.removeItem(storeName);
        }
      }
    } catch (error) {
      console.error(`Failed to migrate store ${storeName}:`, error);
      errors.push(storeName);
    }
  }

  return { migrated, errors };
}

/**
 * Get storage usage information
 */
export async function getStorageInfo(): Promise<{
  indexedDBUsage: number;
  localStorageUsage: number;
  photoCount: number;
  photosSize: number;
}> {
  let indexedDBUsage = 0;
  let localStorageUsage = 0;

  // Estimate localStorage usage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        localStorageUsage += key.length + value.length;
      }
    }
  }
  // Convert to bytes (UTF-16 encoding)
  localStorageUsage *= 2;

  // Get IndexedDB usage estimate
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    indexedDBUsage = estimate.usage || 0;
  }

  // Count photos
  const photoCount = await db.photoBlobs.count();
  let photosSize = 0;
  await db.photoBlobs.each((photo) => {
    photosSize += photo.blob.size;
  });

  return {
    indexedDBUsage,
    localStorageUsage,
    photoCount,
    photosSize,
  };
}

// Register beforeunload handler to flush pending writes
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Synchronously flush ALL pending writes to localStorage (including IndexedDB stores)
    // IndexedDB writes are async and won't complete during unload, so localStorage
    // serves as a synchronous safety net for data that hasn't been persisted yet
    for (const [name, value] of Object.entries(pendingWrites)) {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        // Ignore errors during unload (e.g. quota exceeded for large stores)
      }
    }
  });

  // Also flush on visibility change (when app goes to background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingWrites().catch(() => {
        // Ignore errors during visibility change
      });
    }
  });
}
