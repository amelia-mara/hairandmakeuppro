import { useMemo } from 'react';
import clsx from 'clsx';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

export function CharacterTabs() {
  const project = useProjectStore((s) => s.currentProject);
  const selectedSceneId = useUIStore((s) => s.selectedSceneId);
  const activeCenterTab = useUIStore((s) => s.activeCenterTab);
  const characterTabs = useUIStore((s) => s.characterTabs);
  const setActiveCenterTab = useUIStore((s) => s.setActiveCenterTab);
  const openCharacterTab = useUIStore((s) => s.openCharacterTab);
  const closeCharacterTab = useUIStore((s) => s.closeCharacterTab);

  const selectedScene = useMemo(() => {
    if (!project || !selectedSceneId) return null;
    return project.scenes.find((s) => s.id === selectedSceneId) || null;
  }, [project, selectedSceneId]);

  return (
    <div className="flex items-center border-b border-white/10 bg-surface/50 overflow-x-auto">
      {/* Script tab (always visible) */}
      <button
        onClick={() => setActiveCenterTab('script')}
        className={clsx(
          'px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
          activeCenterTab === 'script'
            ? 'border-accent text-accent'
            : 'border-transparent text-white/50 hover:text-white/70'
        )}
      >
        Script
      </button>

      {/* Character tabs from current scene */}
      {selectedScene?.characters.map((charName) => {
        const isOpen = characterTabs.includes(charName);
        const isActive = activeCenterTab === charName;

        return (
          <button
            key={charName}
            onClick={() => openCharacterTab(charName)}
            className={clsx(
              'group px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1',
              isActive
                ? 'border-accent text-accent'
                : isOpen
                  ? 'border-white/20 text-white/70 hover:text-white'
                  : 'border-transparent text-white/40 hover:text-white/60'
            )}
          >
            {charName}
            {isOpen && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeCharacterTab(charName);
                }}
                className="ml-1 text-white/30 hover:text-white/70 text-[10px]"
              >
                &times;
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
