import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import type { Scene, Character, BreakdownViewMode, BreakdownFilters } from '@/types';
import { clsx } from 'clsx';

interface BreakdownProps {
  onSceneSelect: (sceneId: string) => void;
}

export function Breakdown({ onSceneSelect }: BreakdownProps) {
  const { currentProject, sceneCaptures } = useProjectStore();
  const [viewMode, setViewMode] = useState<BreakdownViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BreakdownFilters>({
    characters: [],
    shootingDay: null,
    location: null,
    completionStatus: 'all',
    lookId: null,
  });
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);

  // Get unique locations from scenes
  const locations = useMemo(() => {
    if (!currentProject) return [];
    const locs = new Set<string>();
    currentProject.scenes.forEach(scene => {
      // Extract location from slugline (e.g., "INT. COFFEE SHOP - DAY" → "COFFEE SHOP")
      const match = scene.slugline.match(/^(?:INT|EXT)\.\s*(.+?)\s*-/);
      if (match) locs.add(match[1].trim());
    });
    return Array.from(locs).sort();
  }, [currentProject]);

  // Filter scenes
  const filteredScenes = useMemo(() => {
    if (!currentProject) return [];

    let scenes = [...currentProject.scenes];

    // Filter by character
    if (filters.characters.length > 0) {
      scenes = scenes.filter(scene =>
        filters.characters.some(charId => scene.characters.includes(charId))
      );
    }

    // Filter by completion status
    if (filters.completionStatus === 'complete') {
      scenes = scenes.filter(scene => scene.isComplete);
    } else if (filters.completionStatus === 'incomplete') {
      scenes = scenes.filter(scene => !scene.isComplete);
    }

    // Filter by location
    if (filters.location) {
      scenes = scenes.filter(scene =>
        scene.slugline.toLowerCase().includes(filters.location!.toLowerCase())
      );
    }

    // Filter by look
    if (filters.lookId) {
      const look = currentProject.looks.find(l => l.id === filters.lookId);
      if (look) {
        scenes = scenes.filter(scene => look.scenes.includes(scene.sceneNumber));
      }
    }

    return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
  }, [currentProject, filters]);

  // Get scene completion progress
  const getSceneProgress = (scene: Scene) => {
    if (!currentProject) return { captured: 0, total: 0 };
    const total = scene.characters.length;
    let captured = 0;

    scene.characters.forEach(charId => {
      const captureKey = `${scene.id}-${charId}`;
      const capture = sceneCaptures[captureKey];
      if (capture && Object.keys(capture.photos).length > 0) {
        captured++;
      }
    });

    return { captured, total };
  };

  // Get characters for a scene
  const getCharactersForScene = (scene: Scene): Character[] => {
    if (!currentProject) return [];
    return scene.characters
      .map(charId => currentProject.characters.find(c => c.id === charId))
      .filter((c): c is Character => c !== undefined);
  };

  // Get look for character in scene
  const getLookForCharacter = (characterId: string, sceneNumber: number) => {
    return currentProject?.looks.find(
      l => l.characterId === characterId && l.scenes.includes(sceneNumber)
    );
  };

  // Get capture for character in scene
  const getCapture = (sceneId: string, characterId: string) => {
    return sceneCaptures[`${sceneId}-${characterId}`];
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      characters: [],
      shootingDay: null,
      location: null,
      completionStatus: 'all',
      lookId: null,
    });
  };

  const hasActiveFilters = filters.characters.length > 0 ||
    filters.shootingDay !== null ||
    filters.location !== null ||
    filters.completionStatus !== 'all' ||
    filters.lookId !== null;

  if (!currentProject) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text-primary">Breakdown</h1>

            <div className="flex items-center gap-2">
              {/* Filter button */}
              <button
                onClick={() => setShowFilters(true)}
                className={clsx(
                  'p-2 rounded-lg transition-colors touch-manipulation relative',
                  hasActiveFilters ? 'text-gold bg-gold-100/50' : 'text-text-muted hover:text-gold'
                )}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                {hasActiveFilters && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gold" />
                )}
              </button>

              {/* View toggle */}
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setViewMode('list')}
                  className={clsx(
                    'px-2.5 py-1.5 transition-colors touch-manipulation',
                    viewMode === 'list' ? 'bg-gold text-white' : 'bg-card text-text-muted'
                  )}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={clsx(
                    'px-2.5 py-1.5 transition-colors touch-manipulation',
                    viewMode === 'grid' ? 'bg-gold text-white' : 'bg-card text-text-muted'
                  )}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scenes count */}
      <div className="mobile-container px-4 py-3">
        <span className="text-xs text-text-muted">
          {filteredScenes.length} scene{filteredScenes.length !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </span>
      </div>

      {/* Content */}
      <div className="mobile-container px-4 pb-4">
        {filteredScenes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted">No scenes match your filters</p>
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-gold font-medium"
            >
              Clear Filters
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <BreakdownListView
            scenes={filteredScenes}
            expandedSceneId={expandedSceneId}
            onToggleExpand={(id) => setExpandedSceneId(expandedSceneId === id ? null : id)}
            onSceneSelect={onSceneSelect}
            getCharactersForScene={getCharactersForScene}
            getLookForCharacter={getLookForCharacter}
            getCapture={getCapture}
            getSceneProgress={getSceneProgress}
          />
        ) : (
          <BreakdownGridView
            scenes={filteredScenes}
            onSceneSelect={onSceneSelect}
            getCharactersForScene={getCharactersForScene}
            getSceneProgress={getSceneProgress}
          />
        )}
      </div>

      {/* Filter Drawer */}
      {showFilters && (
        <FilterDrawer
          filters={filters}
          characters={currentProject.characters}
          locations={locations}
          looks={currentProject.looks}
          onFiltersChange={setFilters}
          onClose={() => setShowFilters(false)}
          onClear={clearFilters}
        />
      )}
    </div>
  );
}

