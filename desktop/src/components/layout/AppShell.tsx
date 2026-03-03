import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useProjectStore, useUIStore } from '@/stores';
import { ExportModal } from '@/components/export/ExportModal';

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProject } = useProjectStore();
  const { modals, openModal, closeModal } = useUIStore();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleExport = () => {
    openModal('export');
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  return (
    <div className="flex h-screen w-screen bg-base text-text-primary font-ui overflow-hidden">
      <Sidebar
        currentPath={location.pathname}
        onNavigate={handleNavigate}
        projectId={projectId}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar
          projectName={currentProject?.name}
          onExport={handleExport}
          onSettings={handleSettings}
        />

        <main className="flex-1 overflow-auto bg-base">
          <Outlet />
        </main>
      </div>

      <ExportModal open={modals.export} onClose={() => closeModal('export')} />
    </div>
  );
}
