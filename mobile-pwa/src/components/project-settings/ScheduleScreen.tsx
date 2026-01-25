import { ScheduleEditor } from './ScheduleEditor';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';

interface ScheduleScreenProps {
  onBack: () => void;
  onSaved?: () => void;
}

export function ScheduleScreen({
  onBack,
  onSaved,
}: ScheduleScreenProps) {
  const { currentProject } = useProjectStore();
  const { saveShootingDay } = useProjectSettingsStore();

  const scenes = currentProject?.scenes || [];

  const handleSave = async (dayNumber: number, date: Date, sceneIds: string[]) => {
    await saveShootingDay(dayNumber, date, sceneIds);
    onSaved?.();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-text-muted hover:text-text-primary transition-colors tap-target"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-text-primary">Today's Scenes</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-container px-4 py-4 pb-safe-bottom">
        {scenes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <p className="text-sm text-text-muted">No scenes available</p>
            <p className="text-xs text-text-light mt-1">Import a script to add scenes</p>
          </div>
        ) : (
          <ScheduleEditor
            scenes={scenes}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
