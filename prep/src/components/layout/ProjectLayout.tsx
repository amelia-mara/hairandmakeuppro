import { type ReactNode } from 'react';
import { ProjectSidebar } from './ProjectSidebar';

interface ProjectLayoutProps {
  projectId: string;
  activePage: string;
  onNavigate: (page: string) => void;
  onBackToHub: () => void;
  children: ReactNode;
}

export function ProjectLayout({ projectId, activePage, onNavigate, onBackToHub, children }: ProjectLayoutProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <ProjectSidebar
        projectId={projectId}
        activePage={activePage}
        onNavigate={onNavigate}
        onBackToHub={onBackToHub}
      />
      <main className="project-content">
        {children}
      </main>
    </div>
  );
}
