import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Film, Palette } from 'lucide-react';
import { Card, Badge, Select } from '@/components/ui';
import { useProjectStore, useBreakdownStore } from '@/stores';
import type { RoleType } from '@/types';

const roleLabelMap: Record<RoleType, string> = {
  lead: 'Lead',
  supporting: 'Supporting',
  day_player: 'Day Player',
  extra: 'Extra',
};

const roleFilterOptions = [
  { value: 'all', label: 'All Roles' },
  { value: 'lead', label: 'Lead' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'day_player', label: 'Day Player' },
  { value: 'extra', label: 'Extra' },
];

export default function Characters() {
  const navigate = useNavigate();
  const { characters } = useProjectStore();
  const { looks } = useBreakdownStore();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filteredCharacters = useMemo(() => {
    let result = characters;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.actorName?.toLowerCase().includes(q) ||
          c.aliases.some((a) => a.toLowerCase().includes(q))
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter((c) => c.roleType === roleFilter);
    }

    return result;
  }, [characters, search, roleFilter]);

  const getLookCount = (characterId: string) =>
    looks.filter((l) => l.characterId === characterId).length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary tracking-wide">
            CHARACTERS
          </h1>
          <Badge variant="default">{characters.length}</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search characters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-input-bg border border-border-default rounded-md
              text-text-primary text-sm placeholder:text-text-placeholder
              focus:border-border-focus focus:outline-none"
          />
        </div>
        <div className="w-48">
          <Select
            options={roleFilterOptions}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Character Grid */}
      {filteredCharacters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <Users className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">
            {characters.length === 0
              ? 'No characters yet. Import a script to detect characters.'
              : 'No characters match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {filteredCharacters.map((character) => {
            const lookCount = getLookCount(character.id);

            return (
              <Card
                key={character.id}
                hover
                padding="md"
                className="flex flex-col gap-3"
                onClick={() => {
                  /* Navigate to breakdown with this character selected, or open detail */
                }}
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-gold">
                      {character.name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {character.name}
                    </p>
                    {character.actorName && (
                      <p className="text-xs text-text-muted truncate">
                        {character.actorName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Role badge */}
                <Badge variant={character.roleType}>
                  {roleLabelMap[character.roleType]}
                </Badge>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Film className="w-3.5 h-3.5" />
                    {character.sceneCount} scenes
                  </span>
                  <span className="flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" />
                    {lookCount} looks
                  </span>
                </div>

                {/* Description snippet */}
                {character.baseDescription && (
                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                    {character.baseDescription}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
