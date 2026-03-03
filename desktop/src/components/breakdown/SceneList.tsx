import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input, Badge } from '@/components/ui';
import { truncate, getCompletionStatus } from '@/utils/helpers';
import type { Scene, SceneBreakdown } from '@/types';

interface SceneListProps {
  scenes: Scene[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  breakdowns: Record<string, SceneBreakdown>;
}

const completionIcons: Record<'empty' | 'partial' | 'complete', string> = {
  empty: '\u25CB',    // ○ outline circle
  partial: '\u25D0',  // ◐ half-filled circle
  complete: '\u25CF', // ● filled circle
};

const completionColors: Record<'empty' | 'partial' | 'complete', string> = {
  empty: 'text-text-muted',
  partial: 'text-warning',
  complete: 'text-success',
};

export function SceneList({
  scenes,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  breakdowns,
}: SceneListProps) {
  const filteredScenes = useMemo(() => {
    if (!search.trim()) return scenes;

    const query = search.toLowerCase().trim();
    return scenes.filter((scene) => {
      // Match scene number
      if (String(scene.number).includes(query)) return true;
      // Match location
      if (scene.location.toLowerCase().includes(query)) return true;
      // Match character IDs (names would require character lookup, but match on IDs)
      if (scene.heading.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [scenes, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-3 border-b border-border-subtle">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search scenes..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto">
        {filteredScenes.length === 0 && (
          <div className="px-4 py-8 text-center text-text-muted text-sm">
            No scenes found.
          </div>
        )}

        {filteredScenes.map((scene) => {
          const isSelected = scene.id === selectedId;
          const status = getCompletionStatus(breakdowns, scene.id);

          return (
            <button
              key={scene.id}
              onClick={() => onSelect(scene.id)}
              className={`w-full text-left px-4 py-3 border-l-2 transition-colors-fast hover:bg-surface-hover
                ${isSelected
                  ? 'border-l-gold bg-gold-muted'
                  : 'border-l-transparent'
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-text-primary">
                  Sc. {scene.number}
                </span>
                <Badge variant={scene.intExt === 'INT' ? 'int' : scene.intExt === 'EXT' ? 'ext' : 'int'}>
                  {scene.intExt}
                </Badge>
                <Badge variant={scene.timeOfDay.toLowerCase() === 'night' ? 'night' : 'day'}>
                  {scene.timeOfDay}
                </Badge>
                <span className={`ml-auto text-base ${completionColors[status]}`}>
                  {completionIcons[status]}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-snug">
                {truncate(scene.location, 40)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
