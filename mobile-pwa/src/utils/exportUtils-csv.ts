/**
 * Export Utilities for Hair & Makeup Pro — CSV / Scene Breakdown rows
 * Owns the shared row-builder used by both CSV and XLSX exports.
 */

import type {
  Project,
  SceneCapture,
  MakeupDetails,
  HairDetails,
  SFXDetails,
  ContinuityFlags,
  ContinuityEvent,
} from '@/types';

// ============================================
// SCENE BREAKDOWN EXPORT (CSV + XLSX)
// ============================================

// Column group definitions for the breakdown export
export const BREAKDOWN_GROUP_HEADERS = [
  { label: 'Scene', span: 4 },
  { label: 'Character', span: 2 },
  { label: 'Makeup', span: 7 },
  { label: 'Hair', span: 5 },
  { label: 'SFX', span: 1 },
  { label: 'Continuity Events', span: 1 },
  { label: 'Notes & Status', span: 3 },
];

export const BREAKDOWN_HEADERS = [
  // Scene (4)
  'Scene #', 'INT/EXT', 'Slugline', 'Time of Day',
  // Character (2)
  'Character', 'Look',
  // Makeup (7)
  'Base', 'Concealer', 'Contour & Highlight', 'Blush', 'Brows', 'Eyes', 'Lips',
  // Hair (5)
  'Style & Parting', 'Products', 'Pieces & Pins', 'Accessories', 'Wig Details',
  // SFX (1)
  'SFX',
  // Continuity Events (1)
  'Continuity Events',
  // Notes & Status (3)
  'Flags', 'Notes', 'Status',
];

/** Combine non-empty values with a separator */
function joinParts(parts: (string | undefined | null)[], sep = ', '): string {
  return parts.filter(Boolean).join(sep);
}

/** Format makeup data into 7 grouped columns */
function formatMakeupGroups(m: MakeupDetails): string[] {
  return [
    // Base: Foundation + Coverage
    joinParts([
      m.foundation && `Foundation: ${m.foundation}`,
      m.coverage && `Coverage: ${m.coverage}`,
    ]),
    // Concealer
    joinParts([
      m.concealer && `${m.concealer}`,
      m.concealerPlacement && `(${m.concealerPlacement})`,
    ], ' '),
    // Contour & Highlight
    joinParts([
      m.contour && `Contour: ${m.contour}`,
      m.contourPlacement && `(${m.contourPlacement})`,
      m.highlight && `Highlight: ${m.highlight}`,
      m.highlightPlacement && `(${m.highlightPlacement})`,
    ], ' | '),
    // Blush
    joinParts([
      m.blush && `${m.blush}`,
      m.blushPlacement && `(${m.blushPlacement})`,
    ], ' '),
    // Brows
    joinParts([
      m.browProduct && `Product: ${m.browProduct}`,
      m.browShape && `Shape: ${m.browShape}`,
    ]),
    // Eyes
    joinParts([
      m.eyePrimer && `Primer: ${m.eyePrimer}`,
      m.lidColour && `Lid: ${m.lidColour}`,
      m.creaseColour && `Crease: ${m.creaseColour}`,
      m.outerV && `Outer V: ${m.outerV}`,
      m.liner && `Liner: ${m.liner}`,
      m.lashes && `Lashes: ${m.lashes}`,
    ]),
    // Lips
    joinParts([
      m.lipLiner && `Liner: ${m.lipLiner}`,
      m.lipColour && `Colour: ${m.lipColour}`,
    ]),
  ];
}

/** Format hair data into 5 grouped columns */
function formatHairGroups(h: HairDetails): string[] {
  return [
    // Style & Parting
    joinParts([h.style, h.parting && `Parting: ${h.parting}`]),
    // Products
    h.products || '',
    // Pieces & Pins
    joinParts([
      h.piecesOut && `Pieces out: ${h.piecesOut}`,
      h.pins && `Pins: ${h.pins}`,
    ]),
    // Accessories
    h.accessories || '',
    // Wig Details (only if wig)
    h.hairType === 'Wig' ? joinParts([
      h.wigNameId && `Name: ${h.wigNameId}`,
      h.wigType && `Type: ${h.wigType}`,
      h.wigCapMethod && `Cap: ${h.wigCapMethod}`,
      h.wigAttachment?.length ? `Attachment: ${h.wigAttachment.join(', ')}` : null,
      h.hairline && `Hairline: ${h.hairline}`,
      h.laceTint && `Lace tint: ${h.laceTint}`,
      h.edgesBabyHairs && `Edges: ${h.edgesBabyHairs}`,
    ], ' | ') : '',
  ];
}

