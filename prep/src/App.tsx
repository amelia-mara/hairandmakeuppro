import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { ProjectHub } from '@/pages/ProjectHub';
import { CreateProject } from '@/pages/CreateProject';

type View = 'hub' | 'create' | 'project';

function App() {
  const [view, setView] = useState<View>('hub');
  const [, setSelectedProjectId] = useState<string | null>(null);

  const handleCreateProject = () => setView('create');
  const handleCancelCreate = () => setView('hub');
  const handleProjectCreated = (id: string) => {
    setSelectedProjectId(id);
    // For now, go back to hub. Later this will navigate to the project dashboard.
    setView('hub');
  };
  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    // Future: navigate to project dashboard
    setView('hub');
  };

  return (
    <div className="ambient-light min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TopBar />

      {view === 'hub' && (
        <ProjectHub
          onCreateProject={handleCreateProject}
          onSelectProject={handleSelectProject}
        />
      )}

      {view === 'create' && (
        <CreateProject
          onComplete={handleProjectCreated}
          onCancel={handleCancelCreate}
        />
      )}
    </div>
  );
}

export default App;
