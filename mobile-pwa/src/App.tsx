import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { demoProject } from '@/stores/demoData';
import { BottomNav } from '@/components/navigation';
import { SceneList, SceneView } from '@/components/scenes';
import type { NavTab } from '@/types';

export default function App() {
  const {
    currentProject,
    setProject,
    activeTab,
    setActiveTab,
    currentSceneId,
    setCurrentScene,
    setCurrentCharacter,
  } = useProjectStore();

  // Load demo data on first mount
  useEffect(() => {
    if (!currentProject) {
      setProject(demoProject);
    }
  }, [currentProject, setProject]);

  // Handle scene selection
  const handleSceneSelect = (sceneId: string) => {
    setCurrentScene(sceneId);
    setCurrentCharacter(null); // Will auto-select first character
  };

  // Handle back from scene view
  const handleBackFromScene = () => {
    setCurrentScene(null);
    setCurrentCharacter(null);
  };

  // Handle tab change
  const handleTabChange = (tab: NavTab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      // Clear scene view when switching tabs
      if (currentSceneId) {
        setCurrentScene(null);
        setCurrentCharacter(null);
      }
    }
  };

  // Render content based on active tab and current view
  const renderContent = () => {
    // If viewing a specific scene
    if (currentSceneId && activeTab === 'scenes') {
      return (
        <SceneView
          sceneId={currentSceneId}
          onBack={handleBackFromScene}
        />
      );
    }

    // Tab content
    switch (activeTab) {
      case 'scenes':
        return <SceneList onSceneSelect={handleSceneSelect} />;
      case 'lookbooks':
        return <PlaceholderScreen title="Lookbooks" description="Character lookbooks will appear here" />;
      case 'timesheet':
        return <PlaceholderScreen title="Timesheet" description="Track application times and working hours" />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <SceneList onSceneSelect={handleSceneSelect} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderContent()}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
}

// Placeholder screen for tabs not yet implemented
interface PlaceholderScreenProps {
  title: string;
  description: string;
}

function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center">
            <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
          </div>
        </div>
      </div>
      <div className="mobile-container flex items-center justify-center min-h-[60vh]">
        <div className="text-center px-8">
          <div className="w-20 h-20 rounded-full bg-gold-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">{title}</h2>
          <p className="text-sm text-text-muted">{description}</p>
          <p className="text-xs text-gold mt-4">Coming soon</p>
        </div>
      </div>
    </div>
  );
}

// Settings screen
function SettingsScreen() {
  const { clearProject, currentProject } = useProjectStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center">
            <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-6">
        {/* Project info */}
        <section className="mb-6">
          <h2 className="section-header mb-3">CURRENT PROJECT</h2>
          <div className="card">
            <div className="text-base font-semibold text-text-primary">
              {currentProject?.name ?? 'No project loaded'}
            </div>
            {currentProject && (
              <div className="text-sm text-text-muted mt-1">
                {currentProject.scenes.length} scenes • {currentProject.characters.length} characters
              </div>
            )}
          </div>
        </section>

        {/* App info */}
        <section className="mb-6">
          <h2 className="section-header mb-3">ABOUT</h2>
          <div className="card space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Version</span>
              <span className="text-sm text-text-primary">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Platform</span>
              <span className="text-sm text-text-primary">Mobile PWA</span>
            </div>
          </div>
        </section>

        {/* Sync status (placeholder) */}
        <section className="mb-6">
          <h2 className="section-header mb-3">SYNC STATUS</h2>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-text-primary">Offline Mode</span>
            </div>
            <p className="text-xs text-text-muted mt-2">
              All data is stored locally on your device.
            </p>
          </div>
        </section>

        {/* Clear data */}
        <section>
          <h2 className="section-header mb-3">DATA</h2>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="card w-full text-left text-error hover:bg-red-50 transition-colors"
          >
            Clear All Data
          </button>
        </section>

        {/* Clear confirmation modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Clear All Data?</h3>
              <p className="text-sm text-text-muted mb-6">
                This will delete all captured photos and scene data. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-button bg-gray-100 text-text-primary font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearProject();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-button bg-error text-white font-medium"
                >
                  Clear Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
