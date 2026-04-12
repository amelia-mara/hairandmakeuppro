import { useState, useEffect, useRef } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { ProjectHub } from '@/pages/ProjectHub';
import { CreateProjectModal } from '@/pages/CreateProject';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { ProjectDashboard } from '@/pages/ProjectDashboard';
import { ScriptBreakdown } from '@/pages/ScriptBreakdown';
import { BreakdownSheet } from '@/pages/BreakdownSheet';
import { ContinuityTracker } from '@/pages/ContinuityTracker';
import { Budget } from '@/pages/Budget';
import { Timesheet } from '@/pages/Timesheet';
import { CallSheets } from '@/pages/CallSheets';
import { Schedule } from '@/pages/Schedule';
import { Team } from '@/pages/Team';
import { CharacterDesign } from '@/pages/CharacterDesign';
import { AuthPage } from '@/pages/AuthPage';
import { BetaCodePage } from '@/pages/BetaCodePage';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjectSync } from '@/hooks/useProjectSync';
import { canAccessPrep } from '@/utils/tierUtils';
import { isFeatureEnabled } from '@/utils/featureFlags';
import { PrepUpgradeScreen } from '@/pages/PrepUpgradeScreen';

function App() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [showAuth, setShowAuth] = useState(false);
  const [showBetaCode, setShowBetaCode] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Restore session on mount
  useEffect(() => {
    useAuthStore.getState().getSession();
  }, []);

  const handleNavigateToAuth = (mode: 'login' | 'signup' = 'signup') => {
    if (mode === 'signup') {
      // Require beta code before signup
      setShowBetaCode(true);
      return;
    }
    setAuthMode(mode);
    setShowAuth(true);
  };

  const handleCreateProject = () => {
    if (!isAuthenticated) {
      handleNavigateToAuth('signup');
      return;
    }
    setShowCreateModal(true);
  };
  const handleCloseModal = () => setShowCreateModal(false);
  const handleProjectCreated = (id: string) => {
    setSelectedProjectId(id);
    setActivePage('dashboard');
    setShowCreateModal(false);
  };
  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setActivePage('dashboard');
  };
  const handleBackToHub = () => {
    setSelectedProjectId(null);
  };

  // When auth completes (store updates to authenticated), return to hub
  useEffect(() => {
    if ((showAuth || showBetaCode) && isAuthenticated) {
      setShowAuth(false);
      setShowBetaCode(false);
    }
  }, [showAuth, showBetaCode, isAuthenticated]);

  // Browser back button support — intercept popstate to navigate within the app
  const showAuthRef = useRef(showAuth);
  const showBetaCodeRef = useRef(showBetaCode);
  const selectedProjectIdRef = useRef(selectedProjectId);
  showAuthRef.current = showAuth;
  showBetaCodeRef.current = showBetaCode;
  selectedProjectIdRef.current = selectedProjectId;

  useEffect(() => {
    window.history.pushState({ app: 'prep-happy' }, '');

    const handlePopState = () => {
      window.history.pushState({ app: 'prep-happy' }, '');

      if (showAuthRef.current) {
        setShowAuth(false);
        return;
      }

      if (showBetaCodeRef.current) {
        setShowBetaCode(false);
        return;
      }

      if (selectedProjectIdRef.current) {
        setSelectedProjectId(null);
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // When user signs out, return to the landing page (project hub)
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      setSelectedProjectId(null);
      setActivePage('dashboard');
      setShowAuth(false);
      setShowBetaCode(false);
    }
  }, [isAuthenticated, isLoading]);

  // Show loading screen while restoring session
  if (isLoading) {
    return (
      <div
        className="ambient-light min-h-screen"
        style={{
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="brand-logo" style={{ fontSize: '1.75rem', marginBottom: '16px' }}>
            <span className="brand-logo-checks">Checks</span>{' '}
            <span className="brand-logo-happy">Happy.</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Beta code entry page (before signup)
  if (showBetaCode && !isAuthenticated) {
    return (
      <div className="ambient-light min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <BetaCodePage
          onValidated={() => {
            setShowBetaCode(false);
            setAuthMode('signup');
            setShowAuth(true);
          }}
          onBack={() => setShowBetaCode(false)}
          onSignIn={() => {
            setShowBetaCode(false);
            setAuthMode('login');
            setShowAuth(true);
          }}
        />
      </div>
    );
  }

  // Auth page (login or signup after beta code)
  if (showAuth && !isAuthenticated) {
    return (
      <div className="ambient-light min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <AuthPage
          initialMode={authMode}
          onRequestSignup={() => {
            setShowAuth(false);
            setShowBetaCode(true);
          }}
        />
      </div>
    );
  }

  // Prep Happy tier gate — Designer only
  const userTier = useAuthStore((s) => s.user?.tier);
  if (isAuthenticated && userTier && !canAccessPrep(userTier)) {
    return (
      <PrepUpgradeScreen
        onSignOut={() => useAuthStore.getState().signOut()}
      />
    );
  }

  // Project view — TopBar with nav dropdown + content
  if (selectedProjectId) {
    return (
      <ProjectView
        projectId={selectedProjectId}
        activePage={activePage}
        onNavigate={setActivePage}
        onBackToHub={handleBackToHub}
        onNavigateToAuth={() => handleNavigateToAuth('login')}
      />
    );
  }

  // Hub view
  return (
    <div className="ambient-light min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TopBar onNavigateToAuth={() => handleNavigateToAuth('login')} />
      <ProjectHub
        onCreateProject={handleCreateProject}
        onSelectProject={handleSelectProject}
        onNavigateToAuth={() => handleNavigateToAuth()}
      />
      {showCreateModal && (
        <CreateProjectModal
          onComplete={handleProjectCreated}
          onCancel={handleCloseModal}
        />
      )}
    </div>
  );
}

/**
 * ProjectView — wrapper component that connects the project to Supabase sync.
 * This is a separate component so the useProjectSync hook has proper lifecycle.
 */
function ProjectView({
  projectId,
  activePage,
  onNavigate,
  onBackToHub,
  onNavigateToAuth,
}: {
  projectId: string;
  activePage: string;
  onNavigate: (page: string) => void;
  onBackToHub: () => void;
  onNavigateToAuth: () => void;
}) {
  const getProject = useProjectStore((s) => s.getProject);
  const project = getProject(projectId);
  const projectTitle = project?.title || 'Project';
  const userTier = useAuthStore((s) => s.user?.tier || '');

  // Connect to Supabase sync + Realtime subscriptions
  const { loading, saveStatus } = useProjectSync(projectId);

  // Show loading state while fetching from Supabase
  if (loading) {
    return (
      <div
        className="ambient-light min-h-screen"
        style={{
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="brand-logo" style={{ fontSize: '1.75rem', marginBottom: '16px' }}>
            <span className="brand-logo-checks">Checks</span>{' '}
            <span className="brand-logo-happy">Happy.</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ambient-light min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Rainbow swirl decoration — consistent across all pages */}
      <div className="page-rainbow">
        <div className="rainbow-ring rainbow-ring--1" />
        <div className="rainbow-ring rainbow-ring--2" />
        <div className="rainbow-ring rainbow-ring--3" />
      </div>
      <TopBar
        title={projectTitle}
        activePage={activePage}
        onNavigate={onNavigate}
        projectType={project?.type}
        onBackToHub={onBackToHub}
        onNavigateToAuth={onNavigateToAuth}
      />
      {/* Save status indicator */}
      {saveStatus === 'saving' && (
        <div style={{
          position: 'fixed', top: 12, right: 16, zIndex: 9999,
          padding: '4px 12px', borderRadius: '6px',
          backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)',
          fontSize: '0.75rem', opacity: 0.8,
        }}>
          Saving...
        </div>
      )}
      {saveStatus === 'saved' && (
        <div style={{
          position: 'fixed', top: 12, right: 16, zIndex: 9999,
          padding: '4px 12px', borderRadius: '6px',
          backgroundColor: 'var(--bg-secondary)', color: 'var(--accent-green, #22c55e)',
          fontSize: '0.75rem', opacity: 0.8,
        }}>
          Saved
        </div>
      )}
      {saveStatus === 'error' && (
        <div style={{
          position: 'fixed', top: 12, right: 16, zIndex: 9999,
          padding: '4px 12px', borderRadius: '6px',
          backgroundColor: '#7f1d1d', color: '#fca5a5',
          fontSize: '0.75rem', cursor: 'pointer',
        }}
          title="Some changes may not have been saved to the cloud. Try making an edit to retry."
        >
          Save failed — check connection
        </div>
      )}
      <ProjectLayout
        projectId={projectId}
        activePage={activePage}
        onNavigate={onNavigate}
        onBackToHub={onBackToHub}
      >
        {activePage === 'dashboard' && (
          <ProjectDashboard projectId={projectId} />
        )}
        {activePage === 'script' && (
          <ScriptBreakdown projectId={projectId} />
        )}
        {activePage === 'breakdown' && (
          <BreakdownSheet projectId={projectId} />
        )}
        {activePage === 'character-design' && isFeatureEnabled('characterDesign', userTier) && (
          <CharacterDesign projectId={projectId} />
        )}
        {activePage === 'continuity' && (
          <ContinuityTracker projectId={projectId} />
        )}
        {activePage === 'budget' && isFeatureEnabled('budget', userTier) && (
          <Budget projectId={projectId} />
        )}
        {activePage === 'timesheet' && isFeatureEnabled('timesheets', userTier) && (
          <Timesheet projectId={projectId} />
        )}
        {activePage === 'schedule' && (
          <Schedule projectId={projectId} />
        )}
        {activePage === 'call-sheets' && (
          <CallSheets projectId={projectId} />
        )}
        {activePage === 'team' && isFeatureEnabled('teamManagement', userTier) && (
          <Team projectId={projectId} />
        )}
      </ProjectLayout>
    </div>
  );
}

export default App;
