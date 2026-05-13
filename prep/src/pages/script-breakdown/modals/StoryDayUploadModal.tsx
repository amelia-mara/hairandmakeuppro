import { useEffect, useRef, useState } from 'react';
import {
  parseStoryDayBreakdown,
  type StoryDayRow,
} from '@/utils/storyDayBreakdownParser';
import {
  useParsedScriptStore,
  useBreakdownStore,
  type Scene,
  type ParsedSceneData,
  type SceneBreakdown,
} from '@/stores/breakdownStore';

interface Props {
  projectId: string;
  onClose: () => void;
  onApplied: (summary: { updated: number; unmatched: number }) => void;
}

type Stage = 'pick' | 'parsing' | 'preview' | 'applying';

/** Joined preview row — pairs the parsed PDF row with the project's
 *  current scene snapshot so the user can spot misreads before apply. */
interface PreviewRow {
  parsed: StoryDayRow;
  /** Matched scene IDs in the project. One PDF row often expands to
   *  multiple scenes (range like 11-15), so this is plural. */
  matchedSceneIds: string[];
  /** Subset of `parsed.sceneNumbers` we couldn't find in the project. */
  missingNumbers: number[];
}

/**
 * Story Day Breakdown upload modal.
 *
 * Flow: drop a PDF → parse → preview table → apply.
 *
 * The PDF is the canonical departmental source: applying overwrites
 * `scene.storyDay`, `scene.timelineType`, and
 * `breakdown.timeline.note` for every matched scene. Synopsis is
 * intentionally NOT touched — the PDF's short department-level
 * description shouldn't clobber the user's scene-level notes.
 * Scenes not mentioned in the PDF are untouched.
 *
 * Triggered from ToolsMenu → "Upload Story Day Breakdown".
 */
