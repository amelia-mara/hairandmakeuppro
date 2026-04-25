import { Fragment } from 'react';
import { diffWords } from 'diff';
import type { Character, Scene, ScriptTag } from '@/stores/breakdownStore';
import { BREAKDOWN_CATEGORIES } from '@/stores/breakdownStore';
import { buildTaggedSegments } from '@/utils/buildTaggedSegments';

/* ─── Character-name highlighting pipeline ─── */

/** Return value of buildCharNamePattern — a compiled regex plus a
 *  longest-first lookup array for resolving matches back to Character. */
export type CharNamePattern = { re: RegExp; lookup: { name: string; char: Character }[] } | null;

// Common words that should never be highlighted as first-name fragments
const GENERIC_WORDS = new Set([
  'MAN', 'WOMAN', 'BOY', 'GIRL', 'OLD', 'YOUNG', 'CHILD', 'BABY',
  'COWBOY', 'COWGIRL', 'DOCTOR', 'NURSE', 'OFFICER', 'CAPTAIN',
  'SERGEANT', 'DETECTIVE', 'AGENT', 'JUDGE', 'PRIEST', 'PASTOR',
  'DRIVER', 'WAITER', 'WAITRESS', 'BARTENDER', 'BARMAN', 'GUARD',
  'SOLDIER', 'GENERAL', 'KING', 'QUEEN', 'PRINCE', 'PRINCESS',
  'MRS', 'MR', 'MISS', 'TALL', 'SHORT', 'BIG', 'FAT', 'THIN',
  'ELDERLY', 'MIDDLE', 'LITTLE', 'BEAUTIFUL', 'PRETTY', 'HANDSOME',
]);

/**
 * Build a compiled regex that matches known character names within
 * action/description lines. Only multi-word full names and their
 * first-name references are matched. Single-word character names and
 * generic words are excluded.
 *
 * Designed to be wrapped in a useMemo with [characters] as the dep.
 */
export function buildCharNamePattern(characters: Character[]): CharNamePattern {
  const allNames: { name: string; char: Character }[] = [];
  for (const c of characters) {
    if (!/\s/.test(c.name.trim())) continue;
    allNames.push({ name: c.name, char: c });
    const first = c.name.split(/\s+/)[0];
    if (first.length >= 3 && !GENERIC_WORDS.has(first.toUpperCase())) {
      allNames.push({ name: first, char: c });
    }
  }
  allNames.sort((a, b) => b.name.length - a.name.length);
  if (allNames.length === 0) return null;
  const escaped = allNames.map(n => n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  return { re, lookup: allNames };
}

/**
 * Render a text string with inline character-name highlights. Names
 * that match the pattern get the sv-cue-inline class and are clickable.
 *
 * Designed to be wrapped in a useCallback with
 * [charNamePattern, onCharClick] as deps.
 */
export function highlightCharacterNames(
  text: string,
  keyPrefix: string,
  charNamePattern: CharNamePattern,
  onCharClick: (charId: string) => void,
): React.ReactNode {
  if (!charNamePattern || !text) return text;
  const { re, lookup } = charNamePattern;
  re.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const matchText = m[0];
    const upper = matchText.toUpperCase();
    const entry = lookup.find(n => n.name.toUpperCase() === upper);
    if (!entry) continue;
    if (m.index > lastIdx) {
      parts.push(<span key={`${keyPrefix}-t${lastIdx}`}>{text.slice(lastIdx, m.index)}</span>);
    }
    parts.push(
      <span key={`${keyPrefix}-c${m.index}`} className="sv-cue-inline" onClick={(e) => { e.stopPropagation(); onCharClick(entry.char.id); }}>
        {matchText}
      </span>
    );
    lastIdx = m.index + matchText.length;
  }
  if (lastIdx === 0) return text;
  if (lastIdx < text.length) {
    parts.push(<span key={`${keyPrefix}-t${lastIdx}`}>{text.slice(lastIdx)}</span>);
  }
  return <>{parts}</>;
}

/* ─── Scene content renderer ─── */

interface RenderSceneContentParams {
  scene: Scene;
  charNames: string[];
  cueNameToChar: Map<string, Character>;
  characters: Character[];
  onCharClick: (charId: string) => void;
  highlightCharNames: (text: string, keyPrefix: string) => React.ReactNode;
  handleTagClick: (e: React.MouseEvent, sceneId: string, tagIds: string[]) => void;
  sceneTags: ScriptTag[];
  /**
   * When the active scene has unreviewed script revisions, the parent
   * passes the old + new script bodies so this renderer can highlight
   * the words that changed in terracotta. Tag overlays are skipped
   * while review-mode is active (they reappear once the user marks the
   * scene reviewed and `isSceneRevised` becomes false).
   */
  revisedDiff?: { oldContent: string; newContent: string } | null;
}

