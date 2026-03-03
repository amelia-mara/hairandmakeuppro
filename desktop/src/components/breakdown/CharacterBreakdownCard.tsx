import { useBreakdownStore } from '../../stores/breakdownStore';
import type { DetectedCharacter, CharacterSceneBreakdown } from '../../types/breakdown';

interface CharacterBreakdownCardProps {
  character: DetectedCharacter;
  sceneId: string;
  breakdown: CharacterSceneBreakdown;
}

export default function CharacterBreakdownCard({
  character,
  sceneId,
  breakdown,
}: CharacterBreakdownCardProps) {
  const { updateCharacterSceneBreakdown } = useBreakdownStore();

  const update = (data: Partial<CharacterSceneBreakdown>) => {
    updateCharacterSceneBreakdown(sceneId, character.id, data);
  };

  return (
    <div className="bg-[#1a1a1a] border border-neutral-800 rounded-lg p-4">
      {/* Character name */}
      <h4 className="text-white font-medium text-sm mb-3 uppercase tracking-wide">
        {character.name}
      </h4>

      <div className="space-y-3">
        {/* Hair */}
        <div>
          <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
            Hair
          </label>
          <input
            type="text"
            value={breakdown.hairNotes}
            onChange={(e) => update({ hairNotes: e.target.value })}
            placeholder="Hair notes..."
            className="w-full bg-[#0f0f0f] border border-neutral-800 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-gold/40"
          />
        </div>

        {/* Makeup */}
        <div>
          <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
            Makeup
          </label>
          <input
            type="text"
            value={breakdown.makeupNotes}
            onChange={(e) => update({ makeupNotes: e.target.value })}
            placeholder="Makeup notes..."
            className="w-full bg-[#0f0f0f] border border-neutral-800 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-gold/40"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
            Notes
          </label>
          <input
            type="text"
            value={breakdown.generalNotes}
            onChange={(e) => update({ generalNotes: e.target.value })}
            placeholder="General notes..."
            className="w-full bg-[#0f0f0f] border border-neutral-800 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-gold/40"
          />
        </div>

        {/* Change toggle */}
        <div className="flex items-center gap-4 pt-1">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Changes:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`change-${sceneId}-${character.id}`}
              checked={!breakdown.hasChange}
              onChange={() => update({ hasChange: false })}
              className="accent-gold"
            />
            <span className="text-sm text-neutral-400">No Change</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`change-${sceneId}-${character.id}`}
              checked={breakdown.hasChange}
              onChange={() => update({ hasChange: true })}
              className="accent-gold"
            />
            <span className="text-sm text-neutral-400">Change</span>
          </label>
        </div>
      </div>
    </div>
  );
}
