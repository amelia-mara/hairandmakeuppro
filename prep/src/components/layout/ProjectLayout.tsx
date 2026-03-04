import { type ReactNode } from 'react';
import { ProjectSidebar } from './ProjectSidebar';

interface ProjectLayoutProps {
  projectId: string;
  activePage: string;
  onNavigate: (page: string) => void;
  onBackToHub: () => void;
  children: ReactNode;
}

export function ProjectLayout({ projectId, activePage, onNavigate, children }: ProjectLayoutProps) {
  return (
    <div className="project-layout">
      <ProjectSidebar
        projectId={projectId}
        activePage={activePage}
        onNavigate={onNavigate}
      />
      <main className="project-content">
        {children}
      </main>
    </div>
  );
}
