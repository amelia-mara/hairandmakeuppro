import { useMemo } from 'react';
import { useBreakdownStore } from '../../stores/breakdownStore';
import CharacterBreakdownCard from './CharacterBreakdownCard';
import type { ParsedScene, DetectedCharacter } from '../../types/breakdown';

interface SceneBreakdownPanelProps {
  scene: ParsedScene;
  characters: DetectedCharacter[];
}

export default function SceneBreakdownPanel({ scene, characters }: SceneBreakdownPanelProps) {
  const { sceneBreakdowns, updateSceneBreakdown, markSceneComplete } = useBreakdownStore();

  const breakdown = sceneBreakdowns[scene.id];
  const isComplete = breakdown?.isComplete ?? false;

  // Characters that appear in this scene
  const sceneCharacters = useMemo(
    () => characters.filter((c) => c.scenes.includes(scene.id)),
    [characters, scene.id],
  );

  const handleStoryDayChange = (val: string) => {
    updateSceneBreakdown(scene.id, { storyDay: val });
  };

  const handleTimelineNotes = (val: string) => {
    updateSceneBreakdown(scene.id, { timelineNotes: val });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gold font-semibold">Sc. {scene.sceneNumber}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              scene.intExt === 'EXT' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {scene.intExt}
          </span>
        </div>
        <p className="text-white text-sm truncate">
          {scene.location} - {scene.timeOfDay}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Timeline section */}
        <div className="bg-[#1a1a1a] border border-neutral-800 rounded-lg p-4">
          <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Timeline</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-neutral-600 mb-1">Story Day</label>
              <select
                value={breakdown?.storyDay || ''}
                onChange={(e) => handleStoryDayChange(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-neutral-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/40 appearance-none"
              >
                <option value="">Select...</option>
                {Array.from({ length: 30 }, (_, i) => (
                  <option key={i + 1} value={`Day ${i + 1}`}>
                    Day {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-neutral-600 mb-1">Time of Day</label>
              <div className="px-3 py-2 text-sm text-neutral-400 bg-[#0f0f0f] border border-neutral-800 rounded-md">
                {scene.timeOfDay}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-[10px] text-neutral-600 mb-1">Notes</label>
            <input
              type="text"
              value={breakdown?.timelineNotes || ''}
              onChange={(e) => handleTimelineNotes(e.target.value)}
              placeholder="Timeline notes..."
              className="w-full bg-[#0f0f0f] border border-neutral-800 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-gold/40"
            />
          </div>
        </div>

        {/* Characters in scene */}
        <div>
          <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
            Characters in Scene ({sceneCharacters.length})
          </h4>

          {sceneCharacters.length > 0 ? (
            <div className="space-y-3">
              {sceneCharacters.map((char) => {
                const charBd = breakdown?.characterBreakdowns[char.id] || {
                  characterId: char.id,
                  hairNotes: '',
                  makeupNotes: '',
                  generalNotes: '',
                  hasChange: false,
                };

                return (
                  <CharacterBreakdownCard
                    key={char.id}
                    character={char}
                    sceneId={scene.id}
                    breakdown={charBd}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-neutral-600 text-sm italic py-4 text-center">
              No characters assigned to this scene
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-800">
        <button
          onClick={() => markSceneComplete(scene.id, !isComplete)}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isComplete
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
              : 'bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20'
          }`}
        >
          {isComplete ? 'Scene Complete ✓' : 'Mark Scene Complete'}
        </button>
      </div>
    </div>
  );
}
