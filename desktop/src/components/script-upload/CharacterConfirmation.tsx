import { useState } from 'react';
import type { DetectedCharacter } from '@/utils/characterDetector';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface CharacterConfirmationProps {
  characters: DetectedCharacter[];
  onConfirm: (selectedNames: string[]) => void;
  onBack: () => void;
}

const roleLabels: Record<string, string> = {
  lead: 'Lead',
  supporting: 'Supporting',
  day_player: 'Day Player',
  extra: 'Extra',
};

const roleBadgeVariant: Record<string, 'accent' | 'success' | 'warning' | 'muted'> = {
  lead: 'accent',
  supporting: 'success',
  day_player: 'warning',
  extra: 'muted',
};

export function CharacterConfirmation({ characters, onConfirm, onBack }: CharacterConfirmationProps) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set(characters.filter((c) => c.selected).map((c) => c.name));
  });

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(characters.map((c) => c.name)));
  const deselectAll = () => setSelected(new Set());

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-white/60 mb-4">
          {characters.length} characters detected. Select the ones to track.
          Extras are auto-deselected.
        </p>
        <div className="flex gap-2 mb-3">
          <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
          <Button variant="ghost" size="sm" onClick={deselectAll}>Deselect All</Button>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-1 pr-2">
        {characters.map((char) => (
          <div
            key={char.name}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selected.has(char.name)}
                onChange={() => toggle(char.name)}
              />
              <span className="text-sm text-white/90 font-medium">{char.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={roleBadgeVariant[char.roleType]}>
                {roleLabels[char.roleType]}
              </Badge>
              <span className="text-xs text-white/40 w-12 text-right">
                {char.sceneCount} sc.
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-white/10">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">{selected.size} selected</span>
          <Button
            variant="primary"
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
          >
            Confirm Characters
          </Button>
        </div>
      </div>
    </div>
  );
}
