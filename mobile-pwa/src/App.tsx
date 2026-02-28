import { useState, useEffect, useMemo, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSyncStore } from '@/stores/syncStore';
import { initChangeTracking } from '@/services/syncChangeTracker';
import { migrateToIndexedDB, flushPendingWrites } from '@/db/zustandStorage';

// Initialize change tracking (idempotent, runs once)
initChangeTracking();
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
import { ProjectSettingsScreen } from '@/components/project-settings';
import { SyncStatusBar } from '@/components/sync';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { useTutorialStore } from '@/stores/tutorialStore';
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
    currentLookId,
    setCurrentScene,
    setCurrentCharacter,
    setCurrentLook,
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
    selectTier,
    setScreen,
    goBack,
    user,
    settingsProjectId,
    setSettingsProjectId,
  } = useAuthStore();

  // Tutorial state — show on first login for authenticated users
  const {
    hasCompletedTutorial,
    hasSkippedTutorial,
    showTutorial,
    startTutorial,
  } = useTutorialStore();

  const tutorialTriggered = useRef(false);
  useEffect(() => {
    if (
      isAuthenticated &&
      !hasCompletedTutorial &&
      !hasSkippedTutorial &&
      !showTutorial &&
      !tutorialTriggered.current
    ) {
      tutorialTriggered.current = true;
      startTutorial();
    }
  }, [isAuthenticated, hasCompletedTutorial, hasSkippedTutorial, showTutorial, startTutorial]);

  // Track if we're showing the home/setup screen
  // Start as false - will be set true explicitly when needed
  const [showHome, setShowHome] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showProcessingNotice, setShowProcessingNotice] = useState(false);

  // Track if migration has been attempted
  const migrationAttempted = useRef(false);

  // Initialize IndexedDB and migrate from localStorage on first mount
  useEffect(() => {
    if (migrationAttempted.current) return;
    migrationAttempted.current = true;

    migrateToIndexedDB().catch((error) => {
      console.error('[Storage] Migration failed:', error);
    });

    // Flush pending writes before page unload
    const handleBeforeUnload = () => {
      flushPendingWrites();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Refresh project memberships when app returns from background (common on mobile)
  const { refreshUserProjects } = useAuthStore();
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        refreshUserProjects();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, refreshUserProjects]);

  // Key to force More component to reset when clicking the same tab
  const [tabResetKey, setTabResetKey] = useState(0);
  // SubView for direct navigation to team, invite, stats, project settings, billing, or user profile
  const [moreSubView, setMoreSubView] = useState<'team' | 'invite' | 'projectStats' | 'projectSettings' | 'userProfile' | 'billing' | undefined>(undefined);

  // Validate state on mount - fix inconsistent persisted state that causes blank screens
  useEffect(() => {
    // If user completed onboarding but isn't authenticated and has no project,
    // they should be sent to the project hub to sign in or join a project
    if (hasCompletedOnboarding && !isAuthenticated && !currentProject) {
      setScreen('hub');
    }
  }, [hasCompletedOnboarding, isAuthenticated, currentProject, setScreen]);

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

  // Online/offline detection for manual sync
  useEffect(() => {
    const handleOnline = () => useSyncStore.getState().setOnline(true);
    const handleOffline = () => useSyncStore.getState().setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Set initial state
    useSyncStore.getState().setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Background Schedule Stage 2 Processing: Automatically process pending schedules
  // This extracts detailed scene data from each shooting day using AI
  const { schedule, isProcessingStage2, startStage2Processing } = useScheduleStore();
  const { syncCastDataFromSchedule } = useProjectStore();
  const scheduleProcessingTriggered = useRef(false);

  useEffect(() => {
    // Start processing if schedule exists with no breakdown data and not already processing
    // Handles both 'pending' status (new uploads) and 'complete' with empty days (legacy/incorrect status)
    if (
      schedule &&
      !isProcessingStage2 &&
      (!schedule.days || schedule.days.length === 0) &&
      schedule.rawText && // Has raw text for Stage 2 to process
      !scheduleProcessingTriggered.current
    ) {
      scheduleProcessingTriggered.current = true;
      startStage2Processing();
    }
  }, [schedule, isProcessingStage2, startStage2Processing]);

  // Auto-sync cast data after Stage 2 processing completes
  const scheduleSyncTriggered = useRef<string | null>(null);

  useEffect(() => {
    if (
      schedule &&
      schedule.status === 'complete' &&
      !isProcessingStage2 &&
      schedule.days &&
      schedule.days.length > 0 &&
      currentProject &&
      scheduleSyncTriggered.current !== schedule.id // Only sync once per schedule
    ) {
      scheduleSyncTriggered.current = schedule.id;
      // Get fresh schedule from store for sync
      const freshSchedule = useScheduleStore.getState().schedule;
      if (freshSchedule) {
        syncCastDataFromSchedule(freshSchedule, {
          createMissingCharacters: true,
          overwriteExisting: false,
          autoConfirm: true,
        });
      }
    }
  }, [schedule?.status, schedule?.days?.length, schedule?.id, isProcessingStage2, currentProject, syncCastDataFromSchedule]);

  // Handle project ready (from Home component)
  const handleProjectReady = () => {
    setShowHome(false);
    clearNeedsSetup();
    setActiveTab('today');
    // Show processing notice so user knows background work is still happening
    setShowProcessingNotice(true);
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
    // Clear look overview if open
    if (currentLookId) {
      setCurrentLook(null);
    }
  };

  // Handle navigation to user profile from project header (goes back to project, not menu)
  const [showUserProfile, setShowUserProfile] = useState(false);

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
  if (!hasCompletedOnboarding) {
    switch (currentScreen) {
      case 'welcome':
        return <WelcomeScreen />;
      case 'signin':
        return <SignInScreen />;
      case 'signup':
        return <SignUpScreen />;
      case 'hub':
        return <ProjectHubScreen />;
      case 'join':
        return <JoinProjectScreen />;
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
      case 'project-settings':
        return settingsProjectId ? (
          <ProjectSettingsScreen
            projectId={settingsProjectId}
            onBack={() => {
              setSettingsProjectId(null);
              setScreen('hub');
            }}
            onProjectDeleted={() => {
              setSettingsProjectId(null);
              setScreen('hub');
            }}
            onProjectArchived={() => {
              setSettingsProjectId(null);
              setScreen('hub');
            }}
          />
        ) : (
          <ProjectHubScreen />
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
      case 'project-settings':
        return settingsProjectId ? (
          <ProjectSettingsScreen
            projectId={settingsProjectId}
            onBack={() => {
              setSettingsProjectId(null);
              setScreen('hub');
            }}
            onProjectDeleted={() => {
              setSettingsProjectId(null);
              setScreen('hub');
            }}
            onProjectArchived={() => {
              setSettingsProjectId(null);
              setScreen('hub');
            }}
          />
        ) : (
          <ProjectHubScreen />
        );
      default:
        return <ProjectHubScreen />;
    }
  }

  // Safety fallback: If user has completed onboarding but isn't authenticated
  // and has no project, show project hub (they can sign in or join from there)
  if (hasCompletedOnboarding && !isAuthenticated && !currentProject) {
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

  // Show User Profile screen (from header avatar click)
  if (showUserProfile) {
    return (
      <UserProfileScreen
        onBack={() => setShowUserProfile(false)}
        onNavigateToBilling={() => {
          setShowUserProfile(false);
          setActiveTab('more');
          setMoreSubView('billing');
        }}
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
        return <Today onSceneSelect={handleSceneSelect} onNavigateToTab={handleNavigateToTab} />;
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
        return <Today onSceneSelect={handleSceneSelect} onNavigateToTab={handleNavigateToTab} />;
    }
  };

  // Show project header on main content tabs (not on More, not when viewing a scene)
  const showProjectHeader = !currentSceneId && !['more', 'settings', 'script', 'schedule', 'callsheets'].includes(activeTab);

  return (
    <div className="min-h-screen bg-background">
      {/* Persistent sync status bar - shown at the very top on all project pages */}
      {currentProject && <SyncStatusBar />}

      {/* Lifecycle Banner (shows when project is wrapped/archived) */}
      {lifecycle.state !== 'active' && (
        <LifecycleBanner onExport={() => setShowExport(true)} />
      )}

      {/* Project Header - simplified with account icon */}
      {showProjectHeader && (
        <ProjectHeader
          onSwitchProject={handleSwitchProject}
          onNavigateToProfile={() => setShowUserProfile(true)}
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

      {/* Processing Notice - shown once after project setup to inform user about background work */}
      {showProcessingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="pt-8 pb-4 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold/10 flex items-center justify-center">
                {schedule ? (
                  <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-1">You're All Set!</h2>
              <p className="text-sm text-text-muted px-6">Your project is ready to explore</p>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
              {schedule ? (
                <>
                  {/* Schedule processing info */}
                  <div className="rounded-xl bg-gold/5 border border-gold/20 p-4 mb-4">
                    <div className="flex gap-3">
                      <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-gold animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                      <div className="text-xs text-text-secondary">
                        <p className="font-medium mb-1">Schedule Processing</p>
                        <p>Your schedule is being processed in the background. Character assignments will be confirmed automatically once complete.</p>
                      </div>
                    </div>
                  </div>

                  {/* What you can do now */}
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-6">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                      <div className="text-xs text-blue-700">
                        <p className="font-medium mb-1">Start Working Now</p>
                        <p>You can browse scenes, add looks, and set up your continuity bible while the schedule finishes processing.</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* No schedule - script only info */}
                  <div className="rounded-xl bg-gold/5 border border-gold/20 p-4 mb-4">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      <div className="text-xs text-text-secondary">
                        <p className="font-medium mb-1">Character Confirmation Needed</p>
                        <p>Without a production schedule, characters in each scene need to be confirmed manually. Tap into a scene in the Breakdown tab to review and confirm which characters appear.</p>
                      </div>
                    </div>
                  </div>

                  {/* Tip about uploading a schedule */}
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-6">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                      </svg>
                      <div className="text-xs text-blue-700">
                        <p className="font-medium mb-1">Tip: Upload a Schedule</p>
                        <p>Uploading a production schedule (one-liner/stripboard) lets the app automatically identify which characters are in each scene, saving you time.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Dismiss button */}
              <button
                onClick={() => setShowProcessingNotice(false)}
                className="w-full py-3.5 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First-run tutorial overlay */}
      {showTutorial && (
        <TutorialOverlay
          onOpenGuide={() => {
            setActiveTab('more');
            setMoreSubView(undefined);
            // Small delay so More mounts first, then navigate to help
            setTimeout(() => {
              setMoreSubView(undefined);
            }, 0);
          }}
        />
      )}
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
