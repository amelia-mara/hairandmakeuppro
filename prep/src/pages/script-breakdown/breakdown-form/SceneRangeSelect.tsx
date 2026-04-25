import type { Scene } from '@/stores/breakdownStore';

/**
 * Two-select scene range picker used by the continuity events section
 * of the breakdown form panel. Parses a `"Start-End"` string into Start
 * and End dropdowns and emits a rebuilt string on change.
 *
 * The End select supports an explicit "Open" option for events the
 * user hasn't decided the closing scene for yet — emits `"${start}-"`
 * (trailing hyphen, no end). The "Active continuity events" panel in
 * BreakdownFormPanel surfaces these on every later scene with a
 * one-click "End here" button so the user can close them out as they
 * read through the script.
 */
export function SceneRangeSelect({ sceneRange, allScenes, onChange }: {
  sceneRange: string; allScenes: Scene[]; onChange: (range: string) => void;
}) {
  const parts = sceneRange.split('-');
  const startScene = parts[0]?.trim() || '';
  // No fallback to startScene — empty end means the event is still open.
  const endScene = parts[1]?.trim() ?? '';

  const handleStart = (v: string) => onChange(`${v}-${endScene}`);
  const handleEnd = (v: string) => onChange(`${startScene}-${v}`);

  return (
    <div className="ce-scene-range">
      <div className="ce-scene-range-field">
        <label className="ce-scene-range-label">Start</label>
        <select className="ce-scene-range-select" value={startScene} onChange={(e) => handleStart(e.target.value)}>
          {allScenes.map((s) => <option key={s.id} value={String(s.number)}>Scene {s.number}</option>)}
        </select>
      </div>
      <span className="ce-scene-range-sep">—</span>
      <div className="ce-scene-range-field">
        <label className="ce-scene-range-label">End</label>
        <select className="ce-scene-range-select" value={endScene} onChange={(e) => handleEnd(e.target.value)}>
          <option value="">Open / decide later</option>
          {allScenes.map((s) => <option key={s.id} value={String(s.number)}>Scene {s.number}</option>)}
        </select>
      </div>
    </div>
  );
}
