import { useState, useMemo } from 'react';
import { useBreakdownStore } from '../../stores/breakdownStore';
import SceneListItem from './SceneListItem';

export default function SceneList() {
  const { scenes, characters, sceneBreakdowns, selectedSceneId, selectScene } = useBreakdownStore();
  const [search, setSearch] = useState('');

  // Build a map of scene ID → number of characters in that scene
  const sceneCharCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const scene of scenes) {
      const count = characters.filter((c) => c.scenes.includes(scene.id)).length;
      map[scene.id] = count;
    }
    return map;
  }, [scenes, characters]);

  const filtered = useMemo(() => {
    if (!search.trim()) return scenes;
    const q = search.toLowerCase();
    return scenes.filter(
      (s) =>
        s.sceneNumber.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q),
    );
  }, [scenes, search]);

  const completedCount = useMemo(
    () => Object.values(sceneBreakdowns).filter((b) => b.isComplete).length,
    [sceneBreakdowns],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-neutral-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Scenes</h3>
          <span className="text-xs text-neutral-500">
            {completedCount}/{scenes.length}
          </span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search scenes..."
          className="w-full bg-[#1a1a1a] border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold/40"
        />
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.map((scene) => (
          <SceneListItem
            key={scene.id}
            scene={scene}
            breakdown={sceneBreakdowns[scene.id]}
            characterCount={sceneCharCounts[scene.id] || 0}
            isSelected={selectedSceneId === scene.id}
            onClick={() => selectScene(scene.id)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-neutral-600 text-sm text-center py-8">
            {search ? 'No scenes match' : 'No scenes'}
          </p>
        )}
      </div>
    </div>
  );
}
