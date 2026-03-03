import { useUIStore } from '@/stores/uiStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { BreakdownPage } from '@/pages/BreakdownPage';
import { ScriptUploadModal } from '@/components/script-upload/ScriptUploadModal';
import { LookEditorModal } from '@/components/looks/LookEditorModal';
import { ExportModal } from '@/components/export/ExportModal';

function App() {
  const currentView = useUIStore((s) => s.currentView);

  return (
    <AppLayout>
      {currentView === 'home' && <HomePage />}
      {currentView === 'breakdown' && <BreakdownPage />}

      {/* Global Modals */}
      <ScriptUploadModal />
      <LookEditorModal />
      <ExportModal />
    </AppLayout>
  );
}

export default App;
