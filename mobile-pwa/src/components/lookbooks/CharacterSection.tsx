import { useState } from 'react';
import type { Character, Look } from '@/types';
import { LookCard } from './LookCard';

interface CharacterSectionProps {
  character: Character;
  looks: Look[];
  capturedScenes: number;
  totalScenes: number;
  getCaptureProgress: (look: Look) => { captured: number; total: number };
  onAddLook: () => void;
}

export function CharacterSection({
  character,
  looks,
  capturedScenes,
  totalScenes,
  getCaptureProgress,
  onAddLook,
}: CharacterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-card rounded-card overflow-hidden shadow-card">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
      >
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${character.avatarColour || '#C9A962'} 0%, ${adjustColor(character.avatarColour || '#C9A962', -20)} 100%)`,
          }}
        >
          {character.initials}
        </div>

        {/* Character info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-primary truncate">{character.name}</h3>
            <span className="px-2 py-0.5 bg-gold-100 text-gold text-xs font-medium rounded-full flex-shrink-0">
              {looks.length} look{looks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-sm text-text-muted mt-0.5">
            {capturedScenes}/{totalScenes} scenes captured
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={`w-5 h-5 text-text-muted transition-transform duration-200 flex-shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 space-y-3">
          {looks.length > 0 ? (
            looks.map(look => (
              <LookCard
                key={look.id}
                look={look}
                character={character}
                progress={getCaptureProgress(look)}
              />
            ))
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-text-muted mb-3">No looks defined for this character</p>
              <button
                onClick={onAddLook}
                className="text-sm text-gold font-medium"
              >
                + Add first look
              </button>
            </div>
          )}

          {/* Add look button for character */}
          {looks.length > 0 && (
            <button
              onClick={onAddLook}
              className="w-full py-2 text-sm text-gold font-medium border border-dashed border-gold-300 rounded-input hover:bg-gold-50 transition-colors"
            >
              + Add look for {character.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to darken a color for gradient
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
