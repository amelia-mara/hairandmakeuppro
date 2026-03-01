import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { SyncIcon } from '@/components/sync';
import { getAutoSaveFailureCount, getLastAutoSaveError } from '@/services/autoSave';
import { parseScriptRevision } from '@/utils/parseScriptRevision';
import type { ProjectRole, ProductionType } from '@/types';

interface ProjectHeaderProps {
  onSwitchProject?: () => void;
  onQuickSwitch?: (projectId: string) => void;
  onNavigateToProfile?: () => void;
  onSyncTap?: () => void;
}

const getRoleLabel = (role: ProjectRole): string => {
  const labels: Record<string, string> = {
    owner: 'Owner', designer: 'Designer', hod: 'HOD',
    supervisor: 'Supervisor', key: 'Key', floor: 'Floor',
    daily: 'Daily', trainee: 'Trainee', artist: 'Artist', viewer: 'Viewer',
  };
  return labels[role] || role;
};

const getTypeLabel = (type: ProductionType): string => {
  const labels: Record<string, string> = {
    film: 'Film', tv_series: 'TV Series', short_film: 'Short',
    commercial: 'Commercial', music_video: 'Music Video', other: 'Production',
  };
  return labels[type] || 'Production';
};

export function ProjectHeader({ onSwitchProject, onQuickSwitch, onNavigateToProfile, onSyncTap }: ProjectHeaderProps) {
  const { currentProject } = useProjectStore();
  const { user, projectMemberships } = useAuthStore();
  const [saveFailures, setSaveFailures] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll for auto-save failures every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSaveFailures(getAutoSaveFailureCount());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Parse script revision from filename
  const scriptRevision = useMemo(() => {
    if (!currentProject?.scriptFilename) return null;
    const rev = parseScriptRevision(currentProject.scriptFilename);
    if (!rev.colour && !rev.formattedDate) return null;
    return rev;
  }, [currentProject?.scriptFilename]);

  if (!currentProject) return null;

  // Get user initials for avatar
  const getInitials = () => {
    if (!user?.name) return 'U';
    const parts = user.name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  // Other projects (not the current one)
  const otherProjects = projectMemberships.filter(
    p => p.projectId !== currentProject.id
  );

  const handleProjectSelect = (projectId: string) => {
    setShowDropdown(false);
    onQuickSwitch?.(projectId);
  };

  const handleAllProjects = () => {
    setShowDropdown(false);
    onSwitchProject?.();
  };

  // Build subtitle text from script revision
  const subtitleParts: string[] = [];
  if (scriptRevision?.colour) subtitleParts.push(`${scriptRevision.colour} Draft`);
  if (scriptRevision?.formattedDate) subtitleParts.push(scriptRevision.formattedDate);
  const subtitle = subtitleParts.join(' \u2014 '); // em dash separator

  return (
    <>
      <div className="sticky top-0 z-30 safe-top bg-card border-b border-border">
        <div className="mobile-container">
          <div className="h-12 px-4 flex items-center justify-between" ref={dropdownRef}>
            {/* Project name + script info — tap to open dropdown */}
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 min-w-0 active:opacity-70 transition-opacity"
            >
              <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-text-primary truncate max-w-[200px] block leading-tight">
                  {currentProject.name}
                </span>
                {subtitle && (
                  <span className="flex items-center gap-1 text-[10px] text-text-muted leading-tight">
                    {scriptRevision?.colourHex && (
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0 border border-black/10"
                        style={{ backgroundColor: scriptRevision.colourHex }}
                      />
                    )}
                    {subtitle}
                  </span>
                )}
              </div>
              <svg className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            <div className="flex items-center gap-1">
              {/* Sync icon */}
              {onSyncTap && <SyncIcon onClick={onSyncTap} />}

              {/* Account icon */}
              <button
                onClick={onNavigateToProfile}
                className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold text-xs font-bold active:scale-95 transition-transform"
              >
                {getInitials()}
              </button>
            </div>
          </div>
        </div>

        {/* Save failure warning banner */}
        {saveFailures >= 2 && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5">
            <p className="text-xs text-red-600 dark:text-red-400 text-center">
              Auto-save failing — your changes may not be saved to the cloud.
              {getLastAutoSaveError() && (
                <span className="block text-[10px] opacity-70 mt-0.5">
                  {getLastAutoSaveError()}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Project switcher dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowDropdown(false)} />

          {/* Dropdown panel */}
          <div className="fixed left-0 right-0 z-50 px-4 below-project-header">
            <div className="mobile-container">
              <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden max-h-[60vh] flex flex-col">
                {/* Current project */}
                <div className="px-4 py-3 border-b border-border bg-gold/5">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gold flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary truncate">{currentProject.name}</p>
                      {subtitle && (
                        <p className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                          {scriptRevision?.colourHex && (
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0 border border-black/10"
                              style={{ backgroundColor: scriptRevision.colourHex }}
                            />
                          )}
                          {subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-gold uppercase tracking-wider">Current</span>
                  </div>
                </div>

                {/* Other projects list */}
                {otherProjects.length > 0 && (
                  <div className="overflow-y-auto flex-1 divide-y divide-border">
                    {otherProjects.map((project) => (
                      <button
                        key={project.projectId}
                        onClick={() => handleProjectSelect(project.projectId)}
                        className="w-full text-left px-4 py-3 active:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-text-primary truncate">{project.projectName}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {getTypeLabel(project.productionType)}
                          <span className="mx-1 text-text-light">&middot;</span>
                          {getRoleLabel(project.role)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {/* All Projects link */}
                <button
                  onClick={handleAllProjects}
                  className="flex items-center gap-2 px-4 py-3 border-t border-border active:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                  <span className="text-sm font-medium text-text-secondary">All Projects</span>
                  <svg className="w-3.5 h-3.5 text-text-light ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
