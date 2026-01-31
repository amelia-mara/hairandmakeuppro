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
    sm: { icon: 40, text: 'text-sm', underlineWidth: 100 },
    md: { icon: 64, text: 'text-lg', underlineWidth: 160 },
    lg: { icon: 100, text: 'text-[28px]', underlineWidth: 220 },
  };

  const config = sizes[size];

  return (
    <div className={clsx('flex flex-col items-center', className)}>
      {/* Logo Icon - Gold checkmark extending beyond smaller ring */}
      <svg
        width={config.icon}
        height={config.icon}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={clsx('mb-4', animated && 'animate-scale-in')}
      >
        <defs>
          {/* Gold gradient for checkmark */}
          <linearGradient id="checkGold" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#D4B86A" />
            <stop offset="30%" stopColor="#E8D48A" />
            <stop offset="50%" stopColor="#C9A962" />
            <stop offset="70%" stopColor="#B8962E" />
            <stop offset="100%" stopColor="#A8893D" />
          </linearGradient>
          {/* Ring gradient - gold/black shine effect */}
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a1a1a" />
            <stop offset="25%" stopColor="#3d3d3d" />
            <stop offset="40%" stopColor="#8B7332" />
            <stop offset="50%" stopColor="#C9A962" />
            <stop offset="60%" stopColor="#8B7332" />
            <stop offset="75%" stopColor="#3d3d3d" />
            <stop offset="100%" stopColor="#1a1a1a" />
          </linearGradient>
        </defs>

        {/* Circle ring - smaller than checkmark, with gold/black gradient */}
        <circle
          cx="50"
          cy="50"
          r="32"
          stroke="url(#ringGradient)"
          strokeWidth="3"
          fill="none"
        />

        {/* Gold checkmark - extends beyond the circle */}
        <path
          d="M28 52L42 66L72 32"
          stroke="url(#checkGold)"
          strokeWidth="6"
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
              'font-serif font-normal tracking-[0.15em] text-[#1a1a1a]'
            )}
          >
            CHECKS HAPPY
          </h1>
          {/* Gold underline with tapered ends */}
          {showUnderline && (
            <svg
              width={config.underlineWidth}
              height="4"
              viewBox="0 0 220 4"
              className="mt-2"
            >
              <defs>
                <linearGradient id="underlineGold" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D4B86A" stopOpacity="0" />
                  <stop offset="15%" stopColor="#D4B86A" />
                  <stop offset="50%" stopColor="#C9A962" />
                  <stop offset="85%" stopColor="#D4B86A" />
                  <stop offset="100%" stopColor="#D4B86A" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line
                x1="0"
                y1="2"
                x2="220"
                y2="2"
                stroke="url(#underlineGold)"
                strokeWidth="1.5"
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
        <linearGradient id="checkGoldIcon" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#D4B86A" />
          <stop offset="50%" stopColor="#C9A962" />
          <stop offset="100%" stopColor="#A8893D" />
        </linearGradient>
        <linearGradient id="ringGradientIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="40%" stopColor="#8B7332" />
          <stop offset="50%" stopColor="#C9A962" />
          <stop offset="60%" stopColor="#8B7332" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="32" stroke="url(#ringGradientIcon)" strokeWidth="3" fill="none" />
      <path
        d="M28 52L42 66L72 32"
        stroke="url(#checkGoldIcon)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
});
