import type { SFXDetails, SFXType, BloodType, Photo } from '@/types';
import { createEmptySFXDetails, SFX_TYPES, BLOOD_TYPES } from '@/types';
import { PhotoImg } from '@/hooks';
import { FormField } from '../ui/FormField';
import { Switch } from '../ui/Toggle';

interface SFXFormProps {
  sfx?: SFXDetails;
  onChange?: (sfx: SFXDetails) => void;
  onCapturePhoto?: () => void;
  onRemovePhoto?: (photoId: string) => void;
  readOnly?: boolean;
}

export function SFXForm({
  sfx,
  onChange,
  onCapturePhoto,
  onRemovePhoto,
  readOnly = false,
}: SFXFormProps) {
  const currentSFX = sfx || createEmptySFXDetails();

  const handleFieldChange = <K extends keyof SFXDetails>(field: K, value: SFXDetails[K]) => {
    if (onChange && !readOnly) {
      onChange({ ...currentSFX, [field]: value });
    }
  };

  const handleSFXTypeToggle = (type: SFXType) => {
    if (readOnly) return;
    const current = currentSFX.sfxTypes || [];
    const newTypes = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    handleFieldChange('sfxTypes', newTypes);
  };

  const handleBloodTypeToggle = (type: BloodType) => {
    if (readOnly) return;
    const current = currentSFX.bloodTypes || [];
    const newTypes = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    handleFieldChange('bloodTypes', newTypes);
  };

  return (
    <div className="space-y-4">
      {/* SFX Required Toggle */}
      <div className="flex items-center justify-between">
        <label className="field-label">SFX Required</label>
        <Switch
          isOn={currentSFX.sfxRequired}
          onToggle={() => !readOnly && handleFieldChange('sfxRequired', !currentSFX.sfxRequired)}
          disabled={readOnly}
        />
      </div>

      {/* Show all SFX fields when required is true */}
      {currentSFX.sfxRequired && (
        <>
          {/* SFX Type Multi-select Pills */}
          <div>
            <label className="field-label block mb-2">SFX Type</label>
            {readOnly ? (
              <div className="text-sm text-text-primary">
                {currentSFX.sfxTypes.length > 0
                  ? currentSFX.sfxTypes.join(', ')
                  : <span className="text-text-placeholder">—</span>}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {SFX_TYPES.map((type) => {
                  const isSelected = currentSFX.sfxTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleSFXTypeToggle(type)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                        isSelected
                          ? 'bg-gold text-white border-gold'
                          : 'bg-white text-text-secondary border-border hover:border-gold/50'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prosthetics Section */}
          <div className="border-t border-border pt-4">
            <h4 className="field-label text-gold mb-3">PROSTHETICS</h4>
            <div className="space-y-3">
              <FormField
                label="Prosthetic Pieces"
                value={currentSFX.prostheticPieces}
                onChange={(v) => handleFieldChange('prostheticPieces', v)}
                readOnly={readOnly}
                placeholder="e.g., Brow piece #3, nose tip, chin extension"
                multiline
              />
              <FormField
                label="Prosthetic Adhesive"
                value={currentSFX.prostheticAdhesive}
                onChange={(v) => handleFieldChange('prostheticAdhesive', v)}
                readOnly={readOnly}
                placeholder="e.g., Pros-Aide, Telesis 5"
              />
            </div>
          </div>

          {/* Blood Section */}
          <div className="border-t border-border pt-4">
            <h4 className="field-label text-gold mb-3">BLOOD</h4>
            <div className="space-y-3">
              <div>
                <label className="field-label block mb-2">Blood Type</label>
                {readOnly ? (
                  <div className="text-sm text-text-primary">
                    {currentSFX.bloodTypes.length > 0
                      ? currentSFX.bloodTypes.join(', ')
                      : <span className="text-text-placeholder">—</span>}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {BLOOD_TYPES.map((type) => {
                      const isSelected = currentSFX.bloodTypes.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleBloodTypeToggle(type)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                            isSelected
                              ? 'bg-gold text-white border-gold'
                              : 'bg-white text-text-secondary border-border hover:border-gold/50'
                          }`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <FormField
                label="Blood Products"
                value={currentSFX.bloodProducts}
                onChange={(v) => handleFieldChange('bloodProducts', v)}
                readOnly={readOnly}
                placeholder="e.g., Kryolan Dark Blood, Fleet Street Drying Blood"
              />
              <FormField
                label="Blood Placement"
                value={currentSFX.bloodPlacement}
                onChange={(v) => handleFieldChange('bloodPlacement', v)}
                readOnly={readOnly}
                placeholder="e.g., Left temple wound, splatter on collar"
                multiline
              />
            </div>
          </div>

          {/* Tattoos Section */}
          <div className="border-t border-border pt-4">
            <h4 className="field-label text-gold mb-3">TATTOOS</h4>
            <div className="space-y-3">
              <FormField
                label="Tattoo Coverage"
                value={currentSFX.tattooCoverage}
                onChange={(v) => handleFieldChange('tattooCoverage', v)}
                readOnly={readOnly}
                placeholder="e.g., Dermablend on right arm sleeve"
              />
              <FormField
                label="Temporary Tattoos"
                value={currentSFX.temporaryTattoos}
                onChange={(v) => handleFieldChange('temporaryTattoos', v)}
                readOnly={readOnly}
                placeholder="e.g., Neck tattoo transfer, left forearm design"
              />
            </div>
          </div>

          {/* Eyes & Teeth Section */}
          <div className="border-t border-border pt-4">
            <h4 className="field-label text-gold mb-3">EYES & TEETH</h4>
            <div className="space-y-3">
              <FormField
                label="Contact Lenses"
                value={currentSFX.contactLenses}
                onChange={(v) => handleFieldChange('contactLenses', v)}
                readOnly={readOnly}
                placeholder="e.g., 9mm Mesmer Ghostly White, plano"
              />
              <FormField
                label="Teeth"
                value={currentSFX.teeth}
                onChange={(v) => handleFieldChange('teeth', v)}
                readOnly={readOnly}
                placeholder="e.g., Custom vampire fangs, coffee staining"
              />
            </div>
          </div>

          {/* Aging & Character */}
          <div className="border-t border-border pt-4">
            <h4 className="field-label text-gold mb-3">AGING & CHARACTER</h4>
            <FormField
              label="Aging / Character Notes"
              value={currentSFX.agingCharacterNotes}
              onChange={(v) => handleFieldChange('agingCharacterNotes', v)}
              readOnly={readOnly}
              placeholder="e.g., Stipple aging on hands and neck, sunken cheeks with highlight/shadow"
              multiline
              rows={3}
            />
          </div>

          {/* SFX Application Time */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <label className="field-label whitespace-nowrap">SFX APPLICATION TIME</label>
              {readOnly ? (
                <span className="text-sm text-text-primary font-semibold">
                  {currentSFX.sfxApplicationTime ?? '—'} min
                </span>
              ) : (
                <>
                  <input
                    type="number"
                    value={currentSFX.sfxApplicationTime ?? ''}
                    onChange={(e) => handleFieldChange(
                      'sfxApplicationTime',
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )}
                    className="w-16 bg-[#f8f7f5] border border-[#e8e6e1] rounded-lg px-3 py-2 text-sm text-center font-semibold text-[#1a1a1a] focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-colors"
                    placeholder="--"
                    min="0"
                  />
                  <span className="text-sm text-text-muted">minutes</span>
                </>
              )}
            </div>
          </div>

          {/* SFX Reference Photos */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="field-label text-gold">SFX REFERENCE PHOTOS</h4>
              <span className="text-[11px] text-text-light">
                {currentSFX.sfxReferencePhotos.length} photos
              </span>
            </div>
            <SFXPhotoGrid
              photos={currentSFX.sfxReferencePhotos}
              onCapture={onCapturePhoto}
              onRemove={onRemovePhoto}
              readOnly={readOnly}
            />
          </div>
        </>
      )}

      {/* Show message when SFX not required */}
      {!currentSFX.sfxRequired && (
        <div className="text-center py-4">
          <p className="text-sm text-text-muted">
            Toggle SFX Required to add special effects details.
          </p>
        </div>
      )}
    </div>
  );
}

// SFX Photo Grid component
interface SFXPhotoGridProps {
  photos: Photo[];
  onCapture?: () => void;
  onRemove?: (photoId: string) => void;
  readOnly?: boolean;
}

function SFXPhotoGrid({ photos, onCapture, onRemove, readOnly }: SFXPhotoGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="relative aspect-square">
          <PhotoImg
            photo={photo}
            alt="SFX reference"
            className="w-full h-full object-cover rounded-lg"
          />
          {!readOnly && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(photo.id)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center shadow-sm"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {/* Add Photo Button */}
      {!readOnly && onCapture && (
        <button
          type="button"
          onClick={onCapture}
          className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-text-light hover:border-gold hover:text-gold transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
          <span className="text-[10px] font-medium">Add</span>
        </button>
      )}

      {/* Empty state */}
      {photos.length === 0 && readOnly && (
        <div className="col-span-4 text-center py-4">
          <p className="text-sm text-text-muted">No SFX reference photos.</p>
        </div>
      )}
    </div>
  );
}
