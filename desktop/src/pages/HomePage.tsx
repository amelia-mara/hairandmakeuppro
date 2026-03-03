import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';

export function HomePage() {
  const project = useProjectStore((s) => s.currentProject);
  const clearProject = useProjectStore((s) => s.clearProject);
  const setView = useUIStore((s) => s.setView);
  const setShowScriptUpload = useUIStore((s) => s.setShowScriptUpload);

  if (project) {
    // Show existing project summary
    const totalScenes = project.scenes.length;
    const completedScenes = Object.values(project.sceneBreakdowns).filter((b) => b.isComplete).length;
    const totalCharacters = project.characters.length;

    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">{project.name}</h2>
            <p className="text-white/50 text-sm mt-1">
              Created {new Date(project.created).toLocaleDateString()}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface rounded-lg p-4 border border-white/10">
              <div className="text-2xl font-bold text-accent">{totalScenes}</div>
              <div className="text-xs text-white/50 mt-1">Scenes</div>
            </div>
            <div className="bg-surface rounded-lg p-4 border border-white/10">
              <div className="text-2xl font-bold text-accent">{totalCharacters}</div>
              <div className="text-xs text-white/50 mt-1">Characters</div>
            </div>
            <div className="bg-surface rounded-lg p-4 border border-white/10">
              <div className="text-2xl font-bold text-accent">
                {totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0}%
              </div>
              <div className="text-xs text-white/50 mt-1">Complete</div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setView('breakdown')}
            >
              Continue Breakdown
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={clearProject}
            >
              Start New Project
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Prep Happy</h2>
          <p className="text-white/50 mt-2">
            Upload a script PDF to get started with your Hair & Makeup breakdown.
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => setShowScriptUpload(true)}
        >
          Upload Script PDF
        </Button>

        <p className="text-xs text-white/30">
          Fast parse &bull; Under 60 seconds to productive
        </p>
      </div>
    </div>
  );
}
