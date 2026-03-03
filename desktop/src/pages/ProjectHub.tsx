import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FolderOpen, Clock, Film, Users } from 'lucide-react';
import { Button, Input, Modal, Card } from '@/components/ui';
import { useProjectStore } from '@/stores';
import { formatRelativeTime } from '@/utils/helpers';

function NewProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [projectName, setProjectName] = useState('');

  const handleCreate = () => {
    const trimmed = projectName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setProjectName('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!projectName.trim()}
          >
            Create Project
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Enter a name for your new pre-production project.
        </p>
        <Input
          label="Project Name"
          placeholder="e.g. The Deadline"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
    </Modal>
  );
}

export default function ProjectHub() {
  const navigate = useNavigate();
  const { recentProjects, createProject, loadProject } = useProjectStore();
  const [modalOpen, setModalOpen] = useState(false);

  const handleCreateProject = (name: string) => {
    const id = createProject(name);
    navigate(`/project/${id}`);
  };

  const handleOpenRecent = (id: string) => {
    loadProject(id);
    navigate(`/project/${id}`);
  };

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-6 py-12">
      {/* Branding */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold tracking-wider text-gold mb-2">
          PREP HAPPY
        </h1>
        <p className="text-sm text-text-muted tracking-[0.3em] uppercase">
          Pre-Production Suite
        </p>
      </div>

      {/* Action Cards */}
      <div className="flex gap-6 mb-16">
        <Card
          hover
          padding="lg"
          className="w-56 flex flex-col items-center gap-4 text-center"
          onClick={() => setModalOpen(true)}
        >
          <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center">
            <FileText className="w-7 h-7 text-gold" />
          </div>
          <div>
            <p className="text-lg font-semibold text-text-primary">
              New Project
            </p>
            <p className="text-xs text-text-muted mt-1">
              Start a fresh breakdown
            </p>
          </div>
        </Card>

        <Card
          hover
          padding="lg"
          className="w-56 flex flex-col items-center gap-4 text-center"
          onClick={() => {
            /* TODO: file picker for .phproj files */
          }}
        >
          <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center">
            <FolderOpen className="w-7 h-7 text-text-secondary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-text-primary">
              Open Project
            </p>
            <p className="text-xs text-text-muted mt-1">
              Load an existing file
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <div className="w-full max-w-xl">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
            Recent Projects
          </h2>
          <div className="space-y-2">
            {recentProjects.map((project) => (
              <Card
                key={project.id}
                hover
                padding="md"
                className="flex items-center gap-4"
                onClick={() => handleOpenRecent(project.id)}
              >
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {project.name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {project.sceneCount} scenes
                    </span>
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {project.characterCount} characters
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(project.lastOpened)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
