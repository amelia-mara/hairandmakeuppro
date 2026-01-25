import { useState } from 'react';
import { BottomSheet } from '@/components/ui/Modal';
import { ConfirmationModal } from './ConfirmationModal';
import type { ProjectMembership, UserTier } from '@/types';
import { canManageProject } from '@/types';

interface ProjectMenuProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectMembership | null;
  userTier: UserTier;
  onViewTeam: () => void;
  onShareInvite: () => void;
  onViewStats: () => void;
  onOpenSettings: () => void;
  onSwitchProject: () => void;
  onLeaveProject: () => void;
}

export function ProjectMenu({
  isOpen,
  onClose,
  project,
  userTier,
  onViewTeam,
  onShareInvite,
  onViewStats,
  onOpenSettings,
  onSwitchProject,
  onLeaveProject,
}: ProjectMenuProps) {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  if (!project) return null;

  // Check if user can manage this project (owner or supervisor+)
  const isOwner = project.role === 'owner';
  const canManage = canManageProject(userTier, {
    isOwner,
    role: project.role === 'owner' ? 'designer' : project.role === 'supervisor' ? 'supervisor' : 'trainee',
  });

  const handleLeaveProject = () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeaveProject = () => {
    setShowLeaveConfirm(false);
    onClose();
    onLeaveProject();
  };

  // Map simple ProjectRole to display text
  const getRoleDisplay = () => {
    switch (project.role) {
      case 'owner':
        return 'Owner';
      case 'supervisor':
        return 'Supervisor';
      case 'artist':
        return 'Artist';
      case 'viewer':
        return 'Viewer';
      default:
        return project.role;
    }
  };

  const menuItems = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      label: 'Team',
      sublabel: `${project.teamMemberCount} members`,
      onClick: () => { onClose(); onViewTeam(); },
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      ),
      label: 'Share Invite Code',
      onClick: () => { onClose(); onShareInvite(); },
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      label: 'Project Stats',
      onClick: () => { onClose(); onViewStats(); },
    },
  ];

  // Add settings option for owners/supervisors
  if (canManage) {
    menuItems.push({
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      label: 'Project Settings',
      sublabel: isOwner ? 'Owner' : 'Supervisor access',
      onClick: () => { onClose(); onOpenSettings(); },
    });
  }

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} showCloseButton={false}>
        <div className="pb-4">
          {/* Project Header */}
          <div className="text-center pb-4 border-b border-border mb-4">
            <h2 className="text-xl font-bold text-text-primary">{project.projectName}</h2>
            <p className="text-sm text-text-muted mt-1">
              {project.productionType === 'film' && 'Feature Film'}
              {project.productionType === 'tv_series' && 'TV Series'}
              {project.productionType === 'short_film' && 'Short Film'}
              {project.productionType === 'commercial' && 'Commercial'}
              {project.productionType === 'music_video' && 'Music Video'}
              {project.productionType === 'other' && 'Production'}
            </p>
            <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-gold-50 rounded-full">
              <span className="text-xs font-medium text-gold">{getRoleDisplay()}</span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-1">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-gold-50 flex items-center justify-center text-gold">
                  {item.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                  {item.sublabel && (
                    <p className="text-xs text-text-muted">{item.sublabel}</p>
                  )}
                </div>
                <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-border my-4" />

          {/* Switch Project */}
          <button
            onClick={() => { onClose(); onSwitchProject(); }}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-text-muted">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <span className="text-sm font-medium text-text-primary">Switch Project</span>
          </button>

          {/* Leave Project */}
          {!isOwner && (
            <button
              onClick={handleLeaveProject}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </div>
              <span className="text-sm font-medium text-red-500">Leave Project</span>
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Leave Project Confirmation */}
      <ConfirmationModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={confirmLeaveProject}
        title={`Leave "${project.projectName}"?`}
        message={
          <div className="space-y-2">
            <p>You will lose access to this project immediately.</p>
            <p>To rejoin, you'll need a new invite code from the project owner.</p>
          </div>
        }
        confirmText="Leave Project"
        variant="danger"
      />
    </>
  );
}
