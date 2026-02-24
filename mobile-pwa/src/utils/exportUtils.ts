/**
 * Export Utilities for Hair & Makeup Pro
 * Generates PDFs, CSVs, and ZIP archives for project export
 */

import type {
  Project,
  Scene,
  Character,
  Look,
  SceneCapture,
  MakeupDetails,
  HairDetails,
  SFXDetails,
  ContinuityFlags,
} from '@/types';

// ============================================
// CONTINUITY BIBLE PDF GENERATOR
// ============================================

export function generateContinuityBiblePDF(
  project: Project,
  sceneCaptures: Record<string, SceneCapture>,
  options?: {
    preparedBy?: string;
    firstShootDate?: Date;
    lastShootDate?: Date;
  }
): string {
  const preparedBy = options?.preparedBy || 'Hair & Makeup Department';
  const firstShoot = options?.firstShootDate || new Date();
  const lastShoot = options?.lastShootDate || new Date();

  // Generate character sections
  const characterSections = project.characters.map(character => {
    const characterLooks = project.looks.filter(l => l.characterId === character.id);
    return generateCharacterSection(character, characterLooks, project.scenes, sceneCaptures);
  }).join('');

  // Generate scene sections
  const sortedScenes = project.scenes
    .sort((a, b) => a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }));

  const sceneSections = sortedScenes
    .map(scene => generateSceneSection(scene, project.characters, project.looks, sceneCaptures))
    .join('');

  // Generate table of contents - ALL characters
  const characterTOC = project.characters
    .map((c) => `<li><a href="#character-${c.id}">${c.name}</a></li>`)
    .join('');

  // Generate table of contents - ALL scenes
  const sceneTOC = sortedScenes
    .map(s => `<li><a href="#scene-${s.id}">Sc ${s.sceneNumber} – ${s.slugline || 'Untitled'}</a></li>`)
    .join('');

  const totalLooks = project.looks.length;
  const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${project.name} - Continuity Bible</title>
      <style>
        @media print {
          .page-break { page-break-before: always; }
          .no-break { page-break-inside: avoid; }
          .no-print { display: none; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 0;
          max-width: 900px;
          margin: 0 auto;
          color: #2c2c2c;
          line-height: 1.5;
          font-size: 13px;
        }

        /* ── Cover Page ── */
        .cover-page {
          text-align: center;
          min-height: 95vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 60px 40px;
        }
        .cover-rule { width: 80px; height: 3px; background: #C9A962; margin: 0 auto 40px; }
        .cover-title { font-size: 38px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px; margin-bottom: 6px; }
        .cover-subtitle { font-size: 18px; font-weight: 400; color: #C9A962; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 50px; }
        .cover-stats { display: flex; gap: 40px; justify-content: center; margin-bottom: 50px; }
        .cover-stat { text-align: center; }
        .cover-stat-value { font-size: 28px; font-weight: 700; color: #C9A962; display: block; }
        .cover-stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
        .cover-meta { font-size: 12px; color: #999; line-height: 1.8; }
        .cover-meta strong { color: #666; }

        /* ── Section Headings ── */
        .section-heading {
          font-size: 22px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 6px 0;
          padding: 30px 40px 0;
        }
        .section-heading-rule { width: 50px; height: 3px; background: #C9A962; margin: 0 0 30px 40px; }

        /* ── Table of Contents ── */
        .toc { padding: 30px 40px; }
        .toc h2 { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
        .toc-rule { width: 50px; height: 3px; background: #C9A962; margin-bottom: 30px; }
        .toc h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #C9A962; margin-bottom: 10px; }
        .toc ul { list-style: none; padding: 0; margin: 0 0 24px 0; }
        .toc li { padding: 3px 0; font-size: 12px; border-bottom: 1px dotted #e5e5e5; }
        .toc li:last-child { border-bottom: none; }
        .toc a { color: #444; text-decoration: none; }
        .toc a:hover { color: #C9A962; }
        .toc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .toc-scenes-list { columns: 2; column-gap: 24px; }
        .toc-scenes-list li { break-inside: avoid; }

        /* ── Character Section ── */
        .character-section { padding: 0 40px; margin-bottom: 20px; page-break-inside: avoid; }
        .character-header {
          background: linear-gradient(135deg, #C9A962, #B8975A);
          color: white;
          padding: 16px 20px;
          border-radius: 8px 8px 0 0;
        }
        .character-name { font-size: 20px; font-weight: 700; margin: 0; }
        .character-look-count { font-size: 12px; opacity: 0.85; margin-top: 2px; }

        /* ── Look Card ── */
        .look-section {
          border: 1px solid #e0e0e0;
          border-top: none;
          padding: 20px;
          margin-bottom: 0;
          page-break-inside: avoid;
        }
        .look-section:last-child { border-radius: 0 0 8px 8px; }
        .look-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f0f0f0;
        }
        .look-name { font-size: 16px; font-weight: 600; color: #1a1a1a; }
        .look-scenes { font-size: 11px; color: #777; margin-top: 2px; }
        .look-time {
          font-size: 11px;
          color: #C9A962;
          font-weight: 500;
          white-space: nowrap;
        }

        /* ── Photo Grid ── */
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin: 0 0 16px;
          page-break-inside: avoid;
        }
        .photo-placeholder {
          aspect-ratio: 3/4;
          background: #fafafa;
          border: 1px dashed #d5d5d5;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #bbb;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .photo-img {
          width: 100%;
          aspect-ratio: 3/4;
          object-fit: cover;
          border-radius: 4px;
        }
        .master-photo {
          grid-column: span 2;
          grid-row: span 2;
        }
        .master-photo .photo-img,
        .master-photo .photo-placeholder {
          aspect-ratio: auto;
          height: 100%;
        }

        /* ── Details Tables ── */
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 16px;
        }
        .details-section h4 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #C9A962;
          font-weight: 600;
          margin: 0 0 8px 0;
          padding-bottom: 6px;
          border-bottom: 1px solid #f0f0f0;
        }
        .details-table { width: 100%; font-size: 12px; border-collapse: collapse; }
        .details-table td { padding: 3px 0; vertical-align: top; }
        .details-table td:first-child { color: #888; width: 42%; }
        .details-table td:last-child { color: #2c2c2c; font-weight: 500; }

        /* ── Notes ── */
        .notes-section {
          margin-top: 14px;
          padding: 10px 14px;
          background: #f8f8f8;
          border-radius: 6px;
          border-left: 3px solid #C9A962;
        }
        .notes-section h4 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #888;
          margin: 0 0 6px 0;
        }
        .notes-section p { font-size: 12px; color: #555; margin: 0; }

        /* ── Scene Section ── */
        .scene-section {
          margin: 0 40px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .scene-header {
          background: #f7f7f7;
          padding: 12px 16px;
          border-bottom: 1px solid #e0e0e0;
        }
        .scene-number {
          font-size: 11px;
          color: #C9A962;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .scene-slugline { font-size: 15px; font-weight: 600; color: #1a1a1a; margin: 4px 0 0; }
        .scene-synopsis { font-size: 12px; color: #777; margin-top: 4px; }
        .scene-content { padding: 14px 16px; }
        .scene-content h4 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #999;
          margin: 0 0 10px;
        }
        .scene-characters { display: flex; flex-wrap: wrap; gap: 8px; }
        .scene-character-card {
          flex: 1;
          min-width: 180px;
          padding: 10px 12px;
          background: #fafafa;
          border: 1px solid #eee;
          border-radius: 6px;
        }
        .scene-character-name { font-weight: 600; font-size: 13px; color: #1a1a1a; }
        .scene-character-look { font-size: 11px; color: #777; margin-top: 2px; }

        /* ── Continuity Flags ── */
        .flags-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .flag-badge {
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .flag-sweat { background: #e3f2fd; color: #1565c0; }
        .flag-dishevelled { background: #fff3e0; color: #ef6c00; }
        .flag-blood { background: #ffebee; color: #c62828; }
        .flag-dirt { background: #efebe9; color: #5d4037; }
        .flag-wetHair { background: #e0f7fa; color: #00838f; }
        .flag-tears { background: #e8eaf6; color: #3949ab; }

        /* ── SFX ── */
        .sfx-section {
          margin-top: 14px;
          padding: 10px 14px;
          background: #fffbf0;
          border: 1px solid #f0e0b0;
          border-radius: 6px;
        }
        .sfx-section h4 {
          color: #d48806;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 6px 0;
        }
      </style>
    </head>
    <body>
      <!-- Cover Page -->
      <div class="cover-page">
        <div class="cover-rule"></div>
        <h1 class="cover-title">${project.name}</h1>
        <h2 class="cover-subtitle">Continuity Bible</h2>
        <div class="cover-stats">
          <div class="cover-stat">
            <span class="cover-stat-value">${project.scenes.length}</span>
            <span class="cover-stat-label">Scenes</span>
          </div>
          <div class="cover-stat">
            <span class="cover-stat-value">${project.characters.length}</span>
            <span class="cover-stat-label">Characters</span>
          </div>
          <div class="cover-stat">
            <span class="cover-stat-value">${totalLooks}</span>
            <span class="cover-stat-label">Looks</span>
          </div>
        </div>
        <div class="cover-meta">
          <p><strong>Prepared by:</strong> ${preparedBy}</p>
          <p><strong>Production Dates:</strong> ${formatDate(firstShoot)} – ${formatDate(lastShoot)}</p>
          <p><strong>Exported:</strong> ${exportDate}</p>
        </div>
      </div>

      <div class="page-break"></div>

      <!-- Table of Contents -->
      <div class="toc">
        <h2>Contents</h2>
        <div class="toc-rule"></div>
        <div class="toc-grid">
          <div>
            <h3>Characters (${project.characters.length})</h3>
            <ul>${characterTOC}</ul>
          </div>
          <div>
            <h3>Scenes (${sortedScenes.length})</h3>
            <ul class="toc-scenes-list">${sceneTOC}</ul>
          </div>
        </div>
      </div>

      <div class="page-break"></div>

      <!-- Character Sections -->
      <div class="section-heading">Character Reference</div>
      <div class="section-heading-rule"></div>
      ${characterSections}

      <div class="page-break"></div>

      <!-- Scene Sections -->
      <div class="section-heading">Scene Index</div>
      <div class="section-heading-rule"></div>
      ${sceneSections}
    </body>
    </html>
  `;
}

function generateCharacterSection(
  character: Character,
  looks: Look[],
  scenes: Scene[],
  sceneCaptures: Record<string, SceneCapture>
): string {
  const lookSections = looks.map(look => {
    const lookScenes = scenes
      .filter(s => look.scenes.includes(s.sceneNumber))
      .map(s => s.sceneNumber)
      .join(', ');

    // Get photos from scene captures
    const captureKey = Object.keys(sceneCaptures).find(
      key => key.includes(character.id) && sceneCaptures[key].lookId === look.id
    );
    const capture = captureKey ? sceneCaptures[captureKey] : null;

    return `
      <div class="look-section">
        <div class="look-header">
          <div>
            <div class="look-name">${look.name}</div>
            <div class="look-scenes">Scenes: ${lookScenes || 'None assigned'}</div>
          </div>
          <div class="look-time">Application Time: ~${look.estimatedTime} min</div>
        </div>

        <!-- Photos Grid -->
        <div class="photo-grid">
          <div class="master-photo">
            ${look.masterReference
              ? `<img class="photo-img" src="${look.masterReference.uri}" alt="Master Reference" />`
              : '<div class="photo-placeholder">Master Reference<br/>No Photo</div>'
            }
          </div>
          ${['front', 'left', 'right', 'back'].map(angle => {
            const photo = capture?.photos[angle as keyof typeof capture.photos];
            return photo
              ? `<img class="photo-img" src="${photo.uri}" alt="${angle}" />`
              : `<div class="photo-placeholder">${angle.charAt(0).toUpperCase() + angle.slice(1)}</div>`;
          }).join('')}
        </div>

        <!-- Details -->
        <div class="details-grid">
          <div class="details-section">
            <h4>Makeup</h4>
            <table class="details-table">
              ${formatMakeupDetails(look.makeup)}
            </table>
          </div>
          <div class="details-section">
            <h4>Hair</h4>
            <table class="details-table">
              ${formatHairDetails(look.hair)}
            </table>
          </div>
        </div>

        ${capture?.sfxDetails?.sfxRequired ? `
          <div class="sfx-section">
            <h4>Special Effects</h4>
            <table class="details-table">
              ${formatSFXDetails(capture.sfxDetails)}
            </table>
          </div>
        ` : ''}

        ${capture?.notes ? `
          <div class="notes-section">
            <h4>Notes</h4>
            <p>${capture.notes}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="character-section" id="character-${character.id}">
      <div class="character-header">
        <h3 class="character-name">${character.name}</h3>
        <div class="character-look-count">${looks.length} Look${looks.length !== 1 ? 's' : ''}</div>
      </div>
      ${lookSections}
    </div>
  `;
}

function generateSceneSection(
  scene: Scene,
  characters: Character[],
  looks: Look[],
  sceneCaptures: Record<string, SceneCapture>
): string {
  const sceneCharacters = characters.filter(c => scene.characters.includes(c.id));

  const characterCards = sceneCharacters.map(char => {
    const look = looks.find(l => l.characterId === char.id && l.scenes.includes(scene.sceneNumber));
    const captureKey = `${scene.id}-${char.id}`;
    const capture = sceneCaptures[captureKey];

    const flags = capture ? formatContinuityFlags(capture.continuityFlags) : '';

    return `
      <div class="scene-character-card">
        <div class="scene-character-name">${char.name}</div>
        <div class="scene-character-look">${look?.name || 'No Look Assigned'}</div>
        ${flags ? `<div class="flags-list">${flags}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="scene-section" id="scene-${scene.id}">
      <div class="scene-header">
        <div class="scene-number">SCENE ${scene.sceneNumber}</div>
        <div class="scene-slugline">${scene.intExt}. ${scene.slugline} - ${scene.timeOfDay}</div>
        ${scene.synopsis ? `<div class="scene-synopsis">${scene.synopsis}</div>` : ''}
      </div>
      <div class="scene-content">
        <h4 style="font-size: 12px; color: #666; margin: 0 0 10px;">Characters in Scene:</h4>
        <div class="scene-characters">
          ${characterCards || '<p style="color: #999; font-size: 13px;">No characters assigned</p>'}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// SCENE BREAKDOWN CSV GENERATOR
// ============================================

export function generateSceneBreakdownCSV(
  project: Project,
  sceneCaptures: Record<string, SceneCapture>
): string {
  const headers = [
    'Scene',
    'INT/EXT',
    'Location',
    'Time',
    'Characters',
    'Looks',
    'Makeup Summary',
    'Hair Summary',
    'SFX',
    'Flags',
    'Notes',
    'Status',
  ];

  const rows = project.scenes
    .sort((a, b) => a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }))
    .map(scene => {
      const sceneCharacters = project.characters.filter(c => scene.characters.includes(c.id));
      const characterNames = sceneCharacters.map(c => c.name).join('; ');

      const lookNames = sceneCharacters.map(char => {
        const look = project.looks.find(l =>
          l.characterId === char.id && l.scenes.includes(scene.sceneNumber)
        );
        return look ? `${char.name}: ${look.name}` : null;
      }).filter(Boolean).join('; ');

      // Aggregate makeup/hair/sfx info
      let makeupSummary: string[] = [];
      let hairSummary: string[] = [];
      let sfxSummary: string[] = [];
      let flags: string[] = [];
      let notes: string[] = [];

      sceneCharacters.forEach(char => {
        const captureKey = `${scene.id}-${char.id}`;
        const capture = sceneCaptures[captureKey];
        const look = project.looks.find(l =>
          l.characterId === char.id && l.scenes.includes(scene.sceneNumber)
        );

        if (look) {
          if (look.makeup.foundation) makeupSummary.push(look.makeup.foundation);
          if (look.makeup.lipColour) makeupSummary.push(look.makeup.lipColour);
          if (look.hair.style) hairSummary.push(look.hair.style);
        }

        if (capture) {
          if (capture.sfxDetails.sfxRequired) {
            sfxSummary.push(capture.sfxDetails.sfxTypes.join(', '));
          }
          const activeFlags = Object.entries(capture.continuityFlags)
            .filter(([_, v]) => v)
            .map(([k]) => k);
          flags.push(...activeFlags);
          if (capture.notes) notes.push(capture.notes);
        }
      });

      return [
        scene.sceneNumber.toString(),
        scene.intExt,
        scene.slugline,
        scene.timeOfDay,
        characterNames,
        lookNames,
        [...new Set(makeupSummary)].join(', '),
        [...new Set(hairSummary)].join(', '),
        [...new Set(sfxSummary)].join(', ') || 'None',
        [...new Set(flags)].join(', ') || '-',
        notes.join(' | '),
        scene.isComplete ? 'Complete' : 'Incomplete',
      ];
    });

  // Escape CSV values
  const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  return csvContent;
}

// ============================================
// CHARACTER LOOKBOOKS GENERATOR
// ============================================

export function generateCharacterLookbookPDF(
  character: Character,
  looks: Look[],
  scenes: Scene[],
  sceneCaptures: Record<string, SceneCapture>
): string {
  const lookPages = looks.map(look => {
    const lookScenes = scenes
      .filter(s => look.scenes.includes(s.sceneNumber))
      .map(s => `Scene ${s.sceneNumber}`)
      .join(', ');

    // Find any capture with this look for photos
    const captureKey = Object.keys(sceneCaptures).find(
      key => key.includes(character.id) && sceneCaptures[key].lookId === look.id
    );
    const capture = captureKey ? sceneCaptures[captureKey] : null;

    return `
      <div class="look-page">
        <div class="look-header">
          <h2>${look.name}</h2>
          <p class="scenes-list">${lookScenes || 'No scenes assigned'}</p>
          <p class="app-time">Estimated Application: ${look.estimatedTime} minutes</p>
        </div>

        <div class="photo-section">
          ${look.masterReference
            ? `<img class="master-photo" src="${look.masterReference.uri}" alt="Master Reference" />`
            : '<div class="photo-placeholder master">No Master Reference</div>'
          }
          <div class="angle-photos">
            ${['front', 'left', 'right', 'back'].map(angle => {
              const photo = capture?.photos[angle as keyof typeof capture.photos];
              return photo
                ? `<img src="${photo.uri}" alt="${angle}" />`
                : `<div class="photo-placeholder">${angle}</div>`;
            }).join('')}
          </div>
        </div>

        <div class="details-section">
          <div class="makeup-details">
            <h3>Makeup</h3>
            ${formatMakeupDetailsHTML(look.makeup)}
          </div>
          <div class="hair-details">
            <h3>Hair</h3>
            ${formatHairDetailsHTML(look.hair)}
          </div>
        </div>

        ${capture?.notes ? `
          <div class="notes-section">
            <h3>Notes</h3>
            <p>${capture.notes}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('<div class="page-break"></div>');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${character.name} - Lookbook</title>
      <style>
        @media print { .page-break { page-break-before: always; } }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        .character-cover { text-align: center; padding: 100px 20px; }
        .character-name { font-size: 48px; color: #C9A962; margin-bottom: 10px; }
        .character-subtitle { font-size: 18px; color: #666; }
        .look-page { margin-bottom: 40px; }
        .look-header { margin-bottom: 20px; }
        .look-header h2 { color: #C9A962; margin: 0 0 5px; }
        .scenes-list { color: #666; font-size: 14px; margin: 0; }
        .app-time { color: #999; font-size: 12px; margin: 5px 0 0; }
        .photo-section { display: flex; gap: 20px; margin-bottom: 20px; }
        .master-photo { width: 250px; height: auto; border-radius: 8px; }
        .angle-photos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; }
        .angle-photos img { width: 100%; border-radius: 4px; }
        .photo-placeholder { background: #f5f5f5; border: 1px dashed #ccc; border-radius: 4px; padding: 40px; text-align: center; color: #999; }
        .photo-placeholder.master { width: 250px; min-height: 300px; display: flex; align-items: center; justify-content: center; }
        .details-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .details-section h3 { font-size: 14px; color: #C9A962; border-bottom: 1px solid #eee; padding-bottom: 5px; margin: 0 0 10px; }
        .detail-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #f5f5f5; }
        .detail-label { color: #666; }
        .detail-value { color: #333; font-weight: 500; }
        .notes-section { margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
        .notes-section h3 { font-size: 12px; color: #666; margin: 0 0 8px; }
      </style>
    </head>
    <body>
      <div class="character-cover">
        <h1 class="character-name">${character.name}</h1>
        <p class="character-subtitle">Hair & Makeup Lookbook</p>
        <p style="color: #999; margin-top: 20px;">${looks.length} Look${looks.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="page-break"></div>
      ${lookPages}
    </body>
    </html>
  `;
}

// ============================================
// TIMESHEET EXPORT GENERATOR
// ============================================

export function generateTimesheetsPDF(
  projectName: string,
  entries: Array<{
    date: string;
    dayType: string;
    preCall: string;
    unitCall: string;
    outOfChair: string;
    wrapOut: string;
    totalHours: number;
    otHours: number;
    notes: string;
  }>,
  rateCard: {
    dailyRate: number;
    baseDayHours: number;
    kitRental: number;
  }
): string {
  // Calculate totals
  const totalDays = entries.length;
  const totalBaseHours = entries.reduce((sum, e) => sum + Math.min(e.totalHours, rateCard.baseDayHours), 0);
  const totalOTHours = entries.reduce((sum, e) => sum + e.otHours, 0);

  const rows = entries.map(entry => `
    <tr>
      <td>${formatDateShort(entry.date)}</td>
      <td>${entry.dayType}</td>
      <td>${entry.preCall || '-'}</td>
      <td>${entry.unitCall || '-'}</td>
      <td>${entry.wrapOut || '-'}</td>
      <td>${entry.totalHours.toFixed(1)}</td>
      <td>${entry.otHours > 0 ? entry.otHours.toFixed(1) : '-'}</td>
      <td>${entry.notes || '-'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${projectName} - Timesheets</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; }
        h1 { color: #C9A962; }
        .summary-box { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .summary-item { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
        .summary-label { font-size: 12px; color: #666; }
        .summary-value { font-size: 24px; font-weight: bold; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #C9A962; color: white; padding: 10px; text-align: left; font-size: 12px; }
        td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <h1>Timesheet Summary</h1>
      <p style="color: #666;">Production: ${projectName}</p>

      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-label">Total Days</div>
          <div class="summary-value">${totalDays}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Base Hours</div>
          <div class="summary-value">${totalBaseHours.toFixed(1)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">OT Hours</div>
          <div class="summary-value">${totalOTHours.toFixed(1)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Kit Rental</div>
          <div class="summary-value">${totalDays} days</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Day Type</th>
            <th>Pre-Call</th>
            <th>Unit Call</th>
            <th>Wrap</th>
            <th>Hours</th>
            <th>OT</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="footer">
        <p>Signature: ______________________ Date: ______________</p>
      </div>
    </body>
    </html>
  `;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatMakeupDetails(makeup: MakeupDetails): string {
  const fields = [
    ['Foundation', makeup.foundation],
    ['Coverage', makeup.coverage],
    ['Concealer', makeup.concealer],
    ['Blush', makeup.blush],
    ['Lips', makeup.lipColour],
    ['Eyes', [makeup.lidColour, makeup.liner, makeup.lashes].filter(Boolean).join(', ')],
    ['Setting', makeup.setting],
  ].filter(([_, v]) => v);

  return fields.map(([label, value]) => `
    <tr><td>${label}:</td><td>${value}</td></tr>
  `).join('');
}

function formatHairDetails(hair: HairDetails): string {
  const fields = [
    ['Style', hair.style],
    ['Parting', hair.parting],
    ['Products', hair.products],
    ['Pieces Out', hair.piecesOut],
    ['Accessories', hair.accessories],
    ['Type', hair.hairType !== 'Natural' ? hair.hairType : null],
  ].filter(([_, v]) => v);

  if (hair.hairType !== 'Natural') {
    if (hair.wigNameId) fields.push(['Wig', hair.wigNameId]);
    if (hair.wigType) fields.push(['Wig Type', hair.wigType]);
  }

  return fields.map(([label, value]) => `
    <tr><td>${label}:</td><td>${value}</td></tr>
  `).join('');
}

function formatSFXDetails(sfx: SFXDetails): string {
  const fields = [
    ['Types', sfx.sfxTypes.join(', ')],
    ['Prosthetics', sfx.prostheticPieces],
    ['Adhesive', sfx.prostheticAdhesive],
    ['Blood Types', sfx.bloodTypes.join(', ')],
    ['Blood Products', sfx.bloodProducts],
    ['Contact Lenses', sfx.contactLenses],
    ['Teeth', sfx.teeth],
  ].filter(([_, v]) => v && v.length > 0);

  return fields.map(([label, value]) => `
    <tr><td>${label}:</td><td>${value}</td></tr>
  `).join('');
}

function formatMakeupDetailsHTML(makeup: MakeupDetails): string {
  const fields = [
    ['Foundation', makeup.foundation],
    ['Coverage', makeup.coverage],
    ['Concealer', makeup.concealer],
    ['Blush', makeup.blush],
    ['Lip Colour', makeup.lipColour],
    ['Lid Colour', makeup.lidColour],
    ['Liner', makeup.liner],
    ['Lashes', makeup.lashes],
    ['Setting', makeup.setting],
  ].filter(([_, v]) => v);

  return fields.map(([label, value]) => `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${value}</span>
    </div>
  `).join('');
}

function formatHairDetailsHTML(hair: HairDetails): string {
  const fields = [
    ['Style', hair.style],
    ['Parting', hair.parting],
    ['Products', hair.products],
    ['Pieces Out', hair.piecesOut],
    ['Pins', hair.pins],
    ['Accessories', hair.accessories],
    ['Type', hair.hairType],
  ].filter(([_, v]) => v);

  if (hair.hairType !== 'Natural') {
    if (hair.wigNameId) fields.push(['Wig ID', hair.wigNameId]);
    if (hair.wigType) fields.push(['Wig Type', hair.wigType]);
    if (hair.hairline) fields.push(['Hairline', hair.hairline]);
  }

  return fields.map(([label, value]) => `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${value}</span>
    </div>
  `).join('');
}

function formatContinuityFlags(flags: ContinuityFlags): string {
  const activeFlags = [];
  if (flags.sweat) activeFlags.push('<span class="flag-badge flag-sweat">Sweat</span>');
  if (flags.dishevelled) activeFlags.push('<span class="flag-badge flag-dishevelled">Dishevelled</span>');
  if (flags.blood) activeFlags.push('<span class="flag-badge flag-blood">Blood</span>');
  if (flags.dirt) activeFlags.push('<span class="flag-badge flag-dirt">Dirt</span>');
  if (flags.wetHair) activeFlags.push('<span class="flag-badge flag-wetHair">Wet Hair</span>');
  if (flags.tears) activeFlags.push('<span class="flag-badge flag-tears">Tears</span>');
  return activeFlags.join('');
}
