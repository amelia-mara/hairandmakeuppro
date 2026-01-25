import { useEffect } from 'react';
import { ProjectStatsCard } from './ProjectStatsCard';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';

interface ProjectStatsScreenProps {
  projectId: string;
  onBack: () => void;
}

export function ProjectStatsScreen({
  projectId,
  onBack,
}: ProjectStatsScreenProps) {
  const { projectStats, isLoading, loadProjectSettings } = useProjectSettingsStore();

  useEffect(() => {
    if (!projectStats) {
      loadProjectSettings(projectId);
    }
  }, [projectId, projectStats, loadProjectSettings]);

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
            <h1 className="text-lg font-semibold text-text-primary">Project Stats</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-container px-4 py-4">
        {isLoading && !projectStats ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projectStats ? (
          <ProjectStatsCard stats={projectStats} />
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-text-muted">No stats available</p>
          </div>
        )}
      </div>
    </div>
  );
}
