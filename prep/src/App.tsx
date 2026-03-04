import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { ProjectHub } from '@/pages/ProjectHub';
import { CreateProjectModal } from '@/pages/CreateProject';

function App() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [, setSelectedProjectId] = useState<string | null>(null);

  const handleCreateProject = () => setShowCreateModal(true);
  const handleCloseModal = () => setShowCreateModal(false);
  const handleProjectCreated = (id: string) => {
    setSelectedProjectId(id);
    setShowCreateModal(false);
  };
  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
  };

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
