import { useState, useRef } from 'react';
import { clsx } from 'clsx';
import type { ContinuityEvent, ContinuityEventType, Photo, ProgressionStage } from '@/types';
import { CONTINUITY_EVENT_TYPES, STAGE_SUGGESTIONS } from '@/types';
import { BottomSheet, Button, Input, Textarea } from '../ui';
import { createPhotoFromBlob } from '@/utils/imageUtils';
import { PhotoCapture } from '../photos';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (event: Omit<ContinuityEvent, 'id'>) => void;
  availableScenes?: string[];
}

export function AddEventModal({ isOpen, onClose, onAdd, availableScenes = [] }: AddEventModalProps) {
  const [type, setType] = useState<ContinuityEventType>('Wound');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stage, setStage] = useState('');
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [products, setProducts] = useState('');
  const [showStageSuggestions, setShowStageSuggestions] = useState(false);
  const [referencePhotos, setReferencePhotos] = useState<Photo[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progression timeline
  const [progression, setProgression] = useState<ProgressionStage[]>([]);
  const [showProgression, setShowProgression] = useState(false);

  const resetForm = () => {
    setType('Wound');
    setName('');
    setDescription('');
    setStage('');
    setSelectedScenes([]);
    setProducts('');
    setReferencePhotos([]);
    setShowPhotoCapture(false);
    setProgression([]);
    setShowProgression(false);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    onAdd({
      type,
      name: name.trim(),
      description: description.trim(),
      stage: stage.trim(),
      sceneRange: selectedScenes.length > 0 ? selectedScenes.join(', ') : '',
      scenes: selectedScenes,
      products: products.trim(),
      referencePhotos,
      progression,
    });

    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleScene = (scene: string) => {
    setSelectedScenes((prev) =>
      prev.includes(scene)
        ? prev.filter((s) => s !== scene)
        : [...prev, scene]
    );
  };

  const selectAllScenes = () => {
    if (selectedScenes.length === availableScenes.length) {
      setSelectedScenes([]);
    } else {
      setSelectedScenes([...availableScenes]);
    }
  };

  // Progression stage management
  const addProgressionStage = () => {
    const nextScene = selectedScenes.find(
      (s) => !progression.some((p) => p.scene === s)
    ) || '';
    setProgression((prev) => [
      ...prev,
      {
        id: `stage-${Date.now()}`,
        scene: nextScene,
        stage: '',
        notes: '',
        referencePhotos: [],
      },
    ]);
  };

  const updateProgressionStage = (id: string, updates: Partial<ProgressionStage>) => {
    setProgression((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const removeProgressionStage = (id: string) => {
    setProgression((prev) => prev.filter((p) => p.id !== id));
  };

  // Photo handling
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsCapturing(true);
      try {
        const photo = await createPhotoFromBlob(file, 'additional');
        setReferencePhotos((prev) => [...prev, photo]);
      } catch (err) {
        console.error('Failed to process photo:', err);
      } finally {
        setIsCapturing(false);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setReferencePhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handlePhotoCapture = async (blob: Blob) => {
    setIsCapturing(true);
    try {
      const photo = await createPhotoFromBlob(blob, 'additional');
      setReferencePhotos((prev) => [...prev, photo]);
    } catch (err) {
      console.error('Failed to process captured photo:', err);
    } finally {
      setIsCapturing(false);
      setShowPhotoCapture(false);
    }
  };

  const handleAddPhoto = () => {
    setShowPhotoCapture(true);
  };

  // Types that typically have changing progression
  const hasProgression = type === 'Wound' || type === 'Bruise' || type === 'Other';

  return (
    <>
      {/* Photo Capture Modal */}
      <PhotoCapture
        isOpen={showPhotoCapture}
        onClose={() => setShowPhotoCapture(false)}
        onCapture={handlePhotoCapture}
        angle="additional"
      />

      <BottomSheet
        isOpen={isOpen && !showPhotoCapture}
        onClose={handleClose}
        title="Add Continuity Event"
        height="auto"
      >
        {/* Hidden file input - kept as fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

      <div className="space-y-4">
        {/* Event Type Selector */}
        <div>
          <label className="field-label block mb-2">TYPE</label>
          <div className="flex flex-wrap gap-2">
            {CONTINUITY_EVENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors touch-manipulation',
                  {
                    'bg-gold text-white border-gold': type === t,
                    'bg-gray-100 text-text-secondary border-gray-200 hover:bg-gray-200': type !== t,
                  }
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <Input
          label="NAME"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Forehead Cut"
        />

        {/* Description */}
        <Textarea
          label="DESCRIPTION"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the makeup effect..."
          rows={2}
        />

        {/* Scene Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="field-label">SCENES</label>
            {availableScenes.length > 0 && (
              <button
                type="button"
                onClick={selectAllScenes}
                className="text-[11px] text-gold font-medium"
              >
                {selectedScenes.length === availableScenes.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          {availableScenes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {availableScenes.map((scene) => {
                const isSelected = selectedScenes.includes(scene);
                return (
                  <button
                    key={scene}
                    type="button"
                    onClick={() => toggleScene(scene)}
                    className={clsx(
                      'min-w-[44px] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors touch-manipulation',
                      {
                        'bg-gold text-white border-gold': isSelected,
                        'bg-gray-50 text-text-secondary border-gray-200': !isSelected,
                      }
                    )}
                  >
                    {scene}
                  </button>
                );
              })}
            </div>
          ) : (
            <Input
              value={selectedScenes.join(', ')}
              onChange={(e) => setSelectedScenes(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="e.g., 12, 13, 14, 15"
            />
          )}
          {selectedScenes.length > 0 && (
            <p className="text-[11px] text-text-muted mt-1.5">
              {selectedScenes.length} scene{selectedScenes.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Current Stage with suggestions */}
        <div className="relative">
          <Input
            label="CURRENT STAGE"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            onFocus={() => setShowStageSuggestions(true)}
            onBlur={() => setTimeout(() => setShowStageSuggestions(false), 200)}
            placeholder="e.g., Fresh, Day 2 Healing"
          />
          {showStageSuggestions && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card rounded-lg shadow-lg border border-border overflow-hidden max-h-40 overflow-y-auto">
              {STAGE_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setStage(suggestion);
                    setShowStageSuggestions(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-gray-50 touch-manipulation"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progression Timeline */}
        {hasProgression && selectedScenes.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="field-label">PROGRESSION TIMELINE</label>
              <button
                type="button"
                onClick={() => setShowProgression(!showProgression)}
                className="text-[11px] text-gold font-medium"
              >
                {showProgression ? 'Hide' : 'Plan changes over scenes'}
              </button>
            </div>

            {showProgression && (
              <div className="space-y-2.5">
                {progression.length > 0 && (
                  <div className="space-y-2">
                    {progression.map((ps, idx) => (
                      <div key={ps.id} className="bg-gray-50 rounded-lg p-3 relative">
                        {/* Stage number indicator */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 rounded-full bg-gold text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </div>
                          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
                            Stage {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeProgressionStage(ps.id)}
                            className="ml-auto p-0.5 text-text-light hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* Scene picker for this stage */}
                        <div className="mb-2">
                          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide block mb-1">From Scene</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedScenes.map((scene) => (
                              <button
                                key={scene}
                                type="button"
                                onClick={() => updateProgressionStage(ps.id, { scene })}
                                className={clsx(
                                  'min-w-[36px] px-2 py-1 text-[11px] font-medium rounded border transition-colors touch-manipulation',
                                  {
                                    'bg-gold text-white border-gold': ps.scene === scene,
                                    'bg-white text-text-secondary border-gray-200': ps.scene !== scene,
                                  }
                                )}
                              >
                                {scene}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Stage description */}
                        <div className="mb-2 relative">
                          <ProgressionStagePicker
                            value={ps.stage}
                            onChange={(val) => updateProgressionStage(ps.id, { stage: val })}
                          />
                        </div>

                        {/* Notes for this stage */}
                        <Textarea
                          value={ps.notes}
                          onChange={(e) => updateProgressionStage(ps.id, { notes: e.target.value })}
                          placeholder="Application notes for this stage..."
                          rows={1}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Add stage button */}
                <button
                  type="button"
                  onClick={addProgressionStage}
                  className="w-full py-2.5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-gold bg-gold-100/30 border border-dashed border-gold-300 rounded-lg hover:bg-gold-100/50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Stage
                </button>

                {progression.length === 0 && (
                  <p className="text-[11px] text-text-light text-center">
                    Plan how this event changes across scenes — e.g. fresh wound in Sc 5, scabbing by Sc 12, healed by Sc 20
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Products */}
        <Textarea
          label="PRODUCTS"
          value={products}
          onChange={(e) => setProducts(e.target.value)}
          placeholder="List products used..."
          rows={2}
        />

        {/* Reference Photos */}
        <div>
          <label className="field-label block mb-2">REFERENCE PHOTOS</label>

          {/* Photo grid */}
          {referencePhotos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {referencePhotos.map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={photo.thumbnail || photo.uri}
                    alt="Reference"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                    aria-label="Remove photo"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add photo button */}
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={handleAddPhoto}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <>
                <div className="w-4 h-4 mr-1.5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {referencePhotos.length > 0 ? 'Add Another Photo' : 'Add Reference Photo'}
              </>
            )}
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" size="lg" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Add Event
          </Button>
        </div>
      </div>
      </BottomSheet>
    </>
  );
}

// Small inline component for stage selection with suggestions
function ProgressionStagePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  return (
    <div className="relative">
      <Input
        label="STAGE"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder="e.g., Fresh, Scabbed"
      />
      {showSuggestions && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card rounded-lg shadow-lg border border-border overflow-hidden max-h-32 overflow-y-auto">
          {STAGE_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                onChange(suggestion);
                setShowSuggestions(false);
              }}
              className="w-full px-3 py-1.5 text-left text-[12px] text-text-secondary hover:bg-gray-50 touch-manipulation"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
