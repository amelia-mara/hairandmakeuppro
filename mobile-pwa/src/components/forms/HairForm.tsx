import type { HairDetails } from '@/types';

interface HairFormProps {
  hair?: HairDetails;
  onChange?: (hair: HairDetails) => void;
  readOnly?: boolean;
}

export function HairForm({ hair, onChange, readOnly }: HairFormProps) {
  // These are reserved for editable mode (future implementation)
  void onChange;
  void readOnly;

  if (!hair) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-text-muted">No hair details available for this look.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ReadOnlyField label="Style Description" value={hair.style} />
      <ReadOnlyField label="Products Used" value={hair.products} />
      <div className="grid grid-cols-2 gap-3">
        <ReadOnlyField label="Parting" value={hair.parting} />
        <ReadOnlyField label="Pieces Out" value={hair.piecesOut} />
      </div>
      <ReadOnlyField label="Pins / Grips / Ties" value={hair.pins} />
      <ReadOnlyField label="Accessories" value={hair.accessories} />
    </div>
  );
}

interface ReadOnlyFieldProps {
  label: string;
  value: string;
}

function ReadOnlyField({ label, value }: ReadOnlyFieldProps) {
  if (!value) {
    return (
      <div>
        <label className="field-label block mb-1">{label}</label>
        <div className="text-sm text-text-placeholder">—</div>
      </div>
    );
  }

  return (
    <div>
      <label className="field-label block mb-1">{label}</label>
      <div className="text-sm text-text-primary">{value}</div>
    </div>
  );
}
