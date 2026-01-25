import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Scene } from '@/types';

interface ScheduleEditorProps {
  scenes: Scene[];
  onSave: (dayNumber: number, date: Date, sceneIds: string[]) => void;
  initialDayNumber?: number;
  initialDate?: Date;
  initialSceneIds?: string[];
}

export function ScheduleEditor({
  scenes,
  onSave,
  initialDayNumber = 1,
  initialDate = new Date(),
  initialSceneIds = [],
}: ScheduleEditorProps) {
  const [dayNumber, setDayNumber] = useState(initialDayNumber);
  const [date, setDate] = useState(formatDateForInput(initialDate));
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(
    new Set(initialSceneIds)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Format date for input
  function formatDateForInput(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  // Format date for display
  function formatDateDisplay(dateStr: string): string {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  }

  // Filter scenes by search query
  const filteredScenes = useMemo(() => {
    if (!searchQuery.trim()) return scenes;

    const query = searchQuery.toLowerCase();
    return scenes.filter(
      (scene) =>
        scene.sceneNumber.toLowerCase().includes(query) ||
        scene.slugline.toLowerCase().includes(query)
    );
  }, [scenes, searchQuery]);

  // Toggle scene selection
  const toggleScene = (sceneId: string) => {
    const newSelected = new Set(selectedSceneIds);
    if (newSelected.has(sceneId)) {
      newSelected.delete(sceneId);
    } else {
      newSelected.add(sceneId);
    }
    setSelectedSceneIds(newSelected);
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const selectedDate = new Date(date);
      onSave(dayNumber, selectedDate, Array.from(selectedSceneIds));
    } finally {
      setIsSaving(false);
    }
  };

  // Get ordered selected scenes for drag reorder
  const selectedScenes = useMemo(() => {
    return scenes.filter((s) => selectedSceneIds.has(s.id));
  }, [scenes, selectedSceneIds]);

  return (
    <div className="space-y-6">
      {/* Day Number and Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            Shooting Day
          </label>
          <div className="relative">
            <select
              value={dayNumber}
              onChange={(e) => setDayNumber(Number(e.target.value))}
              className="input-field w-full appearance-none pr-10"
            >
              {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  Day {num}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field w-full"
          />
        </div>
      </div>

      {/* Date Display */}
      <div className="text-center py-2 px-4 bg-gold-50 rounded-xl">
        <p className="text-sm font-medium text-gold">{formatDateDisplay(date)}</p>
      </div>

      {/* Search Scenes */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          SELECT SCENES FOR TODAY:
        </label>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scenes..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Scene List */}
      <div className="max-h-[40vh] overflow-y-auto -mx-4 px-4">
        <div className="space-y-2">
          {filteredScenes.map((scene) => {
            const isSelected = selectedSceneIds.has(scene.id);
            return (
              <button
                key={scene.id}
                onClick={() => toggleScene(scene.id)}
                className={`w-full px-4 py-3 rounded-xl text-left flex items-center gap-3 transition-colors ${
                  isSelected
                    ? 'bg-gold-50 border border-gold'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-gold border-gold text-white'
                      : 'border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      Scene {scene.sceneNumber}
                    </span>
                    <span className="text-xs text-text-muted">
                      {scene.intExt}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted truncate">
                    {scene.slugline}
                  </p>
                </div>
                {scene.isComplete && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-600 rounded-full">
                    Complete
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {filteredScenes.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted">No scenes found</p>
          </div>
        )}
      </div>

      {/* Selected Count */}
      <div className="py-2 border-t border-border">
        <p className="text-sm text-text-muted text-center">
          {selectedSceneIds.size} scene{selectedSceneIds.size !== 1 ? 's' : ''} selected
        </p>
      </div>

      {/* Selected Scenes Preview (for reordering) */}
      {selectedScenes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-muted mb-2">Shot Order:</p>
          <div className="space-y-1">
            {selectedScenes.map((scene, index) => (
              <div
                key={scene.id}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
              >
                <span className="text-xs font-bold text-text-muted w-5">
                  {index + 1}.
                </span>
                <span className="text-xs text-text-primary">
                  Scene {scene.sceneNumber}
                </span>
                <span className="text-xs text-text-muted truncate flex-1">
                  {scene.slugline}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-light mt-2 text-center">
            Tip: Drag to reorder scenes for shot order
          </p>
        </div>
      )}

      {/* Save Button */}
      <Button
        variant="primary"
        onClick={handleSave}
        fullWidth
        disabled={selectedSceneIds.size === 0 || isSaving}
      >
        {isSaving ? 'Saving...' : "Save Today's Schedule"}
      </Button>
    </div>
  );
}
