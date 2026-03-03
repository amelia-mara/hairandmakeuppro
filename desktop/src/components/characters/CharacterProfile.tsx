import { useState, useMemo } from 'react';
import { Plus, Pencil, User, Palette, Clock } from 'lucide-react';
import { Tabs, Badge, Input, TextArea, Button, Card } from '@/components/ui';
import type { Character, Look, Scene } from '@/types';

interface CharacterProfileProps {
  character: Character;
  looks: Look[];
  scenes: Scene[];
  onUpdateCharacter: (data: Partial<Character>) => void;
  onAddLook: () => void;
  onEditLook: (lookId: string) => void;
}

const SUB_TABS = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'looks', label: 'Looks', icon: <Palette className="w-4 h-4" /> },
  { id: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
];

const ROLE_LABELS: Record<string, string> = {
  lead: 'Lead',
  supporting: 'Supporting',
  day_player: 'Day Player',
  extra: 'Extra',
};

function ProfileTab({
  character,
  onUpdateCharacter,
}: {
  character: Character;
  onUpdateCharacter: (data: Partial<Character>) => void;
}) {
  return (
    <div className="space-y-4 p-4">
      <TextArea
        label="Base Description"
        value={character.baseDescription || ''}
        onChange={(e) => onUpdateCharacter({ baseDescription: e.target.value })}
        placeholder="Physical description, distinguishing features, general look..."
      />
      <Input
        label="Actor Name"
        value={character.actorName || ''}
        onChange={(e) => onUpdateCharacter({ actorName: e.target.value })}
        placeholder="Actor / performer name"
      />
    </div>
  );
}

function LooksTab({
  looks,
  scenes,
  onAddLook,
  onEditLook,
}: {
  looks: Look[];
  scenes: Scene[];
  onAddLook: () => void;
  onEditLook: (lookId: string) => void;
}) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {looks.map((look) => {
          const assignedSceneCount = look.assignedSceneIds.length;

          return (
            <Card key={look.id} hover padding="sm">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-text-primary">
                  {look.name}
                </h4>
                <button
                  onClick={() => onEditLook(look.id)}
                  className="p-1 text-text-muted hover:text-text-primary rounded transition-colors-fast"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-text-muted">
                {assignedSceneCount} {assignedSceneCount === 1 ? 'scene' : 'scenes'}
              </p>
              {look.hairDescription && (
                <p className="text-xs text-text-secondary mt-1 truncate">
                  Hair: {look.hairDescription}
                </p>
              )}
              {look.makeupDescription && (
                <p className="text-xs text-text-secondary mt-0.5 truncate">
                  Makeup: {look.makeupDescription}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <Button
        variant="secondary"
        size="sm"
        icon={<Plus className="w-4 h-4" />}
        onClick={onAddLook}
        className="w-full"
      >
        Add Look
      </Button>
    </div>
  );
}

function TimelineTab({
  character,
  scenes,
  looks,
}: {
  character: Character;
  scenes: Scene[];
  looks: Look[];
}) {
  // Get scenes this character appears in, sorted by scene number
  const characterScenes = useMemo(() => {
    return scenes
      .filter((s) => character.sceneNumbers.includes(s.number))
      .sort((a, b) => a.number - b.number);
  }, [scenes, character.sceneNumbers]);

  return (
    <div className="p-4">
      {characterScenes.length === 0 && (
        <p className="text-sm text-text-muted text-center py-6">
          No scene appearances found.
        </p>
      )}

      <div className="space-y-1">
        {characterScenes.map((scene) => {
          // Find look assigned to this scene for this character
          const assignedLook = looks.find((l) =>
            l.assignedSceneIds.includes(scene.id)
          );

          return (
            <div
              key={scene.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors-fast"
            >
              <span className="text-sm font-medium text-gold w-10 shrink-0">
                {scene.number}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {scene.heading}
                </p>
              </div>
              {assignedLook && (
                <Badge variant="default">{assignedLook.name}</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CharacterProfile({
  character,
  looks,
  scenes,
  onUpdateCharacter,
  onAddLook,
  onEditLook,
}: CharacterProfileProps) {
  const [activeTab, setActiveTab] = useState('profile');

  // Filter looks for this character
  const characterLooks = useMemo(
    () => looks.filter((l) => l.characterId === character.id),
    [looks, character.id]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Character header */}
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-muted flex items-center justify-center">
            <User className="w-5 h-5 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                {character.name}
              </h2>
              <Badge variant={character.roleType}>
                {ROLE_LABELS[character.roleType] || character.roleType}
              </Badge>
            </div>
            <p className="text-sm text-text-muted">
              {character.sceneCount} {character.sceneCount === 1 ? 'scene' : 'scenes'}
              {character.actorName && (
                <span> &middot; {character.actorName}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs tabs={SUB_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'profile' && (
          <ProfileTab
            character={character}
            onUpdateCharacter={onUpdateCharacter}
          />
        )}
        {activeTab === 'looks' && (
          <LooksTab
            looks={characterLooks}
            scenes={scenes}
            onAddLook={onAddLook}
            onEditLook={onEditLook}
          />
        )}
        {activeTab === 'timeline' && (
          <TimelineTab
            character={character}
            scenes={scenes}
            looks={characterLooks}
          />
        )}
      </div>
    </div>
  );
}
