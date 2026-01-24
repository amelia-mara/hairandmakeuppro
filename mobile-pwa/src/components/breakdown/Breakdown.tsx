import { useState, useMemo, useRef, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { SceneScriptModal } from '@/components/scenes/SceneScriptModal';
import {
  SceneCharacterConfirmation,
  SceneCharacterStatus,
  CharacterConfirmationProgress,
} from '@/components/breakdown/SceneCharacterConfirmation';
import { generateSceneSynopsis } from '@/services/aiService';
import type { Scene, Character, Look, SceneCapture, BreakdownViewMode, BreakdownFilters, SceneFilmingStatus } from '@/types';
import { SCENE_FILMING_STATUS_CONFIG } from '@/types';
import { clsx } from 'clsx';

// Filming Status Dropdown Component - allows changing status directly from Breakdown
interface FilmingStatusDropdownProps {
  scene: Scene;
  onStatusChange: (sceneNumber: string, status: SceneFilmingStatus, notes?: string) => void;
  onNotesModalOpen: (sceneNumber: string, status: 'partial' | 'not-filmed') => void;
}

function FilmingStatusDropdown({ scene, onStatusChange, onNotesModalOpen }: FilmingStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const currentConfig = scene.filmingStatus
    ? SCENE_FILMING_STATUS_CONFIG[scene.filmingStatus]
    : null;

  const handleStatusSelect = (status: SceneFilmingStatus) => {
    setIsOpen(false);
    if (status === 'complete') {
      // Complete doesn't need notes
      onStatusChange(scene.sceneNumber, status);
    } else {
      // Partial and not-filmed need notes modal
      onNotesModalOpen(scene.sceneNumber, status);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={clsx(
          'flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold rounded-lg flex-shrink-0 border transition-colors',
          currentConfig ? [
            currentConfig.bgClass,
            currentConfig.textClass,
            scene.filmingStatus === 'complete' && 'border-green-200',
            scene.filmingStatus === 'partial' && 'border-amber-200',
            scene.filmingStatus === 'not-filmed' && 'border-red-200'
          ] : 'bg-gray-100 text-text-muted border-gray-200 hover:border-gray-300'
        )}
      >
        {currentConfig ? (
          <>
            <span className={clsx(
              'w-2 h-2 rounded-full',
              scene.filmingStatus === 'complete' && 'bg-green-500',
              scene.filmingStatus === 'partial' && 'bg-amber-500',
              scene.filmingStatus === 'not-filmed' && 'bg-red-500'
            )} />
            {currentConfig.shortLabel}
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Set Status
          </>
        )}
        <svg className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-border overflow-hidden min-w-[140px]">
          {(['complete', 'partial', 'not-filmed'] as SceneFilmingStatus[]).map((status) => {
            const config = SCENE_FILMING_STATUS_CONFIG[status];
            const isSelected = scene.filmingStatus === status;
            return (
              <button
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusSelect(status);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors text-left',
                  isSelected ? `${config.bgClass} ${config.textClass}` : 'hover:bg-gray-50 text-text-primary'
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                {config.label}
                {isSelected && (
                  <svg className="w-3.5 h-3.5 ml-auto text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Filming Notes Modal - for adding notes when marking partial or incomplete
interface FilmingNotesModalProps {
  sceneNumber: string;
  status: 'partial' | 'not-filmed';
  onConfirm: (notes: string) => void;
  onClose: () => void;
}

function FilmingNotesModal({ sceneNumber, status, onConfirm, onClose }: FilmingNotesModalProps) {
  const [notes, setNotes] = useState('');
  const config = SCENE_FILMING_STATUS_CONFIG[status];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <h2 className="text-lg font-semibold text-text-primary">
              Scene {sceneNumber} - {config.label}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {status === 'partial' ? 'What still needs to be filmed?' : 'Why wasn\'t this scene filmed?'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Ran out of time, weather issues, actor unavailable..."
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
              rows={4}
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-button border border-border text-text-muted text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(notes)}
              className={clsx(
                'flex-1 py-2.5 rounded-button text-white text-sm font-medium',
                status === 'partial' ? 'bg-amber-500' : 'bg-red-500'
              )}
            >
              Mark as {config.label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BreakdownProps {
  onSceneSelect: (sceneId: string) => void;
}

export function Breakdown({ onSceneSelect }: BreakdownProps) {
  const { currentProject, sceneCaptures, updateSceneSynopsis, updateSceneFilmingStatus } = useProjectStore();
  const { getDiscrepancyForScene } = useScheduleStore();
  const [viewMode, setViewMode] = useState<BreakdownViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BreakdownFilters>({
    characters: [],
    shootingDay: null,
    location: null,
    completionStatus: 'all',
    filmingStatus: 'all',
    lookId: null,
  });
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [scriptModalSceneId, setScriptModalSceneId] = useState<string | null>(null);
  const [generatingSynopsisId, setGeneratingSynopsisId] = useState<string | null>(null);
  const [characterConfirmSceneId, setCharacterConfirmSceneId] = useState<string | null>(null);

  // Filming status notes modal state
  const [notesModalState, setNotesModalState] = useState<{
    sceneNumber: string;
    status: 'partial' | 'not-filmed';
  } | null>(null);

  // Handle filming status change
  const handleFilmingStatusChange = (sceneNumber: string, status: SceneFilmingStatus, notes?: string) => {
    updateSceneFilmingStatus(sceneNumber, status, notes);
  };

  // Open notes modal for partial/incomplete status
  const handleNotesModalOpen = (sceneNumber: string, status: 'partial' | 'not-filmed') => {
    setNotesModalState({ sceneNumber, status });
  };

  // Confirm status with notes
  const handleNotesConfirm = (notes: string) => {
    if (notesModalState) {
      updateSceneFilmingStatus(notesModalState.sceneNumber, notesModalState.status, notes);
      setNotesModalState(null);
    }
  };

  // Handle generating synopsis for a scene
  const handleGenerateSynopsis = async (scene: Scene) => {
    if (generatingSynopsisId) return; // Already generating

    setGeneratingSynopsisId(scene.id);
    try {
      const synopsis = await generateSceneSynopsis(
        scene.slugline,
        scene.scriptContent || ''
      );
      if (synopsis) {
        updateSceneSynopsis(scene.id, synopsis);
      }
    } catch (error) {
      console.error('Failed to generate synopsis:', error);
    } finally {
      setGeneratingSynopsisId(null);
    }
  };

  // Get scene for script modal
  const scriptModalScene = useMemo(() => {
    if (!scriptModalSceneId || !currentProject) return null;
    return currentProject.scenes.find(s => s.id === scriptModalSceneId) || null;
  }, [scriptModalSceneId, currentProject]);

  // Get scene for character confirmation modal
  const characterConfirmScene = useMemo(() => {
    if (!characterConfirmSceneId || !currentProject) return null;
    return currentProject.scenes.find(s => s.id === characterConfirmSceneId) || null;
  }, [characterConfirmSceneId, currentProject]);

  // Character confirmation progress
  const confirmationProgress = useMemo(() => {
    if (!currentProject) return { total: 0, confirmed: 0 };
    const total = currentProject.scenes.length;
    const confirmed = currentProject.scenes.filter(
      s => s.characterConfirmationStatus === 'confirmed'
    ).length;
    return { total, confirmed };
  }, [currentProject]);

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

    // Filter by completion status (continuity capture)
    if (filters.completionStatus === 'complete') {
      scenes = scenes.filter(scene => scene.isComplete);
    } else if (filters.completionStatus === 'incomplete') {
      scenes = scenes.filter(scene => !scene.isComplete);
    }

    // Filter by filming status
    if (filters.filmingStatus !== 'all') {
      scenes = scenes.filter(scene => scene.filmingStatus === filters.filmingStatus);
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

    return scenes.sort((a, b) => a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }));
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
  const getLookForCharacter = (characterId: string, sceneNumber: string) => {
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
      filmingStatus: 'all',
      lookId: null,
    });
  };

  const hasActiveFilters = filters.characters.length > 0 ||
    filters.shootingDay !== null ||
    filters.location !== null ||
    filters.completionStatus !== 'all' ||
    filters.filmingStatus !== 'all' ||
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

      {/* Character confirmation progress */}
      {confirmationProgress.total > 0 && confirmationProgress.confirmed < confirmationProgress.total && (
        <div className="mobile-container">
          <CharacterConfirmationProgress
            totalScenes={confirmationProgress.total}
            confirmedScenes={confirmationProgress.confirmed}
          />
        </div>
      )}

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
            onSynopsisClick={(sceneId) => setScriptModalSceneId(sceneId)}
            onGenerateSynopsis={handleGenerateSynopsis}
            generatingSynopsisId={generatingSynopsisId}
            getCharactersForScene={getCharactersForScene}
            getLookForCharacter={getLookForCharacter}
            getCapture={getCapture}
            getSceneProgress={getSceneProgress}
            getDiscrepancy={getDiscrepancyForScene}
            onCharacterConfirm={(sceneId) => setCharacterConfirmSceneId(sceneId)}
            allCharacters={currentProject?.characters || []}
            onFilmingStatusChange={handleFilmingStatusChange}
            onNotesModalOpen={handleNotesModalOpen}
          />
        ) : (
          <BreakdownGridView
            scenes={filteredScenes}
            onSceneSelect={onSceneSelect}
            getCharactersForScene={getCharactersForScene}
            getSceneProgress={getSceneProgress}
            onFilmingStatusChange={handleFilmingStatusChange}
            onNotesModalOpen={handleNotesModalOpen}
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

      {/* Scene Script Modal */}
      {scriptModalScene && (
        <SceneScriptModal
          scene={scriptModalScene}
          onClose={() => setScriptModalSceneId(null)}
        />
      )}

      {/* Character Confirmation Modal */}
      {characterConfirmScene && (
        <SceneCharacterConfirmation
          scene={characterConfirmScene}
          onClose={() => setCharacterConfirmSceneId(null)}
          onConfirm={() => setCharacterConfirmSceneId(null)}
        />
      )}

      {/* Filming Notes Modal */}
      {notesModalState && (
        <FilmingNotesModal
          sceneNumber={notesModalState.sceneNumber}
          status={notesModalState.status}
          onConfirm={handleNotesConfirm}
          onClose={() => setNotesModalState(null)}
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
  onSynopsisClick: (sceneId: string) => void;
  onGenerateSynopsis: (scene: Scene) => void;
  generatingSynopsisId: string | null;
  getCharactersForScene: (scene: Scene) => Character[];
  getLookForCharacter: (characterId: string, sceneNumber: string) => Look | null | undefined;
  getCapture: (sceneId: string, characterId: string) => SceneCapture | null | undefined;
  getSceneProgress: (scene: Scene) => { captured: number; total: number };
  getDiscrepancy: (sceneNumber: string) => { message: string } | null;
  onCharacterConfirm: (sceneId: string) => void;
  allCharacters: Character[];
  onFilmingStatusChange: (sceneNumber: string, status: SceneFilmingStatus, notes?: string) => void;
  onNotesModalOpen: (sceneNumber: string, status: 'partial' | 'not-filmed') => void;
}

// Get glass overlay class based on filming status
const getGlassOverlayClass = (filmingStatus?: string | null) => {
  if (!filmingStatus) return null;
  switch (filmingStatus) {
    case 'complete':
      return 'scene-glass-complete';
    case 'partial':
      return 'scene-glass-partial';
    case 'not-filmed':
      return 'scene-glass-incomplete';
    default:
      return null;
  }
};

function BreakdownListView({
  scenes,
  expandedSceneId,
  onToggleExpand,
  onSceneSelect,
  onSynopsisClick,
  onGenerateSynopsis,
  generatingSynopsisId,
  getCharactersForScene,
  getLookForCharacter,
  getCapture,
  getSceneProgress,
  getDiscrepancy,
  onCharacterConfirm,
  allCharacters,
  onFilmingStatusChange,
  onNotesModalOpen,
}: BreakdownListViewProps) {
  return (
    <div className="space-y-2">
      {scenes.map((scene) => {
        const isExpanded = expandedSceneId === scene.id;
        const characters = getCharactersForScene(scene);
        const progress = getSceneProgress(scene);
        const isComplete = progress.total > 0 && progress.captured === progress.total;
        const discrepancy = getDiscrepancy(scene.sceneNumber);

        // Get filming status styling
        const filmingStatusConfig = scene.filmingStatus
          ? SCENE_FILMING_STATUS_CONFIG[scene.filmingStatus]
          : null;

        const glassOverlayClass = getGlassOverlayClass(scene.filmingStatus);

        // Get accent bar class based on filming status
        const getAccentBarClass = () => {
          if (!scene.filmingStatus) return 'accent-bar-neutral';
          switch (scene.filmingStatus) {
            case 'complete': return 'accent-bar-complete';
            case 'partial': return 'accent-bar-partial';
            case 'not-filmed': return 'accent-bar-incomplete';
            default: return 'accent-bar-neutral';
          }
        };

        return (
          <div
            key={scene.id}
            className="relative"
          >
            {/* Glass overlay */}
            {glassOverlayClass && (
              <div className={clsx('scene-glass-overlay', glassOverlayClass)} />
            )}
            <div
              className="card overflow-hidden relative z-10"
            >
            {/* Left accent bar */}
            <div className={clsx('absolute left-0 top-0 bottom-0 w-1 rounded-l-card', getAccentBarClass())} />
            {/* Row header - always visible */}
            <button
              onClick={() => onToggleExpand(scene.id)}
              className="w-full flex items-center gap-3 p-3 text-left touch-manipulation"
            >
              {/* Scene number with discrepancy warning */}
              <div className="w-10 flex items-center justify-center gap-0.5">
                <span className="text-lg font-bold text-text-primary">
                  {scene.sceneNumber}
                </span>
                {(discrepancy || scene.hasScheduleDiscrepancy) && (
                  <svg
                    className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>

              {/* INT/EXT badge */}
              <span className={clsx(
                'px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0',
                scene.intExt === 'INT' ? 'bg-slate-100 text-slate-600' : 'bg-stone-100 text-stone-600'
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

              {/* Filming status dropdown - allows changing status */}
              <FilmingStatusDropdown
                scene={scene}
                onStatusChange={onFilmingStatusChange}
                onNotesModalOpen={onNotesModalOpen}
              />

              {/* Checkmark icon when complete - like Today page */}
              {isComplete && (
                <span className="text-green-500 flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              )}

              {/* Partial progress indicator */}
              {!isComplete && progress.captured > 0 && (
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gold" />
              )}

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

            {/* Scene heading and synopsis - always visible */}
            <div className="px-3 pb-3 pt-1 border-t border-border/50">
              {/* Full slugline */}
              <p className="text-sm font-medium text-text-primary">{scene.slugline}</p>

              {/* Synopsis and/or View full scene link - show when synopsis or scriptContent exists */}
              {(scene.synopsis || scene.scriptContent) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSynopsisClick(scene.id);
                  }}
                  className="w-full text-left group mt-1.5"
                >
                  {/* Show synopsis text if available */}
                  {scene.synopsis && (
                    <p className="text-xs text-text-muted italic line-clamp-2 group-hover:text-gold transition-colors">
                      {scene.synopsis}
                    </p>
                  )}
                  {/* Show "Tap to view full scene" when scriptContent exists */}
                  {scene.scriptContent && (
                    <span className="text-[10px] text-gold flex items-center gap-1 mt-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Tap to view full scene
                    </span>
                  )}
                </button>
              )}

              {/* Character confirmation status - show when not all confirmed or when showing status is useful */}
              {(scene.characterConfirmationStatus !== 'confirmed' || characters.length === 0) && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <SceneCharacterStatus
                    scene={scene}
                    characters={allCharacters}
                    onConfirmClick={() => onCharacterConfirm(scene.id)}
                  />
                </div>
              )}
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-border px-3 pb-3 pt-3 space-y-3">
                {/* Schedule discrepancy warning */}
                {discrepancy && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-amber-700">Schedule Discrepancy</p>
                      <p className="text-xs text-amber-600 mt-0.5">{discrepancy.message}</p>
                    </div>
                  </div>
                )}

                {/* Generate Synopsis / View script - only shown if no synopsis */}
                {!scene.synopsis && scene.scriptContent && (
                  <div className="flex items-center gap-2">
                    {/* Generate Synopsis Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenerateSynopsis(scene);
                      }}
                      disabled={generatingSynopsisId === scene.id}
                      className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                        generatingSynopsisId === scene.id
                          ? 'bg-gray-100 text-text-muted cursor-wait'
                          : 'bg-gold-100 text-gold hover:bg-gold-200 active:scale-95'
                      )}
                    >
                      {generatingSynopsisId === scene.id ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                          </svg>
                          Generate Synopsis
                        </>
                      )}
                    </button>
                    {/* View full scene link */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSynopsisClick(scene.id);
                      }}
                      className="text-xs text-text-muted flex items-center gap-1 hover:text-gold transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View script
                    </button>
                  </div>
                )}

                {/* Filming status with notes */}
                {scene.filmingStatus && (
                  <div className={clsx(
                    'p-2.5 rounded-lg',
                    filmingStatusConfig?.bgClass
                  )}>
                    <div className="flex items-center gap-2">
                      <FilmingStatusIcon status={scene.filmingStatus} />
                      <span className={clsx('text-sm font-medium', filmingStatusConfig?.textClass)}>
                        {filmingStatusConfig?.label}
                      </span>
                    </div>
                    {scene.filmingNotes && (
                      <p className={clsx('text-xs mt-1.5', filmingStatusConfig?.textClass)}>
                        {scene.filmingNotes}
                      </p>
                    )}
                  </div>
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
          </div>
        );
      })}
    </div>
  );
}

// Filming status icon component
function FilmingStatusIcon({ status }: { status: SceneFilmingStatus }) {
  const config = SCENE_FILMING_STATUS_CONFIG[status];

  if (status === 'complete') {
    return (
      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: config.color }}>
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === 'partial') {
    return (
      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: config.color }}>
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: config.color }}>
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  );
}

// Grid View Component
interface BreakdownGridViewProps {
  scenes: Scene[];
  onSceneSelect: (id: string) => void;
  getCharactersForScene: (scene: Scene) => Character[];
  getSceneProgress: (scene: Scene) => { captured: number; total: number };
  onFilmingStatusChange: (sceneNumber: string, status: SceneFilmingStatus, notes?: string) => void;
  onNotesModalOpen: (sceneNumber: string, status: 'partial' | 'not-filmed') => void;
}

function BreakdownGridView({
  scenes,
  onSceneSelect,
  getCharactersForScene,
  getSceneProgress,
  onFilmingStatusChange,
  onNotesModalOpen,
}: BreakdownGridViewProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {scenes.map((scene) => {
        const characters = getCharactersForScene(scene);
        const progress = getSceneProgress(scene);
        const progressPercent = progress.total > 0 ? (progress.captured / progress.total) * 100 : 0;
        const isComplete = progress.total > 0 && progress.captured === progress.total;

        const glassOverlayClass = getGlassOverlayClass(scene.filmingStatus);

        // Get accent bar class based on filming status
        const getAccentBarClass = () => {
          if (!scene.filmingStatus) return 'accent-bar-neutral';
          switch (scene.filmingStatus) {
            case 'complete': return 'accent-bar-complete';
            case 'partial': return 'accent-bar-partial';
            case 'not-filmed': return 'accent-bar-incomplete';
            default: return 'accent-bar-neutral';
          }
        };

        return (
          <div key={scene.id} className="relative">
            {/* Glass overlay */}
            {glassOverlayClass && (
              <div className={clsx('scene-glass-overlay', glassOverlayClass)} />
            )}
            <div className="card text-left w-full relative z-10 overflow-hidden">
            {/* Left accent bar */}
            <div className={clsx('absolute left-0 top-0 bottom-0 w-1', getAccentBarClass())} />

            {/* Main clickable area */}
            <button
              onClick={() => onSceneSelect(scene.id)}
              className="w-full text-left active:scale-[0.98] transition-transform"
            >

            {/* Scene number and INT/EXT */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-text-primary">{scene.sceneNumber}</span>
                {/* Checkmark icon when complete - like Today page */}
                {isComplete && (
                  <span className="text-green-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className={clsx(
                  'px-1.5 py-0.5 text-[9px] font-bold rounded',
                  scene.intExt === 'INT' ? 'bg-slate-100 text-slate-600' : 'bg-stone-100 text-stone-600'
                )}>
                  {scene.intExt}
                </span>
              </div>
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

            {/* Progress bar - sophisticated color palette */}
            <div className="h-1.5 bg-gray-100/80 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progressPercent}%`,
                  background: scene.filmingStatus === 'complete'
                    ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                    : scene.filmingStatus === 'partial'
                    ? 'linear-gradient(90deg, #d4a853 0%, #c9a962 100%)'
                    : scene.filmingStatus === 'not-filmed'
                    ? 'linear-gradient(90deg, #f87171 0%, #ef4444 100%)'
                    : progressPercent === 100
                    ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(90deg, #c9a962 0%, #d4a853 100%)'
                }}
              />
            </div>
            <span className="text-[10px] text-text-light mt-1 block">
              {progress.captured}/{progress.total} captured
            </span>
            </button>

            {/* Filming status dropdown - outside button to avoid nesting */}
            <div className="mt-2 pt-2 border-t border-border/50">
              <FilmingStatusDropdown
                scene={scene}
                onStatusChange={onFilmingStatusChange}
                onNotesModalOpen={onNotesModalOpen}
              />
            </div>
            </div>
          </div>
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
  looks: Look[];
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
          {/* Filming Status */}
          <div>
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-2">
              FILMING STATUS
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onFiltersChange({ ...filters, filmingStatus: 'all' })}
                className={clsx(
                  'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                  filters.filmingStatus === 'all'
                    ? 'bg-gold text-white'
                    : 'bg-gray-100 text-text-muted'
                )}
              >
                All
              </button>
              {(['complete', 'partial', 'not-filmed'] as SceneFilmingStatus[]).map((status) => {
                const config = SCENE_FILMING_STATUS_CONFIG[status];
                return (
                  <button
                    key={status}
                    onClick={() => onFiltersChange({ ...filters, filmingStatus: status })}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5',
                      filters.filmingStatus === status
                        ? `${config.bgClass} ${config.textClass}`
                        : 'bg-gray-100 text-text-muted'
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    {config.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Continuity Status */}
          <div>
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-2">
              CONTINUITY STATUS
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
                  {status === 'all' ? 'All' : status === 'complete' ? 'Captured' : 'Not Captured'}
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
