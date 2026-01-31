import { memo } from 'react';
import { clsx } from 'clsx';

interface ChecksHappyLogoProps {
  /** Size variant - 'sm' for nav, 'md' for headers, 'lg' for welcome screen */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the text below the icon */
  showText?: boolean;
  /** Whether to show the underline below text */
  showUnderline?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate the checkmark on mount */
  animated?: boolean;
}

/**
 * Checks Happy logo component with gold checkmark in black circle
 * Matches the brand aesthetic: elegant, premium, film industry
 */
export const ChecksHappyLogo = memo(function ChecksHappyLogo({
  size = 'md',
  showText = true,
  showUnderline = true,
  className,
  animated = false,
}: ChecksHappyLogoProps) {
  // Size configurations
  const sizes = {
    sm: { icon: 32, stroke: 1.2, check: 2, text: 'text-xs', spacing: 'gap-1' },
    md: { icon: 48, stroke: 1.5, check: 2.5, text: 'text-sm', spacing: 'gap-2' },
    lg: { icon: 80, stroke: 2, check: 3.5, text: 'text-[22px]', spacing: 'gap-4' },
  };

  const config = sizes[size];
  const iconSize = config.icon;

  return (
    <div className={clsx('flex flex-col items-center', config.spacing, className)}>
      {/* Logo Icon - Gold checkmark in black circle */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={clsx(animated && 'animate-scale-in')}
      >
        {/* Glow effect for premium look */}
        <defs>
          <filter id="gold-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="checkmark-gradient" x1="14" y1="16" x2="34" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D4B86A" />
            <stop offset="40%" stopColor="#E8D48A" />
            <stop offset="60%" stopColor="#C9A962" />
            <stop offset="100%" stopColor="#A8893D" />
          </linearGradient>
        </defs>

        {/* Black circle outline */}
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="#1a1a1a"
          strokeWidth={config.stroke}
          fill="none"
        />

        {/* Gold checkmark with gradient */}
        <path
          d="M15 25L21 31L33 17"
          stroke="url(#checkmark-gradient)"
          strokeWidth={config.check}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter="url(#gold-glow)"
          className={clsx(animated && 'animate-draw-check')}
        />
      </svg>

      {/* Text: CHECKS HAPPY */}
      {showText && (
        <div className="flex flex-col items-center">
          <h1
            className={clsx(
              config.text,
              'font-serif font-normal tracking-[0.25em] text-text-primary'
            )}
          >
            CHECKS HAPPY
          </h1>
          {showUnderline && (
            <div
              className="mt-1 h-px bg-text-primary/30"
              style={{ width: size === 'lg' ? '180px' : size === 'md' ? '120px' : '80px' }}
            />
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Icon-only version for compact spaces (nav, badges, etc.)
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
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="checkmark-gradient-icon" x1="14" y1="16" x2="34" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D4B86A" />
          <stop offset="50%" stopColor="#C9A962" />
          <stop offset="100%" stopColor="#A8893D" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
      <path
        d="M15 25L21 31L33 17"
        stroke="url(#checkmark-gradient-icon)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
});
