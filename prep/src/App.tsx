import { useState } from 'react';
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
import { useProjectStore } from '@/stores/projectStore';

function App() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const getProject = useProjectStore((s) => s.getProject);

  const handleCreateProject = () => setShowCreateModal(true);
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

  // Project view — TopBar with nav dropdown + content
  if (selectedProjectId) {
    const project = getProject(selectedProjectId);
    const projectTitle = project?.title || 'Project';

    return (
      <div className="ambient-light min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <TopBar
          title={projectTitle}
          activePage={activePage}
          onNavigate={setActivePage}
          projectType={project?.type}
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
      <TopBar />
      <ProjectHub
        onCreateProject={handleCreateProject}
        onSelectProject={handleSelectProject}
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
