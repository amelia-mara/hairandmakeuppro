import { forwardRef, type InputHTMLAttributes } from 'react';

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className = '', checked, ...props }, ref) => {
    return (
      <label className={`inline-flex items-center gap-2 cursor-pointer ${className}`}>
        <div className="relative">
          <input
            ref={ref}
            type="radio"
            checked={checked}
            className="sr-only peer"
            {...props}
          />
          <div
            className={`w-[18px] h-[18px] rounded-full border transition-colors-fast flex items-center justify-center
              ${checked ? 'border-gold' : 'bg-input-bg border-border-default peer-hover:border-border-strong'}`}
          >
            {checked && <div className="w-2 h-2 rounded-full bg-gold" />}
          </div>
        </div>
        {label && <span className="text-sm text-text-primary">{label}</span>}
      </label>
    );
  }
);

Radio.displayName = 'Radio';
