import { clsx } from 'clsx';
import type { Character } from '@/types';

interface CharacterAvatarProps {
  character: Character;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function CharacterAvatar({
  character,
  size = 'md',
  className,
}: CharacterAvatarProps) {
  const bgColor = character.avatarColour ?? '#C9A962';

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center font-bold text-white flex-shrink-0',
        {
          'w-5 h-5 text-[8px]': size === 'xs',
          'w-8 h-8 text-xs': size === 'sm',
          'w-10 h-10 text-sm': size === 'md',
          'w-14 h-14 text-lg': size === 'lg',
          'w-20 h-20 text-2xl': size === 'xl',
        },
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${bgColor} 0%, ${adjustColor(bgColor, -20)} 100%)`,
      }}
    >
      {character.initials}
    </div>
  );
}

// Helper to darken a color for gradient
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