// List View Component
interface BreakdownListViewProps {
  scenes: Scene[];
  expandedSceneId: string | null;
  onToggleExpand: (id: string) => void;
  onSceneSelect: (id: string) => void;
  getCharactersForScene: (scene: Scene) => Character[];
  getLookForCharacter: (characterId: string, sceneNumber: number) => any;
  getCapture: (sceneId: string, characterId: string) => any;
  getSceneProgress: (scene: Scene) => { captured: number; total: number };
}

function BreakdownListView({
  scenes,
  expandedSceneId,
  onToggleExpand,
  onSceneSelect,
  getCharactersForScene,
  getLookForCharacter,
  getCapture,
  getSceneProgress,
}: BreakdownListViewProps) {
  return (
    <div className="space-y-2">
      {scenes.map((scene) => {
        const isExpanded = expandedSceneId === scene.id;
        const characters = getCharactersForScene(scene);
        const progress = getSceneProgress(scene);
        const isComplete = progress.total > 0 && progress.captured === progress.total;

        return (
          <div key={scene.id} className="card overflow-hidden">
            {/* Row header - always visible */}
            <button
              onClick={() => onToggleExpand(scene.id)}
              className="w-full flex items-center gap-3 p-3 text-left touch-manipulation"
            >
              {/* Scene number */}
              <span className="w-10 text-lg font-bold text-text-primary text-center">
                {scene.sceneNumber}
              </span>

              {/* INT/EXT badge */}
              <span className={clsx(
                'px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0',
                scene.intExt === 'INT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              )}>
                {scene.intExt}
              </span>

              {/* Location (truncated) */}
              <span className="flex-1 text-sm text-text-secondary truncate">
                {scene.slugline.replace(/^(INT|EXT)\.\s*/, '').replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS)$/i, '')}
              </span>

              {/* Character count */}
              <span className="flex-shrink-0 flex items-center -space-x-1.5">
                {characters.slice(0, 3).map((char) => (
                  <CharacterAvatar key={char.id} character={char} size="xs" />
                ))}
                {characters.length > 3 && (
                  <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-text-muted">
                    +{characters.length - 3}
                  </span>
                )}
              </span>

              {/* Status indicator */}
              <span className={clsx(
                'w-2 h-2 rounded-full flex-shrink-0',
                isComplete ? 'bg-green-500' : progress.captured > 0 ? 'bg-gold' : 'bg-gray-200'
              )} />

              {/* Expand chevron */}
              <svg
                className={clsx(
                  'w-4 h-4 text-text-light transition-transform flex-shrink-0',
                  isExpanded && 'rotate-180'
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-border px-3 pb-3 pt-3 space-y-3">
                {/* Full slugline */}
                <p className="text-sm font-medium text-text-primary">{scene.slugline}</p>

                {/* Synopsis if available */}
                {scene.synopsis && (
                  <p className="text-xs text-text-muted">{scene.synopsis}</p>
                )}

                {/* Character breakdown cards */}
                <div className="space-y-2">
                  {characters.map((char) => {
                    const look = getLookForCharacter(char.id, scene.sceneNumber);
                    const capture = getCapture(scene.id, char.id);
                    const hasCaptured = capture && Object.keys(capture.photos).length > 0;
                    const activeFlags = capture
                      ? Object.entries(capture.continuityFlags)
                          .filter(([_, v]) => v)
                          .map(([k]) => k)
                      : [];

                    return (
                      <div key={char.id} className="bg-gray-50 rounded-lg p-2.5">
                        <div className="flex items-center gap-2 mb-2">
                          <CharacterAvatar character={char} size="sm" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-text-primary">{char.name}</span>
                            {look && (
                              <span className="text-xs text-gold ml-2">• {look.name}</span>
                            )}
                          </div>
                          {hasCaptured && (
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        {/* Look details if available */}
                        {look && (
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            {look.makeup.foundation && (
                              <div>
                                <span className="text-text-light">Makeup:</span>{' '}
                                <span className="text-text-secondary">{look.makeup.foundation}</span>
                              </div>
                            )}
                            {look.hair.style && (
                              <div>
                                <span className="text-text-light">Hair:</span>{' '}
                                <span className="text-text-secondary">{look.hair.style}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Continuity flags */}
                        {activeFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {activeFlags.map((flag) => (
                              <span
                                key={flag}
                                className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-amber-100 text-amber-700 capitalize"
                              >
                                {flag.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Photo thumbnails if captured */}
                        {capture && Object.keys(capture.photos).length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {(['front', 'left', 'right', 'back'] as const).map((angle) => {
                              const photo = capture.photos[angle];
                              return (
                                <div
                                  key={angle}
                                  className={clsx(
                                    'w-10 h-10 rounded overflow-hidden bg-gray-200',
                                    !photo && 'opacity-30'
                                  )}
                                >
                                  {photo && (
                                    <img
                                      src={photo.thumbnail || photo.uri}
                                      alt={angle}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action button */}
                <button
                  onClick={() => onSceneSelect(scene.id)}
                  className="w-full py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  {progress.captured > 0 ? 'Edit Details' : 'Capture Continuity'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Grid View Component
interface BreakdownGridViewProps {
  scenes: Scene[];
  onSceneSelect: (id: string) => void;
  getCharactersForScene: (scene: Scene) => Character[];
  getSceneProgress: (scene: Scene) => { captured: number; total: number };
}

function BreakdownGridView({
  scenes,
  onSceneSelect,
  getCharactersForScene,
  getSceneProgress,
}: BreakdownGridViewProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {scenes.map((scene) => {
        const characters = getCharactersForScene(scene);
        const progress = getSceneProgress(scene);
        const progressPercent = progress.total > 0 ? (progress.captured / progress.total) * 100 : 0;

        return (
          <button
            key={scene.id}
            onClick={() => onSceneSelect(scene.id)}
            className="card text-left active:scale-[0.98] transition-transform"
          >
            {/* Scene number and INT/EXT */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl font-bold text-text-primary">{scene.sceneNumber}</span>
              <span className={clsx(
                'px-1.5 py-0.5 text-[9px] font-bold rounded',
                scene.intExt === 'INT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              )}>
                {scene.intExt}
              </span>
            </div>

            {/* Slugline (truncated) */}
            <p className="text-xs text-text-muted line-clamp-2 mb-2.5 min-h-[2.5rem]">
              {scene.slugline.replace(/^(INT|EXT)\.\s*/, '').replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS)$/i, '')}
            </p>

            {/* Character avatars */}
            <div className="flex items-center -space-x-1 mb-2.5">
              {characters.slice(0, 4).map((char) => (
                <CharacterAvatar key={char.id} character={char} size="xs" />
              ))}
              {characters.length > 4 && (
                <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-text-muted">
                  +{characters.length - 4}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  progressPercent === 100 ? 'bg-green-500' : 'bg-gold'
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-text-light mt-1 block">
              {progress.captured}/{progress.total} captured
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Filter Drawer Component
interface FilterDrawerProps {
  filters: BreakdownFilters;
  characters: Character[];
  locations: string[];
  looks: any[];
  onFiltersChange: (filters: BreakdownFilters) => void;
  onClose: () => void;
  onClear: () => void;
}

function FilterDrawer({
  filters,
  characters,
  locations,
  looks,
  onFiltersChange,
  onClose,
  onClear,
}: FilterDrawerProps) {
  const toggleCharacter = (charId: string) => {
    const newChars = filters.characters.includes(charId)
      ? filters.characters.filter(id => id !== charId)
      : [...filters.characters, charId];
    onFiltersChange({ ...filters, characters: newChars });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
    >
      <div
        className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-card shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Filters</h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Completion Status */}
          <div>
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-2">
              STATUS
            </h3>
            <div className="flex flex-wrap gap-2">
              {(['all', 'complete', 'incomplete'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => onFiltersChange({ ...filters, completionStatus: status })}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                    filters.completionStatus === status
                      ? 'bg-gold text-white'
                      : 'bg-gray-100 text-text-muted'
                  )}
                >
                  {status === 'all' ? 'All' : status === 'complete' ? 'Complete' : 'Incomplete'}
                </button>
              ))}
            </div>
          </div>

          {/* Characters */}
          <div>
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-2">
              CHARACTERS
            </h3>
            <div className="flex flex-wrap gap-2">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => toggleCharacter(char.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors',
                    filters.characters.includes(char.id)
                      ? 'bg-gold text-white'
                      : 'bg-gray-100 text-text-muted'
                  )}
                >
                  <CharacterAvatar character={char} size="xs" />
                  {char.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          {locations.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-2">
                LOCATION
              </h3>
              <select
                value={filters.location || ''}
                onChange={(e) => onFiltersChange({ ...filters, location: e.target.value || null })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-text-primary"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          )}

          {/* Look */}
          {looks.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-2">
                LOOK
              </h3>
              <select
                value={filters.lookId || ''}
                onChange={(e) => onFiltersChange({ ...filters, lookId: e.target.value || null })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-text-primary"
              >
                <option value="">All Looks</option>
                {looks.map((look) => {
                  const char = characters.find(c => c.id === look.characterId);
                  return (
                    <option key={look.id} value={look.id}>
                      {char?.name.split(' ')[0]} - {look.name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border p-4 flex gap-3">
          <button
            onClick={onClear}
            className="flex-1 py-2.5 rounded-button border border-border text-text-muted text-sm font-medium"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-button gold-gradient text-white text-sm font-medium"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState() {
  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center">
            <h1 className="text-lg font-semibold text-text-primary">Breakdown</h1>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">No Breakdown Data</h3>
        <p className="text-sm text-text-muted text-center mb-6">
          Sync from desktop or upload a script to generate scenes
        </p>
        <div className="flex gap-3">
          <button className="px-4 py-2.5 rounded-button border border-gold text-gold text-sm font-medium active:scale-95 transition-transform">
            Sync Now
          </button>
          <button className="px-4 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform">
            Upload Script
          </button>
        </div>
      </div>
    </div>
  );
}
