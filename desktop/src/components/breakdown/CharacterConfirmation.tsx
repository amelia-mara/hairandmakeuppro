import { useState, useMemo } from 'react';
import type { DetectedCharacter } from '../../types/breakdown';

interface CharacterConfirmationProps {
  characters: DetectedCharacter[];
  onConfirm: (confirmedIds: string[]) => void;
  onBack: () => void;
}

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  lead: { label: 'Lead', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  supporting: { label: 'Supporting', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  day_player: { label: 'Day Player', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  extra: { label: 'Extra', className: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' },
};

export default function CharacterConfirmation({
  characters,
  onConfirm,
  onBack,
}: CharacterConfirmationProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(characters.map((c) => c.id)),
  );

  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => b.sceneCount - a.sceneCount),
    [characters],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(characters.map((c) => c.id)));
  const deselectAll = () => setSelected(new Set());

  const selectedCount = selected.size;
  const totalCount = characters.length;

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-neutral-400 hover:text-white text-sm mb-4 inline-block transition-colors"
        >
          &larr; Back to upload
        </button>
        <h2 className="text-2xl font-semibold text-white mb-2">Confirm Characters</h2>
        <p className="text-neutral-400 text-sm">
          {totalCount} characters detected. Uncheck any you don't need to track.
        </p>
      </div>

      {/* Select controls */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={selectAll}
          className="text-sm text-gold hover:text-gold-light transition-colors"
        >
          Select All
        </button>
        <span className="text-neutral-700">|</span>
        <button
          onClick={deselectAll}
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Deselect All
        </button>
        <span className="ml-auto text-sm text-neutral-500">
          {selectedCount} of {totalCount} selected
        </span>
      </div>

      {/* Character list */}
      <div className="space-y-1 mb-8 max-h-[50vh] overflow-y-auto">
        {sortedCharacters.map((char) => {
          const isSelected = selected.has(char.id);
          const badge = ROLE_BADGES[char.roleType];

          return (
            <button
              key={char.id}
              onClick={() => toggle(char.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                isSelected
                  ? 'bg-[#1a1a1a] border border-neutral-700'
                  : 'bg-transparent border border-transparent opacity-50 hover:opacity-75'
              }`}
            >
              {/* Checkbox */}
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'bg-gold border-gold' : 'border-neutral-600'
                }`}
              >
                {isSelected && (
                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Name */}
              <span className="text-white font-medium flex-1 truncate">{char.name}</span>

              {/* Role badge */}
              <span className={`text-xs px-2 py-0.5 rounded border ${badge.className}`}>
                {badge.label}
              </span>

              {/* Scene count */}
              <span className="text-neutral-500 text-sm tabular-nums w-16 text-right">
                {char.sceneCount} scene{char.sceneCount !== 1 ? 's' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* Confirm button */}
      <button
        onClick={() => onConfirm(Array.from(selected))}
        disabled={selectedCount === 0}
        className="w-full py-3 bg-gold text-black font-medium rounded-lg hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Confirm {selectedCount} Character{selectedCount !== 1 ? 's' : ''} & Start Breakdown
      </button>
    </div>
  );
}
