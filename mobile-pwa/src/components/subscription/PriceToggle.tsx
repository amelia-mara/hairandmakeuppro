import { clsx } from 'clsx';
import type { BillingPeriod } from '@/types/subscription';

export interface PriceToggleProps {
  value: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
  showPerProject?: boolean;
}

export function PriceToggle({
  value,
  onChange,
  showPerProject = false,
}: PriceToggleProps) {
  const options: { value: BillingPeriod; label: string; sublabel?: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly', sublabel: 'Save 20%' },
  ];

  if (showPerProject) {
    options.push({ value: 'per_project', label: 'Per Project' });
  }

  return (
    <div className="flex items-center justify-center gap-1 p-1 bg-input-bg rounded-xl border border-border">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            'relative flex flex-col items-center justify-center px-4 py-2 rounded-lg transition-all duration-200',
            'text-sm font-medium',
            'min-w-[90px]',
            {
              'bg-gold text-white shadow-sm': value === option.value,
              'text-text-secondary hover:text-text-primary': value !== option.value,
            }
          )}
        >
          <span>{option.label}</span>
          {option.sublabel && (
            <span className={clsx(
              'text-[10px] font-semibold',
              value === option.value ? 'text-white/80' : 'text-gold'
            )}>
              {option.sublabel}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Designer tier specific toggle for monthly vs per-project
export interface DesignerBillingToggleProps {
  value: 'monthly' | 'per_project';
  onChange: (value: 'monthly' | 'per_project') => void;
}

export function DesignerBillingToggle({
  value,
  onChange,
}: DesignerBillingToggleProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-gold-50/50 rounded-lg border border-gold/20">
      <button
        onClick={() => onChange('monthly')}
        className={clsx(
          'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
          {
            'bg-gold text-white': value === 'monthly',
            'text-gold hover:bg-gold-100': value !== 'monthly',
          }
        )}
      >
        Monthly £29.99
      </button>
      <button
        onClick={() => onChange('per_project')}
        className={clsx(
          'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
          {
            'bg-gold text-white': value === 'per_project',
            'text-gold hover:bg-gold-100': value !== 'per_project',
          }
        )}
      >
        Per Project £49
      </button>
    </div>
  );
}
