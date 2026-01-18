import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface TogglePillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive: boolean;
  label: string;
}

export const TogglePill = forwardRef<HTMLButtonElement, TogglePillProps>(
  ({ className, isActive, label, onClick, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isActive}
        onClick={onClick}
        className={clsx(
          'px-3 py-1.5 text-xs font-medium rounded-pill border transition-all duration-200 touch-manipulation',
          'focus:outline-none focus:ring-2 focus:ring-gold/50',
          {
            'bg-gold-50 text-gold border-gold': isActive,
            'bg-gray-100 text-text-muted border-gray-200 hover:bg-gray-200': !isActive,
          },
          className
        )}
        {...props}
      >
        {label}
      </button>
    );
  }
);

TogglePill.displayName = 'TogglePill';

export interface SwitchProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isOn: boolean;
  label?: string;
  onToggle: () => void;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, isOn, label, onToggle, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isOn}
        onClick={onToggle}
        className={clsx(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2',
          {
            'bg-gold': isOn,
            'bg-gray-200': !isOn,
          },
          className
        )}
        {...props}
      >
        {label && <span className="sr-only">{label}</span>}
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            {
              'translate-x-5': isOn,
              'translate-x-0': !isOn,
            }
          )}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';
