import type { ParsedScene, SceneBreakdown } from '../../types/breakdown';

interface SceneListItemProps {
  scene: ParsedScene;
  breakdown?: SceneBreakdown;
  characterCount: number;
  isSelected: boolean;
  onClick: () => void;
}

export default function SceneListItem({
  scene,
  breakdown,
  characterCount,
  isSelected,
  onClick,
}: SceneListItemProps) {
  const isComplete = breakdown?.isComplete ?? false;
  const hasData = breakdown
    ? Object.values(breakdown.characterBreakdowns).some(
        (cb) => cb.hairNotes || cb.makeupNotes || cb.generalNotes,
      )
    : false;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
        isSelected
          ? 'bg-gold/10 border border-gold/30'
          : 'hover:bg-[#1a1a1a] border border-transparent'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Scene number */}
        <span
          className={`text-lg font-semibold tabular-nums shrink-0 w-8 ${
            isSelected ? 'text-gold' : 'text-white'
          }`}
        >
          {scene.sceneNumber}
        </span>

        <div className="flex-1 min-w-0">
          {/* INT/EXT + Location */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                scene.intExt === 'EXT'
                  ? 'bg-blue-500/15 text-blue-400'
                  : scene.intExt === 'INT/EXT'
                    ? 'bg-purple-500/15 text-purple-400'
                    : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {scene.intExt}
            </span>
            <span className="text-neutral-400 text-xs truncate">{scene.location}</span>
          </div>

          {/* Time + Character count */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-neutral-600">{scene.timeOfDay}</span>
            {characterCount > 0 && (
              <span className="text-neutral-600">
                {characterCount} char{characterCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Completion dot */}
        <div className="mt-1.5 shrink-0">
          <div
            className={`w-2 h-2 rounded-full ${
              isComplete
                ? 'bg-emerald-500'
                : hasData
                  ? 'bg-amber-500'
                  : 'bg-neutral-700'
            }`}
          />
        </div>
      </div>
    </button>
  );
}
