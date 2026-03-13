import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS, emptyHMW,
  useBreakdownStore, useTagStore, useSynopsisStore, useParsedScriptStore,
  type Scene, type Character, type Look, type CharacterBreakdown, type SceneBreakdown,
} from '@/stores/breakdownStore';
import { LookbookTab, useLookbookMeta } from './LookbookTab';
import { BibleTab } from './BibleTab';

/* ━━━ Helpers ━━━ */

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Find the previous scene a character appeared in (script order) */
function findPrevScene(charId: string, currentIdx: number, scenes: Scene[]): number | null {
  for (let i = currentIdx - 1; i >= 0; i--) {
    if (scenes[i].characterIds.includes(charId)) return scenes[i].number;
  }
  return null;
}

/** Build continuity notes string */
function buildContinuityNotes(
  cb: CharacterBreakdown | undefined,
  charId: string,
  sceneIdx: number,
  scenes: Scene[],
  breakdown: SceneBreakdown | undefined,
  tags: { text: string; categoryId: string }[],
): string {
  const parts: string[] = [];

  // Active continuity events for this scene
  if (breakdown) {
    const events = breakdown.continuityEvents.filter((e) => e.characterId === charId);
    if (events.length > 0) parts.push(events.map((e) => e.description || e.type).join(', '));
  }

  // Character notes
  if (cb?.notes) parts.push(cb.notes);

  // Injury / health tags
  const injTags = tags.filter((t) => t.categoryId === 'injuries' || t.categoryId === 'health');
  if (injTags.length > 0) parts.push(injTags.map((t) => t.text).join(', '));

  // "Same as Sc X" logic — only show when no data at all for this character
  const hasHairTag = tags.some((t) => t.categoryId === 'hair');
  const hasMakeupTag = tags.some((t) => t.categoryId === 'makeup');
  const hasManualEntry = cb && (cb.entersWith.hair || cb.entersWith.makeup || cb.entersWith.wardrobe || cb.sfx);
  if (parts.length === 0 && !hasManualEntry && !hasHairTag && !hasMakeupTag) {
    const prev = findPrevScene(charId, sceneIdx, scenes);
    if (prev !== null) parts.push(`Same as Sc ${prev}`);
  }

  return parts.join('; ');
}

/* ━━━ Export ━━━ */

function exportCSV(rows: string[][], filename: string) {
  const esc = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ━━━ Icons ━━━ */

function ExportIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}

function FilterIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
}

function ShareIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}

function CopyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
}

/* ━━━ Main Component ━━━ */

