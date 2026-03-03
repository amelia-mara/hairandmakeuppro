import { useMemo } from 'react';
import type { Scene, Character } from '@/types';

interface ScriptViewProps {
  scene: Scene;
  characters: Character[];
  onCharacterClick: (characterId: string) => void;
}

interface ContentSegment {
  type: 'text' | 'character';
  text: string;
  characterId?: string;
}

export function ScriptView({ scene, characters, onCharacterClick }: ScriptViewProps) {
  // Build a map of character names (and aliases) to their IDs for matching
  const characterMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const char of characters) {
      map.set(char.name.toUpperCase(), char.id);
      for (const alias of char.aliases) {
        map.set(alias.toUpperCase(), char.id);
      }
    }
    return map;
  }, [characters]);

  // Parse the content to highlight character names
  const parsedLines = useMemo(() => {
    const lines = scene.content.split('\n');

    return lines.map((line) => {
      const segments: ContentSegment[] = [];
      let remaining = line;

      if (!remaining.trim()) {
        return [{ type: 'text' as const, text: line }];
      }

      // Build regex pattern from all character names
      const names = Array.from(characterMap.keys()).sort((a, b) => b.length - a.length);
      if (names.length === 0) {
        return [{ type: 'text' as const, text: line }];
      }

      const escapedNames = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'gi');

      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(line)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          segments.push({ type: 'text', text: line.slice(lastIndex, match.index) });
        }

        const matchedName = match[0].toUpperCase();
        const characterId = characterMap.get(matchedName);

        segments.push({
          type: 'character',
          text: match[0],
          characterId,
        });

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < line.length) {
        segments.push({ type: 'text', text: line.slice(lastIndex) });
      }

      return segments.length > 0 ? segments : [{ type: 'text' as const, text: line }];
    });
  }, [scene.content, characterMap]);

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Scene heading */}
      <h2 className="text-lg font-bold text-text-primary uppercase tracking-wide mb-6">
        {scene.heading}
      </h2>

      {/* Script content */}
      <div className="font-script text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
        {parsedLines.map((segments, lineIndex) => (
          <div key={lineIndex} className="min-h-[1.4em]">
            {segments.map((segment, segIndex) => {
              if (segment.type === 'character' && segment.characterId) {
                return (
                  <button
                    key={segIndex}
                    onClick={() => onCharacterClick(segment.characterId!)}
                    className="text-gold font-bold hover:text-gold-hover hover:underline transition-colors-fast cursor-pointer"
                  >
                    {segment.text}
                  </button>
                );
              }
              return <span key={segIndex}>{segment.text}</span>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
