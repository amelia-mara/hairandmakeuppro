import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { formatShortDate } from '@/utils/helpers';
import type { ShootingSceneStatus, CallSheet, ShootingScene } from '@/types';

// Demo call sheet for development
const demoCallSheet: CallSheet = {
  id: 'call-1',
  date: new Date().toISOString().split('T')[0],
  productionDay: 4,
  unitCallTime: '06:00',
  firstShotEstimate: '07:30',
  lunchEstimate: '13:00',
  wrapEstimate: '19:00',
  weatherNote: 'Sunny, 22°C',
  scenes: [
    { sceneNumber: 12, shootOrder: 1, estimatedTime: '07:30', status: 'wrapped' },
    { sceneNumber: 15, shootOrder: 2, estimatedTime: '09:15', status: 'in-progress' },
    { sceneNumber: 16, shootOrder: 3, estimatedTime: '11:00', status: 'upcoming' },
    { sceneNumber: 8, shootOrder: 4, estimatedTime: '14:00', status: 'upcoming' },
    { sceneNumber: 23, shootOrder: 5, estimatedTime: '16:30', status: 'upcoming' },
  ],
  uploadedAt: new Date(),
};

interface TodayProps {
  onSceneSelect: (sceneId: string) => void;
}

export function Today({ onSceneSelect }: TodayProps) {
  const { currentProject, sceneCaptures } = useProjectStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [callSheet, setCallSheet] = useState<CallSheet | null>(demoCallSheet);

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

  // Get scene data from project
  const getSceneData = (sceneNumber: number) => {
    return currentProject?.scenes.find(s => s.sceneNumber === sceneNumber);
  };

  // Get characters in scene
  const getCharactersInScene = (sceneNumber: number) => {
    const scene = getSceneData(sceneNumber);
    if (!scene || !currentProject) return [];
    return scene.characters
      .map(charId => currentProject.characters.find(c => c.id === charId))
      .filter(Boolean);
  };

  // Get look for character in scene
  const getLookForCharacter = (characterId: string, sceneNumber: number) => {
    return currentProject?.looks.find(
      l => l.characterId === characterId && l.scenes.includes(sceneNumber)
    );
  };

  // Check if all characters have continuity captured for scene
  const isSceneContinuityCaptured = (sceneNumber: number) => {
    const scene = getSceneData(sceneNumber);
    if (!scene) return false;

    return scene.characters.every(charId => {
      const captureKey = `${scene.id}-${charId}`;
      const capture = sceneCaptures[captureKey];
      return capture && Object.keys(capture.photos).length > 0;
    });
  };

  // Update scene status
  const updateSceneStatus = (sceneNumber: number, status: ShootingSceneStatus) => {
    if (!callSheet) return;
    setCallSheet({
      ...callSheet,
      scenes: callSheet.scenes.map(s =>
        s.sceneNumber === sceneNumber ? { ...s, status } : s
      ),
    });
  };

  // Handle scene tap
  const handleSceneTap = (sceneNumber: number) => {
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
          {callSheet?.weatherNote && (
            <div className="px-4 pb-3 -mt-1">
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
                {callSheet.weatherNote}
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
                {callSheet.firstShotEstimate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">First Shot</span>
                    <span className="text-sm font-semibold text-text-primary">{callSheet.firstShotEstimate}</span>
                  </div>
                )}
                {callSheet.lunchEstimate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">Lunch</span>
                    <span className="text-sm font-semibold text-text-primary">{callSheet.lunchEstimate}</span>
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
                    onStatusChange={(status) => updateSceneStatus(shootingScene.sceneNumber, status)}
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
    </div>
  );
}

// Scene Card Component
interface TodaySceneCardProps {
  shootingScene: ShootingScene;
  scene?: ReturnType<typeof useProjectStore.getState>['currentProject'] extends { scenes: (infer S)[] } | null ? S : never;
  characters: any[];
  isCaptured: boolean;
  getLookForCharacter: (characterId: string, sceneNumber: number) => any;
  onTap: () => void;
  onStatusChange: (status: ShootingSceneStatus) => void;
}

function TodaySceneCard({
  shootingScene,
  scene,
  characters,
  isCaptured,
  getLookForCharacter,
  onTap,
  onStatusChange,
}: TodaySceneCardProps) {
  const [showActions, setShowActions] = useState(false);

  const statusColors: Record<ShootingSceneStatus, { bg: string; text: string; border: string }> = {
    'upcoming': { bg: 'bg-gray-50', text: 'text-text-muted', border: 'border-gray-200' },
    'in-progress': { bg: 'bg-gold-100/50', text: 'text-gold', border: 'border-gold' },
    'wrapped': { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  };

  const statusLabels: Record<ShootingSceneStatus, string> = {
    'upcoming': 'Upcoming',
    'in-progress': 'In Progress',
    'wrapped': 'Wrapped',
  };

  const colors = statusColors[shootingScene.status];

  // Long press handler
  const handleLongPress = () => {
    setShowActions(true);
  };

  return (
    <>
      <button
        onClick={onTap}
        onContextMenu={(e) => {
          e.preventDefault();
          handleLongPress();
        }}
        className={`w-full text-left card border-l-4 ${colors.border} transition-all active:scale-[0.98]`}
      >
        {/* Top row: Scene number + Location + Status */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-text-primary">
              {shootingScene.sceneNumber}
            </span>
            {scene && (
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  scene.intExt === 'INT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {scene.intExt}
                </span>
                <span className="text-xs text-text-muted">
                  {scene.timeOfDay}
                </span>
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
            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${colors.bg} ${colors.text}`}>
              {statusLabels[shootingScene.status]}
            </span>
          </div>
        </div>

        {/* Location & Synopsis */}
        {scene && (
          <div className="mb-3">
            <p className="text-sm text-text-secondary line-clamp-1">
              {scene.slugline.replace(/^(INT|EXT)\.\s*/, '').replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS)$/i, '')}
            </p>
            {scene.synopsis && (
              <p className="text-[13px] text-[#666] italic line-clamp-1 mt-1">
                {scene.synopsis}
              </p>
            )}
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
      </button>

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
              {shootingScene.status !== 'wrapped' && (
                <button
                  onClick={() => {
                    onStatusChange('wrapped');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Mark Wrapped
                </button>
              )}
              {shootingScene.status !== 'upcoming' && (
                <button
                  onClick={() => {
                    onStatusChange('upcoming');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-muted hover:bg-gray-50 flex items-center gap-3"
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
