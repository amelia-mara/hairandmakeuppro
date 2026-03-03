import { type ReactNode, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const project = useProjectStore((s) => s.currentProject);
  const setView = useUIStore((s) => s.setView);
  const currentView = useUIStore((s) => s.currentView);
  const setShowScriptUpload = useUIStore((s) => s.setShowScriptUpload);
  const setShowExportModal = useUIStore((s) => s.setShowExportModal);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+F — focus scene search
      if (isMod && e.key === 'f' && currentView === 'breakdown') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search scenes..."]');
        searchInput?.focus();
      }

      // Escape — close modals
      // (Handled by individual modals already)
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentView]);

  return (
    <div className="h-screen flex flex-col bg-base text-white overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-white/10 bg-surface shrink-0">
        <div className="flex items-center gap-4">
          {currentView === 'breakdown' && (
            <button
              onClick={() => setView('home')}
              className="text-white/50 hover:text-white text-sm flex items-center gap-1 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
              Dashboard
            </button>
          )}
          <h1 className="text-sm font-semibold text-accent tracking-wide">
            PREP HAPPY
          </h1>
          {project && (
            <span className="text-white/40 text-xs">
              {project.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentView === 'breakdown' && project && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowExportModal(true)}
            >
              Export
            </Button>
          )}
          {!project && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowScriptUpload(true)}
            >
              Import Script
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
