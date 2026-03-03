import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { exportBreakdownToXLSX } from '@/services/exportService';

export function ExportModal() {
  const project = useProjectStore((s) => s.currentProject);
  const showModal = useUIStore((s) => s.showExportModal);
  const setShowModal = useUIStore((s) => s.setShowExportModal);

  if (!project) return null;

  const totalScenes = project.scenes.length;
  const completedScenes = Object.values(project.sceneBreakdowns).filter((b) => b.isComplete).length;
  const totalCharacters = project.characters.length;
  const totalLooks = project.looks.length;

  const handleExport = () => {
    exportBreakdownToXLSX(project);
  };

  return (
    <Modal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      title="Export Breakdown"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-xl font-bold text-accent">{completedScenes}/{totalScenes}</div>
            <div className="text-xs text-white/50 mt-1">Scenes completed</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-xl font-bold text-accent">{totalCharacters}</div>
            <div className="text-xs text-white/50 mt-1">Characters tracked</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-xl font-bold text-accent">{totalLooks}</div>
            <div className="text-xs text-white/50 mt-1">Looks defined</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-xl font-bold text-accent">
              {totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0}%
            </div>
            <div className="text-xs text-white/50 mt-1">Progress</div>
          </div>
        </div>

        <p className="text-sm text-white/60">
          Export will create an Excel spreadsheet with three sheets: Scene Breakdown,
          Characters, and Looks.
        </p>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleExport}>
            Download XLSX
          </Button>
        </div>
      </div>
    </Modal>
  );
}
