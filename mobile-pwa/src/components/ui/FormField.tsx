interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

/**
 * Shared form field component for text inputs and textareas.
 * Used by MakeupForm and HairForm components.
 */
export function FormField({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  multiline = false,
  rows = 2,
}: FormFieldProps) {
  if (readOnly) {
    return (
      <div>
        <label className="field-label block mb-1">{label}</label>
        <div className="text-sm text-text-primary">
          {value || <span className="text-text-placeholder">—</span>}
        </div>
      </div>
    );
  }

  const inputClasses =
    'w-full bg-[#f8f7f5] border border-[#e8e6e1] rounded-lg px-3 py-3 text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-colors';

  if (multiline) {
    return (
      <div>
        <label className="field-label block mb-1.5">{label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`${inputClasses} resize-none`}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="field-label block mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClasses}
      />
    </div>
  );
}
