import { useState, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { BottomNav } from '@/components/navigation';
import { SceneView } from '@/components/scenes';
import { Today } from '@/components/today';
import { Breakdown } from '@/components/breakdown';
import { Lookbooks } from '@/components/lookbooks';
import { Timesheet } from '@/components/timesheet';
import { Budget } from '@/components/budget';
import { More, WrapPopupModal, LifecycleBanner, ProjectExportScreen } from '@/components/more';
import { Home } from '@/components/home';
import { ChatAssistant } from '@/components/chat/ChatAssistant';
import {
  WelcomeScreen,
  SignInScreen,
  SignUpScreen,
  JoinProjectScreen,
  ProjectHubScreen,
  CreateProjectScreen,
} from '@/components/auth';
import { SelectPlanScreen } from '@/components/subscription';
import type { NavTab, SubscriptionTier, BillingPeriod } from '@/types';

export default function App() {
  const {
    currentProject,
    activeTab,
    setActiveTab,
    currentSceneId,
    setCurrentScene,
    setCurrentCharacter,
    checkWrapTrigger,
    lifecycle,
    updateActivity,
  } = useProjectStore();

  const {
    isAuthenticated,
    hasCompletedOnboarding,
    currentScreen,
    guestProjectCode,
    selectTier,
    setScreen,
    user,
  } = useAuthStore();

  // Track if we're showing the home/setup screen
  const [showHome, setShowHome] = useState(!currentProject);
  const [showExport, setShowExport] = useState(false);
  // Key to force More component to reset when clicking the same tab
  const [tabResetKey, setTabResetKey] = useState(0);

  // Check for wrap triggers on mount and when scenes change
  useEffect(() => {
    if (currentProject) {
      checkWrapTrigger();
    }
  }, [currentProject?.scenes.filter(s => s.isComplete).length]);

  // Update activity timestamp periodically
  useEffect(() => {
    if (currentProject) {
      updateActivity();
    }
  }, [currentSceneId, activeTab]);

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
    // If clicking the same tab, increment reset key to force sub-views to reset
    if (tab === activeTab) {
      setTabResetKey(k => k + 1);
    }
    setActiveTab(tab);
    // Clear scene view when switching tabs or re-clicking current tab
    if (currentSceneId) {
      setCurrentScene(null);
      setCurrentCharacter(null);
    }
  };

  // Handle navigation from More menu to a specific tab
  const handleNavigateToTab = (tab: NavTab) => {
    handleTabChange(tab);
  };

  // Handler for tier selection
  const handleSelectTier = async (tier: SubscriptionTier, billingPeriod: BillingPeriod) => {
    await selectTier(tier, billingPeriod);
  };

  // Handler for skipping plan selection (continue with free)
  const handleSkipPlanSelection = async () => {
    await selectTier('trainee', 'monthly');
  };

  // Auth flow - show auth screens for new users or logged out users
  // Skip if user has a guest project code (they joined without account)
  if (!hasCompletedOnboarding && !guestProjectCode) {
    switch (currentScreen) {
      case 'welcome':
        return <WelcomeScreen />;
      case 'signin':
        return <SignInScreen />;
      case 'signup':
        return <SignUpScreen />;
      case 'join':
        return <JoinProjectScreen />;
      case 'hub':
        return <ProjectHubScreen />;
      case 'create-project':
        return <CreateProjectScreen />;
      case 'select-plan':
        return (
          <SelectPlanScreen
            isOnboarding={true}
            currentTier={user?.tier as SubscriptionTier | undefined}
            onSelectTier={handleSelectTier}
            onSkip={handleSkipPlanSelection}
            onBack={() => setScreen('signup')}
          />
        );
      default:
        return <WelcomeScreen />;
    }
  }

  // Show auth screens for authenticated users who need to manage projects
  if (isAuthenticated && !currentProject && !showHome) {
    switch (currentScreen) {
      case 'hub':
        return <ProjectHubScreen />;
      case 'join':
        return <JoinProjectScreen />;
      case 'create-project':
        return <CreateProjectScreen />;
      case 'select-plan':
        return (
          <SelectPlanScreen
            isOnboarding={false}
            currentTier={user?.tier as SubscriptionTier | undefined}
            onSelectTier={handleSelectTier}
            onBack={() => setScreen('hub')}
          />
        );
      default:
        return <ProjectHubScreen />;
    }
  }

  // Show Home screen if no project or explicitly requested
  if (showHome || !currentProject) {
    return <Home onProjectReady={handleProjectReady} />;
  }

  // Show Export screen
  if (showExport) {
    return (
      <ProjectExportScreen
        onBack={() => setShowExport(false)}
        onExportComplete={() => setShowExport(false)}
      />
    );
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
      // but if user navigates directly (e.g., from customized nav), show the specific view
      case 'script':
      case 'schedule':
      case 'callsheets':
      case 'settings':
      case 'more':
        return <More onNavigateToTab={handleNavigateToTab} onStartNewProject={handleStartNewProject} initialView={activeTab} resetKey={tabResetKey} />;
      default:
        return <Today onSceneSelect={handleSceneSelect} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Lifecycle Banner (shows when project is wrapped/archived) */}
      {lifecycle.state !== 'active' && (
        <LifecycleBanner onExport={() => setShowExport(true)} />
      )}

      {renderContent()}

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* AI Chat Assistant */}
      <ChatAssistant />

      {/* Wrap Popup Modal (shows when project completion is triggered) */}
      <WrapPopupModal onExport={() => setShowExport(true)} />
    </div>
  );
}