export function StoryDayUploadModal({ projectId, onClose, onApplied }: Props) {
  const [stage, setStage] = useState<Stage>('pick');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [unmatchedRaw, setUnmatchedRaw] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stage !== 'parsing' && stage !== 'applying') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, stage]);

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.');
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const handleParse = async () => {
    if (!selectedFile) return;
    setStage('parsing');
    setError('');
    try {
      const { rows, unmatchedRaw: unmatched } = await parseStoryDayBreakdown(selectedFile);
      if (rows.length === 0) {
        setError(
          "Couldn't find any rows in this PDF. Check that it has a Story Day / Scene / Description / Timeline table at the top.",
        );
        setStage('pick');
        return;
      }
      // Join each parsed row against the current scenes list so the
      // preview can show which rows will apply and which scenes are
      // missing. Reads from the parsedScriptStore so we see the
      // most-recent local state (including manual inserts).
      const parsed = useParsedScriptStore.getState().getParsedData(projectId);
      const scenes = parsed?.scenes ?? [];
      const previews: PreviewRow[] = rows.map((r) => {
        const matchedSceneIds: string[] = [];
        const missingNumbers: number[] = [];
        for (let i = 0; i < r.sceneNumbers.length; i++) {
          const num = r.sceneNumbers[i];
          const suffix = r.sceneSuffixes[i];
          const match = findSceneMatch(scenes, num, suffix);
          if (match) matchedSceneIds.push(match.id);
          else missingNumbers.push(num);
        }
        return { parsed: r, matchedSceneIds, missingNumbers };
      });
      setPreviewRows(previews);
      setUnmatchedRaw(unmatched);
      setStage('preview');
    } catch (err) {
      console.error('[StoryDayUpload] parse failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to read PDF.');
      setStage('pick');
    }
  };

  const handleApply = () => {
    setStage('applying');
    const parsed = useParsedScriptStore.getState().getParsedData(projectId);
    if (!parsed) {
      setError('No script data loaded for this project.');
      setStage('preview');
      return;
    }

    // Build a sceneId → patch map so we mutate the scenes array in
    // one pass. The breakdown store is keyed by sceneId so order
    // doesn't matter once we know the matched IDs.
    const scenePatches = new Map<string, Partial<ParsedSceneData>>();
    const breakdownStore = useBreakdownStore.getState();

    let updated = 0;
    let unmatchedScenes = 0;

    for (const pr of previewRows) {
      for (const sid of pr.matchedSceneIds) {
        scenePatches.set(sid, {
          storyDay: pr.parsed.storyDay,
          timelineType: pr.parsed.timelineType,
        });
        // Synopsis is DELIBERATELY NOT touched. The PDF's Description
        // column is a per-day summary written by the script supervisor;
        // it's much shorter than the user's scene-level synopsis and
        // overwriting would clobber department-specific notes. The
        // PDF's description still surfaces in the preview table so the
        // user can sanity-check the match, but it stays out of the
        // scene record.

        // Timeline note + day live on the per-scene breakdown. If the
        // scene has no breakdown row yet, mint a minimal one so the
        // note has somewhere to land — saveBreakdown will sync it.
        // `dayConfirmed: true` flips the Day field from the muted
        // "suggested" style into the bold accent "confirmed" style so
        // the user can see at a glance which scenes have had their
        // story-day data applied from the canonical PDF.
        const bd = breakdownStore.getBreakdown(sid);
        const next: SceneBreakdown = bd
          ? {
              ...bd,
              timeline: {
                ...bd.timeline,
                day: pr.parsed.storyDay,
                dayConfirmed: true,
                note: pr.parsed.timeline,
                type: pr.parsed.timelineType ?? bd.timeline.type,
              },
            }
          : {
              sceneId: sid,
              timeline: {
                day: pr.parsed.storyDay,
                dayConfirmed: true,
                time: '',
                type: pr.parsed.timelineType ?? '',
                note: pr.parsed.timeline,
              },
              characters: [],
              continuityEvents: [],
            };
        breakdownStore.setBreakdown(sid, next);
        updated++;
      }
      unmatchedScenes += pr.missingNumbers.length;
    }

    // Apply scene patches in a single store update so consumers see
    // the change atomically (and only one autosave fires).
    const nextScenes = parsed.scenes.map((sc) => {
      const patch = scenePatches.get(sc.id);
      return patch ? { ...sc, ...patch } : sc;
    });
    useParsedScriptStore.getState().setParsedData(projectId, {
      ...parsed,
      scenes: nextScenes,
    });

    onApplied({ updated, unmatched: unmatchedScenes });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div
      className="modal-backdrop"
      onClick={stage !== 'parsing' && stage !== 'applying' ? onClose : undefined}
    >
      <div
        className="modal-glass"
        style={{ width: stage === 'preview' ? 760 : 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
            <span className="heading-italic">Upload</span>{' '}
            <span className="heading-regular">Story Day Breakdown</span>
          </h2>
          {stage !== 'parsing' && stage !== 'applying' && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div style={{ padding: '20px 28px 28px', overflowY: 'auto', flex: 1 }}>
          {(stage === 'pick' || stage === 'parsing') && (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 20px' }}>
                Upload the departmental Story Day Breakdown PDF. Story day and timeline will be applied to every matched scene. Synopsis is left untouched.
              </p>

              {stage === 'parsing' ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading PDF…</div>
                </div>
              ) : !selectedFile ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) handleFileSelect(f);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  style={{
                    width: '100%',
                    padding: '40px 30px',
                    textAlign: 'center',
                    border: `2px dashed ${dragOver ? 'var(--accent-gold, #D4943A)' : 'var(--border-subtle, rgba(255,255,255,0.08))'}`,
                    borderRadius: 12,
                    background: dragOver ? 'rgba(201, 169, 97, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                      <path d="M14 2v6h6" />
                      <path d="M12 18v-6" />
                      <path d="M9 15l3-3 3 3" />
                    </svg>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
                    Click to upload or drag and drop
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>PDF</div>
                </button>
              ) : (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: 'rgba(201, 169, 97, 0.08)',
                    border: '1px solid var(--accent-gold, #D4943A)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold, #D4943A)" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: 'var(--text-heading)',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selectedFile.name}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      {formatSize(selectedFile.size)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setError('');
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />

              {error && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.10)',
                    border: '1px solid rgba(239, 68, 68, 0.30)',
                    color: '#ef4444',
                    fontSize: '0.8125rem',
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}

          {stage === 'preview' && (
            <PreviewTable rows={previewRows} unmatchedRaw={unmatchedRaw} />
          )}

          {stage === 'applying' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Applying…</div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(stage === 'pick' || stage === 'preview') && (
          <div
            style={{
              padding: '16px 28px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
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
            {stage === 'pick' && (
              <button
                onClick={handleParse}
                disabled={!selectedFile}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  background: selectedFile ? 'var(--accent-gold, #D4943A)' : 'rgba(212, 148, 58, 0.30)',
                  border: 'none',
                  color: '#1a1410',
                  cursor: selectedFile ? 'pointer' : 'not-allowed',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                Parse
              </button>
            )}
            {stage === 'preview' && (
              <button
                onClick={handleApply}
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
                Apply
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Find the scene in the project that matches the parsed (number, suffix).
 *
 * Suffix-aware: `132A` prefers a scene with `numberSuffix === 'A'`
 * before falling back to plain `132`. Without this, manual inserts
 * (5A, 5B) would get overwritten by entries that actually target the
 * unsuffixed scene 5.
 */
function findSceneMatch(
  scenes: Scene[],
  num: number,
  suffix: string | undefined,
): Scene | undefined {
  if (suffix) {
    const exact = scenes.find((s) => s.number === num && s.numberSuffix === suffix);
    if (exact) return exact;
  }
  return scenes.find((s) => s.number === num && !s.numberSuffix);
}

interface PreviewTableProps {
  rows: PreviewRow[];
  unmatchedRaw: string[];
}

/** Compact preview of every parsed row. Rows whose scenes are all
 *  missing in the project get a warning row at the top with their
 *  raw Scene cell so the user can spot misreads or non-numeric ids
 *  (X1, X2, etc.) before applying. */
function PreviewTable({ rows, unmatchedRaw }: PreviewTableProps) {
  const totalRows = rows.length;
  const totalScenes = rows.reduce((acc, r) => acc + r.matchedSceneIds.length, 0);
  const totalMissing = rows.reduce((acc, r) => acc + r.missingNumbers.length, 0);

  return (
    <>
      <div
        style={{
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          marginBottom: 14,
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <strong style={{ color: 'var(--text-heading)' }}>{totalRows}</strong> rows parsed
        </span>
        <span>
          <strong style={{ color: 'var(--text-heading)' }}>{totalScenes}</strong> scenes will be updated
        </span>
        {totalMissing > 0 && (
          <span style={{ color: '#E8621A' }}>
            <strong>{totalMissing}</strong> scene numbers not found in this project
          </span>
        )}
      </div>

      {unmatchedRaw.length > 0 && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 6,
            background: 'rgba(232, 98, 26, 0.10)',
            border: '1px solid rgba(232, 98, 26, 0.30)',
            color: '#E8621A',
            fontSize: '0.8125rem',
            marginBottom: 14,
          }}
        >
          Skipped (non-numeric scene IDs): {unmatchedRaw.join(', ')}
        </div>
      )}

      <div style={{ overflow: 'auto', maxHeight: 420, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary, #1a1410)', zIndex: 1 }}>
              <th style={th}>Story Day</th>
              <th style={th}>Scene</th>
              <th style={th}>Match</th>
              <th style={th}>Description</th>
              <th style={th}>Timeline</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const matched = r.matchedSceneIds.length;
              const requested = r.parsed.sceneNumbers.length;
              const allMissing = requested > 0 && matched === 0;
              return (
                <tr
                  key={i}
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                    background: allMissing ? 'rgba(232, 98, 26, 0.06)' : 'transparent',
                  }}
                >
                  <td style={td}>{r.parsed.storyDay}</td>
                  <td style={td}>{r.parsed.sceneRaw}</td>
                  <td style={{ ...td, color: allMissing ? '#E8621A' : 'var(--text-muted)' }}>
                    {matched}/{requested || '—'}
                  </td>
                  <td style={{ ...td, maxWidth: 280 }}>
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                      title={r.parsed.description}
                    >
                      {r.parsed.description}
                    </div>
                  </td>
                  <td style={td}>{r.parsed.timeline}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontWeight: 600,
  fontSize: '0.6875rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const td: React.CSSProperties = {
  padding: '8px 10px',
  verticalAlign: 'top',
  color: 'var(--text-secondary)',
};
