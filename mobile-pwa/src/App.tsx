import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { demoProject } from '@/stores/demoData';
import { BottomNav } from '@/components/navigation';
import { SceneView } from '@/components/scenes';
import { Today } from '@/components/today';
import { Breakdown } from '@/components/breakdown';
import { Lookbooks } from '@/components/lookbooks';
import { Timesheet } from '@/components/timesheet';
import { More } from '@/components/more';
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

  // Handle scene selection (from Today or Breakdown)
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

  // Handle navigation from More menu to a specific tab
  const handleNavigateToTab = (tab: NavTab) => {
    handleTabChange(tab);
  };

  // Render content based on active tab and current view
  const renderContent = () => {
    // If viewing a specific scene (from Today or Breakdown tabs)
    if (currentSceneId && (activeTab === 'today' || activeTab === 'breakdown')) {
      return (
        <SceneView
          sceneId={currentSceneId}
          onBack={handleBackFromScene}
        />
      );
    }

    // Tab content
    switch (activeTab) {
      case 'today':
        return <Today onSceneSelect={handleSceneSelect} />;
      case 'breakdown':
        return <Breakdown onSceneSelect={handleSceneSelect} />;
      case 'looks':
        return <Lookbooks />;
      case 'hours':
        return <Timesheet />;
      // These tabs are handled by the More component internally,
      // but if user navigates directly (e.g., from customized nav), show More
      case 'script':
      case 'schedule':
      case 'callsheets':
      case 'settings':
      case 'more':
        return <More onNavigateToTab={handleNavigateToTab} />;
      default:
        return <Today onSceneSelect={handleSceneSelect} />;
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
