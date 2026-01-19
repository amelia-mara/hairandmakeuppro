import type { HairDetails, HairType, WigType, WigAttachment, HairlineStyle } from '@/types';
import { createEmptyHairDetails, HAIR_TYPES, WIG_TYPES, WIG_ATTACHMENTS, HAIRLINE_STYLES } from '@/types';
import { FormField } from '../ui/FormField';

interface HairFormProps {
  hair?: HairDetails;
  onChange?: (hair: HairDetails) => void;
  readOnly?: boolean;
}

export function HairForm({ hair, onChange, readOnly = false }: HairFormProps) {
  // Use empty hair if none provided
  const currentHair = hair || createEmptyHairDetails();
  const showWigFields = currentHair.hairType !== 'Natural';

  const handleFieldChange = (field: keyof HairDetails, value: string | HairType | WigType | HairlineStyle | WigAttachment[]) => {
    if (onChange && !readOnly) {
      onChange({ ...currentHair, [field]: value });
    }
  };

  const handleAttachmentToggle = (attachment: WigAttachment) => {
    if (readOnly) return;
    const current = currentHair.wigAttachment || [];
    const newAttachments = current.includes(attachment)
      ? current.filter(a => a !== attachment)
      : [...current, attachment];
    handleFieldChange('wigAttachment', newAttachments);
  };

  if (!hair && readOnly) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-text-muted">No hair details available for this look.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hair Type Selector */}
      <div>
        <label className="field-label block mb-1.5">Hair Type</label>
        {readOnly ? (
          <div className="text-sm text-text-primary">{currentHair.hairType}</div>
        ) : (
          <select
            value={currentHair.hairType}
            onChange={(e) => handleFieldChange('hairType', e.target.value as HairType)}
            className="w-full bg-[#f8f7f5] border border-[#e8e6e1] rounded-lg px-3 py-3 text-sm text-[#1a1a1a] focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-colors"
          >
            {HAIR_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        )}
      </div>

      {/* Standard Fields */}
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

      {/* Wig Fields - shown when hair type is not Natural */}
      {showWigFields && (
        <>
          <div className="border-t border-border pt-4 mt-4">
            <h4 className="field-label text-gold mb-3">WIG / HAIRPIECE DETAILS</h4>
          </div>

          <FormField
            label="Wig Name / ID"
            value={currentHair.wigNameId}
            onChange={(v) => handleFieldChange('wigNameId', v)}
            readOnly={readOnly}
            placeholder="e.g., WIG-042 Auburn Bob"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label block mb-1.5">Wig Type</label>
              {readOnly ? (
                <div className="text-sm text-text-primary">
                  {currentHair.wigType || <span className="text-text-placeholder">—</span>}
                </div>
              ) : (
                <select
                  value={currentHair.wigType}
                  onChange={(e) => handleFieldChange('wigType', e.target.value as WigType)}
                  className="w-full bg-[#f8f7f5] border border-[#e8e6e1] rounded-lg px-3 py-3 text-sm text-[#1a1a1a] focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-colors"
                >
                  <option value="">Select type...</option>
                  {WIG_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="field-label block mb-1.5">Hairline</label>
              {readOnly ? (
                <div className="text-sm text-text-primary">
                  {currentHair.hairline || <span className="text-text-placeholder">—</span>}
                </div>
              ) : (
                <select
                  value={currentHair.hairline}
                  onChange={(e) => handleFieldChange('hairline', e.target.value as HairlineStyle)}
                  className="w-full bg-[#f8f7f5] border border-[#e8e6e1] rounded-lg px-3 py-3 text-sm text-[#1a1a1a] focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-colors"
                >
                  <option value="">Select style...</option>
                  {HAIRLINE_STYLES.map((style) => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <FormField
            label="Wig Cap Method"
            value={currentHair.wigCapMethod}
            onChange={(v) => handleFieldChange('wigCapMethod', v)}
            readOnly={readOnly}
            placeholder="e.g., Cornrows, bald cap, braided flat"
          />

          {/* Wig Attachment Multi-select Pills */}
          <div>
            <label className="field-label block mb-2">Attachment Method</label>
            {readOnly ? (
              <div className="text-sm text-text-primary">
                {currentHair.wigAttachment.length > 0
                  ? currentHair.wigAttachment.join(', ')
                  : <span className="text-text-placeholder">—</span>}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {WIG_ATTACHMENTS.map((attachment) => {
                  const isSelected = currentHair.wigAttachment.includes(attachment);
                  return (
                    <button
                      key={attachment}
                      type="button"
                      onClick={() => handleAttachmentToggle(attachment)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                        isSelected
                          ? 'bg-gold text-white border-gold'
                          : 'bg-white text-text-secondary border-border hover:border-gold/50'
                      }`}
                    >
                      {attachment}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <FormField
            label="Lace Tint"
            value={currentHair.laceTint}
            onChange={(v) => handleFieldChange('laceTint', v)}
            readOnly={readOnly}
            placeholder="e.g., Ebin Lace Tint Medium Brown"
          />

          <FormField
            label="Edges / Baby Hairs"
            value={currentHair.edgesBabyHairs}
            onChange={(v) => handleFieldChange('edgesBabyHairs', v)}
            readOnly={readOnly}
            placeholder="e.g., Laid with Got2b, swoop on left side"
          />
        </>
      )}
    </div>
  );
}
