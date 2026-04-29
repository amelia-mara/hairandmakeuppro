import { useActiveCallSheet } from '@/hooks/useActiveCallSheet';
import {
  useProjectBreakdownContext,
  canonicalSceneNumber,
  type BreakdownContext,
} from '@/hooks/useProjectBreakdownContext';
import type { CastCall, CallSheetScene } from '@/utils/callSheet/types';
import type { CharacterBreakdown, ParsedSceneData } from '@/stores/breakdownStore';

/* ━━━ Today's Cast ━━━ */

export function TodaysCastWidget({ projectId }: { projectId: string }) {
  const cs = useActiveCallSheet(projectId);
  const ctx = useProjectBreakdownContext(projectId);
  if (!cs) return <EmptyWidget message="Upload a call sheet to populate today's cast." />;

  const cast = cs.castCalls ?? [];
  if (cast.length === 0) {
    return <EmptyWidget message="The latest call sheet didn't include cast call times." />;
  }

  // Pre-compute the scene IDs the call sheet covers, so we can look up
  // each cast member's looks & breakdown details across just today's
  // shoot (not the whole script).
  const todayScriptScenes = cs.scenes
    .map((s) => ctx.scenesByNumber.get(canonicalSceneNumber(s.sceneNumber)))
    .filter((s): s is ParsedSceneData => Boolean(s));

  return (
    <div className="dash-widget-stack">
      <CallSheetHeader title={`Day ${cs.productionDay}`} sub={cs.date} />
      <div className="dash-cast-list">
        {cast.map((c) => (
          <CastRow
            key={c.id || c.name}
            cast={c}
            ctx={ctx}
            todayScriptScenes={todayScriptScenes}
          />
        ))}
      </div>
    </div>
  );
}

