import { useState, useMemo, useRef, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { SceneScriptModal } from '@/components/scenes/SceneScriptModal';
import { formatShortDate } from '@/utils/helpers';
import type { ShootingSceneStatus, SceneFilmingStatus, CallSheet, CallSheetScene, Scene } from '@/types';
import { SCENE_FILMING_STATUS_CONFIG } from '@/types';
import { clsx } from 'clsx';

// Demo call sheet for development (used when no call sheet is uploaded)
const demoCallSheet: CallSheet = {
  id: 'call-1',
  date: new Date().toISOString().split('T')[0],
  productionDay: 4,
  unitCallTime: '06:00',
  firstShotTime: '07:30',
  lunchTime: '13:00',
  wrapEstimate: '19:00',
  weather: { conditions: 'Sunny', tempHigh: 22 },
  scenes: [
    { sceneNumber: '12', setDescription: 'INT. COFFEE SHOP - DAY', dayNight: 'D', shootOrder: 1, estimatedTime: '07:30', status: 'wrapped', filmingStatus: 'complete' },
    { sceneNumber: '15', setDescription: 'EXT. PARK - DAY', dayNight: 'D', shootOrder: 2, estimatedTime: '09:15', status: 'wrapped', filmingStatus: 'partial', filmingNotes: 'Missing wide shot due to lighting' },
    { sceneNumber: '16', setDescription: 'INT. APARTMENT - DAY', dayNight: 'D', shootOrder: 3, estimatedTime: '11:00', status: 'in-progress' },
    { sceneNumber: '8', setDescription: 'EXT. STREET - NIGHT', dayNight: 'N', shootOrder: 4, estimatedTime: '14:00', status: 'upcoming' },
    { sceneNumber: '23', setDescription: 'INT. OFFICE - DAY', dayNight: 'D', shootOrder: 5, estimatedTime: '16:30', status: 'upcoming' },
  ],
  uploadedAt: new Date(),
};

interface TodayProps {
  onSceneSelect: (sceneId: string) => void;
}

export function Today({ onSceneSelect }: TodayProps) {
  const { currentProject, sceneCaptures, updateSceneFilmingStatus: syncFilmingStatus } = useProjectStore();
  const { getActiveCallSheet } = useCallSheetStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get active call sheet from store, fallback to demo
  const activeCallSheet = getActiveCallSheet();
  const [callSheet, setCallSheet] = useState<CallSheet | null>(activeCallSheet || demoCallSheet);

  // Update local state when active call sheet changes
  useEffect(() => {
    if (activeCallSheet) {
      setCallSheet(activeCallSheet);
    }
  }, [activeCallSheet]);

  // State for scene script modal
  const [scriptModalScene, setScriptModalScene] = useState<Scene | null>(null);

  // Navigate days
  const navigateDay = (direction: -1 | 1) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
    // In real app, would load call sheet for that date
  };

  // Sort scenes: In Progress → Upcoming → Wrapped
  const sortedScenes = useMemo(() => {
    if (!callSheet) return [];
    const statusOrder: Record<ShootingSceneStatus, number> = {
      'in-progress': 0,
      'upcoming': 1,
      'wrapped': 2,
    };
    return [...callSheet.scenes].sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.shootOrder - b.shootOrder;
    });
  }, [callSheet]);

  // Get scene data from project (sceneNumber can be "4A", "12", etc.)
  const getSceneData = (sceneNumber: string) => {
    return currentProject?.scenes.find(s => s.sceneNumber === sceneNumber);
  };

  // Get characters in scene
  const getCharactersInScene = (sceneNumber: string) => {
    const scene = getSceneData(sceneNumber);
    if (!scene || !currentProject) return [];
    return scene.characters
      .map(charId => currentProject.characters.find(c => c.id === charId))
      .filter(Boolean);
  };

  // Get look for character in scene
  const getLookForCharacter = (characterId: string, sceneNumber: string) => {
    return currentProject?.looks.find(
      l => l.characterId === characterId && l.scenes.includes(sceneNumber)
    );
  };

  // Check if all characters have continuity captured for scene
  const isSceneContinuityCaptured = (sceneNumber: string) => {
    const scene = getSceneData(sceneNumber);
    if (!scene) return false;

    return scene.characters.every(charId => {
      const captureKey = `${scene.id}-${charId}`;
      const capture = sceneCaptures[captureKey];
      return capture && Object.keys(capture.photos).length > 0;
    });
  };

  // Update scene status
  const updateSceneStatus = (sceneNumber: string, status: ShootingSceneStatus) => {
    if (!callSheet) return;
    setCallSheet({
      ...callSheet,
      scenes: callSheet.scenes.map(s =>
        s.sceneNumber === sceneNumber ? { ...s, status } : s
      ),
    });
  };

  // Update scene filming status - also syncs to project store for Breakdown view
  const updateSceneFilmingStatus = (
    sceneNumber: string,
    filmingStatus: SceneFilmingStatus,
    filmingNotes?: string
  ) => {
    if (!callSheet) return;
    // Update local call sheet state
    setCallSheet({
      ...callSheet,
      scenes: callSheet.scenes.map(s =>
        s.sceneNumber === sceneNumber
          ? { ...s, filmingStatus, filmingNotes }
          : s
      ),
    });
    // Sync to project store for Breakdown view
    syncFilmingStatus(sceneNumber, filmingStatus, filmingNotes);
  };

  // Handle scene tap
  const handleSceneTap = (sceneNumber: string) => {
    const scene = getSceneData(sceneNumber);
    if (scene) {
      onSceneSelect(scene.id);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            {/* Date navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateDay(-1)}
                className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-text-primary">{formatShortDate(currentDate)}</h1>
              <button
                onClick={() => navigateDay(1)}
                className="p-2 text-text-muted active:text-gold transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Production day badge */}
            {callSheet && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gold-100 text-gold">
                Day {callSheet.productionDay}
              </span>
            )}
          </div>

          {/* Weather note */}
          {callSheet?.weather?.conditions && (
            <div className="px-4 pb-3 -mt-1">
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
                {callSheet.weather.conditions}
                {callSheet.weather.tempHigh && `, ${callSheet.weather.tempHigh}°C`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mobile-container px-4 py-4 space-y-4">
        {callSheet ? (
          <>
            {/* Call Sheet Summary Card */}
            <div className="card">
              <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
                CALL TIMES
              </h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">Unit Call</span>
                  <span className="text-sm font-semibold text-text-primary">{callSheet.unitCallTime}</span>
                </div>
                {callSheet.firstShotTime && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">First Shot</span>
                    <span className="text-sm font-semibold text-text-primary">{callSheet.firstShotTime}</span>
                  </div>
                )}
                {callSheet.lunchTime && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">Lunch</span>
                    <span className="text-sm font-semibold text-text-primary">{callSheet.lunchTime}</span>
                  </div>
                )}
                {callSheet.wrapEstimate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">Est. Wrap</span>
                    <span className="text-sm font-semibold text-text-primary">{callSheet.wrapEstimate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Scenes Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light">
                TODAY'S SCENES ({sortedScenes.length})
              </h2>
            </div>

            {/* Scenes List */}
            <div className="space-y-2.5">
              {sortedScenes.map((shootingScene) => {
                const scene = getSceneData(shootingScene.sceneNumber);
                const characters = getCharactersInScene(shootingScene.sceneNumber);
                const isCaptured = isSceneContinuityCaptured(shootingScene.sceneNumber);

                return (
                  <TodaySceneCard
                    key={shootingScene.sceneNumber}
                    shootingScene={shootingScene}
                    scene={scene}
                    characters={characters}
                    isCaptured={isCaptured}
                    getLookForCharacter={getLookForCharacter}
                    onTap={() => handleSceneTap(shootingScene.sceneNumber)}
                    onSynopsisClick={(scene) => setScriptModalScene(scene)}
                    onStatusChange={(status) => updateSceneStatus(shootingScene.sceneNumber, status)}
                    onFilmingStatusChange={(filmingStatus, notes) =>
                      updateSceneFilmingStatus(shootingScene.sceneNumber, filmingStatus, notes)
                    }
                  />
                );
              })}
            </div>
          </>
        ) : (
          /* Empty State */
          <EmptyState />
        )}
      </div>

      {/* Scene Script Modal */}
      {scriptModalScene && (
        <SceneScriptModal
          scene={scriptModalScene}
          onClose={() => setScriptModalScene(null)}
        />
      )}
    </div>
  );
}

// Scene Card Component
interface TodaySceneCardProps {
  shootingScene: CallSheetScene;
  scene?: Scene;
  characters: any[];
  isCaptured: boolean;
  getLookForCharacter: (characterId: string, sceneNumber: string) => any;
  onTap: () => void;
  onSynopsisClick: (scene: Scene) => void;
  onStatusChange: (status: ShootingSceneStatus) => void;
  onFilmingStatusChange: (status: SceneFilmingStatus, notes?: string) => void;
}

function TodaySceneCard({
  shootingScene,
  scene,
  characters,
  isCaptured,
  getLookForCharacter,
  onTap,
  onSynopsisClick,
  onStatusChange,
  onFilmingStatusChange,
}: TodaySceneCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showFilmingStatusModal, setShowFilmingStatusModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [filmingNotes, setFilmingNotes] = useState(shootingScene.filmingNotes || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse INT/EXT and time of day from setDescription when no scene data
  const parsedSceneInfo = useMemo(() => {
    if (scene) return null; // Use actual scene data if available
    const desc = shootingScene.setDescription || '';
    // Parse patterns like "INT. COFFEE SHOP - DAY" or "EXT. PARK - NIGHT"
    const intExtMatch = desc.match(/^(INT|EXT)\./i);
    const timeMatch = desc.match(/- (DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS)$/i);
    const locationMatch = desc.match(/^(?:INT|EXT)\.\s*(.+?)(?:\s*-\s*(?:DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS))?$/i);
    return {
      intExt: intExtMatch ? intExtMatch[1].toUpperCase() : null,
      timeOfDay: timeMatch ? timeMatch[1].toUpperCase() : null,
      location: locationMatch ? locationMatch[1].trim() : desc,
    };
  }, [scene, shootingScene.setDescription]);

  // Get the glass overlay class based on filming status
  const getGlassOverlayClass = () => {
    if (!shootingScene.filmingStatus) return null;
    switch (shootingScene.filmingStatus) {
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

  const glassOverlayClass = getGlassOverlayClass();

  const statusLabels: Record<ShootingSceneStatus, string> = {
    'upcoming': 'Upcoming',
    'in-progress': 'In Progress',
    'wrapped': 'Wrapped',
  };

  // Get status badge styling
  const getStatusBadge = () => {
    if (shootingScene.filmingStatus) {
      const config = SCENE_FILMING_STATUS_CONFIG[shootingScene.filmingStatus];
      return {
        bg: config.bgClass,
        text: config.textClass,
        label: config.shortLabel,
        color: config.color,
      };
    }
    const statusColors: Record<ShootingSceneStatus, { bg: string; text: string; color: string }> = {
      'upcoming': { bg: 'bg-gray-100', text: 'text-text-muted', color: '#6b7280' },
      'in-progress': { bg: 'bg-gold-100/50', text: 'text-gold', color: '#C9A962' },
      'wrapped': { bg: 'bg-green-50', text: 'text-green-600', color: '#22c55e' },
    };
    return { ...statusColors[shootingScene.status], label: statusLabels[shootingScene.status] };
  };

  const statusBadge = getStatusBadge();

  // Long press handler
  const handleLongPress = () => {
    setShowActions(true);
  };

  // Handle filming status selection from dropdown
  const handleStatusSelect = (status: SceneFilmingStatus) => {
    if (status === 'not-filmed' || status === 'partial') {
      // Show notes modal for partial/incomplete
      setShowFilmingStatusModal(true);
      setShowStatusDropdown(false);
    } else {
      onFilmingStatusChange(status);
      setShowStatusDropdown(false);
    }
  };

  // Handle filming status selection with notes
  const handleFilmingStatusSelect = (status: SceneFilmingStatus) => {
    onFilmingStatusChange(status, filmingNotes);
    setShowFilmingStatusModal(false);
    setShowActions(false);
  };

  return (
    <>
      {/* Container needs z-index when dropdown is open to ensure dropdown appears above other cards */}
      <div className={clsx('relative', showStatusDropdown && 'z-40')}>
        <div
          onClick={onTap}
          onContextMenu={(e) => {
            e.preventDefault();
            handleLongPress();
          }}
          className="w-full text-left card transition-all active:scale-[0.98] relative overflow-hidden cursor-pointer"
        >
          {/* Glass overlay - positioned inside card to cover entire pill */}
          {glassOverlayClass && (
            <div className={clsx('scene-glass-overlay', glassOverlayClass)} />
          )}

          {/* Status accent bar on left edge */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-card"
            style={{
              backgroundColor: shootingScene.status === 'in-progress'
                ? '#C9A962' // Gold for in progress
                : shootingScene.status === 'wrapped'
                  ? shootingScene.filmingStatus === 'complete'
                    ? '#22c55e' // Green for complete
                    : shootingScene.filmingStatus === 'partial'
                      ? '#f59e0b' // Amber for partial
                      : shootingScene.filmingStatus === 'not-filmed'
                        ? '#ef4444' // Red for not filmed
                        : '#9ca3af' // Gray for wrapped without filming status
                  : 'transparent' // No bar for upcoming
            }}
          />

          {/* Card content - positioned above glass overlay */}
          <div className="relative z-10 pl-2">
            {/* Top row: Scene number + INT/EXT + Status */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-text-primary">
                  {shootingScene.sceneNumber}
                </span>
                {/* Show INT/EXT badge and time of day from scene data or parsed from setDescription */}
                {(scene || parsedSceneInfo) && (
                  <div className="flex items-center gap-2">
                    {(scene?.intExt || parsedSceneInfo?.intExt) && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        (scene?.intExt || parsedSceneInfo?.intExt) === 'INT'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {scene?.intExt || parsedSceneInfo?.intExt}
                      </span>
                    )}
                    {(scene?.timeOfDay || parsedSceneInfo?.timeOfDay) && (
                      <span className="text-xs text-text-muted">
                        {scene?.timeOfDay || parsedSceneInfo?.timeOfDay}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isCaptured && (
                  <span className="text-green-500">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
                {/* Status Dropdown */}
                <div ref={dropdownRef} className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowStatusDropdown(!showStatusDropdown);
                    }}
                    className="status-dropdown-btn touch-manipulation"
                    style={{ borderColor: shootingScene.filmingStatus ? statusBadge.color : undefined }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: statusBadge.color }}
                    />
                    <span className={statusBadge.text}>{statusBadge.label}</span>
                    <svg className={clsx('w-3 h-3 text-text-muted transition-transform', showStatusDropdown && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {/* Dropdown menu */}
                  {showStatusDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-fadeIn">
                      {(['complete', 'partial', 'not-filmed'] as SceneFilmingStatus[]).map((status) => {
                        const config = SCENE_FILMING_STATUS_CONFIG[status];
                        const isSelected = shootingScene.filmingStatus === status;
                        return (
                          <button
                            key={status}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusSelect(status);
                            }}
                            className={clsx(
                              'w-full px-3 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors',
                              isSelected ? config.bgClass : 'hover:bg-gray-50'
                            )}
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: config.color }}
                            />
                            <span className={clsx('font-medium', isSelected && config.textClass)}>
                              {config.label}
                            </span>
                            {isSelected && (
                              <svg className={clsx('w-4 h-4 ml-auto', config.textClass)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Location & Synopsis */}
            {(scene || parsedSceneInfo?.location) && (
              <div className="mb-3">
                <p className="text-sm font-medium text-text-primary line-clamp-1">
                  {scene
                    ? scene.slugline.replace(/^(INT|EXT)\.\s*/, '').replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS)$/i, '')
                    : parsedSceneInfo?.location}
                </p>
                {/* Synopsis - clickable to view full scene */}
                {scene?.synopsis ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSynopsisClick(scene);
                    }}
                    className="w-full text-left group mt-1"
                  >
                    <p className="text-[13px] text-[#666] italic line-clamp-1 group-hover:text-gold transition-colors">
                      {scene.synopsis}
                    </p>
                    <span className="text-[10px] text-gold flex items-center gap-1 mt-0.5 opacity-80">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View full scene
                    </span>
                  </button>
                ) : scene?.scriptContent ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSynopsisClick(scene);
                    }}
                    className="text-[10px] text-gold flex items-center gap-1 mt-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View full scene
                  </button>
                ) : null}
              </div>
            )}

            {/* Filming notes if partial or incomplete */}
            {shootingScene.filmingStatus && shootingScene.filmingStatus !== 'complete' && shootingScene.filmingNotes && (
              <div className={clsx(
                'mb-3 px-2 py-1.5 rounded text-xs',
                shootingScene.filmingStatus === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              )}>
                <span className="font-medium">Note:</span> {shootingScene.filmingNotes}
              </div>
            )}

            {/* Characters with looks */}
            {characters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {characters.map((char) => {
                  const look = getLookForCharacter(char.id, shootingScene.sceneNumber);
                  return (
                    <div key={char.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full pl-1 pr-2.5 py-1">
                      <CharacterAvatar character={char} size="xs" />
                      <span className="text-xs font-medium text-text-primary">{char.name.split(' ')[0]}</span>
                      {look && (
                        <span className="text-[10px] text-text-muted">• {look.name}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Estimated time */}
            {shootingScene.estimatedTime && (
              <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-text-muted">Est. {shootingScene.estimatedTime}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Modal */}
      {showActions && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
          onClick={() => setShowActions(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-base font-semibold text-text-primary">Scene {shootingScene.sceneNumber}</h3>
            </div>
            <div className="py-2">
              {shootingScene.status !== 'in-progress' && (
                <button
                  onClick={() => {
                    onStatusChange('in-progress');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  Mark In Progress
                </button>
              )}

              {/* Filming Status Options */}
              <div className="border-t border-border mt-2 pt-2">
                <div className="px-4 py-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-text-light">
                    FILMING STATUS
                  </span>
                </div>
                <button
                  onClick={() => handleFilmingStatusSelect('complete')}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium">Complete</span>
                    <p className="text-xs text-text-muted">Scene fully filmed</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowFilmingStatusModal(true)}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium">Part Complete</span>
                    <p className="text-xs text-text-muted">Some shots still needed</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowFilmingStatusModal(true)}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium">Incomplete</span>
                    <p className="text-xs text-text-muted">Scene not filmed</p>
                  </div>
                </button>
              </div>

              {shootingScene.status !== 'upcoming' && (
                <button
                  onClick={() => {
                    onStatusChange('upcoming');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-muted hover:bg-gray-50 flex items-center gap-3 border-t border-border mt-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                  Revert to Upcoming
                </button>
              )}
            </div>
            <button
              onClick={() => setShowActions(false)}
              className="w-full p-4 text-center text-sm font-medium text-gold border-t border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filming Status Modal with Notes */}
      {showFilmingStatusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowFilmingStatusModal(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-base font-semibold text-text-primary">Scene {shootingScene.sceneNumber} - Add Notes</h3>
              <p className="text-xs text-text-muted mt-1">Why wasn't this scene fully filmed?</p>
            </div>
            <div className="p-4">
              <textarea
                value={filmingNotes}
                onChange={(e) => setFilmingNotes(e.target.value)}
                placeholder="e.g., Ran out of time, weather issues, actor unavailable..."
                rows={3}
                className="w-full p-3 border border-border rounded-lg text-sm bg-input-bg text-text-primary resize-none"
              />
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button
                onClick={() => handleFilmingStatusSelect('partial')}
                className="flex-1 py-2.5 rounded-button bg-amber-500 text-white text-sm font-medium"
              >
                Part Complete
              </button>
              <button
                onClick={() => handleFilmingStatusSelect('not-filmed')}
                className="flex-1 py-2.5 rounded-button bg-red-500 text-white text-sm font-medium"
              >
                Incomplete
              </button>
            </div>
            <button
              onClick={() => setShowFilmingStatusModal(false)}
              className="w-full p-3 text-center text-sm text-text-muted border-t border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Empty State Component
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">No Call Sheet</h3>
      <p className="text-sm text-text-muted text-center mb-6">
        Upload a call sheet or manually add today's scenes
      </p>
      <div className="flex gap-3">
        <button className="px-4 py-2.5 rounded-button border border-gold text-gold text-sm font-medium active:scale-95 transition-transform">
          Upload PDF
        </button>
        <button className="px-4 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform">
          Select Scenes
        </button>
      </div>
    </div>
  );
}
