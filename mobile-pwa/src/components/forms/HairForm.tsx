import type { HairDetails } from '@/types';
import { createEmptyHairDetails } from '@/types';

interface HairFormProps {
  hair?: HairDetails;
  onChange?: (hair: HairDetails) => void;
  readOnly?: boolean;
}

export function HairForm({ hair, onChange, readOnly = false }: HairFormProps) {
  // Use empty hair if none provided
  const currentHair = hair || createEmptyHairDetails();

  const handleFieldChange = (field: keyof HairDetails, value: string) => {
    if (onChange && !readOnly) {
      onChange({ ...currentHair, [field]: value });
    }
  };

  if (!hair && readOnly) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-text-muted">No hair details available for this look.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FormField
        label="Style Description"
        value={currentHair.style}
        onChange={(v) => handleFieldChange('style', v)}
        readOnly={readOnly}
        placeholder="e.g., Loose waves, half-up half-down"
        multiline
      />
      <FormField
        label="Products Used"
        value={currentHair.products}
        onChange={(v) => handleFieldChange('products', v)}
        readOnly={readOnly}
        placeholder="e.g., Oribe Dry Texturizing Spray, heat protectant"
        multiline
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Parting"
          value={currentHair.parting}
          onChange={(v) => handleFieldChange('parting', v)}
          readOnly={readOnly}
          placeholder="e.g., Centre part"
        />
        <FormField
          label="Pieces Out"
          value={currentHair.piecesOut}
          onChange={(v) => handleFieldChange('piecesOut', v)}
          readOnly={readOnly}
          placeholder="e.g., Face-framing layers"
        />
      </div>
      <FormField
        label="Pins / Grips / Ties"
        value={currentHair.pins}
        onChange={(v) => handleFieldChange('pins', v)}
        readOnly={readOnly}
        placeholder="e.g., 6 bobby pins at crown, clear elastic"
      />
      <FormField
        label="Accessories"
        value={currentHair.accessories}
        onChange={(v) => handleFieldChange('accessories', v)}
        readOnly={readOnly}
        placeholder="e.g., Gold barrette, silk ribbon"
      />
    </div>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  placeholder?: string;
  multiline?: boolean;
}

function FormField({ label, value, onChange, readOnly, placeholder, multiline }: FormFieldProps) {
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

  const inputClasses = "w-full bg-[#f8f7f5] border border-[#e8e6e1] rounded-lg px-3 py-3 text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-colors";

  if (multiline) {
    return (
      <div>
        <label className="field-label block mb-1.5">{label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
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
