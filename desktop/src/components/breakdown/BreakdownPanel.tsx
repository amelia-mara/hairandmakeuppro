import { useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { TextArea } from '@/components/ui/TextArea';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';

export function BreakdownPanel() {
  const project = useProjectStore((s) => s.currentProject);
  const selectedSceneId = useUIStore((s) => s.selectedSceneId);
  const selectedCharacterName = useUIStore((s) => s.selectedCharacterName);
  const selectCharacter = useUIStore((s) => s.selectCharacter);
  const updateCharacterSceneData = useProjectStore((s) => s.updateCharacterSceneData);
  const setSceneComplete = useProjectStore((s) => s.setSceneComplete);
  const setSceneStoryDay = useProjectStore((s) => s.setSceneStoryDay);

  const selectedScene = useMemo(() => {
    if (!project || !selectedSceneId) return null;
    return project.scenes.find((s) => s.id === selectedSceneId) || null;
  }, [project, selectedSceneId]);

  const breakdown = useMemo(() => {
    if (!project || !selectedSceneId) return null;
    return project.sceneBreakdowns[selectedSceneId] || null;
  }, [project, selectedSceneId]);

  const characterData = useMemo(() => {
    if (!breakdown || !selectedCharacterName) return null;
    return breakdown.characterData[selectedCharacterName] || null;
  }, [breakdown, selectedCharacterName]);

  const looks = useMemo(() => {
    if (!project || !selectedCharacterName) return [];
    const character = project.characters.find((c) => c.name === selectedCharacterName);
    if (!character) return [];
    return project.looks.filter((l) => l.characterId === character.id);
  }, [project, selectedCharacterName]);

  const handleFieldChange = useCallback(
    (field: string, value: string | boolean) => {
      if (!selectedSceneId || !selectedCharacterName) return;
      updateCharacterSceneData(selectedSceneId, selectedCharacterName, { [field]: value });
    },
    [selectedSceneId, selectedCharacterName, updateCharacterSceneData]
  );

  // Empty state
  if (!selectedScene) {
    return (
      <div className="h-full flex items-center justify-center bg-surface border-l border-white/10">
        <div className="text-center px-6">
          <svg className="w-10 h-10 text-white/20 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
          </svg>
          <p className="text-white/40 text-sm">Select a scene to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface border-l border-white/10">
      {/* Scene Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Scene {selectedScene.number}
            </h3>
            <p className="text-xs text-white/40 truncate">{selectedScene.heading}</p>
          </div>
          <Checkbox
            checked={breakdown?.isComplete || false}
            onChange={(checked) => setSceneComplete(selectedScene.id, checked)}
            label="Done"
          />
        </div>
        <div className="mt-2">
          <Input
            placeholder="Story day (e.g. Day 1)"
            value={breakdown?.storyDay || ''}
            onChange={(e) => setSceneStoryDay(selectedScene.id, e.target.value)}
            className="text-xs"
          />
        </div>
      </div>

      {/* Cast Pills */}
      <div className="px-4 py-2 border-b border-white/10">
        <div className="flex flex-wrap gap-1">
          {selectedScene.characters.map((charName) => (
            <button
              key={charName}
              onClick={() => selectCharacter(charName)}
              className={clsx(
                'px-2 py-1 rounded-full text-xs font-medium transition-colors',
                selectedCharacterName === charName
                  ? 'bg-accent text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              )}
            >
              {charName}
            </button>
          ))}
        </div>
      </div>

      {/* Character Breakdown Form */}
      {selectedCharacterName && characterData ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Look selector */}
          {looks.length > 0 && (
            <div>
              <label className="text-xs font-medium text-white/50 uppercase tracking-wide">Look</label>
              <select
                value={characterData.lookId || ''}
                onChange={(e) => handleFieldChange('lookId', e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
              >
                <option value="">No look assigned</option>
                {looks.map((look) => (
                  <option key={look.id} value={look.id}>{look.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Hair */}
          <TextArea
            label="Hair"
            value={characterData.hairNotes}
            onChange={(e) => handleFieldChange('hairNotes', e.target.value)}
            rows={3}
            placeholder="Hair notes for this scene..."
          />

          {/* Makeup */}
          <TextArea
            label="Makeup"
            value={characterData.makeupNotes}
            onChange={(e) => handleFieldChange('makeupNotes', e.target.value)}
            rows={3}
            placeholder="Makeup notes for this scene..."
          />

          {/* SFX */}
          <TextArea
            label="SFX"
            value={characterData.sfxNotes}
            onChange={(e) => handleFieldChange('sfxNotes', e.target.value)}
            rows={2}
            placeholder="SFX notes (prosthetics, blood, wounds...)"
          />

          {/* Notes */}
          <TextArea
            label="Notes"
            value={characterData.generalNotes}
            onChange={(e) => handleFieldChange('generalNotes', e.target.value)}
            rows={2}
            placeholder="General notes..."
          />

          {/* Change toggle */}
          <Checkbox
            checked={characterData.hasChange}
            onChange={(checked) => handleFieldChange('hasChange', checked)}
            label="Has change from previous scene"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/30 text-sm">Select a character above</p>
        </div>
      )}

      {/* Bottom actions */}
      {selectedCharacterName && (
        <div className="px-4 py-2 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              const uiStore = useUIStore.getState();
              uiStore.setEditingLookId(null);
              uiStore.setShowLookEditor(true);
            }}
          >
            + Create Look for {selectedCharacterName}
          </Button>
        </div>
      )}
    </div>
  );
}
