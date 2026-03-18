import { useState, useEffect } from 'react';
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
import { CharacterDesign } from '@/pages/CharacterDesign';
import { AuthPage } from '@/pages/AuthPage';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';

function App() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const getProject = useProjectStore((s) => s.getProject);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const handleNavigateToAuth = (mode: 'login' | 'signup' = 'signup') => {
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
    if (showAuth && isAuthenticated) {
      setShowAuth(false);
    }
  }, [showAuth, isAuthenticated]);

  // Auth page
  if (showAuth && !isAuthenticated) {
    return (
      <div className="ambient-light min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <AuthPage initialMode={authMode} />
      </div>
    );
  }

  // Project view — TopBar with nav dropdown + content
  if (selectedProjectId) {
    const project = getProject(selectedProjectId);
    const projectTitle = project?.title || 'Project';

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
          onNavigate={setActivePage}
          projectType={project?.type}
          onBackToHub={handleBackToHub}
          onNavigateToAuth={() => handleNavigateToAuth('login')}
        />
        <ProjectLayout
          projectId={selectedProjectId}
          activePage={activePage}
          onNavigate={setActivePage}
          onBackToHub={handleBackToHub}
        >
          {activePage === 'dashboard' && (
            <ProjectDashboard projectId={selectedProjectId} />
          )}
          {activePage === 'script' && (
            <ScriptBreakdown projectId={selectedProjectId} />
          )}
          {activePage === 'breakdown' && (
            <BreakdownSheet projectId={selectedProjectId} />
          )}
          {activePage === 'character-design' && (
            <CharacterDesign projectId={selectedProjectId} />
          )}
          {activePage === 'continuity' && (
            <ContinuityTracker projectId={selectedProjectId} />
          )}
          {activePage === 'budget' && (
            <Budget projectId={selectedProjectId} />
          )}
          {activePage === 'timesheet' && (
            <Timesheet projectId={selectedProjectId} />
          )}
        </ProjectLayout>
      </div>
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

export default App;
