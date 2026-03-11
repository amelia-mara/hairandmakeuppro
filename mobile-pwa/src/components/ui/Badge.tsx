import { forwardRef, type HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'gold' | 'int' | 'ext' | 'success' | 'warning' | 'error' | 'outline' | 'day' | 'night';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'sm', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-bold uppercase tracking-wider',
          {
            // Variants
            'bg-cream-dark text-[#5A3E28]': variant === 'default' || variant === 'int' || variant === 'ext',
            'bg-gold text-white': variant === 'gold',
            'bg-teal text-white': variant === 'success',
            'bg-amber text-[#2A1A08]': variant === 'warning',
            'bg-red-100 text-red-700': variant === 'error',
            'bg-transparent border border-current': variant === 'outline',
            'bg-[#F5A623] text-[#2A1A08]': variant === 'day',
            'bg-[#5A3E28] text-[#F5EFE0]': variant === 'night',
            // Sizes
            'px-2 py-0.5 text-[9px] rounded': size === 'sm',
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
  label?: string;
}

export const CountBadge = forwardRef<HTMLSpanElement, CountBadgeProps>(
  ({ className, count, label = 'fields', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] font-semibold rounded-xl',
          'bg-gold-100/60 text-gold',
          className
        )}
        {...props}
      >
        {count} {label}
      </span>
    );
  }
);

CountBadge.displayName = 'CountBadge';
