import { useState } from 'react';
import { clsx } from 'clsx';
import { useProjectStore } from '@/stores/projectStore';
import type { SceneFilter } from '@/types';
import { Header } from '../navigation';
import { SceneCard } from './SceneCard';

interface SceneListProps {
  onSceneSelect: (sceneId: string) => void;
}

export function SceneList({ onSceneSelect }: SceneListProps) {
  const {
    currentProject,
    sceneFilter,
    setSceneFilter,
    searchQuery,
    setSearchQuery,
    getFilteredScenes,
    sceneCaptures,
  } = useProjectStore();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const filteredScenes = getFilteredScenes();

  const filters: { id: SceneFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'complete', label: 'Complete' },
    { id: 'incomplete', label: 'Incomplete' },
  ];

  const totalScenes = currentProject?.scenes.length ?? 0;
  const completeCount = currentProject?.scenes.filter(s => s.isComplete).length ?? 0;

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      <Header
        title={currentProject?.name ?? 'Project'}
        showDemo
        showSearch
        onSearch={() => setIsSearchOpen(!isSearchOpen)}
      />

      {/* Search bar */}
      {isSearchOpen && (
        <div className="bg-card border-b border-border px-4 py-3">
          <div className="mobile-container">
            <div className="relative">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scenes..."
                className="input-field w-full pl-10"
                autoFocus
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-placeholder"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="bg-card border-b border-border">
        <div className="mobile-container">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSceneFilter(filter.id)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-full transition-colors touch-manipulation',
                    {
                      'bg-gold text-white': sceneFilter === filter.id,
                      'bg-gray-100 text-text-secondary hover:bg-gray-200': sceneFilter !== filter.id,
                    }
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Scene count */}
            <div className="text-xs text-text-muted">
              {filteredScenes.length} of {totalScenes} scenes
              {completeCount > 0 && (
                <span className="text-success ml-1">({completeCount} done)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scene list */}
      <div className="mobile-container">
        <div className="p-4 space-y-3 pb-24">
          {filteredScenes.length === 0 ? (
            <EmptyState filter={sceneFilter} hasSearch={!!searchQuery} />
          ) : (
            filteredScenes.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                captures={sceneCaptures}
                onClick={() => onSceneSelect(scene.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  filter: SceneFilter;
  hasSearch: boolean;
}

function EmptyState({ filter, hasSearch }: EmptyStateProps) {
  let message = 'No scenes found';
  let subMessage = '';

  if (hasSearch) {
    message = 'No matching scenes';
    subMessage = 'Try adjusting your search terms';
  } else if (filter === 'complete') {
    message = 'No completed scenes';
    subMessage = 'Mark scenes as complete to see them here';
  } else if (filter === 'incomplete') {
    message = 'All scenes completed!';
    subMessage = 'Great work!';
  }

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">{message}</h3>
      {subMessage && (
        <p className="text-sm text-text-muted">{subMessage}</p>
      )}
    </div>
  );
}
