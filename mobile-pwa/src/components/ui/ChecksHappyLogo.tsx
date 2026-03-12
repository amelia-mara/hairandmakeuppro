import { memo } from 'react';
import { clsx } from 'clsx';

interface ChecksHappyLogoProps {
  /** Size variant - 'sm' for nav, 'md' for headers, 'lg' for welcome screen */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the rainbow underline below text */
  showUnderline?: boolean;
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
  showUnderline = false,
  className,
  layout = 'horizontal',
}: ChecksHappyLogoProps) {
  const sizes = {
    sm: { checks: 'text-lg', happy: 'text-lg', underlineH: 3, gap: 'gap-0' },
    md: { checks: 'text-2xl', happy: 'text-2xl', underlineH: 4, gap: 'gap-0' },
    lg: { checks: 'text-[42px] leading-tight', happy: 'text-[42px] leading-tight', underlineH: 5, gap: 'gap-0' },
  };

  const config = sizes[size];
  const isStacked = layout === 'stacked';

  return (
    <div className={clsx('flex flex-col items-center', config.gap, className)}>
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
        {isStacked ? null : ' '}
        <span
          className={clsx(
            config.happy,
            'font-serif font-bold italic text-gold'
          )}
        >
          Happy.
        </span>
      </div>

      {/* Rainbow gradient underline — brand colour spectrum */}
      {showUnderline && (
        <svg
          width="100%"
          height={config.underlineH}
          viewBox="0 0 200 4"
          preserveAspectRatio="none"
          className="mt-3 max-w-[260px]"
        >
          <defs>
            <linearGradient id="brandRainbow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4A3020" />      {/* Bark */}
              <stop offset="14%" stopColor="#7A5C3A" />     {/* Earth */}
              <stop offset="28%" stopColor="#D4943A" />     {/* Gold */}
              <stop offset="42%" stopColor="#F5A623" />     {/* Amber */}
              <stop offset="56%" stopColor="#F0882A" />     {/* Warm */}
              <stop offset="70%" stopColor="#E8621A" />     {/* Primary */}
              <stop offset="84%" stopColor="#F2C4A0" />     {/* Peach */}
              <stop offset="100%" stopColor="#4ABFB0" />    {/* Teal */}
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="200" height="4" rx="2" fill="url(#brandRainbow)" />
        </svg>
      )}
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
