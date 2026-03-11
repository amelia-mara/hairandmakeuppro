import { clsx } from 'clsx';
import type { Scene, SceneCapture } from '@/types';
import { Badge } from '../ui';
import { getSceneStatusIcon } from '@/utils/helpers';

interface SceneCardProps {
  scene: Scene;
  captures: Record<string, SceneCapture>;
  onClick: () => void;
}

/**
 * Get the border color class based on INT/EXT + DAY/NIGHT combination
 */
export function SceneCard({ scene, captures, onClick }: SceneCardProps) {
  const statusIcon = getSceneStatusIcon(scene, captures);
  const isDay = scene.timeOfDay === 'DAY' || scene.timeOfDay === 'MORNING';

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full bg-cream rounded-[10px] p-3.5 text-left touch-manipulation transition-all',
        'border border-cream-dark hover:shadow-card-hover active:scale-[0.99]',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Scene number */}
        <div className="flex-shrink-0 pt-0.5">
          <span className="text-sm font-bold text-[#5A3E28]">{scene.sceneNumber}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Slugline */}
          <div className="text-sm font-semibold text-[#2A1A08] truncate mb-1.5">
            {formatSlugline(scene.slugline)}
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2">
            <Badge variant={isDay ? 'day' : 'night'} size="sm">
              {scene.timeOfDay}
            </Badge>
            <span className="text-xs text-[#5A3E28]">{scene.intExt}</span>
          </div>
        </div>

        {/* Breakdown status dot */}
        <div className="flex-shrink-0 pt-1">
          <BreakdownDot status={statusIcon} />
        </div>
      </div>
    </button>
  );
}

// Format slugline to remove INT/EXT prefix and time of day suffix
function formatSlugline(slugline: string): string {
  // Remove INT. or EXT. prefix
  let formatted = slugline.replace(/^(INT\.|EXT\.)\s*/i, '');
  // Remove time of day suffix (- DAY, - NIGHT, etc.)
  formatted = formatted.replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS)\s*$/i, '');
  return formatted;
}

// Breakdown status dot: teal = complete, orange = incomplete/empty
interface BreakdownDotProps {
  status: 'empty' | 'incomplete' | 'complete';
}

function BreakdownDot({ status }: BreakdownDotProps) {
  if (status === 'complete') {
    return (
      <div className="w-3.5 h-3.5 rounded-full bg-teal" title="Breakdown complete" />
    );
  }

  // Incomplete or empty — orange dot
  return (
    <div className="w-3.5 h-3.5 rounded-full bg-gold" title="Breakdown incomplete" />
  );
}

// Compact scene card for list view
interface CompactSceneCardProps {
  scene: Scene;
  isActive: boolean;
  onClick: () => void;
}

export function CompactSceneCard({ scene, isActive, onClick }: CompactSceneCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg touch-manipulation transition-all',
        {
          'bg-gold text-white': isActive,
          'bg-cream-dark text-[#5A3E28] hover:bg-peach': !isActive,
        }
      )}
    >
      <span className="font-semibold text-sm">{scene.sceneNumber}</span>
      {scene.isComplete && (
        <div className={clsx('w-2.5 h-2.5 rounded-full', isActive ? 'bg-white' : 'bg-teal')} />
      )}
    </button>
  );
}
