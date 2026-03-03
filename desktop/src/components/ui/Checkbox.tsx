import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', checked, ...props }, ref) => {
    return (
      <label className={`inline-flex items-center gap-2 cursor-pointer ${className}`}>
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            className="sr-only peer"
            {...props}
          />
          <div
            className={`w-[18px] h-[18px] rounded border transition-colors-fast flex items-center justify-center
              ${checked
                ? 'bg-gold border-gold'
                : 'bg-input-bg border-border-default peer-hover:border-border-strong'
              }`}
          >
            {checked && <Check className="w-3 h-3 text-text-inverse" strokeWidth={3} />}
          </div>
        </div>
        {label && <span className="text-sm text-text-primary">{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
