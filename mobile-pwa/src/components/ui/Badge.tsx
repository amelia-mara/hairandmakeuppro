import { forwardRef, type HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'gold' | 'int' | 'ext' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'sm', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-semibold uppercase tracking-wide',
          {
            // Variants
            'bg-gray-100 text-text-muted': variant === 'default',
            'bg-gold text-white': variant === 'gold',
            'bg-blue-100 text-blue-700': variant === 'int',
            'bg-gold-100 text-gold-700': variant === 'ext',
            'bg-green-100 text-green-700': variant === 'success',
            'bg-orange-100 text-orange-700': variant === 'warning',
            'bg-red-100 text-red-700': variant === 'error',
            'bg-transparent border border-current': variant === 'outline',
            // Sizes
            'px-1.5 py-0.5 text-[9px] rounded': size === 'sm',
            'px-2.5 py-1 text-[10px] rounded-md': size === 'md',
          },
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export interface CountBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  count: number;
}

export const CountBadge = forwardRef<HTMLSpanElement, CountBadgeProps>(
  ({ className, count, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full bg-gold-100 text-gold-700',
          className
        )}
        {...props}
      >
        {count}
      </span>
    );
  }
);

CountBadge.displayName = 'CountBadge';
