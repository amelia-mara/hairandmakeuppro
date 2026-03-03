import { useState, useMemo } from 'react';
import { useBreakdownStore } from '../../stores/breakdownStore';
import type { DetectedCharacter, ParsedScene } from '../../types/breakdown';

interface CharacterProfileProps {
  character: DetectedCharacter;
  scenes: ParsedScene[];
}

type ProfileTab = 'profile' | 'looks' | 'timeline';

export default function CharacterProfile({ character, scenes }: CharacterProfileProps) {
  const [tab, setTab] = useState<ProfileTab>('profile');
  const { characterProfiles, updateCharacterProfile, selectScene } = useBreakdownStore();

  const profile = characterProfiles[character.id];

  const characterScenes = useMemo(
    () => scenes.filter((s) => character.scenes.includes(s.id)),
    [scenes, character.scenes],
  );

  const ROLE_LABELS: Record<string, string> = {
    lead: 'Lead',
    supporting: 'Supporting',
    day_player: 'Day Player',
    extra: 'Extra',
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Character header */}
      <div className="mb-6 pb-4 border-b border-neutral-800">
        <h3 className="text-white text-xl font-semibold mb-1">{character.name}</h3>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <span>{ROLE_LABELS[character.roleType] || character.roleType}</span>
          <span className="text-neutral-700">|</span>
          <span>{character.sceneCount} scenes</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 bg-[#1a1a1a] p-1 rounded-lg">
        {(['profile', 'looks', 'timeline'] as ProfileTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t
                ? 'bg-[#2a2a2a] text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'profile' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
              Base Description
            </label>
            <textarea
              value={profile?.baseDescription || ''}
              onChange={(e) =>
                updateCharacterProfile(character.id, { baseDescription: e.target.value })
              }
              placeholder="Describe the character's overall look, key features, notes for the department..."
              className="w-full h-32 bg-[#1a1a1a] border border-neutral-800 rounded-lg p-3 text-sm text-white placeholder-neutral-600 resize-none focus:outline-none focus:border-gold/40"
            />
          </div>

          <div className="bg-[#1a1a1a] border border-neutral-800 rounded-lg p-4">
            <p className="text-neutral-500 text-sm italic">
              AI character suggestions will be available in a future update.
            </p>
          </div>
        </div>
      )}

      {tab === 'looks' && (
        <div className="space-y-3">
          {profile?.looks && profile.looks.length > 0 ? (
            profile.looks.map((look) => (
              <div
                key={look.id}
                className="bg-[#1a1a1a] border border-neutral-800 rounded-lg p-4"
              >
                <h4 className="text-white font-medium">{look.name}</h4>
                <p className="text-neutral-500 text-sm mt-1">{look.description || 'No description'}</p>
                <p className="text-neutral-600 text-xs mt-2">
                  {look.scenes.length} scene{look.scenes.length !== 1 ? 's' : ''}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-neutral-500 text-sm mb-3">No looks defined yet</p>
              <button className="px-4 py-2 text-sm border border-neutral-700 rounded-lg text-neutral-300 hover:border-gold/40 hover:text-white transition-colors">
                + Add Look
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <div className="space-y-1">
          {characterScenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => selectScene(scene.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[#1a1a1a] transition-colors"
            >
              <span className="text-gold font-semibold tabular-nums w-8">
                {scene.sceneNumber}
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  scene.intExt === 'EXT' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {scene.intExt}
              </span>
              <span className="text-neutral-400 text-sm truncate flex-1">{scene.location}</span>
              <span className="text-neutral-600 text-xs">{scene.timeOfDay}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
