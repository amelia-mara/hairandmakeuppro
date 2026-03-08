import { useState, useRef, useCallback } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS, BREAKDOWN_CATEGORIES,
  useBreakdownStore, useTagStore, useSynopsisStore,
  type Scene, type CharacterBreakdown, type SceneBreakdown,
} from '@/stores/breakdownStore';

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

/** Calculate first appearances for each character */
function calcFirstAppearances(scenes: Scene[]): Record<string, string> {
  const firsts: Record<string, string> = {};
  for (const s of scenes) {
    for (const cid of s.characterIds) {
      if (!firsts[cid]) firsts[cid] = s.id;
    }
  }
  return firsts;
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

  // "Same as Sc X" logic
  if (parts.length === 0 && cb && !cb.entersWith.hair && !cb.entersWith.makeup) {
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

function CopyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
}

/* ━━━ Main Component ━━━ */

export function BreakdownSheet({ projectId: _pid }: { projectId: string }) {
  const store = useBreakdownStore();
  const tagStore = useTagStore();
  const synopsisStore = useSynopsisStore();

  const [filterChar, setFilterChar] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scenes = MOCK_SCENES;
  const characters = MOCK_CHARACTERS;
  const firstAppearances = calcFirstAppearances(scenes);

  /* Filtered scenes: only those with characters */
  const scenesWithCast = scenes.filter((s) => {
    if (s.characterIds.length === 0) return false;
    if (filterChar && !s.characterIds.includes(filterChar)) return false;
    return true;
  });

  /* Copy to clipboard as TSV */
  const handleCopy = useCallback(() => {
    const headers = ['Scene', 'Character', '1st', 'Hair', 'Makeup', 'SFX', 'Continuity Notes'];
    const rows: string[][] = [headers];
    for (let idx = 0; idx < scenes.length; idx++) {
      const s = scenes[idx];
      const bd = store.getBreakdown(s.id);
      const charIds = filterChar ? s.characterIds.filter((c) => c === filterChar) : s.characterIds;
      for (const cid of charIds) {
        const ch = characters.find((c) => c.id === cid);
        if (!ch) continue;
        const cb = bd?.characters.find((c) => c.characterId === cid);
        const isFirst = firstAppearances[cid] === s.id;
        const tags = tagStore.getTagsForScene(s.id).filter((t) => t.characterId === cid);
        const notes = buildContinuityNotes(cb, cid, idx, scenes, bd, tags);
        rows.push([
          String(s.number),
          ch.name,
          isFirst ? '*' : '',
          cb?.entersWith.hair || '',
          cb?.entersWith.makeup || '',
          cb?.sfx || '',
          notes,
        ]);
      }
    }
    const tsv = rows.map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [store, tagStore, scenes, characters, firstAppearances, filterChar]);

  /* Export CSV */
  const handleExport = useCallback(() => {
    const headers = ['Scene', 'Character', '1st', 'Hair', 'Makeup', 'SFX', 'Continuity Notes'];
    const rows: string[][] = [headers];
    for (let idx = 0; idx < scenes.length; idx++) {
      const s = scenes[idx];
      const bd = store.getBreakdown(s.id);
      const charIds = filterChar ? s.characterIds.filter((c) => c === filterChar) : s.characterIds;
      for (const cid of charIds) {
        const ch = characters.find((c) => c.id === cid);
        if (!ch) continue;
        const cb = bd?.characters.find((c) => c.characterId === cid);
        const isFirst = firstAppearances[cid] === s.id;
        const tags = tagStore.getTagsForScene(s.id).filter((t) => t.characterId === cid);
        const notes = buildContinuityNotes(cb, cid, idx, scenes, bd, tags);
        rows.push([
          String(s.number),
          ch.name,
          isFirst ? '*' : '',
          cb?.entersWith.hair || '',
          cb?.entersWith.makeup || '',
          cb?.sfx || '',
          notes,
        ]);
      }
    }
    exportCSV(rows, 'master-breakdown.csv');
  }, [store, tagStore, scenes, characters, firstAppearances, filterChar]);

  return (
    <div className="bs-page">
      {/* Header */}
      <div className="bs-header">
        <div className="bs-header-left">
          <h1 className="bs-title">MASTER BREAKDOWN</h1>
          <span className="bs-subtitle">{scenesWithCast.length} scenes · {characters.length} characters</span>
        </div>
        <div className="bs-header-right">
          {/* Character filter */}
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
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="bs-scroll" ref={scrollRef}>
        {scenesWithCast.map((scene) => {
          const globalIdx = scenes.indexOf(scene);
          const bd = store.getBreakdown(scene.id);
          const synopsis = synopsisStore.getSynopsis(scene.id, scene.synopsis);
          const charIds = filterChar ? scene.characterIds.filter((c) => c === filterChar) : scene.characterIds;

          /* Timeline badges */
          const timelineType = bd?.timeline.type;
          const showBadge = timelineType && timelineType !== 'Normal' && timelineType !== '';

          return (
            <div key={scene.id} className="bs-scene-block">
              {/* Scene header */}
              <div className="bs-scene-header">
                <div className="bs-scene-header-main">
                  <span className="bs-scene-num">SC {scene.number}</span>
                  {bd?.timeline.day && <span className="bs-scene-day">{bd.timeline.day}</span>}
                  <span className="bs-scene-location">
                    {scene.intExt}. {scene.location} — {scene.dayNight}
                  </span>
                  {showBadge && (
                    <span className="bs-scene-badge">{timelineType?.toUpperCase()}</span>
                  )}
                </div>
                {synopsis && <div className="bs-scene-synopsis">{synopsis}</div>}
              </div>

              {/* Table */}
              <table className="bs-table">
                <thead>
                  <tr>
                    <th className="bs-col-char">Character</th>
                    <th className="bs-col-first">1st</th>
                    <th className="bs-col-hair">Hair</th>
                    <th className="bs-col-makeup">Makeup</th>
                    <th className="bs-col-sfx">SFX / Prosthetics</th>
                    <th className="bs-col-notes">Continuity Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {charIds.map((cid) => {
                    const ch = characters.find((c) => c.id === cid);
                    if (!ch) return null;
                    const cb = bd?.characters.find((c) => c.characterId === cid);
                    const isFirst = firstAppearances[cid] === scene.id;
                    const tags = tagStore.getTagsForScene(scene.id).filter((t) => t.characterId === cid);
                    const continuity = buildContinuityNotes(cb, cid, globalIdx, scenes, bd, tags);

                    // Gather category tag pills
                    const hairTags = tags.filter((t) => t.categoryId === 'hair');
                    const makeupTags = tags.filter((t) => t.categoryId === 'makeup');
                    const sfxTags = tags.filter((t) => t.categoryId === 'sfx');

                    const hasEvents = bd?.continuityEvents.some((e) => e.characterId === cid);

                    return (
                      <tr key={cid}
                        className={`bs-row ${isFirst ? 'bs-row--first' : ''} ${hasEvents ? 'bs-row--continuity' : ''}`}>
                        <td className="bs-col-char">
                          <span className="bs-char-name">{ch.name}</span>
                          <span className="bs-char-billing">{ordinal(ch.billing)}</span>
                        </td>
                        <td className="bs-col-first">
                          {isFirst && <span className="bs-first-mark">*</span>}
                        </td>
                        <td className="bs-col-hair">
                          {cb?.entersWith.hair || <span className="bs-empty">—</span>}
                          <TagPills tags={hairTags} catId="hair" />
                        </td>
                        <td className="bs-col-makeup">
                          {cb?.entersWith.makeup || <span className="bs-empty">—</span>}
                          <TagPills tags={makeupTags} catId="makeup" />
                        </td>
                        <td className="bs-col-sfx">
                          {cb?.sfx || <span className="bs-empty">—</span>}
                          <TagPills tags={sfxTags} catId="sfx" />
                        </td>
                        <td className="bs-col-notes">
                          {continuity
                            ? continuity.startsWith('Same as')
                              ? <span className="bs-same-ref">{continuity}</span>
                              : continuity
                            : <span className="bs-empty">—</span>}
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
      </div>
    </div>
  );
}

/* ━━━ Tag pills for table cells ━━━ */

function TagPills({ tags, catId }: { tags: { id: string; text: string }[]; catId: string }) {
  if (tags.length === 0) return null;
  const color = BREAKDOWN_CATEGORIES.find((c) => c.id === catId)?.color || '#999';
  return (
    <div className="bs-tag-row">
      {tags.map((t) => (
        <span key={t.id} className="bs-tag-pill" style={{ borderColor: color, color }}>{t.text}</span>
      ))}
    </div>
  );
}
