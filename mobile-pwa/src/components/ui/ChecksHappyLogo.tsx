import { memo } from 'react';
import { clsx } from 'clsx';

interface ChecksHappyLogoProps {
  /** Size variant - 'sm' for nav, 'md' for headers, 'lg' for welcome screen */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Layout direction */
  layout?: 'horizontal' | 'stacked';
}

/**
 * Checks Happy text logo — matches Prep Happy brand system.
 * "Checks" in dark serif + "Happy." in orange italic serif.
 */
export const ChecksHappyLogo = memo(function ChecksHappyLogo({
  size = 'md',
  className,
  layout = 'horizontal',
}: ChecksHappyLogoProps) {
  const sizes = {
    sm: { checks: 'text-lg', happy: 'text-lg' },
    md: { checks: 'text-2xl', happy: 'text-2xl' },
    lg: { checks: 'text-[42px] leading-tight', happy: 'text-[42px] leading-tight' },
  };

  const config = sizes[size];
  const isStacked = layout === 'stacked';

  return (
    <div className={clsx('flex flex-col items-center', className)}>
      <div className={clsx(
        isStacked ? 'flex flex-col items-center' : 'flex items-baseline gap-2',
      )}>
        <span
          className={clsx(
            config.checks,
            'font-serif font-bold text-text-primary'
          )}
        >
          Checks
        </span>
        <span
          className={clsx(
            config.happy,
            'font-serif font-bold italic text-gold'
          )}
        >
          Happy.
        </span>
      </div>
    </div>
  );
});

/**
 * Compact icon-only mark for nav/badges — small orange dot.
 */
export const ChecksHappyIcon = memo(function ChecksHappyIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="12" r="5" fill="#E8621A" />
    </svg>
  );
});
