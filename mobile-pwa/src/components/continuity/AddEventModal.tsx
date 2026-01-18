import { useState } from 'react';
import { clsx } from 'clsx';
import type { ContinuityEvent, ContinuityEventType } from '@/types';
import { CONTINUITY_EVENT_TYPES, STAGE_SUGGESTIONS } from '@/types';
import { BottomSheet, Button, Input, Textarea } from '../ui';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (event: Omit<ContinuityEvent, 'id'>) => void;
}

export function AddEventModal({ isOpen, onClose, onAdd }: AddEventModalProps) {
  const [type, setType] = useState<ContinuityEventType>('Wound');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stage, setStage] = useState('');
  const [sceneRange, setSceneRange] = useState('');
  const [products, setProducts] = useState('');
  const [showStageSuggestions, setShowStageSuggestions] = useState(false);

  const resetForm = () => {
    setType('Wound');
    setName('');
    setDescription('');
    setStage('');
    setSceneRange('');
    setProducts('');
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    onAdd({
      type,
      name: name.trim(),
      description: description.trim(),
      stage: stage.trim(),
      sceneRange: sceneRange.trim(),
      products: products.trim(),
      referencePhotos: [],
    });

    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Continuity Event"
      height="auto"
    >
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

        {/* Stage with suggestions */}
        <div className="relative">
          <Input
            label="STAGE"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            onFocus={() => setShowStageSuggestions(true)}
            onBlur={() => setTimeout(() => setShowStageSuggestions(false), 200)}
            placeholder="e.g., Fresh, Day 2 Healing"
          />
          {showStageSuggestions && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card rounded-lg shadow-lg border border-border overflow-hidden">
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

        {/* Scene Range */}
        <Input
          label="SCENE RANGE"
          value={sceneRange}
          onChange={(e) => setSceneRange(e.target.value)}
          placeholder="e.g., 12-18"
        />

        {/* Products */}
        <Textarea
          label="PRODUCTS"
          value={products}
          onChange={(e) => setProducts(e.target.value)}
          placeholder="List products used..."
          rows={2}
        />

        {/* TODO: Add reference photo button */}
        <Button variant="outline" size="sm" fullWidth disabled>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Add Reference Photo (Coming Soon)
        </Button>

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
  );
}
