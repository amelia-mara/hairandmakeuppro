import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { PermissionPicker, StatusPicker, ProductionTypeSelector } from './PermissionPicker';
import { DangerZone } from './DangerZone';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';

interface ProjectSettingsScreenProps {
  projectId: string;
  onBack: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToSceneManagement?: () => void;
  onProjectArchived?: () => void;
  onProjectDeleted?: () => void;
}

export function ProjectSettingsScreen({
  projectId,
  onBack,
  onNavigateToSchedule,
  onNavigateToSceneManagement,
  onProjectArchived,
  onProjectDeleted,
}: ProjectSettingsScreenProps) {
  const {
    projectSettings,
    projectStats,
    isLoading,
    loadProjectSettings,
    updateProjectName,
    updateProjectType,
    updateProjectStatus,
    updatePermission,
    archiveProject,
    deleteProject,
  } = useProjectSettingsStore();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  useEffect(() => {
    loadProjectSettings(projectId);
  }, [projectId, loadProjectSettings]);

  useEffect(() => {
    if (projectSettings) {
      setNameValue(projectSettings.name);
    }
  }, [projectSettings]);

  const handleSaveName = async () => {
    if (nameValue.trim() && nameValue !== projectSettings?.name) {
      await updateProjectName(nameValue.trim());
    }
    setEditingName(false);
  };

  const handleArchive = async () => {
    await archiveProject();
    onProjectArchived?.();
  };

  const handleDelete = async () => {
    await deleteProject();
    onProjectDeleted?.();
  };

  if (isLoading && !projectSettings) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
          <div className="mobile-container">
            <div className="h-14 px-4 flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 -ml-2 text-text-muted hover:text-text-primary transition-colors tap-target"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-text-primary">Project Settings</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!projectSettings) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-text-muted hover:text-text-primary transition-colors tap-target"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-text-primary">Project Settings</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-container px-4 py-4 space-y-6">
        {/* Project Details Section */}
        <section>
          <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            PROJECT DETAILS
          </h3>

          <div className="space-y-3">
            {/* Production Name */}
            {editingName ? (
              <div className="card">
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Production Name
                </label>
                <div className="flex gap-2">
                  <Input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    autoFocus
                    className="flex-1"
                  />
                  <button
                    onClick={handleSaveName}
                    className="px-3 py-2 text-sm font-medium text-gold hover:bg-gold-50 rounded-lg transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setNameValue(projectSettings.name);
                      setEditingName(false);
                    }}
                    className="px-3 py-2 text-sm text-text-muted hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">Production Name</p>
                  <p className="text-xs text-text-muted">{projectSettings.name}</p>
                </div>
                <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            )}

            {/* Production Type */}
            <ProductionTypeSelector
              value={projectSettings.type}
              onChange={updateProjectType}
            />

            {/* Project Status */}
            <StatusPicker
              value={projectSettings.status as 'prep' | 'shooting' | 'wrapped'}
              onChange={updateProjectStatus}
            />
          </div>
        </section>

        {/* Shooting Schedule Section */}
        <section>
          <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            SHOOTING SCHEDULE
          </h3>

          <div className="space-y-3">
            <button
              onClick={() => {/* TODO: Import schedule */}}
              className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">Import Schedule</p>
                <p className="text-xs text-text-muted">Upload a shooting schedule</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            <button
              onClick={onNavigateToSchedule}
              className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">Manual Schedule Entry</p>
                <p className="text-xs text-text-muted">Set today's scenes manually</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </section>

        {/* Script Section */}
        <section>
          <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            SCRIPT
          </h3>

          <div className="space-y-3">
            <button
              onClick={() => {/* TODO: Re-import script */}}
              className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">Re-import Script</p>
                <p className="text-xs text-text-muted">Upload updated script</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            <button
              onClick={onNavigateToSceneManagement}
              className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">Scene Management</p>
                <p className="text-xs text-text-muted">Add, edit, or remove scenes</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </section>

        {/* Team Permissions Section */}
        <section>
          <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            TEAM PERMISSIONS
          </h3>

          <div className="space-y-3">
            <PermissionPicker
              label="Who can add photos"
              value={projectSettings.permissions.addPhotos}
              onChange={(value) => updatePermission('addPhotos', value)}
            />

            <PermissionPicker
              label="Who can edit continuity notes"
              value={projectSettings.permissions.editNotes}
              onChange={(value) => updatePermission('editNotes', value)}
            />

            <PermissionPicker
              label="Who can mark scenes complete"
              value={projectSettings.permissions.markComplete}
              onChange={(value) => updatePermission('markComplete', value)}
            />
          </div>
        </section>

        {/* Danger Zone */}
        <DangerZone
          projectName={projectSettings.name}
          photoCount={projectStats?.photoCount || 0}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