export function BreakdownSheet({ projectId }: { projectId: string }) {
  const store = useBreakdownStore();
  const tagStore = useTagStore();
  const synopsisStore = useSynopsisStore();
  const parsedScriptStore = useParsedScriptStore();

  const [filterChar, setFilterChar] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'lookbook' | 'bible'>('breakdown');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lookbookMeta = useLookbookMeta(projectId);

  /* Resolve data source: parsed script → mock data fallback */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const scenes: Scene[] = useMemo(() => parsedData ? parsedData.scenes : MOCK_SCENES, [parsedData]);
  const characters: Character[] = useMemo(() => parsedData ? parsedData.characters : MOCK_CHARACTERS, [parsedData]);
  const looks: Look[] = useMemo(() => parsedData ? parsedData.looks : MOCK_LOOKS, [parsedData]);
  /* Detect time jumps: scenes where the story day differs from the previous scene */
  const timeJumpSceneIds = useMemo(() => {
    const jumpIds = new Set<string>();
    let prevDay = '';
    for (const s of scenes) {
      const day = s.storyDay || '';
      if (prevDay && day && day !== prevDay) {
        jumpIds.add(s.id);
      }
      if (day) prevDay = day;
    }
    return jumpIds;
  }, [scenes]);

  /* Ensure every scene has a breakdown — initialise any that are missing
     so data entered on the Script page is always visible here. */
  useEffect(() => {
    for (const s of scenes) {
      const existing = store.getBreakdown(s.id);
      if (!existing) {
        store.setBreakdown(s.id, {
          sceneId: s.id,
          timeline: {
            day: s.storyDay || '',
            time: s.dayNight === 'DAY' ? 'Day' : s.dayNight === 'NIGHT' ? 'Night' : s.dayNight === 'DAWN' ? 'Dawn' : s.dayNight === 'DUSK' ? 'Dusk' : '',
            type: '', note: '',
          },
          characters: s.characterIds.map((cid) => ({
            characterId: cid, lookId: '',
            entersWith: emptyHMW(), sfx: '',
            changeType: 'no-change' as const, changeNotes: '',
            exitsWith: emptyHMW(), notes: '',
          })),
          continuityEvents: [],
        });
      } else if (!existing.timeline.day && s.storyDay) {
        store.updateTimeline(s.id, { ...existing.timeline, day: s.storyDay });
      }
    }
  }, [scenes, store]);

  /* Filtered scenes: only those with characters */
  const scenesWithCast = scenes.filter((s) => {
    if (s.characterIds.length === 0) return false;
    if (filterChar && !s.characterIds.includes(filterChar)) return false;
    return true;
  });

  /** Build an export row for a character in a scene (shared between copy & CSV) */
  const buildExportRows = useCallback(() => {
    const headers = ['Scene', 'Day', 'Character', 'Hair', 'Makeup', 'Wardrobe', 'SFX', 'Continuity Notes'];
    const rows: string[][] = [headers];
    for (let idx = 0; idx < scenes.length; idx++) {
      const s = scenes[idx];
      const bd = store.getBreakdown(s.id);
      const charIds = filterChar ? s.characterIds.filter((c) => c === filterChar) : s.characterIds;
      const storyDay = bd?.timeline.day || s.storyDay || '';
      for (const cid of charIds) {
        const ch = characters.find((c) => c.id === cid);
        if (!ch) continue;
        const cb = bd?.characters.find((c) => c.characterId === cid);
        const tags = tagStore.getTagsForScene(s.id).filter((t) => t.characterId === cid);
        const notes = buildContinuityNotes(cb, cid, idx, scenes, bd, tags);

        const charLook = cb?.lookId ? looks.find((l) => l.id === cb.lookId) : null;
        const hairTags = tags.filter((t) => t.categoryId === 'hair');
        const makeupTags = tags.filter((t) => t.categoryId === 'makeup');
        const wardrobeTags = tags.filter((t) => t.categoryId === 'wardrobe');
        const sfxTags = tags.filter((t) => t.categoryId === 'sfx');

        const resolve = (manual: string | undefined, tagList: typeof hairTags, lookField: string | undefined) =>
          manual || (tagList.length > 0 ? tagList.map((t) => t.text).join(', ') : '') || lookField || '';

        rows.push([
          String(s.number),
          storyDay,
          ch.name,
          resolve(cb?.entersWith.hair, hairTags, charLook?.hair),
          resolve(cb?.entersWith.makeup, makeupTags, charLook?.makeup),
          resolve(cb?.entersWith.wardrobe, wardrobeTags, charLook?.wardrobe),
          cb?.sfx || sfxTags.map((t) => t.text).join(', ') || '',
          notes,
        ]);
      }
    }
    return rows;
  }, [store, tagStore, scenes, characters, looks, filterChar]);

  /* Copy to clipboard as TSV */
  const handleCopy = useCallback(() => {
    const rows = buildExportRows();
    const tsv = rows.map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [buildExportRows]);

  /* Export CSV */
  const handleExport = useCallback(() => {
    const rows = buildExportRows();
    exportCSV(rows, 'breakdown.csv');
  }, [buildExportRows]);

  return (
    <div className="bs-page">
      {/* Header */}
      <div className="bs-header">
        <div className="bs-header-left">
          <div className="bs-tabs">
            <button className={`bs-tab ${activeTab === 'breakdown' ? 'bs-tab--active' : ''}`} onClick={() => setActiveTab('breakdown')}>Breakdown</button>
            <button className={`bs-tab ${activeTab === 'lookbook' ? 'bs-tab--active' : ''}`} onClick={() => setActiveTab('lookbook')}>Lookbook</button>
            <button className={`bs-tab ${activeTab === 'bible' ? 'bs-tab--active' : ''}`} onClick={() => setActiveTab('bible')}>Bible</button>
          </div>
        </div>
        <div className="bs-header-right">
          {activeTab === 'breakdown' && (
            <>
              <span className="bs-subtitle">{scenesWithCast.length} scenes · {characters.length} characters</span>
              <div className="bs-filter">
                <FilterIcon />
                <select className="bs-filter-select" value={filterChar} onChange={(e) => setFilterChar(e.target.value)}>
                  <option value="">All Characters</option>
                  {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button className="bs-action-btn" onClick={handleCopy}>
                <CopyIcon /> {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="bs-action-btn bs-action-btn--primary" onClick={handleExport}>
                <ExportIcon /> Export CSV
              </button>
            </>
          )}
          {activeTab === 'lookbook' && (
            <>
              <span className="bs-subtitle">{lookbookMeta.characterCount} characters · {lookbookMeta.lookCount} looks</span>
              <button className="bs-action-btn bs-action-btn--primary" onClick={() => { /* future PDF export */ }}>
                <ExportIcon /> Export PDF
              </button>
            </>
          )}
          {activeTab === 'bible' && (
            <>
              <button className="bs-action-btn" onClick={() => { /* future share */ }}>
                <ShareIcon /> Share
              </button>
              <button className="bs-action-btn bs-action-btn--primary" onClick={() => { /* future PDF export */ }}>
                <ExportIcon /> Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'lookbook' && (
        <LookbookTab projectId={projectId} />
      )}

      {activeTab === 'bible' && (
        <BibleTab projectId={projectId} />
      )}

      {/* Spreadsheet */}
      {activeTab === 'breakdown' && <div className="bs-scroll" ref={scrollRef}>
        {scenesWithCast.map((scene) => {
          const globalIdx = scenes.indexOf(scene);
          const bd = store.getBreakdown(scene.id);
          const synopsis = synopsisStore.getSynopsis(scene.id, scene.synopsis);
          const charIds = filterChar ? scene.characterIds.filter((c) => c === filterChar) : scene.characterIds;

          /* Timeline badges */
          const timelineType = bd?.timeline.type;
          const showBadge = timelineType && timelineType !== 'Normal' && timelineType !== '';

          /* Resolve story day: breakdown timeline → scene-level storyDay */
          const storyDay = bd?.timeline.day || scene.storyDay || '';
          const isTimeJump = timeJumpSceneIds.has(scene.id);

          /* Scene-type class for colour coding */
          const sceneTypeClass = timelineType && timelineType !== 'Normal' && timelineType !== ''
            ? `bs-scene-block--${timelineType.toLowerCase().replace(/\s+/g, '-')}`
            : '';

          return (
            <div key={scene.id} className={`bs-scene-block ${isTimeJump ? 'bs-scene-block--time-jump' : ''} ${sceneTypeClass}`}>
              {/* Time jump banner */}
              {isTimeJump && (
                <div className="bs-time-jump-banner">
                  <span className="bs-time-jump-icon">&#9203;</span>
                  TIME JUMP — {storyDay}
                  {bd?.timeline.note && <span className="bs-time-jump-detail"> · {bd.timeline.note}</span>}
                </div>
              )}
              {/* Scene header */}
              <div className="bs-scene-header">
                <div className="bs-scene-header-main">
                  <span className="bs-scene-num">SC {scene.number}</span>
                  {storyDay && <span className="bs-scene-day">{storyDay}</span>}
                  <span className="bs-scene-location">
                    {scene.intExt}. {scene.location} — {scene.dayNight}
                  </span>
                  {showBadge && (
                    <span className="bs-scene-badge">{timelineType?.toUpperCase()}</span>
                  )}
                  {bd?.timeline.note && (
                    <span className="bs-scene-timeline-note">{bd.timeline.note}</span>
                  )}
                </div>
                {synopsis && <div className="bs-scene-synopsis">{synopsis}</div>}
              </div>

              {/* Table */}
              <table className="bs-table">
                <thead>
                  <tr>
                    <th className="bs-col-char">Character</th>
                    <th className="bs-col-hair">Hair</th>
                    <th className="bs-col-makeup">Makeup</th>
                    <th className="bs-col-wardrobe">Wardrobe</th>
                    <th className="bs-col-sfx">SFX / Prosthetics</th>
                    <th className="bs-col-notes">Continuity Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {charIds.map((cid) => {
                    const ch = characters.find((c) => c.id === cid);
                    if (!ch) return null;
                    const cb = bd?.characters.find((c) => c.characterId === cid);
                    const tags = tagStore.getTagsForScene(scene.id).filter((t) => t.characterId === cid);

                    // Gather category tags
                    const hairTags = tags.filter((t) => t.categoryId === 'hair');
                    const makeupTags = tags.filter((t) => t.categoryId === 'makeup');
                    const wardrobeTags = tags.filter((t) => t.categoryId === 'wardrobe');
                    const sfxTags = tags.filter((t) => t.categoryId === 'sfx');

                    // Resolve values: manual entry → tag text → look defaults
                    const charLook = cb?.lookId ? looks.find((l) => l.id === cb.lookId) : null;
                    const resolveField = (manual: string | undefined, tagList: typeof hairTags, lookField: string | undefined) => {
                      if (manual) return manual;
                      if (tagList.length > 0) return tagList.map((t) => t.text).join(', ');
                      if (lookField) return lookField;
                      return '';
                    };

                    const hair = resolveField(cb?.entersWith.hair, hairTags, charLook?.hair);
                    const makeup = resolveField(cb?.entersWith.makeup, makeupTags, charLook?.makeup);
                    const wardrobe = resolveField(cb?.entersWith.wardrobe, wardrobeTags, charLook?.wardrobe);
                    const sfx = cb?.sfx || sfxTags.map((t) => t.text).join(', ') || '';

                    // Build continuity notes
                    const continuity = buildContinuityNotes(cb, cid, globalIdx, scenes, bd, tags);
                    const hasEvents = bd?.continuityEvents.some((e) => e.characterId === cid);

                    // Change info
                    const hasChange = cb?.changeType === 'change';

                    return (
                      <tr key={cid}
                        className={`bs-row ${hasEvents ? 'bs-row--continuity' : ''}`}>
                        <td className="bs-col-char">
                          <div className="bs-char-stack">
                            <span className="bs-char-name">{ch.name}</span>
                            <span className="bs-char-billing">{ordinal(ch.billing)}</span>
                            {charLook && <span className="bs-char-look">{charLook.name}</span>}
                          </div>
                        </td>
                        <td className="bs-col-hair">
                          {hair || <span className="bs-empty">—</span>}
                          {hasChange && cb?.exitsWith.hair && (
                            <div className="bs-exit-note">Exit: {cb.exitsWith.hair}</div>
                          )}
                        </td>
                        <td className="bs-col-makeup">
                          {makeup || <span className="bs-empty">—</span>}
                          {hasChange && cb?.exitsWith.makeup && (
                            <div className="bs-exit-note">Exit: {cb.exitsWith.makeup}</div>
                          )}
                        </td>
                        <td className="bs-col-wardrobe">
                          {wardrobe || <span className="bs-empty">—</span>}
                          {hasChange && cb?.exitsWith.wardrobe && (
                            <div className="bs-exit-note">Exit: {cb.exitsWith.wardrobe}</div>
                          )}
                        </td>
                        <td className="bs-col-sfx">
                          {sfx || <span className="bs-empty">—</span>}
                        </td>
                        <td className="bs-col-notes">
                          {hasChange && cb?.changeNotes && (
                            <div className="bs-change-note">{cb.changeNotes}</div>
                          )}
                          {continuity
                            ? continuity.startsWith('Same as')
                              ? <span className="bs-same-ref">{continuity}</span>
                              : continuity
                            : !hasChange ? <span className="bs-empty">—</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        {scenesWithCast.length === 0 && (
          <div className="bs-empty-state">
            <p>No scenes with characters found{filterChar ? ' for this character' : ''}.</p>
          </div>
        )}
      </div>}
    </div>
  );
}

