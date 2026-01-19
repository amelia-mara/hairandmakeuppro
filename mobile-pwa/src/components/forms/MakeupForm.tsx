import type { MakeupDetails } from '@/types';
import { createEmptyMakeupDetails } from '@/types';
import { FormField } from '../ui/FormField';

interface MakeupFormProps {
  makeup?: MakeupDetails;
  onChange?: (makeup: MakeupDetails) => void;
  readOnly?: boolean;
}

export function MakeupForm({ makeup, onChange, readOnly = false }: MakeupFormProps) {
  // Use empty makeup if none provided
  const currentMakeup = makeup || createEmptyMakeupDetails();

  const handleFieldChange = (field: keyof MakeupDetails, value: string) => {
    if (onChange && !readOnly) {
      onChange({ ...currentMakeup, [field]: value });
    }
  };

  if (!makeup && readOnly) {
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
            <FormField
              label="Foundation"
              value={currentMakeup.foundation}
              onChange={(v) => handleFieldChange('foundation', v)}
              readOnly={readOnly}
              placeholder="e.g., MAC Studio Fix NC25"
            />
            <FormField
              label="Coverage"
              value={currentMakeup.coverage}
              onChange={(v) => handleFieldChange('coverage', v)}
              readOnly={readOnly}
              placeholder="e.g., Medium"
            />
          </div>
          <FormField
            label="Concealer"
            value={currentMakeup.concealer}
            onChange={(v) => handleFieldChange('concealer', v)}
            readOnly={readOnly}
            placeholder="e.g., NARS Radiant Creamy"
          />
          <FormField
            label="Concealer Placement"
            value={currentMakeup.concealerPlacement}
            onChange={(v) => handleFieldChange('concealerPlacement', v)}
            readOnly={readOnly}
            placeholder="e.g., Under eyes, bridge of nose"
          />
          <FormField
            label="Contour"
            value={currentMakeup.contour}
            onChange={(v) => handleFieldChange('contour', v)}
            readOnly={readOnly}
            placeholder="e.g., Charlotte Tilbury Sculpt"
          />
          <FormField
            label="Contour Placement"
            value={currentMakeup.contourPlacement}
            onChange={(v) => handleFieldChange('contourPlacement', v)}
            readOnly={readOnly}
            placeholder="e.g., Hollows of cheeks, jawline"
          />
          <FormField
            label="Highlight"
            value={currentMakeup.highlight}
            onChange={(v) => handleFieldChange('highlight', v)}
            readOnly={readOnly}
            placeholder="e.g., Becca Champagne Pop"
          />
          <FormField
            label="Highlight Placement"
            value={currentMakeup.highlightPlacement}
            onChange={(v) => handleFieldChange('highlightPlacement', v)}
            readOnly={readOnly}
            placeholder="e.g., Cheekbones, brow bone"
          />
          <FormField
            label="Blush"
            value={currentMakeup.blush}
            onChange={(v) => handleFieldChange('blush', v)}
            readOnly={readOnly}
            placeholder="e.g., NARS Orgasm"
          />
          <FormField
            label="Blush Placement"
            value={currentMakeup.blushPlacement}
            onChange={(v) => handleFieldChange('blushPlacement', v)}
            readOnly={readOnly}
            placeholder="e.g., Apples of cheeks"
          />
        </div>
      </section>

      {/* Eyes Section */}
      <section>
        <h4 className="field-label text-gold mb-3">EYES</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Brow Product"
              value={currentMakeup.browProduct}
              onChange={(v) => handleFieldChange('browProduct', v)}
              readOnly={readOnly}
              placeholder="e.g., ABH Dipbrow Taupe"
            />
            <FormField
              label="Brow Shape"
              value={currentMakeup.browShape}
              onChange={(v) => handleFieldChange('browShape', v)}
              readOnly={readOnly}
              placeholder="e.g., Natural arch"
            />
          </div>
          <FormField
            label="Eye Primer"
            value={currentMakeup.eyePrimer}
            onChange={(v) => handleFieldChange('eyePrimer', v)}
            readOnly={readOnly}
            placeholder="e.g., Urban Decay Primer Potion"
          />
          <div className="grid grid-cols-3 gap-3">
            <FormField
              label="Lid Colour"
              value={currentMakeup.lidColour}
              onChange={(v) => handleFieldChange('lidColour', v)}
              readOnly={readOnly}
              placeholder="e.g., Champagne"
            />
            <FormField
              label="Crease"
              value={currentMakeup.creaseColour}
              onChange={(v) => handleFieldChange('creaseColour', v)}
              readOnly={readOnly}
              placeholder="e.g., Warm brown"
            />
            <FormField
              label="Outer V"
              value={currentMakeup.outerV}
              onChange={(v) => handleFieldChange('outerV', v)}
              readOnly={readOnly}
              placeholder="e.g., Deep brown"
            />
          </div>
          <FormField
            label="Liner Style"
            value={currentMakeup.liner}
            onChange={(v) => handleFieldChange('liner', v)}
            readOnly={readOnly}
            placeholder="e.g., Thin black line, tight line"
          />
          <FormField
            label="Lashes"
            value={currentMakeup.lashes}
            onChange={(v) => handleFieldChange('lashes', v)}
            readOnly={readOnly}
            placeholder="e.g., Ardell Wispies, 2 coats mascara"
          />
        </div>
      </section>

      {/* Lips Section */}
      <section>
        <h4 className="field-label text-gold mb-3">LIPS</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Lip Liner"
              value={currentMakeup.lipLiner}
              onChange={(v) => handleFieldChange('lipLiner', v)}
              readOnly={readOnly}
              placeholder="e.g., MAC Spice"
            />
            <FormField
              label="Lip Colour"
              value={currentMakeup.lipColour}
              onChange={(v) => handleFieldChange('lipColour', v)}
              readOnly={readOnly}
              placeholder="e.g., Charlotte Tilbury Pillow Talk"
            />
          </div>
          <FormField
            label="Setting"
            value={currentMakeup.setting}
            onChange={(v) => handleFieldChange('setting', v)}
            readOnly={readOnly}
            placeholder="e.g., MAC Fix+, light powder"
          />
        </div>
      </section>
    </div>
  );
}
