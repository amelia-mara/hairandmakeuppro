import clsx from 'clsx';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Checkbox({ checked, onChange, label, className }: CheckboxProps) {
  return (
    <label className={clsx('flex items-center gap-2 cursor-pointer select-none', className)}>
      <div
        className={clsx(
          'w-4 h-4 rounded border transition-colors flex items-center justify-center',
          checked
            ? 'bg-accent border-accent'
            : 'border-white/30 hover:border-white/50'
        )}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg className="w-3 h-3 text-black" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      {label && <span className="text-sm text-white/80">{label}</span>}
    </label>
  );
}
