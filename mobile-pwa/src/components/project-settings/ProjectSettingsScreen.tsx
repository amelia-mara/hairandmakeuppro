import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { PermissionPicker, ProductionTypeSelector } from './PermissionPicker';
import { DangerZone } from './DangerZone';
import { InviteCodeShare } from './InviteCodeShare';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';
import { useProductionDetailsStore } from '@/stores/productionDetailsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { PROJECT_RETENTION_DAYS } from '@/types';

interface ProjectSettingsScreenProps {
  projectId: string;
  onBack: () => void;
  onNavigateToTeam?: () => void;
  onNavigateToStats?: () => void;
  onNavigateToExport?: () => void;
  onNavigateToProductionDetails?: () => void;
  onProjectArchived?: () => void;
  onProjectDeleted?: () => void;
}

export function ProjectSettingsScreen({
  projectId,
  onBack,
  onNavigateToTeam,
  onNavigateToStats,
  onNavigateToExport,
  onNavigateToProductionDetails,
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
    updatePermission,
    archiveProject,
    deleteProject,
  } = useProjectSettingsStore();

  const { currentProject, lifecycle, wrapProject, restoreProject, getDaysUntilDeletion } = useProjectStore();
  const { user } = useAuthStore();
  const { isComplete: isProductionDetailsComplete, getCompletionCount } = useProductionDetailsStore();
  const productionComplete = isProductionDetailsComplete(projectId);
  const productionCompletion = getCompletionCount(projectId);

  // Determine if current user is the owner
  const isOwner = user && projectSettings ? user.id === projectSettings.ownerId : false;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showWrapConfirm, setShowWrapConfirm] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);

  const daysUntilDeletion = getDaysUntilDeletion();

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

  const handleWrap = () => {
    wrapProject('manual');
    setShowWrapConfirm(false);
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

            {/* Production & Invoicing Details */}
            <button
              onClick={onNavigateToProductionDetails}
              className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">Production & Invoicing</p>
                  <p className="text-xs text-text-muted">
                    {productionComplete
                      ? 'Production details complete'
                      : `${productionCompletion.filled}/${productionCompletion.total} required fields filled`
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {productionComplete && (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                  </svg>
                )}
                <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>
          </div>
        </section>

        {/* Team Section */}
        <section>
          <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            TEAM
          </h3>

          <div className="space-y-3">
            {/* View Team */}
            <button
              onClick={onNavigateToTeam}
              className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">Team Members</p>
                  <p className="text-xs text-text-muted">View and manage team</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Share Invite Code */}
            <button
              onClick={() => setShowInviteCode(!showInviteCode)}
              className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">Share Invite Code</p>
                  <p className="text-xs text-text-muted">Invite team members to join</p>
                </div>
              </div>
              <svg className={`w-5 h-5 text-text-light transition-transform ${showInviteCode ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Invite Code (expandable) */}
            {showInviteCode && (
              <div className="card">
                <InviteCodeShare inviteCode={projectSettings.inviteCode} isOwner={isOwner} />
              </div>
            )}

            {/* Project Stats */}
            <button
              onClick={onNavigateToStats}
              className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">Project Stats</p>
                  <p className="text-xs text-text-muted">View project statistics</p>
                </div>
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

        {/* Export & Wrap Section */}
        {currentProject && (
          <section>
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
              EXPORT & WRAP
            </h3>

            <div className="space-y-3">
              {/* Export Project */}
              <button
                onClick={onNavigateToExport}
                className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-text-primary">Export Project</p>
                    <p className="text-xs text-text-muted">Download continuity documents</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {/* Wrap Project - only show if active */}
              {lifecycle.state === 'active' && (
                <button
                  onClick={() => setShowWrapConfirm(true)}
                  className="w-full card flex items-center justify-between hover:bg-amber-50 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.875 1.875 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-amber-700">Mark as Wrapped</p>
                      <p className="text-xs text-text-muted">Production complete</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}

              {/* Wrapped status banner */}
              {lifecycle.state === 'wrapped' && (
                <div className="card bg-amber-50 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-800">Project Wrapped</p>
                      <p className="text-xs text-amber-600">{daysUntilDeletion} days until archive</p>
                    </div>
                    <button
                      onClick={() => restoreProject()}
                      className="px-3 py-1.5 text-xs font-medium text-gold bg-white rounded-lg border border-gold"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              )}

              {/* Archived status banner */}
              {lifecycle.state === 'archived' && (
                <div className="card bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-800">Project Archived - Read Only</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Danger Zone */}
        <DangerZone
          projectName={projectSettings.name}
          photoCount={projectStats?.photoCount || 0}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      </div>

      {/* Wrap Confirmation Modal */}
      {showWrapConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowWrapConfirm(false)} />
          <div className="relative bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-text-primary mb-2">
              Mark Project as Wrapped?
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              This will mark "{projectSettings.name}" as wrapped. The project will be archived after {PROJECT_RETENTION_DAYS} days.
            </p>
            <p className="text-xs text-text-muted mb-6">
              You can restore the project at any time before it's archived.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWrapConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-button border border-border text-text-muted text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleWrap}
                className="flex-1 py-2.5 px-4 rounded-button bg-amber-500 text-white text-sm font-medium"
              >
                Wrap Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
