import { useMemo } from 'react';
import type { ParsedScene, DetectedCharacter } from '../../types/breakdown';

interface ScriptViewProps {
  scene: ParsedScene;
  characters: DetectedCharacter[];
  onCharacterClick: (characterId: string) => void;
}

export default function ScriptView({ scene, characters, onCharacterClick }: ScriptViewProps) {
  // Build a set of character names in this scene for highlighting
  const charNamesInScene = useMemo(() => {
    const charsHere = characters.filter((c) => c.scenes.includes(scene.id));
    return charsHere.map((c) => ({ name: c.name, id: c.id }));
  }, [characters, scene.id]);

  // Highlight character names in script content
  const highlightedContent = useMemo(() => {
    if (!scene.scriptContent || charNamesInScene.length === 0) return null;

    const lines = scene.scriptContent.split('\n');

    return lines.map((line, i) => {
      const trimmed = line.trim();

      // Check if this line is a character cue (all caps, short line before dialogue)
      const matchingChar = charNamesInScene.find((c) => {
        const normalized = trimmed.replace(/\s*\(.*?\)\s*/g, '').trim();
        return normalized === c.name;
      });

      if (matchingChar) {
        return (
          <div key={i} className="py-0.5">
            <button
              onClick={() => onCharacterClick(matchingChar.id)}
              className="text-gold hover:text-gold-light font-bold transition-colors cursor-pointer"
            >
              {trimmed}
            </button>
          </div>
        );
      }

      // Scene heading
      if (/^\d*[A-Z]?\s*(?:INT|EXT)[\s./]/i.test(trimmed)) {
        return (
          <div key={i} className="py-1 font-bold text-white">
            {trimmed}
          </div>
        );
      }

      // Empty line
      if (!trimmed) {
        return <div key={i} className="h-3" />;
      }

      // Regular line
      return (
        <div key={i} className="py-0.5 text-neutral-300">
          {line}
        </div>
      );
    });
  }, [scene.scriptContent, charNamesInScene, onCharacterClick]);

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Scene heading */}
      <div className="mb-4 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gold font-semibold">Scene {scene.sceneNumber}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              scene.intExt === 'EXT'
                ? 'bg-blue-500/15 text-blue-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {scene.intExt}
          </span>
          <span className="text-neutral-500 text-sm">{scene.timeOfDay}</span>
        </div>
        <h3 className="text-white font-medium">{scene.location}</h3>
      </div>

      {/* Script content */}
      <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {highlightedContent || (
          <p className="text-neutral-600 italic">No script content available for this scene.</p>
        )}
      </div>
    </div>
  );
}
