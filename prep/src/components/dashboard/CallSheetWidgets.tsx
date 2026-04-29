import { useActiveCallSheet } from '@/hooks/useActiveCallSheet';
import type { CastCall, CallSheetScene } from '@/utils/callSheet/types';

/* ━━━ Today's Cast ━━━ */

export function TodaysCastWidget({ projectId }: { projectId: string }) {
  const cs = useActiveCallSheet(projectId);
  if (!cs) return <EmptyWidget message="Upload a call sheet to populate today's cast." />;

  const cast = cs.castCalls ?? [];
  if (cast.length === 0) {
    return <EmptyWidget message="The latest call sheet didn't include cast call times." />;
  }

  return (
    <div className="dash-widget-stack">
      <CallSheetHeader title={`Day ${cs.productionDay}`} sub={cs.date} />
      <div className="dash-cast-list">
        {cast.map((c) => (
          <CastRow key={c.id || c.name} cast={c} />
        ))}
      </div>
    </div>
  );
}

function CastRow({ cast }: { cast: CastCall }) {
  const display = cast.character || cast.name || `#${cast.id}`;
  return (
    <div className="dash-cast-row">
      <div className="dash-cast-id">{cast.id || '—'}</div>
      <div className="dash-cast-name-block">
        <div className="dash-cast-name">{display}</div>
        {cast.character && cast.name && cast.character !== cast.name && (
          <div className="dash-cast-actor">{cast.name}</div>
        )}
      </div>
      <div className="dash-cast-times">
        {cast.callTime && <Time label="Call" value={cast.callTime} />}
        {cast.hmuCall && <Time label="HMU" value={cast.hmuCall} accent />}
        {cast.costumeCall && <Time label="Cost" value={cast.costumeCall} />}
        {cast.onSetTime && <Time label="On set" value={cast.onSetTime} />}
      </div>
    </div>
  );
}

/* ━━━ H&MU Requirements ━━━ */

export function HMURequirementsWidget({ projectId }: { projectId: string }) {
  const cs = useActiveCallSheet(projectId);
  if (!cs) return <EmptyWidget message="Upload a call sheet to see H&MU requirements." />;

  // Pull HMU/SFX-flavoured notes off each scene. A scene with no notes
  // and no cast still appears (so the producer sees order) but in muted
  // form.
  const scenes = cs.scenes;
  if (scenes.length === 0) {
    return <EmptyWidget message="The latest call sheet didn't include scene rows." />;
  }

  return (
    <div className="dash-widget-stack">
      <CallSheetHeader title={`Day ${cs.productionDay}`} sub={cs.date} />
      <div className="dash-scene-list">
        {scenes.map((s) => (
          <SceneRow key={`${s.shootOrder}-${s.sceneNumber}`} scene={s} />
        ))}
      </div>
    </div>
  );
}

function SceneRow({ scene }: { scene: CallSheetScene }) {
  const hmu = pickNote(scene.notes, /HMU/i);
  const sfx = pickNote(scene.notes, /SFX|VFX|STUNT/i);
  const hasCallouts = Boolean(hmu || sfx);

  return (
    <div className="dash-scene-row">
      <div className="dash-scene-meta">
        <span className="dash-scene-num">#{scene.sceneNumber}</span>
        <span className="dash-scene-dn">{scene.dayNight}</span>
        {scene.pages && <span className="dash-scene-pages">{scene.pages}</span>}
        {scene.estimatedTime && <span className="dash-scene-time">{scene.estimatedTime}</span>}
      </div>
      {scene.setDescription && (
        <div className="dash-scene-set" title={scene.setDescription}>
          {scene.setDescription}
        </div>
      )}
      {scene.cast && scene.cast.length > 0 && (
        <div className="dash-scene-cast">
          {scene.cast.map((id) => (
            <span key={id} className="dash-scene-cast-pill">{id}</span>
          ))}
        </div>
      )}
      {hasCallouts && (
        <div className="dash-scene-callouts">
          {hmu && <Callout label="HMU" value={hmu} accent />}
          {sfx && <Callout label="SFX" value={sfx} />}
        </div>
      )}
    </div>
  );
}

function pickNote(notes: string | undefined, re: RegExp): string | undefined {
  if (!notes) return undefined;
  const segs = notes.split(/[,/]+|\s+(?=HMU|SFX|VFX|STUNT)/);
  for (const seg of segs) {
    if (re.test(seg)) return seg.trim();
  }
  return undefined;
}

/* ━━━ Shared bits ━━━ */

function CallSheetHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="dash-widget-header">
      <span className="dash-widget-title">{title}</span>
      <span className="dash-widget-sub">{formatDate(sub)}</span>
    </div>
  );
}

function Time({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className={`dash-cast-time ${accent ? 'is-accent' : ''}`}>
      <span className="dash-cast-time-label">{label}</span>
      <span className="dash-cast-time-value">{value}</span>
    </span>
  );
}

function Callout({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className={`dash-callout ${accent ? 'is-accent' : ''}`}>
      <span className="dash-callout-label">{label}</span>
      <span className="dash-callout-value">{value}</span>
    </span>
  );
}

function EmptyWidget({ message }: { message: string }) {
  return <div className="dash-widget-empty">{message}</div>;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
