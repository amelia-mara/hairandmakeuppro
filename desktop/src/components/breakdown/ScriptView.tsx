import { useEffect, useRef, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

/**
 * Classify a script line for formatting
 */
function classifyLine(line: string): 'heading' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'action' {
  const trimmed = line.trim();
  if (!trimmed) return 'action';
  if (/^(\d+\.?\s*)?(INT\.|EXT\.|INT\/EXT|I\/E\.)/i.test(trimmed)) return 'heading';
  if (/^(CUT TO|FADE|DISSOLVE|SMASH CUT|MATCH CUT)/i.test(trimmed)) return 'transition';
  if (/^\(.*\)$/.test(trimmed)) return 'parenthetical';
  if (trimmed === trimmed.toUpperCase() && trimmed.length < 40 && /^[A-Z]/.test(trimmed) && !trimmed.endsWith('.')) return 'character';
  return trimmed.startsWith(' ') || trimmed.startsWith('\t') ? 'dialogue' : 'action';
}

export function ScriptView() {
  const project = useProjectStore((s) => s.currentProject);
  const selectedSceneId = useUIStore((s) => s.selectedSceneId);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedScene = useMemo(() => {
    if (!project || !selectedSceneId) return null;
    return project.scenes.find((s) => s.id === selectedSceneId) || null;
  }, [project, selectedSceneId]);

  // Scroll to top when scene changes
  useEffect(() => {
    containerRef.current?.scrollTo(0, 0);
  }, [selectedSceneId]);

  if (!project) return null;

  // If a specific scene is selected, show just that scene
  const scenesToShow = selectedScene ? [selectedScene] : project.scenes;

  return (
    <div ref={containerRef} className="h-full overflow-y-auto p-4 font-mono text-sm leading-relaxed">
      {scenesToShow.map((scene) => (
        <div
          key={scene.id}
          id={`scene-${scene.id}`}
          className="mb-8"
        >
          {scene.content.split('\n').map((line, i) => {
            const type = classifyLine(line);
            return (
              <div key={i} className={getLineClass(type)}>
                {line || '\u00A0'}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function getLineClass(type: ReturnType<typeof classifyLine>): string {
  switch (type) {
    case 'heading':
      return 'text-accent font-bold uppercase my-4';
    case 'character':
      return 'text-white/90 font-semibold text-center mt-3';
    case 'dialogue':
      return 'text-white/80 mx-8 md:mx-16';
    case 'parenthetical':
      return 'text-white/50 italic mx-12 md:mx-20';
    case 'transition':
      return 'text-white/40 text-right uppercase my-2';
    default:
      return 'text-white/70 my-1';
  }
}
