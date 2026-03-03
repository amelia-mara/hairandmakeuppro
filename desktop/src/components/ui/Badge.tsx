import type { ReactNode } from 'react';

type BadgeVariant =
  | 'lead'
  | 'supporting'
  | 'day_player'
  | 'extra'
  | 'hair'
  | 'makeup'
  | 'sfx'
  | 'cast'
  | 'int'
  | 'ext'
  | 'day'
  | 'night'
  | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  lead: 'bg-gold/20 text-gold',
  supporting: 'bg-white/10 text-white',
  day_player: 'bg-white/5 text-text-secondary',
  extra: 'bg-white/5 text-text-muted',
  hair: 'bg-cat-hair/20 text-cat-hair',
  makeup: 'bg-cat-makeup/20 text-cat-makeup',
  sfx: 'bg-cat-sfx/20 text-cat-sfx',
  cast: 'bg-cat-cast/20 text-cat-cast',
  int: 'bg-white/10 text-text-secondary',
  ext: 'bg-white/10 text-text-secondary',
  day: 'bg-info/20 text-info',
  night: 'bg-indigo-500/20 text-indigo-400',
  default: 'bg-white/10 text-text-secondary',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
