import { useState, useRef, useCallback } from 'react';
import { useScheduleStore, type ProductionSchedule, type ScheduleVersion } from '@/stores/scheduleStore';
import { parseSchedulePDF } from '@/utils/scheduleParser';

interface ScheduleProps {
  projectId: string;
}

type Tab = 'overview' | 'pdf' | 'versions';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCHEDULE PAGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function Schedule({ projectId }: ScheduleProps) {
  const store = useScheduleStore(projectId);
  const current = store((s) => s.current);
  const versions = store((s) => s.versions);
  const isUploading = store((s) => s.isUploading);
  const upload = store((s) => s.upload);

  const [tab, setTab] = useState<Tab>('overview');
  const [uploading, setUploading] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ScheduleVersion | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Handle PDF upload ── */
  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') return;
      setUploading(true);
      try {
        const result = await parseSchedulePDF(file);
        upload(result.schedule);
        setTab('overview');
      } catch (err) {
        console.error('Failed to parse schedule:', err);
      } finally {
        setUploading(false);
      }
    },
    [upload],
  );

  /* ── Which schedule to display in the version viewer ── */
  const displaySchedule = viewingVersion ? viewingVersion.schedule : current;

  /* ── No schedule uploaded yet — show upload area ── */
  if (!current && !uploading) {
    return (
      <div className="sch-page">
        <div className="sch-header">
          <h1 className="sch-title">
            <span className="sch-title-italic">Production</span>{' '}
            <span className="sch-title-regular">Schedule</span>
          </h1>
          <p className="sch-subtitle">Upload your production schedule PDF to get started</p>
        </div>
        <UploadZone
          fileRef={fileRef}
          uploading={uploading}
          onFile={handleFile}
        />
      </div>
    );
  }

  /* ── Loading state ── */
  if (uploading || isUploading) {
    return (
      <div className="sch-page">
        <div className="sch-loading">
          <div className="sch-spinner" />
          <span>Parsing schedule...</span>
        </div>
      </div>
    );
  }

  /* ── Schedule loaded — tabbed view ── */
  return (
    <div className="sch-page">
      {/* Header */}
      <div className="sch-header">
        <div className="sch-header-top">
          <div>
            <h1 className="sch-title">
              <span className="sch-title-italic">Production</span>{' '}
              <span className="sch-title-regular">Schedule</span>
            </h1>
            {current?.productionName && (
              <p className="sch-production-name">{current.productionName}</p>
            )}
          </div>
          <button
            className="sch-reupload-btn"
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon />
            Upload New Version
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </div>

        {/* Tabs */}
        <div className="sch-tabs">
          <button
            className={`sch-tab ${tab === 'overview' ? 'sch-tab--active' : ''}`}
            onClick={() => { setTab('overview'); setViewingVersion(null); }}
          >
            Overview
          </button>
          <button
            className={`sch-tab ${tab === 'pdf' ? 'sch-tab--active' : ''}`}
            onClick={() => { setTab('pdf'); setViewingVersion(null); }}
          >
            Full PDF
          </button>
          <button
            className={`sch-tab ${tab === 'versions' ? 'sch-tab--active' : ''}`}
            onClick={() => setTab('versions')}
          >
            Versions
            {versions.length > 0 && (
              <span className="sch-tab-badge">{versions.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && displaySchedule && (
        <OverviewTab schedule={displaySchedule} />
      )}
      {tab === 'pdf' && displaySchedule?.pdfUri && (
        <PdfTab pdfUri={displaySchedule.pdfUri} />
      )}
      {tab === 'versions' && (
        <VersionsTab
          current={current!}
          versions={versions}
          viewingVersion={viewingVersion}
          onView={(v) => { setViewingVersion(v); setTab('pdf'); }}
          onRestore={(v) => {
            upload(v.schedule);
            setViewingVersion(null);
            setTab('overview');
          }}
        />
      )}
    </div>
  );
}

/* ━━━ Upload Zone ━━━ */

function UploadZone({
  fileRef,
  uploading,
  onFile,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onFile: (f: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`sch-upload-zone ${dragOver ? 'sch-upload-zone--active' : ''}`}
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      {uploading ? (
        <>
          <div className="sch-spinner" />
          <span className="sch-upload-label">Parsing schedule...</span>
        </>
      ) : (
        <>
          <div className="sch-upload-icon-wrap">
            <UploadIcon />
          </div>
          <span className="sch-upload-label">Drop your schedule PDF here</span>
          <span className="sch-upload-hint">or click to browse</span>
        </>
      )}
    </div>
  );
}

/* ━━━ Overview Tab — Parsed schedule quick view ━━━ */

function OverviewTab({ schedule }: { schedule: ProductionSchedule }) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // Cast number → display name lookup so we can show e.g. [BRY],
  // [TOM] pills under each scene instead of the raw cast numbers
  // the parser stores.
  const castNameByNumber = new Map<number, string>();
  for (const c of schedule.castList) {
    castNameByNumber.set(c.number, c.character || c.name);
  }

  return (
    <div className="sch-overview">
      {/* Stats row */}
      <div className="sch-stats">
        <div className="sch-stat">
          <span className="sch-stat-value">{schedule.totalDays}</span>
          <span className="sch-stat-label">Shooting Days</span>
        </div>
        <div className="sch-stat">
          <span className="sch-stat-value">{schedule.castList.length}</span>
          <span className="sch-stat-label">Cast Members</span>
        </div>
        {schedule.days.length > 0 && (
          <div className="sch-stat">
            <span className="sch-stat-value">
              {schedule.days.reduce((sum, d) => sum + d.scenes.length, 0)}
            </span>
            <span className="sch-stat-label">Total Scenes</span>
          </div>
        )}
        {schedule.scriptVersion && (
          <div className="sch-stat">
            <span className="sch-stat-value sch-stat-value--text">{schedule.scriptVersion}</span>
            <span className="sch-stat-label">Script Version</span>
          </div>
        )}
      </div>

      {/* Cast list */}
      {schedule.castList.length > 0 && (
        <div className="sch-section">
          <h2 className="sch-section-title">Cast List</h2>
          <div className="sch-cast-grid">
            {schedule.castList.map((c) => (
              <div key={c.number} className="sch-cast-card">
                <span className="sch-cast-num">{c.number}</span>
                <span className="sch-cast-name">{c.character || c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day breakdown (if Stage 2 has been processed) */}
      {schedule.days.length > 0 && (
        <div className="sch-section">
          <h2 className="sch-section-title">Day Breakdown</h2>
          <div className="sch-days">
            {schedule.days.map((day) => (
              <div key={day.dayNumber} className="sch-day-card">
                <button
                  className="sch-day-header"
                  onClick={() =>
                    setExpandedDay(expandedDay === day.dayNumber ? null : day.dayNumber)
                  }
                >
                  <div className="sch-day-left">
                    <span className="sch-day-num">Day {day.dayNumber}</span>
                    {day.date && <span className="sch-day-date">{formatDate(day.date)}</span>}
                  </div>
                  <div className="sch-day-right">
                    <span className="sch-day-meta">{day.location}</span>
                    <span className="sch-day-scenes">
                      {day.scenes.length} scene{day.scenes.length !== 1 ? 's' : ''}
                    </span>
                    <ChevronIcon expanded={expandedDay === day.dayNumber} />
                  </div>
                </button>

                {expandedDay === day.dayNumber && (
                  <div className="sch-day-body">
                    {day.hours && (
                      <div className="sch-day-info">
                        <span className="sch-day-info-label">Hours</span>
                        <span>{day.hours}</span>
                      </div>
                    )}
                    {day.notes && day.notes.length > 0 && (
                      <div className="sch-day-info">
                        <span className="sch-day-info-label">Notes</span>
                        <span>{day.notes.join(', ')}</span>
                      </div>
                    )}
                    <div className="sch-scene-list">
                      {day.scenes.map((scene, idx) => (
                        <div key={idx} className="sch-scene-row">
                          <div className="sch-scene-row-main">
                            <span className="sch-scene-num">{scene.sceneNumber}</span>
                            <span className={`sch-scene-badge sch-scene-badge--${scene.intExt.toLowerCase()}`}>
                              {scene.intExt}
                            </span>
                            <span className="sch-scene-loc">{scene.setLocation}</span>
                            <span className="sch-scene-dn">{scene.dayNight}</span>
                            {scene.pages && <span className="sch-scene-pages">{scene.pages} pgs</span>}
                          </div>
                          {scene.castNumbers.length > 0 && (
                            <div className="sch-scene-cast">
                              {scene.castNumbers.map((n) => (
                                <span key={n} className="sch-scene-cast-pill" title={`Cast ${n}`}>
                                  {castNameByNumber.get(n) || `Cast ${n}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw text preview when no day breakdown available */}
      {schedule.days.length === 0 && schedule.rawText && (
        <div className="sch-section">
          <h2 className="sch-section-title">Extracted Text</h2>
          <p className="sch-section-hint">
            The schedule has been parsed for cast data. Full day-by-day breakdown can be added with AI processing.
          </p>
          <pre className="sch-raw-text">{schedule.rawText.slice(0, 5000)}</pre>
        </div>
      )}
    </div>
  );
}

/* ━━━ PDF Tab — Full embedded PDF viewer ━━━ */

function PdfTab({ pdfUri }: { pdfUri: string }) {
  return (
    <div className="sch-pdf-wrap">
      <iframe className="sch-pdf-iframe" src={pdfUri} title="Production Schedule PDF" />
    </div>
  );
}

/* ━━━ Versions Tab ━━━ */

function VersionsTab({
  current,
  versions,
  viewingVersion,
  onView,
  onRestore,
}: {
  current: ProductionSchedule;
  versions: ScheduleVersion[];
  viewingVersion: ScheduleVersion | null;
  onView: (v: ScheduleVersion) => void;
  onRestore: (v: ScheduleVersion) => void;
}) {
  return (
    <div className="sch-versions">
      {/* Current version */}
      <div className="sch-version-card sch-version-card--current">
        <div className="sch-version-badge">Current</div>
        <div className="sch-version-info">
          <span className="sch-version-name">{current.productionName || 'Production Schedule'}</span>
          <span className="sch-version-date">
            Uploaded {formatDateTime(current.uploadedAt)}
          </span>
          <span className="sch-version-meta">
            {current.totalDays} days · {current.castList.length} cast
          </span>
        </div>
      </div>

      {/* Previous versions */}
      {versions.length === 0 ? (
        <div className="sch-versions-empty">
          <p>No previous versions</p>
          <p className="sch-versions-empty-hint">
            When you upload a new schedule, the previous version will be saved here
          </p>
        </div>
      ) : (
        <div className="sch-version-list">
          <h3 className="sch-section-title">Previous Versions</h3>
          {versions.map((v) => (
            <div
              key={v.id}
              className={`sch-version-card ${viewingVersion?.id === v.id ? 'sch-version-card--viewing' : ''}`}
            >
              <div className="sch-version-info">
                <span className="sch-version-name">{v.label}</span>
                <span className="sch-version-date">
                  Uploaded {formatDateTime(v.uploadedAt)}
                </span>
                <span className="sch-version-meta">
                  {v.schedule.totalDays} days · {v.schedule.castList.length} cast
                </span>
              </div>
              <div className="sch-version-actions">
                {v.schedule.pdfUri && (
                  <button className="sch-version-btn" onClick={() => onView(v)}>
                    View PDF
                  </button>
                )}
                <button className="sch-version-btn sch-version-btn--restore" onClick={() => onRestore(v)}>
                  Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ━━━ Helpers ━━━ */

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* ━━━ Icons ━━━ */

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}