function CastRow({
  cast,
  ctx,
  todayScriptScenes,
}: {
  cast: CastCall;
  ctx: BreakdownContext;
  todayScriptScenes: ParsedSceneData[];
}) {
  const display = cast.character || cast.name || `#${cast.id}`;

  // Find the parsed-script character that matches this call sheet row,
  // preferring an actorNumber lookup but falling back to a name compare.
  const scriptChar = matchCharacter(cast, ctx);

  // Looks the actor needs across today's scenes — gathered by walking
  // the breakdown for each script scene and pulling the lookId for this
  // character. De-dupe so a character with the same look in 6 scenes
  // shows the look once.
  const looks = scriptChar
    ? collectTodaysLooks(scriptChar.id, todayScriptScenes, ctx)
    : [];

  return (
    <div className="dash-cast-row">
      <div className="dash-cast-id">{cast.id || '—'}</div>
      <div className="dash-cast-name-block">
        <div className="dash-cast-name">{display}</div>
        {cast.character && cast.name && cast.character !== cast.name && (
          <div className="dash-cast-actor">{cast.name}</div>
        )}
        {looks.length > 0 && (
          <div className="dash-cast-looks">
            {looks.map((l) => (
              <span key={l.id} className="dash-cast-look-pill" title={l.description}>
                {l.name}
              </span>
            ))}
          </div>
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

function matchCharacter(cast: CastCall, ctx: BreakdownContext) {
  if (cast.character) {
    const byName = ctx.charactersByName.get(cast.character.trim().toUpperCase());
    if (byName) return byName;
  }
  if (cast.name) {
    const byName = ctx.charactersByName.get(cast.name.trim().toUpperCase());
    if (byName) return byName;
  }
  return undefined;
}

function collectTodaysLooks(
  characterId: string,
  scenes: ParsedSceneData[],
  ctx: BreakdownContext,
) {
  const seen = new Set<string>();
  const out: { id: string; name: string; description: string }[] = [];
  for (const sc of scenes) {
    const bd = ctx.breakdownsByScene[sc.id];
    if (!bd) continue;
    const charBd = bd.characters.find((c) => c.characterId === characterId);
    if (!charBd?.lookId) continue;
    const look = ctx.looksById.get(charBd.lookId);
    if (!look || seen.has(look.id)) continue;
    seen.add(look.id);
    out.push({ id: look.id, name: look.name, description: look.description });
  }
  return out;
}

/* ━━━ H&MU Requirements ━━━ */

export function HMURequirementsWidget({ projectId }: { projectId: string }) {
  const cs = useActiveCallSheet(projectId);
  const ctx = useProjectBreakdownContext(projectId);
  if (!cs) return <EmptyWidget message="Upload a call sheet to see H&MU requirements." />;

  const scenes = cs.scenes;
  if (scenes.length === 0) {
    return <EmptyWidget message="The latest call sheet didn't include scene rows." />;
  }

  return (
    <div className="dash-widget-stack">
      <CallSheetHeader title={`Day ${cs.productionDay}`} sub={cs.date} />
      <div className="dash-scene-list">
        {scenes.map((s) => (
          <SceneRow key={`${s.shootOrder}-${s.sceneNumber}`} scene={s} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

function SceneRow({ scene, ctx }: { scene: CallSheetScene; ctx: BreakdownContext }) {
  // Cross-reference the call sheet scene number with the script + breakdown
  // so the row can show entersWith hair / makeup / wardrobe per character,
  // SFX, environmental notes — not just the call sheet's notes column.
  const scriptScene = ctx.scenesByNumber.get(canonicalSceneNumber(scene.sceneNumber));
  const breakdown = scriptScene ? ctx.breakdownsByScene[scriptScene.id] : undefined;

  // Scene-level notes from the breakdown (sfx / environmental etc) —
  // independent of who's in the scene.
  const sceneSfx = collectFromCharacters(breakdown, 'sfx');
  const sceneEnv = collectFromCharacters(breakdown, 'environmental');

  // Fall back to the call sheet's notes column when the breakdown is
  // empty (no breakdown data for this scene yet).
  const hmuFromSheet = pickNote(scene.notes, /HMU/i);
  const sfxFromSheet = pickNote(scene.notes, /SFX|VFX|STUNT/i);

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
      {scriptScene?.synopsis && (
        <div className="dash-scene-synopsis">{scriptScene.synopsis}</div>
      )}

      {/* Per-character HMU breakdown rows pulled from the breakdown store. */}
      {breakdown && breakdown.characters.length > 0 && (
        <div className="dash-scene-bd">
          {breakdown.characters.map((cb) => (
            <CharacterBdRow key={cb.characterId} cb={cb} ctx={ctx} />
          ))}
        </div>
      )}

      {/* Cast pills row when no breakdown is hooked up yet. */}
      {!breakdown && scene.cast && scene.cast.length > 0 && (
        <div className="dash-scene-cast">
          {scene.cast.map((id) => (
            <span key={id} className="dash-scene-cast-pill">{id}</span>
          ))}
        </div>
      )}

      {/* Scene-wide call-outs — prefer breakdown data; fall back to the
          call sheet's notes column when breakdown is empty. */}
      {(sceneSfx || sceneEnv || hmuFromSheet || sfxFromSheet) && (
        <div className="dash-scene-callouts">
          {sceneSfx && <Callout label="SFX" value={sceneSfx} />}
          {sceneEnv && <Callout label="Env" value={sceneEnv} />}
          {!breakdown && hmuFromSheet && <Callout label="HMU" value={hmuFromSheet} accent />}
          {!breakdown && sfxFromSheet && !sceneSfx && <Callout label="SFX" value={sfxFromSheet} />}
        </div>
      )}
    </div>
  );
}

function CharacterBdRow({
  cb,
  ctx,
}: {
  cb: CharacterBreakdown;
  ctx: BreakdownContext;
}) {
  const ch = ctx.charactersById.get(cb.characterId);
  const look = cb.lookId ? ctx.looksById.get(cb.lookId) : undefined;
  const enters = cb.entersWith;
  const fields: Array<[string, string]> = [];
  if (enters.hair) fields.push(['Hair', enters.hair]);
  if (enters.makeup) fields.push(['MU', enters.makeup]);
  if (enters.wardrobe) fields.push(['Wdr', enters.wardrobe]);
  if (cb.sfx) fields.push(['SFX', cb.sfx]);

  return (
    <div className="dash-scene-bd-row">
      <div className="dash-scene-bd-name">
        {ch?.name ?? '—'}
        {look && <span className="dash-scene-bd-look">· {look.name}</span>}
      </div>
      {fields.length > 0 && (
        <div className="dash-scene-bd-fields">
          {fields.map(([label, value]) => (
            <span key={label} className="dash-scene-bd-field" title={value}>
              <span className="dash-scene-bd-field-label">{label}</span>
              <span className="dash-scene-bd-field-value">{value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function collectFromCharacters(
  bd: ReturnType<BreakdownContext['breakdownsByScene'][string]> | undefined,
  field: 'sfx' | 'environmental',
): string | undefined {
  if (!bd) return undefined;
  const values = bd.characters
    .map((c) => c[field])
    .filter((v): v is string => Boolean(v && v.trim()));
  if (!values.length) return undefined;
  return Array.from(new Set(values)).join(', ');
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
