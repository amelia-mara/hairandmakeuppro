import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SceneInsertPopupState {
  x: number;
  y: number;
  /** Scene whose content is being split. */
  parentSceneId: string;
  /** Character offsets of the highlighted text within the parent
   *  scene's scriptContent. The split runs at `startOffset`; the
   *  selected text between start and end is dropped from the body
   *  when the heading parses cleanly (it lives in scene metadata
   *  instead). When the parse fails the selection is preserved and
   *  becomes the start of the new scene's body. */
  startOffset: number;
  endOffset: number;
  /** The text the user highlighted. Used to pre-fill the heading
   *  fields when the selection looks like a slugline. */
  selectedText: string;
}

interface ParsedHeading {
  intExt: 'INT' | 'EXT' | null;
  dayNight: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | null;
  location: string | null;
}

/** Pull INT/EXT, location, and time-of-day out of a slugline-shaped
 *  string. Tolerant of dashes vs em-dashes, missing periods, the
 *  combined "INT/EXT" prefix, and parser-friendly time-of-day
 *  variants (MORNING/EVENING/CONTINUOUS map onto our DAWN/DUSK/DAY
 *  enum to mirror the upload pipeline). Returns nulls for fields
 *  the regex couldn't recover. */
function parseSlugline(text: string): ParsedHeading {
  if (!text) return { intExt: null, dayNight: null, location: null };
  const cleaned = text.trim().replace(/\s+/g, ' ');
  const m = cleaned.match(
    /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?)\s+(.+?)(?:\s*[—–-]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|MOMENTS LATER))?\s*$/i,
  );
  if (!m) return { intExt: null, dayNight: null, location: null };
  const rawIntExt = m[1].toUpperCase();
  const intExt: 'INT' | 'EXT' = rawIntExt.startsWith('EXT') ? 'EXT' : 'INT';
  const location = (m[2] || '').trim().toUpperCase().replace(/\.+$/, '');
  let dayNight: ParsedHeading['dayNight'] = null;
  if (m[3]) {
    const tod = m[3].toUpperCase();
    if (tod === 'DAY' || tod === 'NIGHT' || tod === 'DAWN' || tod === 'DUSK') dayNight = tod;
    else if (tod === 'MORNING') dayNight = 'DAWN';
    else if (tod === 'EVENING') dayNight = 'DUSK';
    else dayNight = 'DAY'; // CONTINUOUS / LATER / MOMENTS LATER → DAY
  }
  return { intExt, dayNight, location: location || null };
}

interface Props {
  popup: SceneInsertPopupState | null;
  onClose: () => void;
  /** Caller decides what to do with the dropSelection flag. When true,
   *  the parent scene loses content[startOffset..endOffset] and the
   *  new scene starts at endOffset (heading text is metadata, not
   *  body). When false, only the parent gets truncated at startOffset
   *  and the new scene's body keeps the selected text. */
  onSubmit: (
    heading: { intExt: 'INT' | 'EXT'; dayNight: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK'; location: string },
    dropSelection: boolean,
  ) => void;
}

/**
 * Heading-confirmation form for manual scene inserts. Opened by the
 * character-pick step of `ScriptTagPopup` after the user clicks "Add
 * scene break" on a text selection. Pre-fills INT/EXT, location, and
 * time-of-day from the selected text when it looks like a slugline;
 * falls back to a blank form otherwise (and surfaces a hint so the
 * user knows the selection wasn't recognised).
 *
 * Layout mirrors the tag popup — fixed-position float with viewport
 * clamping, dismiss on outside click, dismiss on Escape.
 */
export function SceneInsertPopup({ popup, onClose, onSubmit }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [intExt, setIntExt] = useState<'INT' | 'EXT'>('INT');
  const [dayNight, setDayNight] = useState<'DAY' | 'NIGHT' | 'DAWN' | 'DUSK'>('DAY');
  const [location, setLocation] = useState('');
  const [parsedOk, setParsedOk] = useState(false);

  // Re-seed the form whenever the popup opens with a new selection.
  useEffect(() => {
    if (!popup) return;
    const parsed = parseSlugline(popup.selectedText);
    const ok = !!(parsed.intExt && parsed.location);
    setParsedOk(ok);
    setIntExt(parsed.intExt ?? 'INT');
    setDayNight(parsed.dayNight ?? 'DAY');
    setLocation(parsed.location ?? '');
  }, [popup]);

  // Dismiss on outside click. Defer one tick so the click that opened
  // the popup doesn't immediately close it.
  useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [popup, onClose]);

  // Clamp inside viewport after first render.
  useEffect(() => {
    if (!popup || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const pad = 10;
    let nx = popup.x;
    let ny = popup.y;
    if (rect.right > window.innerWidth - pad) nx -= rect.right - window.innerWidth + pad;
    if (rect.left < pad) nx += pad - rect.left;
    if (rect.bottom > window.innerHeight - pad) ny -= rect.bottom - window.innerHeight + pad;
    if (rect.top < pad) ny += pad - rect.top;
    if (nx !== popup.x || ny !== popup.y) {
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
    }
  }, [popup]);

  if (!popup) return null;

  const submit = () => {
    const trimmed = location.trim();
    if (!trimmed) return;
    onSubmit(
      { intExt, dayNight, location: trimmed.toUpperCase() },
      // Drop the selected text from the body when the parse succeeded
      // (it's a real slugline that shouldn't appear twice). When the
      // user is splitting a paragraph or typed a heading from
      // scratch, keep the selection in the new scene's body.
      parsedOk,
    );
  };

  return createPortal(
    <div
      ref={ref}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: popup.x,
        top: popup.y,
        zIndex: 1000,
        background: '#2A2018',
        color: '#E8DFD0',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: 8,
        padding: 14,
        width: 320,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        fontFamily: 'inherit',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Insert scene break</div>
      {!parsedOk && (
        <div
          style={{
            fontSize: 11,
            color: '#B8A98C',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 4,
            padding: '6px 8px',
            marginBottom: 10,
            lineHeight: 1.4,
          }}
        >
          Couldn't parse selection as a heading. Fill in the fields below — the highlighted text will stay in the new scene's body.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {(['INT', 'EXT'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setIntExt(v)}
            style={{
              flex: 1,
              padding: '6px 0',
              background: intExt === v ? '#E8621A' : 'rgba(255, 255, 255, 0.06)',
              color: intExt === v ? '#fff' : '#E8DFD0',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            {v}
          </button>
        ))}
      </div>

      <input
        autoFocus
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        placeholder="LOCATION (e.g. KITCHEN)"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '6px 8px',
          marginBottom: 8,
          background: 'rgba(255, 255, 255, 0.06)',
          color: '#E8DFD0',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          borderRadius: 4,
          fontFamily: 'inherit',
          fontSize: 13,
          textTransform: 'uppercase',
        }}
      />

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['DAY', 'NIGHT', 'DAWN', 'DUSK'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setDayNight(v)}
            style={{
              flex: 1,
              padding: '6px 0',
              background: dayNight === v ? '#E8621A' : 'rgba(255, 255, 255, 0.06)',
              color: dayNight === v ? '#fff' : '#E8DFD0',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11,
            }}
          >
            {v}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            color: '#B8A98C',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!location.trim()}
          style={{
            padding: '6px 14px',
            background: location.trim() ? '#E8621A' : 'rgba(232, 98, 26, 0.3)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: location.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            fontSize: 12,
          }}
        >
          Insert
        </button>
      </div>
    </div>,
    document.body,
  );
}