/** Strip parentheticals from a line to get the bare cue name */
function extractCueName(text: string): string {
  return text.replace(/\s*\(.*?\)\s*/g, '').trim();
}

/**
 * Render a scene's script content with inline cue/dialogue styling,
 * character-name highlights, and tag-overlay spans.
 *
 * This is a pure render function — no hooks, no side effects. It's
 * designed to be called inside a useCallback in ScriptView so React
 * can memoize its output.
 */
export function renderSceneContent({
  scene,
  charNames,
  cueNameToChar,
  characters,
  onCharClick,
  highlightCharNames: highlight,
  handleTagClick,
  sceneTags,
  revisedDiff,
}: RenderSceneContentParams): React.ReactNode[] {
  const lines = scene.scriptContent.split('\n');

  /** Check if a trimmed line is a character cue */
  function matchCue(trimmed: string): Character | null {
    if (trimmed !== trimmed.toUpperCase() || trimmed.length > 50) return null;
    const cueName = extractCueName(trimmed);
    if (!cueName) return null;
    return cueNameToChar.get(cueName) || null;
  }

  /* Pre-compute dialogue line indices */
  const dialogueSet = new Set<number>();
  const cueCharMap = new Map<number, Character>();
  let inDialogue = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const charMatch = matchCue(trimmed);
    if (charMatch) {
      cueCharMap.set(i, charMatch);
      inDialogue = true;
    } else if (inDialogue) {
      if (trimmed === '') {
        inDialogue = false;
      } else {
        dialogueSet.add(i);
      }
    }
  }

  /* Revision review — highlight changed words in terracotta. Tag overlays
     are temporarily replaced by diff highlights so the user can spot the
     edits at a glance; once the scene is marked reviewed (isSceneRevised
     flips to false), the parent stops passing `revisedDiff` and the
     normal rendering path returns. */
  if (revisedDiff) {
    const linesWithDiff = buildDiffLines(
      revisedDiff.oldContent,
      revisedDiff.newContent,
      lines.length,
    );
    return linesWithDiff.map((segs, i) => {
      const lineText = lines[i] ?? '';
      const trimmed = lineText.trim();
      const ch = cueCharMap.get(i);
      const baseClass = ch
        ? 'sv-line sv-cue'
        : dialogueSet.has(i)
          ? 'sv-line sv-dialogue'
          : 'sv-line';
      const hasContent = segs.some((s) => s.text.trim().length > 0);
      const onClickProp = ch ? { onClick: () => onCharClick(ch.id) } : {};
      return (
        <div key={`${scene.id}-r${i}`} className={baseClass} {...onClickProp}>
          {hasContent
            ? segs.map((s, j) =>
                s.added
                  ? <span key={j} className="sv-changed">{s.text}</span>
                  : <Fragment key={j}>{s.text}</Fragment>,
              )
            : trimmed}
        </div>
      );
    });
  }

  if (sceneTags.length === 0) {
    /* Plain rendering (no tags to show) */
    return lines.map((line, i) => {
      const trimmed = line.trim();
      const ch = cueCharMap.get(i);
      if (ch) {
        return <div key={`${scene.id}-${i}`} className="sv-line sv-cue" onClick={() => onCharClick(ch.id)}>{trimmed}</div>;
      }
      if (dialogueSet.has(i)) {
        return <div key={`${scene.id}-${i}`} className="sv-line sv-dialogue">{trimmed || '\u00A0'}</div>;
      }
      return <div key={`${scene.id}-${i}`} className="sv-line">{trimmed ? highlight(trimmed, `${scene.id}-${i}`) : '\u00A0'}</div>;
    });
  }

  /* Tagged rendering — overlay highlights on the full scriptContent */
  const segments = buildTaggedSegments(scene.scriptContent, sceneTags);
  let charIdx = 0;
  const lineOffsets: { start: number; end: number; line: string }[] = [];
  for (const line of lines) {
    lineOffsets.push({ start: charIdx, end: charIdx + line.length, line });
    charIdx += line.length + 1;
  }

  return lineOffsets.map((lo, lineIdx) => {
    const trimmed = lo.line.trim();
    const matched = charNames.find((name) => {
      const cue = trimmed.replace(/\s*\(.*\)$/, '').replace(/\s*\(CONT'D\)$/, '');
      return cue === name;
    });
    const isCue = !!matched;

    const lineSegs = segments.filter((s) => s.start < lo.end + 1 && s.end > lo.start);
    const hasTag = lineSegs.some((s) => s.tags.length > 0);
    const isDialogueLine = dialogueSet.has(lineIdx);

    if (!hasTag) {
      if (isCue) {
        const ch = characters.find((c) => c.name === matched)!;
        return <div key={`${scene.id}-${lineIdx}`} className="sv-line sv-cue" onClick={() => onCharClick(ch.id)}>{trimmed}</div>;
      }
      if (isDialogueLine) {
        return <div key={`${scene.id}-${lineIdx}`} className="sv-line sv-dialogue">{trimmed || '\u00A0'}</div>;
      }
      return <div key={`${scene.id}-${lineIdx}`} className="sv-line">{lo.line ? highlight(lo.line, `${scene.id}-${lineIdx}`) : '\u00A0'}</div>;
    }

    /* Render with highlighted spans */
    const parts: React.ReactNode[] = [];
    for (const seg of lineSegs) {
      const segStart = Math.max(seg.start, lo.start) - lo.start;
      const segEnd = Math.min(seg.end, lo.end) - lo.start;
      const segText = lo.line.slice(segStart, segEnd);
      if (seg.tags.length > 0) {
        const castTag = seg.tags.find(t => t.categoryId === 'cast' && t.characterId);
        if (castTag) {
          const charId = castTag.characterId!;
          parts.push(
            <span key={`${seg.start}-${seg.end}`} className="sv-cue-inline"
              onClick={(e) => { e.stopPropagation(); onCharClick(charId); }}
              title={characters.find(c => c.id === charId)?.name || ''}
            >{segText}</span>
          );
        } else {
          const tagColors = seg.tags.map(t => {
            const cat = BREAKDOWN_CATEGORIES.find((c) => c.id === t.categoryId);
            return cat?.color || '#888';
          });
          const titleParts = seg.tags.map(t => {
            const cat = BREAKDOWN_CATEGORIES.find((c) => c.id === t.categoryId);
            const label = cat?.label || 'Tag';
            const charName = t.characterId ? characters.find(c => c.id === t.characterId)?.name : '';
            return charName ? `${label} → ${charName}` : label;
          });
          const underlines = tagColors.map((color, i) =>
            `inset 0 ${-2 - i * 3}px 0 0 ${color}`
          ).join(', ');
          const segTagIds = seg.tags.map(t => t.id);
          parts.push(
            <span key={`${seg.start}-${seg.end}`} className="sv-highlight sv-highlight--clickable"
              style={{
                backgroundColor: `${tagColors[0]}33`,
                borderBottom: 'none',
                boxShadow: underlines,
                paddingBottom: seg.tags.length > 1 ? `${(seg.tags.length - 1) * 3}px` : undefined,
              }}
              title={titleParts.join(' | ')}
              onClick={(e) => handleTagClick(e, scene.id, segTagIds)}
            >{segText}</span>
          );
        }
      } else {
        parts.push(<span key={`${seg.start}-${seg.end}`}>{segText}</span>);
      }
    }

    const lineClass = `sv-line${isCue ? ' sv-cue' : isDialogueLine ? ' sv-dialogue' : ''}`;
    return (
      <div key={`${scene.id}-${lineIdx}`} className={lineClass}
        onClick={isCue && matched ? () => { const ch = characters.find((c) => c.name === matched); if (ch) onCharClick(ch.id); } : undefined}>
        {parts}
      </div>
    );
  });
}

/* ─── Word-diff helpers (for revision review) ─── */

interface DiffSegment {
  added: boolean;
  text: string;
}

/**
 * Word-level diff between the old and new script bodies, split into
 * lines so the existing per-line layout (cue / dialogue / action)
 * still applies. Each output entry is one line; each segment in the
 * line is `{ added, text }` — `added: true` means the words were
 * inserted by the new draft and should render in terracotta.
 *
 * `expectedLineCount` mirrors the line count of `scene.scriptContent`,
 * which is the same as the new content. We pad / truncate so the
 * caller can index by line number safely.
 */
function buildDiffLines(
  oldContent: string,
  newContent: string,
  expectedLineCount: number,
): DiffSegment[][] {
  const parts = diffWords(oldContent || '', newContent || '');
  // Drop removed segments — we render the new content, not the old.
  const visible = parts.filter((p) => !p.removed);

  const lines: DiffSegment[][] = [[]];
  for (const p of visible) {
    const text = p.value;
    let cursor = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') {
        if (cursor < i) {
          lines[lines.length - 1].push({ added: !!p.added, text: text.slice(cursor, i) });
        }
        lines.push([]);
        cursor = i + 1;
      }
    }
    if (cursor < text.length) {
      lines[lines.length - 1].push({ added: !!p.added, text: text.slice(cursor) });
    }
  }

  while (lines.length < expectedLineCount) lines.push([]);
  if (lines.length > expectedLineCount) lines.length = expectedLineCount;
  return lines;
}
