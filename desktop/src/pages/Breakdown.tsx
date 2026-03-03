import { useMemo } from 'react';
import {
  Search,
  Circle,
  CircleDot,
  CheckCircle2,
  FileText,
  User,
  ChevronDown,
} from 'lucide-react';
import { ThreePanel } from '@/components/layout/ThreePanel';
import {
  Input,
  Badge,
  Tabs,
  Card,
  Select,
  TextArea,
  Radio,
  Button,
} from '@/components/ui';
import { useProjectStore, useBreakdownStore, useUIStore } from '@/stores';
import { getCompletionStatus, cn } from '@/utils/helpers';
import type { Scene, Character } from '@/types';

/* ------------------------------------------------------------------ */
/*  Scene List (Left Panel)                                           */
/* ------------------------------------------------------------------ */

function SceneListPanel() {
  const { scenes } = useProjectStore();
  const { sceneBreakdowns } = useBreakdownStore();
  const { selectedSceneId, sceneSearch, selectScene, setSceneSearch } =
    useUIStore();

  const filteredScenes = useMemo(() => {
    if (!sceneSearch.trim()) return scenes;
    const q = sceneSearch.toLowerCase();
    return scenes.filter(
      (s) =>
        s.heading.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        String(s.number).includes(q)
    );
  }, [scenes, sceneSearch]);

  const completionIcon = (scene: Scene) => {
    const status = getCompletionStatus(sceneBreakdowns, scene.id);
    if (status === 'complete')
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (status === 'partial')
      return <CircleDot className="w-4 h-4 text-gold shrink-0" />;
    return <Circle className="w-4 h-4 text-text-muted shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border-subtle">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search scenes..."
            value={sceneSearch}
            onChange={(e) => setSceneSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-sm bg-input-bg border border-border-default rounded-md
              text-text-primary placeholder:text-text-placeholder focus:border-border-focus focus:outline-none"
          />
        </div>
      </div>

      {/* Scene items */}
      <div className="flex-1 overflow-y-auto">
        {filteredScenes.length === 0 && (
          <p className="text-xs text-text-muted p-4 text-center">
            {scenes.length === 0
              ? 'No scenes yet. Import a script to get started.'
              : 'No scenes match your search.'}
          </p>
        )}
        {filteredScenes.map((scene) => {
          const isSelected = selectedSceneId === scene.id;
          return (
            <button
              key={scene.id}
              onClick={() => selectScene(scene.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 border-b border-border-subtle transition-colors-fast',
                isSelected
                  ? 'bg-gold/10 border-l-2 border-l-gold'
                  : 'hover:bg-surface-hover border-l-2 border-l-transparent'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted w-5 text-right shrink-0">
                  {scene.number}
                </span>
                <Badge
                  variant={scene.intExt === 'EXT' ? 'ext' : 'int'}
                >
                  {scene.intExt}
                </Badge>
                <span className="text-sm text-text-primary truncate flex-1">
                  {scene.location}
                </span>
                {completionIcon(scene)}
              </div>
              <div className="flex items-center gap-2 mt-1 ml-7">
                <Badge
                  variant={
                    scene.timeOfDay.toLowerCase().includes('night')
                      ? 'night'
                      : 'day'
                  }
                >
                  {scene.timeOfDay}
                </Badge>
                {scene.storyDay && (
                  <span className="text-[10px] text-text-muted">
                    {scene.storyDay}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="p-3 border-t border-border-subtle text-xs text-text-muted text-center">
        {scenes.length} scenes &middot;{' '}
        {scenes.filter((s) => getCompletionStatus(sceneBreakdowns, s.id) === 'complete').length} complete
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Center Panel: Script + Character Tabs                             */
/* ------------------------------------------------------------------ */

function CenterPanel() {
  const { scenes, characters } = useProjectStore();
  const { selectedSceneId, activeTab, setActiveTab } = useUIStore();

  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId]
  );

  const sceneCharacters = useMemo(() => {
    if (!selectedScene) return [];
    return characters.filter((c) => selectedScene.characterIds.includes(c.id));
  }, [characters, selectedScene]);

  const tabs = useMemo(() => {
    const base = [{ id: 'script', label: 'Script', icon: <FileText className="w-3.5 h-3.5" /> }];
    sceneCharacters.forEach((c) => {
      base.push({
        id: c.id,
        label: c.name,
        icon: <User className="w-3.5 h-3.5" />,
      });
    });
    return base;
  }, [sceneCharacters]);

  if (!selectedScene) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center space-y-2">
          <FileText className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-sm">Select a scene to view its breakdown</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'script' ? (
          <ScriptView scene={selectedScene} />
        ) : (
          <CharacterProfileView
            character={sceneCharacters.find((c) => c.id === activeTab) ?? null}
          />
        )}
      </div>
    </div>
  );
}

function ScriptView({ scene }: { scene: Scene }) {
  return (
    <div className="space-y-4">
      {/* Scene heading */}
      <div className="space-y-1">
        <h2 className="text-base font-bold text-gold uppercase tracking-wide font-mono">
          {scene.heading}
        </h2>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {scene.storyDay && <span>{scene.storyDay}</span>}
          {scene.pageStart && (
            <span>
              {scene.pageStart === scene.pageEnd
                ? `p.${scene.pageStart}`
                : `pp.${scene.pageStart}-${scene.pageEnd}`}
            </span>
          )}
        </div>
      </div>

      {scene.synopsis && (
        <p className="text-sm text-text-secondary italic border-l-2 border-gold/30 pl-3">
          {scene.synopsis}
        </p>
      )}

      {/* Script content in monospace */}
      <div className="bg-base/50 border border-border-subtle rounded-lg p-4">
        <pre className="text-sm text-text-primary font-mono whitespace-pre-wrap leading-relaxed">
          {scene.content}
        </pre>
      </div>
    </div>
  );
}

function CharacterProfileView({ character }: { character: Character | null }) {
  if (!character) {
    return (
      <p className="text-sm text-text-muted">Character not found.</p>
    );
  }

  const roleLabelMap: Record<string, string> = {
    lead: 'Lead',
    supporting: 'Supporting',
    day_player: 'Day Player',
    extra: 'Extra',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center text-gold font-bold text-lg">
          {character.name.charAt(0)}
        </div>
        <div>
          <h3 className="text-lg font-bold text-text-primary">
            {character.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={character.roleType}>
              {roleLabelMap[character.roleType] || character.roleType}
            </Badge>
            {character.actorName && (
              <span className="text-xs text-text-muted">
                {character.actorName}
              </span>
            )}
          </div>
        </div>
      </div>

      {character.baseDescription && (
        <Card padding="sm">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
            Description
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {character.baseDescription}
          </p>
        </Card>
      )}

      <Card padding="sm">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
          Appearances
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-text-muted">Total Scenes: </span>
            <span className="text-text-primary font-medium">
              {character.sceneCount}
            </span>
          </div>
          <div>
            <span className="text-text-muted">First: </span>
            <span className="text-text-primary font-medium">
              Sc. {character.firstAppearance}
            </span>
          </div>
          <div>
            <span className="text-text-muted">Last: </span>
            <span className="text-text-primary font-medium">
              Sc. {character.lastAppearance}
            </span>
          </div>
        </div>
      </Card>

      {character.aliases.length > 0 && (
        <Card padding="sm">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
            Also Known As
          </p>
          <div className="flex flex-wrap gap-1.5">
            {character.aliases.map((alias) => (
              <Badge key={alias} variant="default">
                {alias}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Breakdown Form (Right Panel)                                      */
/* ------------------------------------------------------------------ */

function BreakdownPanel() {
  const { scenes, characters } = useProjectStore();
  const {
    sceneBreakdowns,
    looks,
    getBreakdown,
    updateCharacterBreakdown,
    markSceneComplete,
    getLooksForCharacter,
  } = useBreakdownStore();
  const { selectedSceneId } = useUIStore();

  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId]
  );

  const sceneCharacters = useMemo(() => {
    if (!selectedScene) return [];
    return characters.filter((c) => selectedScene.characterIds.includes(c.id));
  }, [characters, selectedScene]);

  const breakdown = selectedSceneId ? getBreakdown(selectedSceneId) : null;

  if (!selectedScene || !breakdown) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center space-y-2">
          <ChevronDown className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-sm">Select a scene to begin breakdown</p>
        </div>
      </div>
    );
  }

  const isComplete = breakdown.isComplete;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Scene {selectedScene.number} Breakdown
          </h3>
          {isComplete ? (
            <Badge variant="lead">Complete</Badge>
          ) : (
            <Badge variant="default">In Progress</Badge>
          )}
        </div>
      </div>

      {/* Character breakdown forms */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {sceneCharacters.length === 0 && (
          <p className="text-xs text-text-muted text-center py-8">
            No characters assigned to this scene.
          </p>
        )}

        {sceneCharacters.map((character) => {
          const charData = breakdown.characters[character.id] ?? {
            characterId: character.id,
            lookId: '',
            hairNotes: '',
            makeupNotes: '',
            sfxNotes: '',
            notes: '',
            hasChange: false,
          };
          const charLooks = getLooksForCharacter(character.id);

          const lookOptions = [
            { value: '', label: 'No look assigned' },
            ...charLooks.map((l) => ({ value: l.id, label: l.name })),
          ];

          return (
            <div
              key={character.id}
              className="border border-border-default rounded-lg overflow-hidden"
            >
              {/* Character header */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-elevated border-b border-border-subtle">
                <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-gold">
                    {character.name.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {character.name}
                </span>
                <Badge variant={character.roleType} className="ml-auto">
                  {character.roleType.replace('_', ' ')}
                </Badge>
              </div>

              {/* Form */}
              <div className="p-3 space-y-3">
                {/* Look selector */}
                <Select
                  label="Look"
                  options={lookOptions}
                  value={charData.lookId || ''}
                  onChange={(e) =>
                    updateCharacterBreakdown(selectedScene.id, character.id, {
                      lookId: e.target.value || undefined,
                    })
                  }
                />

                {/* Hair */}
                <TextArea
                  label="Hair"
                  placeholder="Hair notes for this scene..."
                  value={charData.hairNotes}
                  onChange={(e) =>
                    updateCharacterBreakdown(selectedScene.id, character.id, {
                      hairNotes: e.target.value,
                    })
                  }
                  className="!min-h-[60px]"
                />

                {/* Makeup */}
                <TextArea
                  label="Makeup"
                  placeholder="Makeup notes for this scene..."
                  value={charData.makeupNotes}
                  onChange={(e) =>
                    updateCharacterBreakdown(selectedScene.id, character.id, {
                      makeupNotes: e.target.value,
                    })
                  }
                  className="!min-h-[60px]"
                />

                {/* SFX */}
                <TextArea
                  label="SFX / Prosthetics"
                  placeholder="SFX notes for this scene..."
                  value={charData.sfxNotes}
                  onChange={(e) =>
                    updateCharacterBreakdown(selectedScene.id, character.id, {
                      sfxNotes: e.target.value,
                    })
                  }
                  className="!min-h-[60px]"
                />

                {/* Notes */}
                <TextArea
                  label="Notes"
                  placeholder="Additional notes..."
                  value={charData.notes}
                  onChange={(e) =>
                    updateCharacterBreakdown(selectedScene.id, character.id, {
                      notes: e.target.value,
                    })
                  }
                  className="!min-h-[60px]"
                />

                {/* Change radio */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-text-secondary">
                    Change from previous scene?
                  </p>
                  <div className="flex gap-4">
                    <Radio
                      name={`change-${character.id}`}
                      label="No Change"
                      checked={!charData.hasChange}
                      onChange={() =>
                        updateCharacterBreakdown(
                          selectedScene.id,
                          character.id,
                          { hasChange: false, changeNotes: undefined }
                        )
                      }
                    />
                    <Radio
                      name={`change-${character.id}`}
                      label="Change"
                      checked={charData.hasChange}
                      onChange={() =>
                        updateCharacterBreakdown(
                          selectedScene.id,
                          character.id,
                          { hasChange: true }
                        )
                      }
                    />
                  </div>
                  {charData.hasChange && (
                    <Input
                      placeholder="Describe the change..."
                      value={charData.changeNotes || ''}
                      onChange={(e) =>
                        updateCharacterBreakdown(
                          selectedScene.id,
                          character.id,
                          { changeNotes: e.target.value }
                        )
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mark complete */}
      <div className="p-4 border-t border-border-subtle">
        <Button
          variant={isComplete ? 'secondary' : 'primary'}
          className="w-full"
          icon={<CheckCircle2 className="w-4 h-4" />}
          onClick={() => {
            if (!isComplete) markSceneComplete(selectedScene.id);
          }}
          disabled={isComplete}
        >
          {isComplete ? 'Scene Complete' : 'Mark Complete'}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Export                                                        */
/* ------------------------------------------------------------------ */

export default function Breakdown() {
  return (
    <ThreePanel
      left={<SceneListPanel />}
      center={<CenterPanel />}
      right={<BreakdownPanel />}
      leftWidth={260}
      rightWidth={360}
    />
  );
}
