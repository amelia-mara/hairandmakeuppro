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
  /** Scene number lifted from the slugline (e.g. "70 INT. KITCHEN -
   *  NIGHT 70" → 70). When present, the inserted scene takes this
   *  number directly instead of the parent's number with a letter
   *  suffix — lets the user create real numbered scenes the parser
   *  missed, rather than always producing sub-scenes (5A, 5B). */
  number: number | null;
  numberSuffix: string | null;
}

/** Pull number, INT/EXT, location, and time-of-day out of a
 *  slugline-shaped string. Tolerant of:
 *    * Optional leading scene number ("70 INT. HOSPITAL - NIGHT") and
 *      mirrored trailing scene number ("70 ... NIGHT 70").
 *    * Missing INT/EXT prefix entirely — falls back to INT and still
 *      parses everything else (the script parser sometimes eats the
 *      prefix and leaves just "HOSPITAL, NURSE'S STATION - NIGHT 70").
 *    * Optional alphabetic suffix on the number (5A → number=5,
 *      suffix="A").
 *    * Dashes vs em-dashes and parser-friendly time-of-day variants
 *      (MORNING/EVENING/CONTINUOUS map onto DAWN/DUSK/DAY to mirror
 *      the upload pipeline). */
function parseSlugline(text: string): ParsedHeading {
  const empty: ParsedHeading = {
    intExt: null, dayNight: null, location: null, number: null, numberSuffix: null,
  };
  if (!text) return empty;

  // Normalise: collapse whitespace, strip trailing page-break asterisks
  // some PDFs leave on the line ("70 *"), and trim.
  let cleaned = text.trim().replace(/\s+/g, ' ').replace(/\s*\*+\s*$/, '');

  // Strip the trailing scene-number echo ("70 ... NIGHT 70") before we
  // try to parse the time-of-day; otherwise the trailing number gets
  // stuck onto the TOD token and the regex fails.
  cleaned = cleaned.replace(/\s+\d+[A-Z]?\s*$/, '');

  // Optional leading scene number with optional alphabetic suffix.
  let number: number | null = null;
  let numberSuffix: string | null = null;
  const numMatch = cleaned.match(/^(\d+)([A-Z])?\b\s*/);
  if (numMatch) {
    number = parseInt(numMatch[1], 10);
    numberSuffix = numMatch[2] || null;
    cleaned = cleaned.slice(numMatch[0].length);
  }

  // INT/EXT prefix is now optional — if missing we still try to
  // recover location + time-of-day from what's left.
  const m = cleaned.match(
    /^(?:(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?)\s+)?(.+?)(?:\s*[—–-]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|MOMENTS LATER))?\s*$/i,
  );
  if (!m) return { ...empty, number, numberSuffix };

  let intExt: 'INT' | 'EXT' = 'INT';
  if (m[1]) {
    intExt = m[1].toUpperCase().startsWith('EXT') ? 'EXT' : 'INT';
  }
  const location = (m[2] || '').trim().toUpperCase().replace(/\.+$/, '');
  let dayNight: ParsedHeading['dayNight'] = null;
  if (m[3]) {
    const tod = m[3].toUpperCase();
    if (tod === 'DAY' || tod === 'NIGHT' || tod === 'DAWN' || tod === 'DUSK') dayNight = tod;
    else if (tod === 'MORNING') dayNight = 'DAWN';
    else if (tod === 'EVENING') dayNight = 'DUSK';
    else dayNight = 'DAY'; // CONTINUOUS / LATER / MOMENTS LATER → DAY
  }
  // Parse is considered successful when we recovered a location —
  // INT/EXT prefix is optional (defaulted), TOD is optional. Without
  // a location there's nothing useful to apply.
  return {
    intExt: location ? intExt : null,
    dayNight,
    location: location || null,
    number,
    numberSuffix,
  };
}

interface Props {
  popup: SceneInsertPopupState | null;
  onClose: () => void;
  /** Caller decides what to do with the dropSelection flag. When true,
   *  the parent scene loses content[startOffset..endOffset] and the
   *  new scene starts at endOffset (heading text is metadata, not
   *  body). When false, only the parent gets truncated at startOffset
   *  and the new scene's body keeps the selected text.
   *
   *  When the heading carries an explicit scene number (the user
   *  highlighted a numbered slugline or edited the Number field in
   *  the form), `heading.number` is forwarded to insertManualScene so
   *  the new scene takes that number directly. When omitted, the
   *  store falls back to `parent.number` + next available letter
   *  suffix. */
  onSubmit: (
    heading: {
      intExt: 'INT' | 'EXT';
      dayNight: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
      location: string;
      number?: number;
      numberSuffix?: string;
    },
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
  /** Scene number for the new scene. Free-form text input so the user
   *  can leave it blank (parent's number + auto suffix) or type a
   *  custom value like "70" or "70A". Stored as string until submit;
   *  parsed into number + suffix there. */
  const [numberInput, setNumberInput] = useState('');
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
    setNumberInput(
      parsed.number != null ? `${parsed.number}${parsed.numberSuffix ?? ''}` : '',
    );
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
    // Parse the user-supplied scene number. Accepts "70", "70A",
    // "70 A" — strips whitespace and pulls out the integer + single
    // alphabetic suffix. Blank means "let the store auto-suffix off
    // the parent scene".
    const numCleaned = numberInput.trim().toUpperCase();
    const numMatch = numCleaned.match(/^(\d+)\s*([A-Z])?$/);
    onSubmit(
      {
        intExt,
        dayNight,
        location: trimmed.toUpperCase(),
        number: numMatch ? parseInt(numMatch[1], 10) : undefined,
        numberSuffix: numMatch?.[2] || undefined,
      },
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

      {/* Scene number + INT/EXT on one row. Number is free-form so
          the user can type "70", "70A", or leave blank to let the
          store auto-suffix off the parent scene. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={numberInput}
          onChange={(e) => setNumberInput(e.target.value)}
          placeholder="Scene #"
          title="Scene number (e.g. 70 or 70A). Leave blank to use the parent scene number with an auto letter suffix."
          style={{
            width: 80,
            boxSizing: 'border-box',
            padding: '6px 8px',
            background: 'rgba(255, 255, 255, 0.06)',
            color: '#E8DFD0',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 4,
            fontFamily: 'inherit',
            fontSize: 13,
            textTransform: 'uppercase',
          }}
        />
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