/** Format SFX details into a single combined string */
function formatSFX(sfx: SFXDetails): string {
  if (!sfx.sfxRequired) return '';
  return joinParts([
    sfx.sfxTypes.length ? `Types: ${sfx.sfxTypes.join(', ')}` : null,
    sfx.prostheticPieces && `Prosthetics: ${sfx.prostheticPieces}`,
    sfx.prostheticAdhesive && `Adhesive: ${sfx.prostheticAdhesive}`,
    sfx.bloodTypes?.length ? `Blood: ${sfx.bloodTypes.join(', ')}` : null,
    sfx.bloodProducts && `Blood products: ${sfx.bloodProducts}`,
    sfx.bloodPlacement && `Placement: ${sfx.bloodPlacement}`,
    sfx.tattooCoverage && `Tattoo coverage: ${sfx.tattooCoverage}`,
    sfx.temporaryTattoos && `Temp tattoos: ${sfx.temporaryTattoos}`,
    sfx.contactLenses && `Contacts: ${sfx.contactLenses}`,
    sfx.teeth && `Teeth: ${sfx.teeth}`,
    sfx.agingCharacterNotes && `Aging: ${sfx.agingCharacterNotes}`,
  ], ' | ');
}

/** Format continuity events for a specific scene */
function formatContinuityEvents(events: ContinuityEvent[], sceneNumber: string): string {
  const relevant = events.filter(e =>
    (e.scenes && e.scenes.includes(sceneNumber)) ||
    (!e.scenes && e.sceneRange)
  );
  if (!relevant.length) return '';
  return relevant.map(e => {
    const parts = [e.type, e.name];
    if (e.stage) parts.push(`Stage: ${e.stage}`);
    if (e.description) parts.push(e.description);
    return parts.join(' - ');
  }).join('; ');
}

/** Format continuity flags */
function formatFlags(flags: ContinuityFlags): string {
  const active = Object.entries(flags)
    .filter(([_, v]) => v)
    .map(([k]) => k);
  return active.join(', ');
}

/** Build the breakdown data rows (one row per character per scene) */
export function buildBreakdownRows(
  project: Project,
  sceneCaptures: Record<string, SceneCapture>
): string[][] {
  const rows: string[][] = [];

  const sortedScenes = [...project.scenes].sort(
    (a, b) => a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true })
  );

  for (const scene of sortedScenes) {
    const sceneCharacters = project.characters.filter(c => scene.characters.includes(c.id));

    if (sceneCharacters.length === 0) {
      // Scene with no characters — still include a row
      rows.push([
        scene.sceneNumber, scene.intExt, scene.slugline, scene.timeOfDay,
        '', '', // character, look
        '', '', '', '', '', '', '', // makeup (7)
        '', '', '', '', '', // hair (5)
        '', // sfx
        '', // continuity events
        '', '', scene.isComplete ? 'Complete' : 'Incomplete', // flags, notes, status
      ]);
      continue;
    }

    for (const char of sceneCharacters) {
      const look = project.looks.find(l =>
        l.characterId === char.id && l.scenes.includes(scene.sceneNumber)
      );
      const captureKey = `${scene.id}-${char.id}`;
      const capture = sceneCaptures[captureKey];

      // Makeup (7 columns)
      const makeupCols = look ? formatMakeupGroups(look.makeup) : ['', '', '', '', '', '', ''];

      // Hair (5 columns)
      const hairCols = look ? formatHairGroups(look.hair) : ['', '', '', '', ''];

      // SFX — prefer capture-level, fall back to look-level
      const sfxSource = capture?.sfxDetails || look?.sfxDetails;
      const sfxText = sfxSource ? formatSFX(sfxSource) : '';

      // Continuity events — merge from capture and look
      const allEvents: ContinuityEvent[] = [
        ...(capture?.continuityEvents || []),
        ...(look?.continuityEvents || []),
      ];
      const eventsText = formatContinuityEvents(allEvents, scene.sceneNumber);

      // Flags — prefer capture-level, fall back to look-level
      const flagsText = capture
        ? formatFlags(capture.continuityFlags)
        : (look?.continuityFlags ? formatFlags(look.continuityFlags) : '');

      // Notes
      const notesText = capture?.notes || look?.notes || '';

      rows.push([
        scene.sceneNumber,
        scene.intExt,
        scene.slugline,
        scene.timeOfDay,
        char.name,
        look?.name || '',
        ...makeupCols,
        ...hairCols,
        sfxText,
        eventsText,
        flagsText,
        notesText,
        scene.isComplete ? 'Complete' : 'Incomplete',
      ]);
    }
  }

  return rows;
}

/** Generate the scene breakdown as a CSV string */
export function generateSceneBreakdownCSV(
  project: Project,
  sceneCaptures: Record<string, SceneCapture>
): string {
  const rows = buildBreakdownRows(project, sceneCaptures);

  const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvContent = [
    BREAKDOWN_HEADERS.join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  return csvContent;
}
