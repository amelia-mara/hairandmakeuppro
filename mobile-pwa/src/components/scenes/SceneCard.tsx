import { clsx } from 'clsx';
import type { Scene, SceneCapture } from '@/types';
import { Badge } from '../ui';
import { getSceneStatusIcon } from '@/utils/helpers';

interface SceneCardProps {
  scene: Scene;
  captures: Record<string, SceneCapture>;
  onClick: () => void;
}

export function SceneCard({ scene, captures, onClick }: SceneCardProps) {
  const statusIcon = getSceneStatusIcon(scene, captures);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full card flex items-start gap-3 text-left touch-manipulation transition-shadow hover:shadow-card-hover active:scale-[0.99]"
    >
      {/* Scene number */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
        <span className="text-sm font-bold text-text-primary">{scene.sceneNumber}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Slugline */}
        <div className="text-sm font-medium text-text-primary truncate mb-1">
          {formatSlugline(scene.slugline)}
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2">
          <Badge variant={scene.intExt === 'INT' ? 'int' : 'ext'} size="sm">
            {scene.intExt}
          </Badge>
          <span className="text-xs text-text-muted">{scene.timeOfDay}</span>
        </div>
      </div>

      {/* Status icon */}
      <div className="flex-shrink-0">
        <StatusIcon status={statusIcon} />
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

// Status icon component
interface StatusIconProps {
  status: 'empty' | 'incomplete' | 'complete';
}

function StatusIcon({ status }: StatusIconProps) {
  if (status === 'complete') {
    return (
      <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (status === 'incomplete') {
    return (
      <div className="w-6 h-6 rounded-full bg-warning flex items-center justify-center">
        <span className="text-white font-bold text-sm">!</span>
      </div>
    );
  }

  // Empty/not started
  return (
    <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
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
          'bg-gray-100 text-text-secondary hover:bg-gray-200': !isActive,
        }
      )}
    >
      <span className="font-semibold text-sm">{scene.sceneNumber}</span>
      {scene.isComplete && (
        <svg className={clsx('w-4 h-4', isActive ? 'text-white' : 'text-success')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
