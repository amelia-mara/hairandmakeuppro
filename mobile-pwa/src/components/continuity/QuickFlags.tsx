import type { ContinuityFlags } from '@/types';
import { TogglePill } from '../ui';

interface QuickFlagsProps {
  flags: ContinuityFlags;
  onToggle: (flag: keyof ContinuityFlags) => void;
}

const flagLabels: { key: keyof ContinuityFlags; label: string }[] = [
  { key: 'sweat', label: 'Sweat' },
  { key: 'dishevelled', label: 'Dishevelled' },
  { key: 'blood', label: 'Blood' },
  { key: 'dirt', label: 'Dirt' },
  { key: 'wetHair', label: 'Wet Hair' },
  { key: 'tears', label: 'Tears' },
];

export function QuickFlags({ flags, onToggle }: QuickFlagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {flagLabels.map(({ key, label }) => (
        <TogglePill
          key={key}
          isActive={flags[key]}
          label={label}
          onClick={() => onToggle(key)}
        />
      ))}
    </div>
  );
}
