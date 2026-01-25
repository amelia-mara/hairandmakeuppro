import { useState } from 'react';
import { ProjectMenu } from '@/components/project-settings';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import type { NavTab } from '@/types';

interface ProjectHeaderProps {
  onNavigateToTab?: (tab: NavTab) => void;
  onNavigateToSubView?: (subView: 'team' | 'invite' | 'projectStats' | 'projectSettings') => void;
  onSwitchProject?: () => void;
}

export function ProjectHeader({ onNavigateToSubView, onSwitchProject }: ProjectHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { currentProject } = useProjectStore();
  const { user, projectMemberships } = useAuthStore();

  // Get current project membership
  const currentMembership = projectMemberships.length > 0 ? projectMemberships[0] : null;

  if (!currentProject) return null;

  // Get production type label
  const getProductionTypeLabel = () => {
    if (!currentMembership?.productionType) return '';
    const types: Record<string, string> = {
      film: 'Feature Film',
      tv_series: 'TV Series',
      short_film: 'Short Film',
      commercial: 'Commercial',
      music_video: 'Music Video',
      other: 'Production',
    };
    return types[currentMembership.productionType] || '';
  };

  const handleViewTeam = () => {
    setShowMenu(false);
    onNavigateToSubView?.('team');
  };

  const handleShareInvite = () => {
    setShowMenu(false);
    onNavigateToSubView?.('invite');
  };

  const handleViewStats = () => {
    setShowMenu(false);
    onNavigateToSubView?.('projectStats');
  };

  const handleOpenSettings = () => {
    setShowMenu(false);
    onNavigateToSubView?.('projectSettings');
  };

  const handleSwitchProject = () => {
    setShowMenu(false);
    onSwitchProject?.();
  };

  const handleLeaveProject = () => {
    setShowMenu(false);
    // TODO: Implement leave project logic
    onSwitchProject?.();
  };

  return (
    <>
      {/* Project Header Bar */}
      <div className="bg-card border-b border-border">
        <div className="mobile-container">
          <button
            onClick={() => setShowMenu(true)}
            className="w-full h-12 px-4 flex items-center justify-between active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {currentProject.name}
                </p>
                {getProductionTypeLabel() && (
                  <p className="text-[10px] text-text-muted truncate">
                    {getProductionTypeLabel()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-text-muted">
              <span className="text-xs">Menu</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Project Menu */}
      <ProjectMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        project={currentMembership}
        userTier={user?.tier || 'trainee'}
        onViewTeam={handleViewTeam}
        onShareInvite={handleShareInvite}
        onViewStats={handleViewStats}
        onOpenSettings={handleOpenSettings}
        onSwitchProject={handleSwitchProject}
        onLeaveProject={handleLeaveProject}
      />
    </>
  );
}
