import { useMemo, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Badge } from '@/components/ui/Badge';

export function SceneList() {
  const project = useProjectStore((s) => s.currentProject);
  const selectedSceneId = useUIStore((s) => s.selectedSceneId);
  const selectScene = useUIStore((s) => s.selectScene);
  const selectCharacter = useUIStore((s) => s.selectCharacter);
  const sceneSearch = useUIStore((s) => s.sceneSearch);
  const setSceneSearch = useUIStore((s) => s.setSceneSearch);

  const filteredScenes = useMemo(() => {
    if (!project) return [];
    if (!sceneSearch.trim()) return project.scenes;

    const query = sceneSearch.toLowerCase();
    return project.scenes.filter((scene) => {
      return (
        scene.heading.toLowerCase().includes(query) ||
        scene.location.toLowerCase().includes(query) ||
        String(scene.number).includes(query) ||
        scene.characters.some((c) => c.toLowerCase().includes(query))
      );
    });
  }, [project, sceneSearch]);

  // Keyboard navigation: up/down arrows to move between scenes
  const navigateScene = useCallback(
    (direction: 'up' | 'down') => {
      if (filteredScenes.length === 0) return;
      const currentIndex = filteredScenes.findIndex((s) => s.id === selectedSceneId);
      let nextIndex: number;
      if (direction === 'down') {
        nextIndex = currentIndex < filteredScenes.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredScenes.length - 1;
      }
      const nextScene = filteredScenes[nextIndex];
      selectScene(nextScene.id);
      if (nextScene.characters.length > 0) {
        selectCharacter(nextScene.characters[0]);
      }
    },
    [filteredScenes, selectedSceneId, selectScene, selectCharacter]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigateScene('down');
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigateScene('up');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateScene]);

  if (!project) return null;

  return (
    <div className="h-full flex flex-col bg-surface border-r border-white/10">
      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <svg className="w-4 h-4 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Search scenes..."
            value={sceneSearch}
            onChange={(e) => setSceneSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>

      {/* Scene List */}
      <div className="flex-1 overflow-y-auto">
        {filteredScenes.map((scene) => {
          const isSelected = scene.id === selectedSceneId;
          const breakdown = project.sceneBreakdowns[scene.id];
          const isComplete = breakdown?.isComplete;

          return (
            <button
              key={scene.id}
              onClick={() => {
                selectScene(scene.id);
                // Auto-select first character
                if (scene.characters.length > 0) {
                  selectCharacter(scene.characters[0]);
                }
              }}
              className={clsx(
                'w-full text-left px-3 py-2 border-b border-white/5 transition-colors',
                isSelected ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-white/5'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Completion indicator */}
                  <div
                    className={clsx(
                      'w-2 h-2 rounded-full shrink-0',
                      isComplete ? 'bg-green-400' : 'bg-white/20'
                    )}
                  />
                  <span className={clsx('text-xs font-mono', isSelected ? 'text-accent' : 'text-white/50')}>
                    {scene.number}
                  </span>
                  <span className="text-xs text-white/80 truncate">
                    {scene.location}
                  </span>
                </div>
                <Badge variant="muted">{scene.timeOfDay}</Badge>
              </div>

              {/* Character count */}
              {scene.characters.length > 0 && (
                <div className="mt-1 ml-6 text-xs text-white/30">
                  {scene.characters.length} character{scene.characters.length !== 1 ? 's' : ''}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="px-3 py-2 border-t border-white/10 text-xs text-white/40">
        {filteredScenes.length} of {project.scenes.length} scenes
        {sceneSearch && (
          <button onClick={() => setSceneSearch('')} className="ml-2 text-accent hover:underline">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
