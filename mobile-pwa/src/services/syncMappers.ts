/**
 * Data mappers between local Zustand state shapes and Supabase row shapes.
 * Used by autoSave.ts for debounced Supabase writes.
 *
 * Extracted from the now-retired manualSync.ts so the autoSave path
 * has no dependency on the old Upload/Download UI plumbing. The
 * function signatures and bodies are unchanged — copy them as-is to
 * keep behaviour identical to the previous build.
 */

import type {
  Scene,
  Character,
  Look,
  SceneCapture,
  ContinuityEvent,
} from '@/types';
import type { Database, Json } from '@/types/supabase';

type DbScene = Database['public']['Tables']['scenes']['Row'];
type DbCharacter = Database['public']['Tables']['characters']['Row'];
type DbLook = Database['public']['Tables']['looks']['Row'];
type DbContinuityEvent = Database['public']['Tables']['continuity_events']['Row'];

export function sceneToDb(scene: Scene, projectId: string): Omit<DbScene, 'created_at'> {
  // Extract raw location from slugline (strip INT/EXT prefix and time-of-day suffix)
  let location = scene.slugline || '';
  const locMatch = location.match(/^(?:INT|EXT)\.\s*(.+?)\s*-\s*(?:DAY|NIGHT|MORNING|EVENING|CONTINUOUS|DAWN|DUSK)$/i);
  if (locMatch) {
    location = locMatch[1].trim();
  }
  return {
    id: scene.id,
    project_id: projectId,
    scene_number: scene.sceneNumber,
    int_ext: scene.intExt || null,
    location: location || null,
    time_of_day: scene.timeOfDay || null,
    synopsis: scene.synopsis || null,
    page_count: null,
    story_day: null,
    shooting_day: scene.shootingDay || null,
    filming_status: scene.filmingStatus || null,
    filming_notes: scene.prepBreakdown
      ? JSON.stringify(scene.prepBreakdown)
      : (scene.filmingNotes || null),
    is_complete: scene.isComplete,
    completed_at: scene.completedAt ? new Date(scene.completedAt).toISOString() : null,
    script_content: scene.scriptContent || null,
  };
}

export function characterToDb(char: Character, projectId: string): Omit<DbCharacter, 'created_at'> {
  return {
    id: char.id,
    project_id: projectId,
    name: char.name,
    actor_name: null,
    initials: char.initials,
    avatar_colour: char.avatarColour || '#6366f1',
    base_look_description: null,
    metadata: null,
  };
}

export function lookToDb(look: Look, projectId: string, masterRefStoragePath?: string | null): Omit<DbLook, 'created_at'> {
  // Embed master reference photo metadata in makeup_details JSON so it
  // survives server round-trips (the looks table has no dedicated column).
  const makeupData: Record<string, unknown> = look.makeup ? { ...(look.makeup as unknown as Record<string, unknown>) } : {};

  if (look.masterReference) {
    makeupData._masterRef = {
      id: look.masterReference.id,
      thumbnail: look.masterReference.thumbnail || '',
      storagePath: masterRefStoragePath ?? (look.masterReference as any)._storagePath ?? null,
      capturedAt: look.masterReference.capturedAt
        ? new Date(look.masterReference.capturedAt).toISOString()
        : null,
      angle: look.masterReference.angle || null,
    };
  } else {
    delete makeupData._masterRef;
  }

  // Embed look-level continuity defaults that have no dedicated DB columns.
  // Strip large base64 URIs from any embedded photos (keep thumbnails only).
  if (look.continuityFlags) {
    makeupData._continuityFlags = look.continuityFlags;
  }
  if (look.continuityEvents && look.continuityEvents.length > 0) {
    makeupData._continuityEvents = look.continuityEvents.map(ev => ({
      ...ev,
      referencePhotos: ev.referencePhotos.map(p => ({
        id: p.id, thumbnail: p.thumbnail || '', angle: p.angle || null,
        capturedAt: p.capturedAt ? new Date(p.capturedAt).toISOString() : null,
      })),
      progression: ev.progression?.map(ps => ({
        ...ps,
        referencePhotos: ps.referencePhotos.map(p => ({
          id: p.id, thumbnail: p.thumbnail || '', angle: p.angle || null,
          capturedAt: p.capturedAt ? new Date(p.capturedAt).toISOString() : null,
        })),
      })),
    }));
  }
  if (look.sfxDetails) {
    makeupData._sfxDetails = {
      ...look.sfxDetails,
      sfxReferencePhotos: look.sfxDetails.sfxReferencePhotos.map(p => ({
        id: p.id, thumbnail: p.thumbnail || '', angle: p.angle || null,
        capturedAt: p.capturedAt ? new Date(p.capturedAt).toISOString() : null,
      })),
    };
  }

  return {
    id: look.id,
    project_id: projectId,
    character_id: look.characterId,
    name: look.name,
    description: look.notes || null,
    estimated_time: look.estimatedTime,
    makeup_details: makeupData as unknown as Json,
    hair_details: look.hair as unknown as Json,
  };
}

