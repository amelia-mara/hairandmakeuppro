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
    <div>
      {/* Character Header - not in card */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${character.avatarColour || '#C9A962'} 0%, ${adjustColor(character.avatarColour || '#C9A962', -20)} 100%)`,
            }}
          >
            {character.initials}
          </div>

          {/* Character info */}
          <div>
            <h3 className="text-[17px] font-bold text-gold">{character.name}</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {looks.length} look{looks.length !== 1 ? 's' : ''} • {capturedScenes}/{totalScenes} scenes
            </p>
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={`w-5 h-5 text-text-light transition-transform duration-200 flex-shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expandable content - indented */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pl-[52px] space-y-2.5">
          {looks.length > 0 ? (
            <>
              {looks.map(look => (
                <LookCard
                  key={look.id}
                  look={look}
                  character={character}
                  progress={getCaptureProgress(look)}
                />
              ))}

              {/* Add look button */}
              <button
                onClick={onAddLook}
                className="w-full py-3.5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-text-muted bg-card border-2 border-dashed border-gray-200 rounded-card hover:border-gold-300 hover:text-gold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add New Look
              </button>
            </>
          ) : (
            <div className="bg-card rounded-card p-6 text-center">
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-[13px] text-text-muted mb-1">No looks defined</p>
              <p className="text-[11px] text-text-light mb-3">Sync from desktop or create manually</p>
              <button
                onClick={onAddLook}
                className="px-5 py-2.5 rounded-full bg-gold-100/50 text-gold text-xs font-semibold"
              >
                + Add Look
              </button>
            </div>
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
