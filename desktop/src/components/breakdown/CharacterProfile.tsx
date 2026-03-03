import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type ProfileTab = 'profile' | 'looks' | 'timeline';

export function CharacterProfile() {
  const project = useProjectStore((s) => s.currentProject);
  const activeCenterTab = useUIStore((s) => s.activeCenterTab);
  const updateCharacterDescription = useProjectStore((s) => s.updateCharacterDescription);
  const setShowLookEditor = useUIStore((s) => s.setShowLookEditor);
  const setEditingLookId = useUIStore((s) => s.setEditingLookId);

  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>('profile');

  const character = useMemo(() => {
    if (!project || activeCenterTab === 'script') return null;
    return project.characters.find((c) => c.name === activeCenterTab) || null;
  }, [project, activeCenterTab]);

  const characterLooks = useMemo(() => {
    if (!project || !character) return [];
    return project.looks.filter((l) => l.characterId === character.id);
  }, [project, character]);

  if (!character || activeCenterTab === 'script') return null;

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Character header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-accent font-bold text-sm">
              {character.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{character.name}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="accent">{character.roleType.replace('_', ' ')}</Badge>
              <span className="text-xs text-white/40">{character.sceneCount} scenes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/10">
        {(['profile', 'looks', 'timeline'] as ProfileTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveProfileTab(tab)}
            className={`px-3 py-2 text-xs font-medium capitalize border-b-2 transition-colors ${
              activeProfileTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-white/50 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeProfileTab === 'profile' && (
        <div className="space-y-4">
          <TextArea
            label="Base Description"
            value={character.baseDescription || ''}
            onChange={(e) => updateCharacterDescription(character.id, e.target.value)}
            rows={4}
            placeholder="Describe the character's default look, hair color, key features..."
          />
          <div>
            <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">Scenes</h4>
            <div className="flex flex-wrap gap-1">
              {character.scenes.map((sceneNum) => (
                <Badge key={sceneNum} variant="muted">{sceneNum}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Looks tab */}
      {activeProfileTab === 'looks' && (
        <div className="space-y-3">
          {characterLooks.map((look) => (
            <div
              key={look.id}
              className="bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
              onClick={() => {
                setEditingLookId(look.id);
                setShowLookEditor(true);
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-white">{look.name}</h4>
                <Badge variant="muted">{look.assignedScenes.length} scenes</Badge>
              </div>
              {look.hairDescription && (
                <p className="text-xs text-white/50 truncate">Hair: {look.hairDescription}</p>
              )}
              {look.makeupDescription && (
                <p className="text-xs text-white/50 truncate">Makeup: {look.makeupDescription}</p>
              )}
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => {
              setEditingLookId(null);
              setShowLookEditor(true);
            }}
          >
            + Add Look
          </Button>
        </div>
      )}

      {/* Timeline tab */}
      {activeProfileTab === 'timeline' && (
        <div className="space-y-2">
          {project?.scenes
            .filter((s) => s.characters.includes(character.name))
            .map((scene) => {
              const breakdown = project.sceneBreakdowns[scene.id];
              const charData = breakdown?.characterData[character.name];
              const isComplete = breakdown?.isComplete;

              return (
                <div
                  key={scene.id}
                  className="flex items-start gap-3 py-2 border-b border-white/5"
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isComplete ? 'bg-green-400' : 'bg-white/20'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/50">{scene.number}</span>
                      <span className="text-xs text-white/70 truncate">{scene.location}</span>
                    </div>
                    {charData && (charData.hairNotes || charData.makeupNotes) && (
                      <div className="mt-1 text-xs text-white/40">
                        {charData.hairNotes && <span>Hair: {charData.hairNotes} </span>}
                        {charData.makeupNotes && <span>Makeup: {charData.makeupNotes}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
