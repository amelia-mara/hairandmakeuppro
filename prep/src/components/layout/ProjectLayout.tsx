import { type ReactNode } from 'react';

interface ProjectLayoutProps {
  projectId: string;
  activePage: string;
  onNavigate: (page: string) => void;
  onBackToHub: () => void;
  children: ReactNode;
}

export function ProjectLayout({ children }: ProjectLayoutProps) {
  return (
    <main className="project-content" style={{ minHeight: 'calc(100vh - 80px)' }}>
      {children}
    </main>
  );
}
