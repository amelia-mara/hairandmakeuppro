import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-semibold transition-all duration-200 touch-manipulation tap-target',
          'focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            // Primary: Gold gradient in both light and dark mode
            'btn-gold text-white active:scale-[0.98]':
              variant === 'primary',
            // Secondary: Subtle background
            'bg-input-bg text-text-primary border border-border hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.98]':
              variant === 'secondary',
            // Outline: Gold outline in both modes
            'btn-outline-gold active:scale-[0.98]':
              variant === 'outline',
            // Ghost: Text only
            'text-gold hover:bg-gold/10 active:scale-[0.98]':
              variant === 'ghost',
            // Danger: Red styling
            'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]':
              variant === 'danger',
            // Sizes - consistent slight rounding (rounded-lg = 8px)
            'px-3 py-1.5 text-sm rounded-lg': size === 'sm',
            'px-4 py-2.5 text-base rounded-lg': size === 'md',
            'px-6 py-3.5 text-lg rounded-lg': size === 'lg',
            // Full width
            'w-full': fullWidth,
          },
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
