import type { DetectedCharacter } from '../../types/breakdown';

interface CharacterTabsProps {
  characters: DetectedCharacter[];
  selectedCharacterId: string | null;
  onSelectCharacter: (id: string | null) => void;
  sceneId: string;
}

export default function CharacterTabs({
  characters,
  selectedCharacterId,
  onSelectCharacter,
  sceneId,
}: CharacterTabsProps) {
  // Only show characters in the current scene
  const sceneCharacters = characters.filter((c) => c.scenes.includes(sceneId));

  return (
    <div className="flex items-center border-b border-neutral-800 px-4 overflow-x-auto">
      {/* Script tab (always shown) */}
      <button
        onClick={() => onSelectCharacter(null)}
        className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          selectedCharacterId === null
            ? 'text-gold border-gold'
            : 'text-neutral-400 border-transparent hover:text-white'
        }`}
      >
        SCRIPT
      </button>

      {/* Character tabs */}
      {sceneCharacters.map((char) => (
        <button
          key={char.id}
          onClick={() => onSelectCharacter(char.id)}
          className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            selectedCharacterId === char.id
              ? 'text-gold border-gold'
              : 'text-neutral-400 border-transparent hover:text-white'
          }`}
        >
          {char.name}
        </button>
      ))}

      {sceneCharacters.length === 0 && (
        <span className="px-4 py-2.5 text-sm text-neutral-600 italic">
          No characters in this scene
        </span>
      )}
    </div>
  );
}