/**
 * Normalise the legacy envelope shape of `continuity_events_data` into
 * a flat ContinuityEvent[]. Pre-fix `sceneCaptureToDb` wrote
 * `{ events: capture.continuityEvents }` on every save; the reader cast
 * that envelope as ContinuityEvent[], so the next save wrapped it
 * again. Production rows on Killa Bee + COTC accumulated 4-8 levels of
 * nested `{events: {events: ...}}` from this loop (F-39 / Bug 1).
 *
 * Behaviour examples:
 *
 *   unwrapContinuityEvents([{ id: '1' }, { id: '2' }])
 *     -> [{ id: '1' }, { id: '2' }]                  // already an array
 *
 *   unwrapContinuityEvents({ events: [{ id: '1' }] })
 *     -> [{ id: '1' }]                                // single-level envelope
 *
 *   unwrapContinuityEvents({ events: { events: [{ id: '1' }] } })
 *     -> [{ id: '1' }]                                // 2-level nesting
 *
 *   unwrapContinuityEvents({
 *     events: [{ id: '1' }],
 *     costume_lookbook: { ... },                      // legacy sibling key
 *     floor_tracking:   { ... },                      // legacy sibling key
 *   })
 *     -> [{ id: '1' }]                                // siblings ignored;
 *                                                     // recursion only
 *                                                     // drills the `events`
 *                                                     // branch, so depth is
 *                                                     // bounded by nesting,
 *                                                     // not by sibling count
 *
 *   unwrapContinuityEvents(null) // -> []
 *   unwrapContinuityEvents(undefined) // -> []
 *   unwrapContinuityEvents({ somethingElse: 1 }) // -> []
 *
 * Termination: each recursive call replaces `raw` with the inner
 * `.events` value. It must either (a) be an Array (we return), or
 * (b) be an object that still has an `events` key (we recurse one
 * deeper), or (c) be anything else (we return []). The chain is
 * bounded by JSON nesting depth — Postgres caps JSONB nesting at
 * ~100 levels, so even maximally-pathological production data hits
 * the array or falls through long before stack exhaustion.
 */
export function unwrapContinuityEvents(raw: unknown): ContinuityEvent[] {
  if (Array.isArray(raw)) return raw as ContinuityEvent[];
  if (raw && typeof raw === 'object' && 'events' in raw) {
    return unwrapContinuityEvents((raw as { events: unknown }).events);
  }
  return [];
}

export function sceneCaptureToDb(
  capture: SceneCapture,
  userId: string | null
): Omit<DbContinuityEvent, 'created_at'> {
  return {
    id: capture.id,
    scene_id: capture.sceneId,
    character_id: capture.characterId,
    look_id: capture.lookId || null,
    shooting_day: null,
    status: 'in_progress',
    hair_notes: null,
    makeup_notes: null,
    prosthetics_notes: null,
    wounds_blood_notes: null,
    general_notes: capture.notes || null,
    application_time: capture.applicationTime || null,
    continuity_flags: capture.continuityFlags as unknown as Json,
    // F-39 / Bug 1: write the raw array. The previous code wrapped
    // continuityEvents in { events: ... } alongside dead costume_lookbook
    // and floor_tracking keys (no reader anywhere consumed them — verified
    // by grep), then the reader miscast the envelope as the array, so
    // every save wrapped one level deeper. `unwrapContinuityEvents` above
    // accepts both shapes on read so legacy rows still decode.
    continuity_events_data: (capture.continuityEvents ?? []) as unknown as Json,
    sfx_details: capture.sfxDetails as unknown as Json,
    checked_by: userId,
    checked_at: null,
  };
}
