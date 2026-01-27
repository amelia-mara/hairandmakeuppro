import { useState, useEffect, useMemo, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { migrateToIndexedDB, flushPendingWrites } from '@/db/zustandStorage';
import { BottomNav, ProjectHeader } from '@/components/navigation';
import { SceneView } from '@/components/scenes';
import { Today } from '@/components/today';
import { Breakdown } from '@/components/breakdown';
import { Lookbooks } from '@/components/lookbooks';
import { Timesheet } from '@/components/timesheet';
import { Budget } from '@/components/budget';
import { More, WrapPopupModal, LifecycleBanner, ProjectExportScreen } from '@/components/more';
import { Home } from '@/components/home';
import { ChatAssistant } from '@/components/chat/ChatAssistant';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  WelcomeScreen,
  SignInScreen,
  SignUpScreen,
  JoinProjectScreen,
  ProjectHubScreen,
  CreateProjectScreen,
} from '@/components/auth';
import { SelectPlanScreen } from '@/components/subscription';
import { UserProfileScreen } from '@/components/profile/UserProfileScreen';
import type { NavTab, SubscriptionTier, BillingPeriod } from '@/types';

// Configuration error screen shown when Supabase environment variables are missing
function ConfigurationError() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-xl font-semibold text-foreground">Configuration Required</h1>
        <p className="text-muted-foreground">
          The application is missing required environment variables. Please ensure
          <code className="mx-1 px-1.5 py-0.5 bg-muted rounded text-sm">VITE_SUPABASE_URL</code>
          and
          <code className="mx-1 px-1.5 py-0.5 bg-muted rounded text-sm">VITE_SUPABASE_ANON_KEY</code>
          are configured in your deployment environment.
        </p>
        <p className="text-sm text-muted-foreground/70">
          If you're the administrator, check your Vercel environment variables or .env file.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  // Show configuration error if Supabase is not properly configured
  if (!isSupabaseConfigured) {
    return <ConfigurationError />;
  }

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
    needsSetup,
    clearNeedsSetup,
  } = useProjectStore();

  const {
    isAuthenticated,
    hasCompletedOnboarding,
    currentScreen,
    guestProjectCode,
    selectTier,
    setScreen,
    goBack,
    user,
  } = useAuthStore();

  // Track if we're showing the home/setup screen
  // Start as false - will be set true explicitly when needed
  const [showHome, setShowHome] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Track if migration has been attempted
  const migrationAttempted = useRef(false);

  // Initialize IndexedDB and migrate from localStorage on first mount
  useEffect(() => {
    if (migrationAttempted.current) return;
    migrationAttempted.current = true;

    migrateToIndexedDB().then(({ migrated, errors }) => {
      if (migrated.length > 0) {
        console.log('[Storage] Migrated to IndexedDB:', migrated);
      }
      if (errors.length > 0) {
        console.warn('[Storage] Migration errors:', errors);
      }
    }).catch((error) => {
      console.error('[Storage] Migration failed:', error);
    });

    // Flush pending writes before page unload
    const handleBeforeUnload = () => {
      flushPendingWrites();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
  // Key to force More component to reset when clicking the same tab
  const [tabResetKey, setTabResetKey] = useState(0);
  // SubView for direct navigation to team, invite, stats, project settings, or user profile
  const [moreSubView, setMoreSubView] = useState<'team' | 'invite' | 'projectStats' | 'projectSettings' | 'userProfile' | undefined>(undefined);

  // Validate state on mount - fix inconsistent persisted state that causes blank screens
  useEffect(() => {
    // If user completed onboarding but isn't authenticated and has no project,
    // they should be sent to the project hub to sign in or join a project
    if (hasCompletedOnboarding && !isAuthenticated && !currentProject && !guestProjectCode) {
      setScreen('hub');
    }
  }, [hasCompletedOnboarding, isAuthenticated, currentProject, guestProjectCode, setScreen]);

  // Memoize the count of complete scenes to avoid creating new array on every render
  const completeScenesCount = useMemo(() => {
    return currentProject?.scenes.filter(s => s.isComplete).length ?? 0;
  }, [currentProject?.scenes]);

  // Check for wrap triggers on mount and when scenes change
  useEffect(() => {
    if (currentProject) {
      checkWrapTrigger();
    }
  }, [currentProject, completeScenesCount, checkWrapTrigger]);

  // Update activity timestamp periodically
  useEffect(() => {
    if (currentProject) {
      updateActivity();
    }
  }, [currentProject, currentSceneId, activeTab, updateActivity]);

  // Handle project ready (from Home component)
  const handleProjectReady = () => {
    setShowHome(false);
    clearNeedsSetup();
    setActiveTab('today');
  };

  // Handle switching to a different project (from Project Menu)
  const handleSwitchProject = () => {
    // Save current project data before clearing (so it can be restored later)
    useProjectStore.getState().saveAndClearProject();
    setShowHome(false);
    setScreen('hub');
  };

  // Handle starting a new project (from Settings or Home)
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
    // Clear subView when changing tabs (unless it's being set deliberately)
    setMoreSubView(undefined);
    // Clear scene view when switching tabs or re-clicking current tab
    if (currentSceneId) {
      setCurrentScene(null);
      setCurrentCharacter(null);
    }
  };

  // Handle navigation to a specific sub-view in More
  const handleNavigateToSubView = (subView: 'team' | 'invite' | 'projectStats' | 'projectSettings' | 'userProfile') => {
    setMoreSubView(subView);
    setActiveTab('settings');
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
            onBack={goBack}
          />
        );
      case 'profile':
        return (
          <UserProfileScreen
            onBack={goBack}
            onNavigateToBilling={() => setScreen('select-plan')}
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
            onBack={goBack}
          />
        );
      case 'profile':
        return (
          <UserProfileScreen
            onBack={goBack}
            onNavigateToBilling={() => setScreen('select-plan')}
          />
        );
      default:
        return <ProjectHubScreen />;
    }
  }

  // Safety fallback: If user has completed onboarding but isn't authenticated
  // and has no project, show project hub (they can sign in or join from there)
  if (hasCompletedOnboarding && !isAuthenticated && !currentProject && !guestProjectCode) {
    return <ProjectHubScreen />;
  }

  // Handle back from Home screen
  const handleBackFromHome = () => {
    setShowHome(false);
    clearNeedsSetup();
    goBack();
  };

  // Show Home screen if no project, explicitly requested, or new project needs setup
  if (showHome || !currentProject || needsSetup) {
    return <Home onProjectReady={handleProjectReady} onBack={handleBackFromHome} />;
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
        return <More onNavigateToTab={handleNavigateToTab} onStartNewProject={handleStartNewProject} initialView={activeTab} resetKey={tabResetKey} subView={moreSubView} />;
      default:
        return <Today onSceneSelect={handleSceneSelect} />;
    }
  };

  // Show project header on main content tabs (not on More, not when viewing a scene)
  const showProjectHeader = !currentSceneId && !['more', 'settings', 'script', 'schedule', 'callsheets'].includes(activeTab);

  return (
    <div className="min-h-screen bg-background">
      {/* Lifecycle Banner (shows when project is wrapped/archived) */}
      {lifecycle.state !== 'active' && (
        <LifecycleBanner onExport={() => setShowExport(true)} />
      )}

      {/* Project Header - simplified with account icon */}
      {showProjectHeader && (
        <ProjectHeader
          onSwitchProject={handleSwitchProject}
          onNavigateToProfile={() => handleNavigateToSubView('userProfile')}
        />
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

// Wrap the app with ErrorBoundary to catch and display errors gracefully
export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
