import { useEffect, useState } from 'react';
import { type Scene, useParsedScriptStore } from '@/stores/breakdownStore';

interface Props {
  projectId: string;
  scene: Scene;
  onClose: () => void;
}

/**
 * Edit a scene's heading fields — number, letter suffix, INT/EXT,
 * location, time-of-day. Opens from a double-click on a scene card
 * in `SceneListPanel`, but works for any scene (manually inserted or
 * parser-generated) so the user can fix misparsed sluglines too.
 *
 * Doesn't touch the script body, breakdown data, or character list —
 * those have their own edit paths (script viewer / breakdown form).
 * Apply dispatches `updateSceneHeading` on the parsed-script store
 * which triggers the usual autosave subscription to Supabase.
 */
export function SceneEditModal({ projectId, scene, onClose }: Props) {
  const updateSceneHeading = useParsedScriptStore((s) => s.updateSceneHeading);

  const [numberInput, setNumberInput] = useState(
    `${scene.number}${scene.numberSuffix ?? ''}`,
  );
  const [intExt, setIntExt] = useState<'INT' | 'EXT'>(scene.intExt);
  const [dayNight, setDayNight] = useState<'DAY' | 'NIGHT' | 'DAWN' | 'DUSK'>(scene.dayNight);
  const [location, setLocation] = useState(scene.location);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const submit = () => {
    const trimmedLoc = location.trim();
    if (!trimmedLoc) {
      setError('Location is required.');
      return;
    }
    const numCleaned = numberInput.trim().toUpperCase();
    const numMatch = numCleaned.match(/^(\d+)\s*([A-Z])?$/);
    if (!numMatch) {
      setError('Scene number must be a number with an optional letter (e.g. 70 or 70A).');
      return;
    }
    updateSceneHeading(projectId, scene.id, {
      number: parseInt(numMatch[1], 10),
      numberSuffix: numMatch[2] || undefined,
      intExt,
      dayNight,
      location: trimmedLoc.toUpperCase(),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-glass"
        style={{ width: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 0' }}>
          <h2
            style={{
              fontSize: '0.8125rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-heading)',
              margin: 0,
            }}
          >
            <span className="heading-italic">Edit</span>{' '}
            <span className="heading-regular">Scene Heading</span>
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '20px 28px 24px' }}>
          {/* Number + INT/EXT on one row. */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: '0 0 110px' }}>
              <div style={labelStyle}>Scene #</div>
              <input
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="70 or 70A"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Int / Ext</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['INT', 'EXT'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setIntExt(v)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      background: intExt === v ? '#E8621A' : 'rgba(255, 255, 255, 0.06)',
                      color: intExt === v ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid rgba(255, 255, 255, 0.10)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div style={{ marginBottom: 10 }}>
            <div style={labelStyle}>Location</div>
            <input
              autoFocus
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="HOSPITAL, NURSE'S STATION"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          {/* Day / Night */}
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Time of Day</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['DAY', 'NIGHT', 'DAWN', 'DUSK'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDayNight(v)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    background: dayNight === v ? '#E8621A' : 'rgba(255, 255, 255, 0.06)',
                    color: dayNight === v ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid rgba(255, 255, 255, 0.10)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 10,
                padding: '8px 10px',
                borderRadius: 4,
                background: 'rgba(239, 68, 68, 0.10)',
                border: '1px solid rgba(239, 68, 68, 0.30)',
                color: '#ef4444',
                fontSize: '0.8125rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                background: 'var(--accent-gold, #D4943A)',
                border: 'none',
                color: '#1a1410',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 9px',
  background: 'rgba(255, 255, 255, 0.06)',
  color: 'var(--text-heading)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: 4,
  fontSize: 13,
  textTransform: 'uppercase',
};
