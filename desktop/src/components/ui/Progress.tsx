interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md';
}

export function Progress({ value, max = 100, className = '', size = 'sm' }: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={`bg-surface-hover rounded-full overflow-hidden ${size === 'sm' ? 'h-1' : 'h-2'} ${className}`}
    >
      <div
        className="h-full bg-gold rounded-full transition-all duration-slow"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
