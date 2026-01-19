import { useState, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { createEmptyMakeupDetails, createEmptyHairDetails } from '@/types';
import type { Look } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface AddLookModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCharacterId?: string | null;
}

export function AddLookModal({ isOpen, onClose, preselectedCharacterId }: AddLookModalProps) {
  const { currentProject, setProject } = useProjectStore();

  const [characterId, setCharacterId] = useState<string>('');
  const [lookName, setLookName] = useState('');
  const [sceneStart, setSceneStart] = useState('');
  const [sceneEnd, setSceneEnd] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('30');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCharacterId(preselectedCharacterId || currentProject?.characters[0]?.id || '');
      setLookName('');
      setSceneStart('');
      setSceneEnd('');
      setEstimatedTime('30');
    }
  }, [isOpen, preselectedCharacterId, currentProject]);

  // Generate default look name suggestion
  useEffect(() => {
    if (characterId && currentProject) {
      const existingLooks = currentProject.looks.filter(l => l.characterId === characterId);
      const dayNum = existingLooks.length + 1;
      setLookName(`Day ${dayNum}`);
    }
  }, [characterId, currentProject]);

  const handleSubmit = () => {
    if (!currentProject || !characterId || !lookName.trim()) return;

    const start = parseInt(sceneStart, 10) || 1;
    const end = parseInt(sceneEnd, 10) || start;
    const scenes: string[] = [];
    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
      scenes.push(String(i));
    }

    const newLook: Look = {
      id: uuidv4(),
      characterId,
      name: lookName.trim(),
      scenes,
      estimatedTime: parseInt(estimatedTime, 10) || 30,
      makeup: createEmptyMakeupDetails(),
      hair: createEmptyHairDetails(),
    };

    // Update project with new look
    setProject({
      ...currentProject,
      looks: [...currentProject.looks, newLook],
      updatedAt: new Date(),
    });

    onClose();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-[430px] bg-card rounded-t-2xl shadow-xl animate-slideUp max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Add New Look</h2>
          <button
            onClick={onClose}
            className="p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Character selector */}
          <div>
            <label className="field-label block mb-2">CHARACTER</label>
            <select
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
              className="input-field w-full"
            >
              {currentProject?.characters.map(char => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))}
            </select>
          </div>

          {/* Look name */}
          <div>
            <label className="field-label block mb-2">LOOK NAME</label>
            <input
              type="text"
              value={lookName}
              onChange={(e) => setLookName(e.target.value)}
              placeholder="e.g., Day 1 - Professional"
              className="input-field w-full"
            />
            <p className="text-xs text-text-muted mt-1">
              Suggest descriptive names like "Day 1 - Office", "Post-Fight", etc.
            </p>
          </div>

          {/* Scene range */}
          <div>
            <label className="field-label block mb-2">SCENE RANGE</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={sceneStart}
                onChange={(e) => setSceneStart(e.target.value)}
                placeholder="Start"
                min="1"
                className="input-field w-24 text-center"
              />
              <span className="text-text-muted">to</span>
              <input
                type="number"
                value={sceneEnd}
                onChange={(e) => setSceneEnd(e.target.value)}
                placeholder="End"
                min="1"
                className="input-field w-24 text-center"
              />
            </div>
            <p className="text-xs text-text-muted mt-1">
              Which scenes use this look? You can adjust later.
            </p>
          </div>

          {/* Estimated time */}
          <div>
            <label className="field-label block mb-2">ESTIMATED APPLICATION TIME</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                min="5"
                step="5"
                className="input-field w-24 text-center"
              />
              <span className="text-sm text-text-muted">minutes</span>
            </div>
          </div>

          {/* Standalone mode hint */}
          <div className="bg-gold-50 rounded-lg p-3">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-gold-dark font-medium">Standalone Mode</p>
                <p className="text-xs text-text-muted mt-0.5">
                  You can add makeup and hair details after creating the look, or sync from desktop for full specifications.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-button bg-gray-100 text-text-primary font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!characterId || !lookName.trim()}
            className="flex-1 py-3 px-4 rounded-button gold-gradient text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Look
          </button>
        </div>
      </div>
    </div>
  );
}
