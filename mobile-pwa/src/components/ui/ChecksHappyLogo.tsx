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
 * Checks Happy logo component - gold checkmark extending beyond a smaller ring
 * Ring has gold/black gradient shine effect
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
    sm: { icon: 48, text: 'text-base', underlineWidth: 120, spacing: 'gap-3' },
    md: { icon: 72, text: 'text-xl', underlineWidth: 180, spacing: 'gap-4' },
    lg: { icon: 100, text: 'text-[26px]', underlineWidth: 260, spacing: 'gap-5' },
  };

  const config = sizes[size];

  return (
    <div className={clsx('flex flex-col items-center', config.spacing, className)}>
      {/* Logo Icon - Gold checkmark extending beyond smaller ring */}
      <svg
        width={config.icon}
        height={config.icon}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={clsx(animated && 'animate-scale-in')}
      >
        <defs>
          {/* Gold gradient for checkmark */}
          <linearGradient id="checkGoldMain" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4B86A" />
            <stop offset="40%" stopColor="#C9A962" />
            <stop offset="100%" stopColor="#A8893D" />
          </linearGradient>
          {/* Ring gradient - gold/black shine effect */}
          <linearGradient id="ringGradientMain" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2a2a2a" />
            <stop offset="30%" stopColor="#4a4a4a" />
            <stop offset="45%" stopColor="#8B7332" />
            <stop offset="55%" stopColor="#C9A962" />
            <stop offset="70%" stopColor="#4a4a4a" />
            <stop offset="100%" stopColor="#2a2a2a" />
          </linearGradient>
        </defs>

        {/* Circle ring - smaller than checkmark, with gold/black gradient */}
        <circle
          cx="50"
          cy="50"
          r="36"
          stroke="url(#ringGradientMain)"
          strokeWidth="2.5"
          fill="none"
        />

        {/* Gold checkmark - extends beyond the circle */}
        <path
          d="M30 52L44 66L70 36"
          stroke="url(#checkGoldMain)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className={clsx(animated && 'animate-draw-check')}
        />
      </svg>

      {/* Text: CHECKS HAPPY */}
      {showText && (
        <div className="flex flex-col items-center">
          <h1
            className={clsx(
              config.text,
              'font-serif font-normal tracking-[0.2em] text-[#1a1a1a]'
            )}
          >
            CHECKS HAPPY
          </h1>
          {/* Gold underline with tapered ends */}
          {showUnderline && (
            <svg
              width={config.underlineWidth}
              height="6"
              viewBox={`0 0 ${config.underlineWidth} 6`}
              className="mt-3"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="underlineGoldMain" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#C9A962" stopOpacity="0" />
                  <stop offset="20%" stopColor="#C9A962" stopOpacity="1" />
                  <stop offset="50%" stopColor="#D4B86A" stopOpacity="1" />
                  <stop offset="80%" stopColor="#C9A962" stopOpacity="1" />
                  <stop offset="100%" stopColor="#C9A962" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line
                x1="0"
                y1="3"
                x2={config.underlineWidth}
                y2="3"
                stroke="url(#underlineGoldMain)"
                strokeWidth="1"
              />
            </svg>
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
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="checkGoldIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4B86A" />
          <stop offset="50%" stopColor="#C9A962" />
          <stop offset="100%" stopColor="#A8893D" />
        </linearGradient>
        <linearGradient id="ringGradientIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="45%" stopColor="#8B7332" />
          <stop offset="55%" stopColor="#C9A962" />
          <stop offset="100%" stopColor="#2a2a2a" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="36" stroke="url(#ringGradientIcon)" strokeWidth="2.5" fill="none" />
      <path
        d="M30 52L44 66L70 36"
        stroke="url(#checkGoldIcon)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
});
