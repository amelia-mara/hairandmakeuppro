import type { MakeupDetails } from '@/types';

interface MakeupFormProps {
  makeup?: MakeupDetails;
  onChange?: (makeup: MakeupDetails) => void;
  readOnly?: boolean;
}

export function MakeupForm({ makeup, onChange, readOnly }: MakeupFormProps) {
  // These are reserved for editable mode (future implementation)
  void onChange;
  void readOnly;

  if (!makeup) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-text-muted">No makeup details available for this look.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Base Section */}
      <section>
        <h4 className="field-label text-gold mb-3">BASE</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label="Foundation" value={makeup.foundation} />
            <ReadOnlyField label="Coverage" value={makeup.coverage} />
          </div>
          <ReadOnlyField label="Concealer" value={makeup.concealer} />
          <ReadOnlyField label="Concealer Placement" value={makeup.concealerPlacement} />
          <ReadOnlyField label="Contour" value={makeup.contour} />
          <ReadOnlyField label="Contour Placement" value={makeup.contourPlacement} />
          <ReadOnlyField label="Highlight" value={makeup.highlight} />
          <ReadOnlyField label="Highlight Placement" value={makeup.highlightPlacement} />
          <ReadOnlyField label="Blush" value={makeup.blush} />
          <ReadOnlyField label="Blush Placement" value={makeup.blushPlacement} />
        </div>
      </section>

      {/* Eyes Section */}
      <section>
        <h4 className="field-label text-gold mb-3">EYES</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label="Brow Product" value={makeup.browProduct} />
            <ReadOnlyField label="Brow Shape" value={makeup.browShape} />
          </div>
          <ReadOnlyField label="Eye Primer" value={makeup.eyePrimer} />
          <div className="grid grid-cols-3 gap-3">
            <ReadOnlyField label="Lid Colour" value={makeup.lidColour} />
            <ReadOnlyField label="Crease" value={makeup.creaseColour} />
            <ReadOnlyField label="Outer V" value={makeup.outerV} />
          </div>
          <ReadOnlyField label="Liner Style" value={makeup.liner} />
          <ReadOnlyField label="Lashes" value={makeup.lashes} />
        </div>
      </section>

      {/* Lips Section */}
      <section>
        <h4 className="field-label text-gold mb-3">LIPS</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label="Lip Liner" value={makeup.lipLiner} />
            <ReadOnlyField label="Lip Colour" value={makeup.lipColour} />
          </div>
          <ReadOnlyField label="Setting" value={makeup.setting} />
        </div>
      </section>
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
