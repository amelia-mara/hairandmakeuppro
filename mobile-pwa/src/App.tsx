import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { BottomNav } from '@/components/navigation';
import { SceneView } from '@/components/scenes';
import { Today } from '@/components/today';
import { Breakdown } from '@/components/breakdown';
import { Lookbooks } from '@/components/lookbooks';
import { Timesheet } from '@/components/timesheet';
import { Budget } from '@/components/budget';
import { More } from '@/components/more';
import { Home } from '@/components/home';
import type { NavTab } from '@/types';

export default function App() {
  const {
    currentProject,
    activeTab,
    setActiveTab,
    currentSceneId,
    setCurrentScene,
    setCurrentCharacter,
  } = useProjectStore();

  // Track if we're showing the home/setup screen
  const [showHome, setShowHome] = useState(!currentProject);

  // Handle project ready (from Home component)
  const handleProjectReady = () => {
    setShowHome(false);
    setActiveTab('today');
  };

  // Handle starting a new project (from Settings)
  const handleStartNewProject = () => {
    setShowHome(true);
  };

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

  // Show Home screen if no project or explicitly requested
  if (showHome || !currentProject) {
    return <Home onProjectReady={handleProjectReady} />;
  }

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
      case 'lookbook':
        return <Lookbooks />;
      case 'hours':
        return <Timesheet />;
      case 'budget':
        return <Budget />;
      // These tabs are handled by the More component internally,
      // but if user navigates directly (e.g., from customized nav), show More
      case 'script':
      case 'schedule':
      case 'callsheets':
      case 'settings':
      case 'more':
        return <More onNavigateToTab={handleNavigateToTab} onStartNewProject={handleStartNewProject} />;
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
