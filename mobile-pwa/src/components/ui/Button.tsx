import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-medium transition-all duration-200 touch-manipulation tap-target',
          'focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            // Variants
            'gold-gradient text-white shadow-md hover:shadow-lg active:scale-[0.98]':
              variant === 'primary',
            'bg-gray-100 text-text-primary hover:bg-gray-200 active:bg-gray-300':
              variant === 'secondary',
            'border-2 border-gold text-gold hover:bg-gold-50 active:bg-gold-100':
              variant === 'outline',
            'text-gold hover:bg-gold-50 active:bg-gold-100':
              variant === 'ghost',
            // Sizes
            'px-3 py-1.5 text-sm rounded-lg': size === 'sm',
            'px-4 py-2.5 text-base rounded-button': size === 'md',
            'px-6 py-3 text-lg rounded-button': size === 'lg',
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
