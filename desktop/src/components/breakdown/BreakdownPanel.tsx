import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import { Input, TextArea, Select, Radio, Button, Badge } from '@/components/ui';
import type { Scene, Character, SceneBreakdown, CharacterSceneData, Look } from '@/types';

interface BreakdownPanelProps {
  scene: Scene;
  characters: Character[];
  breakdown: SceneBreakdown;
  looks: Look[];
  onUpdateBreakdown: (data: Partial<SceneBreakdown>) => void;
  onUpdateCharacterBreakdown: (charId: string, data: Partial<CharacterSceneData>) => void;
  onMarkComplete: () => void;
}

function CharacterSection({
  character,
  charData,
  looks,
  onUpdate,
}: {
  character: Character;
  charData: CharacterSceneData;
  looks: Look[];
  onUpdate: (data: Partial<CharacterSceneData>) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const lookOptions = [
    { value: '', label: 'No look assigned' },
    ...looks.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      {/* Character header - collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-elevated hover:bg-surface-hover transition-colors-fast text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
        )}
        <span className="text-sm font-medium text-text-primary flex-1">
          {character.name}
        </span>
        <Badge variant={character.roleType}>
          {character.roleType.replace('_', ' ')}
        </Badge>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="px-4 py-4 space-y-4 bg-surface">
          {/* Look dropdown */}
          <Select
            label="Look"
            options={lookOptions}
            value={charData.lookId || ''}
            onChange={(e) =>
              onUpdate({ lookId: e.target.value || undefined })
            }
            placeholder="Select a look"
          />

          {/* Hair notes */}
          <TextArea
            label="Hair Notes"
            value={charData.hairNotes}
            onChange={(e) => onUpdate({ hairNotes: e.target.value })}
            placeholder="Hair styling notes..."
            rows={2}
            className="min-h-0"
            style={{ minHeight: '3.5rem' }}
          />

          {/* Makeup notes */}
          <TextArea
            label="Makeup Notes"
            value={charData.makeupNotes}
            onChange={(e) => onUpdate({ makeupNotes: e.target.value })}
            placeholder="Makeup notes..."
            rows={2}
            className="min-h-0"
            style={{ minHeight: '3.5rem' }}
          />

          {/* SFX notes */}
          <TextArea
            label="SFX Notes"
            value={charData.sfxNotes}
            onChange={(e) => onUpdate({ sfxNotes: e.target.value })}
            placeholder="Special effects notes..."
            rows={2}
            className="min-h-0"
            style={{ minHeight: '3.5rem' }}
          />

          {/* General notes */}
          <TextArea
            label="Notes"
            value={charData.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="General notes..."
            rows={2}
            className="min-h-0"
            style={{ minHeight: '3.5rem' }}
          />

          {/* Change radio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Change</label>
            <div className="flex items-center gap-4">
              <Radio
                name={`change-${character.id}`}
                label="No Change"
                checked={!charData.hasChange}
                onChange={() => onUpdate({ hasChange: false })}
              />
              <Radio
                name={`change-${character.id}`}
                label="Change"
                checked={charData.hasChange}
                onChange={() => onUpdate({ hasChange: true })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BreakdownPanel({
  scene,
  characters,
  breakdown,
  looks,
  onUpdateBreakdown,
  onUpdateCharacterBreakdown,
  onMarkComplete,
}: BreakdownPanelProps) {
  // Filter characters that appear in this scene
  const sceneCharacters = characters.filter((c) =>
    scene.characterIds.includes(c.id)
  );

  const handleStoryDayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdateBreakdown({ storyDay: e.target.value });
    },
    [onUpdateBreakdown]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Scene header info */}
      <div className="px-4 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-semibold text-text-primary">
            Scene {scene.number}
          </span>
          <Badge variant={scene.intExt === 'INT' ? 'int' : 'ext'}>
            {scene.intExt}
          </Badge>
          <Badge variant={scene.timeOfDay.toLowerCase() === 'night' ? 'night' : 'day'}>
            {scene.timeOfDay}
          </Badge>
        </div>
        <p className="text-sm text-text-secondary">{scene.location}</p>
      </div>

      {/* Scrollable form area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Story Day input */}
        <Input
          label="Story Day"
          value={breakdown.storyDay || ''}
          onChange={handleStoryDayChange}
          placeholder="e.g., Day 1, Night 3"
        />

        {/* Characters section */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Characters ({sceneCharacters.length})
          </h3>

          <div className="space-y-2">
            {sceneCharacters.map((character) => {
              const charData: CharacterSceneData = breakdown.characters[
                character.id
              ] || {
                characterId: character.id,
                hairNotes: '',
                makeupNotes: '',
                sfxNotes: '',
                notes: '',
                hasChange: false,
              };

              const characterLooks = looks.filter(
                (l) => l.characterId === character.id
              );

              return (
                <CharacterSection
                  key={character.id}
                  character={character}
                  charData={charData}
                  looks={characterLooks}
                  onUpdate={(data) =>
                    onUpdateCharacterBreakdown(character.id, data)
                  }
                />
              );
            })}

            {sceneCharacters.length === 0 && (
              <p className="text-sm text-text-muted py-4 text-center">
                No characters in this scene.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mark Complete button */}
      <div className="px-4 py-4 border-t border-border-subtle">
        <Button
          onClick={onMarkComplete}
          variant={breakdown.isComplete ? 'secondary' : 'primary'}
          className={`w-full ${
            breakdown.isComplete
              ? 'bg-success/20 border-success/30 text-success hover:bg-success/30'
              : ''
          }`}
          icon={
            breakdown.isComplete ? (
              <CheckCircle className="w-4 h-4" />
            ) : undefined
          }
        >
          {breakdown.isComplete ? 'Completed' : 'Mark Complete'}
        </Button>
      </div>
    </div>
  );
}
