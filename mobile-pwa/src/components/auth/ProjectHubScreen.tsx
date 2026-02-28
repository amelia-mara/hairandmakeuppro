import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { UpgradeModal } from '@/components/dashboard';
import * as supabaseProjects from '@/services/supabaseProjects';
import * as supabaseStorage from '@/services/supabaseStorage';
import { hoursUntilDeletion } from '@/services/supabaseProjects';
import { setReceivingFromServer } from '@/services/syncChangeTracker';
import { useSyncStore } from '@/stores/syncStore';
import type { ProjectMembership, Project, ProjectRole, ProductionType, CallSheet, ProductionSchedule, SceneFilmingStatus, MakeupDetails, HairDetails, ScheduleCastMember, ScheduleDay, SceneCapture, Photo, PhotoAngle, ContinuityFlags, ContinuityEvent, SFXDetails } from '@/types';
import { savePhotoBlob } from '@/db';
import { createEmptyMakeupDetails, createEmptyHairDetails } from '@/types';

// Format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
};

const getRoleLabel = (role: ProjectRole): string => {
  const labels: Record<string, string> = {
    owner: 'Owner', designer: 'Designer', hod: 'HOD',
    supervisor: 'Supervisor', key: 'Key', floor: 'Floor',
    daily: 'Daily', trainee: 'Trainee', artist: 'Artist', viewer: 'Viewer',
  };
  return labels[role] || role;
};

// For synced (non-owner) members, show "Synced from [owner name]"
const getMembershipLabel = (membership: ProjectMembership): string => {
  if (membership.role === 'owner') return 'Owner';
  if (membership.ownerName) return `Synced from ${membership.ownerName}`;
  return getRoleLabel(membership.role);
};

// Format deletion countdown for the banner
const formatDeletionCountdown = (pendingDeletionAt: Date): string => {
  const hours = hoursUntilDeletion(pendingDeletionAt);
  if (hours <= 0) return 'This project is being deleted';
  if (hours === 1) return 'This project will be deleted in 1 hour';
  if (hours <= 24) return `This project will be deleted in ${hours} hours`;
  const days = Math.ceil(hours / 24);
  return `This project will be deleted in ${days} day${days !== 1 ? 's' : ''}`;
};

const getTypeLabel = (type: ProductionType): string => {
  const labels: Record<string, string> = {
    film: 'Feature Film', tv_series: 'TV Series', short_film: 'Short Film',
    commercial: 'Commercial', music_video: 'Music Video', other: 'Production',
  };
  return labels[type] || 'Production';
};

function createProjectFromMembership(membership: ProjectMembership): Project {
  return {
    id: membership.projectId,
    name: membership.projectName,
    createdAt: membership.joinedAt,
    updatedAt: membership.lastAccessedAt,
    scenes: [],
    characters: [],
    looks: [],
  };
}

// Load document data (schedule, call sheets, script) into the appropriate stores.
// Called immediately on project open so synced users see data right away.
function loadDocumentsIntoStores(
  scheduleData: any[],
  callSheetData: any[],
  scriptData: any[],
): void {
  // Schedule
  if (scheduleData.length > 0) {
    const db = scheduleData[0];
    if (db.days || db.cast_list) {
      const schedule: ProductionSchedule = {
        id: db.id,
        status: db.status === 'complete' ? 'complete' : 'pending',
        castList: (db.cast_list as unknown as ScheduleCastMember[]) || [],
        days: (db.days as unknown as ScheduleDay[]) || [],
        totalDays: ((db.days as unknown as ScheduleDay[]) || []).length,
        uploadedAt: new Date(db.created_at),
        rawText: db.raw_pdf_text || undefined,
      };
      useScheduleStore.getState().setSchedule(schedule);

      // Download the schedule PDF from storage in background
      if (db.storage_path) {
        supabaseStorage.downloadDocumentAsDataUri(db.storage_path).then(({ dataUri }) => {
          if (!dataUri) return;
          const current = useScheduleStore.getState().schedule;
          if (current && current.id === db.id) {
            useScheduleStore.getState().setSchedule({ ...current, pdfUri: dataUri });
          }
        });
      }
    }
  }

  // Call sheets
  if (callSheetData.length > 0) {
    const callSheetStore = useCallSheetStore.getState();
    callSheetStore.clearAll();

    const callSheets: CallSheet[] = callSheetData.map((db: Record<string, unknown>) => {
      const parsed = (db.parsed_data || {}) as Record<string, unknown>;
      return {
        ...parsed,
        id: db.id,
        date: db.shoot_date,
        productionDay: db.production_day,
        rawText: db.raw_text || (parsed.rawText as string | undefined),
        pdfUri: undefined,
        uploadedAt: new Date(db.created_at as string),
        scenes: (parsed.scenes as CallSheet['scenes']) || [],
      } as CallSheet;
    });

    for (const cs of callSheets) {
      useCallSheetStore.setState((state) => ({
        callSheets: [...state.callSheets, cs].sort(
          (a, b) => a.productionDay - b.productionDay
        ),
      }));
    }

    const latest = callSheets[callSheets.length - 1];
    if (latest) {
      callSheetStore.setActiveCallSheet(latest.id);
    }

    // Download call sheet PDFs in background
    for (const db of callSheetData) {
      if (db.storage_path) {
        supabaseStorage.downloadDocumentAsDataUri(db.storage_path).then(({ dataUri }) => {
          if (!dataUri) return;
          useCallSheetStore.setState((state) => ({
            callSheets: state.callSheets.map((cs) =>
              cs.id === db.id ? { ...cs, pdfUri: dataUri } : cs
            ),
          }));
        });
      }
    }
  }

  // Script
  if (scriptData.length > 0) {
    const dbScript = scriptData[0];
    if (dbScript.storage_path) {
      supabaseStorage.downloadDocumentAsDataUri(dbScript.storage_path).then(({ dataUri }) => {
        if (!dataUri) return;
        useProjectStore.getState().setScriptPdf(dataUri);
      });
    }
  }
}

// Download a photo from Supabase Storage and cache it in IndexedDB,
// then update the scene capture in the store with the thumbnail.
function downloadAndCachePhotoInBackground(
  dbPhoto: any,
  captureKey: string,
  store: ReturnType<typeof useProjectStore.getState>,
): void {
  supabaseStorage.downloadPhoto(dbPhoto.storage_path).then(async ({ blob, error }) => {
    if (error || !blob) return;

    // Create thumbnail
    const thumbnail = await new Promise<string>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.max(size / img.width, size / img.height);
        const x = (size - img.width * scale) / 2;
        const y = (size - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
      img.src = url;
    });

    // Cache in IndexedDB
    await savePhotoBlob(dbPhoto.id, blob, thumbnail, dbPhoto.angle as PhotoAngle);

    // Update the capture in the store with the thumbnail
    const capture = store.sceneCaptures[captureKey] as SceneCapture | undefined;
    if (!capture) return;

    const angle = dbPhoto.angle as string;
    const updatedPhoto: Photo = {
      id: dbPhoto.id,
      uri: '',
      thumbnail,
      capturedAt: new Date(dbPhoto.taken_at),
      angle: angle as PhotoAngle,
    };

    if (angle !== 'additional' && angle !== 'detail') {
      setReceivingFromServer(true);
      store.updateSceneCapture(captureKey, {
        photos: { ...capture.photos, [angle]: updatedPhoto },
      });
      setReceivingFromServer(false);
    }
  }).catch(err => {
    console.warn('[ProjectHub] Photo download failed:', err);
  });
}

// Delete/Leave Confirmation Modal
function DeleteProjectModal({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  isOwner,
  isLoading,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectName: string;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-2xl p-5 max-w-sm w-full shadow-xl">
        <h3 className="text-base font-semibold text-text-primary mb-1.5">
          {isOwner ? 'Delete project?' : 'Leave project?'}
        </h3>
        <p className="text-sm text-text-secondary mb-5">
          {isOwner
            ? `Team members synced to "${projectName}" will have 48 hours to download any documents before it is permanently deleted.`
            : `You'll need a new invite code to rejoin "${projectName}".`}
        </p>
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-text-primary active:scale-[0.98] transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl bg-red-600 text-sm font-medium text-white active:scale-[0.98] transition-transform"
          >
            {isLoading ? 'Deleting...' : isOwner ? 'Delete' : 'Leave'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Overflow menu for project actions
function ProjectMenu({
  isOpen,
  onClose,
  onSettings,
  onSetCurrent,
  onDelete,
  isOwner,
  isCurrent,
  openUpward,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSettings?: () => void;
  onSetCurrent?: () => void;
  onDelete: () => void;
  isOwner: boolean;
  isCurrent?: boolean;
  openUpward?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute right-0 z-50 bg-card rounded-xl shadow-lg border border-border py-1 min-w-[180px] ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
        {onSetCurrent && !isCurrent && (
          <button
            onClick={() => { onSetCurrent(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Set as Current
          </button>
        )}
        {onSettings && (
          <button
            onClick={() => { onSettings(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-gray-50 transition-colors"
          >
            Settings
          </button>
        )}
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          {isOwner ? 'Delete project' : 'Leave project'}
        </button>
      </div>
    </>
  );
}

export function ProjectHubScreen() {
  const {
    user,
    setScreen,
    goBack,
    signOut,
    projectMemberships,
    canCreateProjects,
    updateLastAccessed,
    hasCompletedOnboarding,
    deleteProject,
    leaveProject,
    isLoading,
    pinnedProjectId,
    setPinnedProject,
    setSettingsProjectId,
    refreshUserProjects,
  } = useAuthStore();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [deleteModalProject, setDeleteModalProject] = useState<ProjectMembership | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Refresh project list from server on mount to clear stale/deleted projects
  useEffect(() => {
    refreshUserProjects();
  }, [refreshUserProjects]);

  // Determine "current" (pinned) project and sort the rest by date created
  const pinnedProject = pinnedProjectId
    ? projectMemberships.find((p) => p.projectId === pinnedProjectId) || null
    : null;

  // If no pinned project, fall back to most recently accessed
  const currentProject =
    pinnedProject ||
    (projectMemberships.length > 0
      ? [...projectMemberships].sort(
          (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
        )[0]
      : null);

  // Other projects sorted by date created (joinedAt) descending — newest first
  const otherProjects = projectMemberships
    .filter((p) => p.projectId !== currentProject?.projectId)
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

  const handleProjectOpen = async (membership: ProjectMembership) => {
    updateLastAccessed(membership.projectId);

    const store = useProjectStore.getState();

    // Save current project before switching (if different)
    if (store.currentProject && store.currentProject.id !== membership.projectId) {
      if (store.currentProject.scenes.length > 0) {
        store.saveAndClearProject();
      } else {
        useCallSheetStore.getState().clearCallSheetsForProject();
      }
    }

    // Clear document stores so stale data doesn't bleed across projects
    useCallSheetStore.getState().clearAll();
    useScheduleStore.getState().clearSchedule();

    // ── Load from Supabase ─────────────────────────────────────────
    // The server is the source of truth. Whether you just logged in,
    // switched devices, or tapped the same project — fetch it fresh.
    try {
      const {
        scenes, characters, looks, sceneCharacters, lookScenes,
        continuityEvents, photos: dbPhotos,
        scheduleData, callSheetData, scriptData, error,
      } = await supabaseProjects.getProjectData(membership.projectId);

      const hasSceneData = !error && scenes.length > 0;
      const hasContinuity = continuityEvents.length > 0;
      const hasDocuments = scriptData.length > 0 || scheduleData.length > 0 || callSheetData.length > 0;

      if (hasSceneData || hasDocuments || hasContinuity) {
        const sceneCharMap = new Map<string, string[]>();
        for (const sc of sceneCharacters) {
          const existing = sceneCharMap.get(sc.scene_id) || [];
          existing.push(sc.character_id);
          sceneCharMap.set(sc.scene_id, existing);
        }

        const lookSceneMap = new Map<string, string[]>();
        for (const ls of lookScenes) {
          const existing = lookSceneMap.get(ls.look_id) || [];
          existing.push(ls.scene_number);
          lookSceneMap.set(ls.look_id, existing);
        }

        const localScenes = scenes.map(s => ({
          id: s.id,
          sceneNumber: s.scene_number,
          slugline: s.location || `Scene ${s.scene_number}`,
          intExt: (s.int_ext === 'EXT' ? 'EXT' : 'INT') as 'INT' | 'EXT',
          timeOfDay: (s.time_of_day || 'DAY') as 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS',
          synopsis: s.synopsis || undefined,
          scriptContent: s.script_content || undefined,
          characters: sceneCharMap.get(s.id) || [],
          isComplete: s.is_complete,
          completedAt: s.completed_at ? new Date(s.completed_at) : undefined,
          filmingStatus: (s.filming_status as SceneFilmingStatus) || undefined,
          filmingNotes: s.filming_notes || undefined,
          shootingDay: s.shooting_day || undefined,
          characterConfirmationStatus: 'confirmed' as const,
        }));

        const localCharacters = characters.map(c => ({
          id: c.id,
          name: c.name,
          initials: c.initials,
          avatarColour: c.avatar_colour,
        }));

        const localLooks = looks.map(l => ({
          id: l.id,
          characterId: l.character_id,
          name: l.name,
          scenes: lookSceneMap.get(l.id) || [],
          estimatedTime: l.estimated_time,
          makeup: (l.makeup_details as unknown as MakeupDetails) || createEmptyMakeupDetails(),
          hair: (l.hair_details as unknown as HairDetails) || createEmptyHairDetails(),
        }));

        const project: Project = {
          id: membership.projectId,
          name: membership.projectName,
          createdAt: membership.joinedAt,
          updatedAt: membership.lastAccessedAt,
          scenes: localScenes,
          characters: localCharacters,
          looks: localLooks,
        };

        // Set flag so loading from server doesn't mark as pending changes
        setReceivingFromServer(true);
        try {
          store.setProject(project);
          loadDocumentsIntoStores(scheduleData, callSheetData, scriptData);

          // Load continuity events (scene captures) + photos
          if (continuityEvents.length > 0) {
            // Group photos by continuity_event_id
            const photosByCapture = new Map<string, any[]>();
            for (const p of dbPhotos) {
              const existing = photosByCapture.get(p.continuity_event_id) || [];
              existing.push(p);
              photosByCapture.set(p.continuity_event_id, existing);
            }

            for (const ce of continuityEvents) {
              const captureKey = `${ce.scene_id}-${ce.character_id}`;
              const cePhotos = photosByCapture.get(ce.id) || [];

              // Build photo objects (download in background)
              const mainPhotos: { front?: Photo; left?: Photo; right?: Photo; back?: Photo } = {};
              const additionalPhotos: Photo[] = [];

              for (const dbPhoto of cePhotos) {
                const photo: Photo = {
                  id: dbPhoto.id,
                  uri: '',
                  thumbnail: '',
                  capturedAt: new Date(dbPhoto.taken_at),
                  angle: dbPhoto.angle as PhotoAngle,
                };
                if (dbPhoto.angle !== 'additional' && dbPhoto.angle !== 'detail') {
                  mainPhotos[dbPhoto.angle as keyof typeof mainPhotos] = photo;
                } else {
                  additionalPhotos.push(photo);
                }
              }

              const capture: SceneCapture = {
                id: ce.id,
                sceneId: ce.scene_id,
                characterId: ce.character_id,
                lookId: ce.look_id || '',
                capturedAt: new Date(ce.created_at),
                photos: mainPhotos,
                additionalPhotos,
                continuityFlags: (ce.continuity_flags as unknown as ContinuityFlags) || {
                  sweat: false, dishevelled: false, blood: false,
                  dirt: false, wetHair: false, tears: false,
                },
                continuityEvents: (ce.continuity_events_data as unknown as ContinuityEvent[]) || [],
                sfxDetails: (ce.sfx_details as unknown as SFXDetails) || {
                  sfxRequired: false, sfxTypes: [], prostheticPieces: '',
                  prostheticAdhesive: '', bloodTypes: [], bloodProducts: '',
                  bloodPlacement: '', tattooCoverage: '', temporaryTattoos: '',
                  contactLenses: '', teeth: '', agingCharacterNotes: '',
                  sfxApplicationTime: null, sfxReferencePhotos: [],
                },
                notes: ce.general_notes || '',
                applicationTime: ce.application_time || undefined,
              };

              store.updateSceneCapture(captureKey, capture);

              // Download and cache photos in background
              for (const dbPhoto of cePhotos) {
                downloadAndCachePhotoInBackground(dbPhoto, captureKey, store);
              }
            }
          }
        } finally {
          setReceivingFromServer(false);
        }
        // Clear any pending changes — we just loaded fresh from server.
        useSyncStore.getState().clearChanges();
        // Also clear after a delay to catch async PDF download callbacks
        // from loadDocumentsIntoStores that fire after this point and
        // trigger the change tracker with receivingFromServer already false.
        setTimeout(() => useSyncStore.getState().clearChanges(), 3000);
        store.setActiveTab('today');
        return;
      }
    } catch (err) {
      console.error('Failed to load project from server:', err);

      // ── Offline fallback: use local data if available ───────────
      if (store.hasSavedProject(membership.projectId)) {
        store.restoreSavedProject(membership.projectId);
        store.setActiveTab('today');
        return;
      }
    }

    // ── No data on server (or offline with no local data) ────────
    const project = createProjectFromMembership(membership);
    if (membership.role === 'owner') {
      store.setProjectNeedsSetup(project);
    } else {
      store.setProject(project);
    }
    store.setActiveTab('today');
  };

  const handleCreateClick = () => {
    if (canCreateProjects()) {
      setScreen('create-project');
    } else {
      setShowUpgradeModal(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalProject) return;
    setDeleteError(null);
    const isOwner = deleteModalProject.role === 'owner';
    const result = isOwner
      ? await deleteProject(deleteModalProject.projectId)
      : await leaveProject(deleteModalProject.projectId);

    if (result.success) {
      const store = useProjectStore.getState();
      const callSheetStore = useCallSheetStore.getState();
      if (store.currentProject?.id === deleteModalProject.projectId) {
        store.clearProject();
        callSheetStore.clearCallSheetsForProject();
      }
      if (store.hasSavedProject(deleteModalProject.projectId)) {
        store.removeSavedProject(deleteModalProject.projectId);
      }
      setDeleteModalProject(null);
    } else {
      setDeleteError(result.error || 'Something went wrong. Please try again.');
    }
  };

  const getUserInitials = (): string => {
    if (!user?.name) return '?';
    const parts = user.name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return user.name.slice(0, 2).toUpperCase();
  };

  const canManage = (role: string) => role === 'owner' || role === 'supervisor';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!hasCompletedOnboarding && (
                <button
                  onClick={goBack}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-2"
                >
                  <svg className="w-5 h-5 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5" />
                    <path d="M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h1 className="text-[17px] font-bold text-text-primary">Projects</h1>
            </div>
            <button
              onClick={() => setScreen('profile')}
              className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold text-xs font-bold active:scale-95 transition-transform"
            >
              {getUserInitials()}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {projectMemberships.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-text-primary mb-1">No projects yet</h2>
            <p className="text-sm text-text-muted mb-8 max-w-[240px]">
              Create a new project or join your team with an invite code.
            </p>
            <div className="w-full max-w-[280px] space-y-3">
              <button
                onClick={handleCreateClick}
                className="w-full h-11 rounded-xl gold-gradient text-white text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Create Project
              </button>
              <button
                onClick={() => setScreen('join')}
                className="w-full h-11 rounded-xl border border-border text-sm font-medium text-text-primary active:scale-[0.98] transition-transform"
              >
                Join with Code
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current project - hero card */}
            {currentProject && (
              <section>
                <div className="text-[11px] font-medium tracking-wider text-text-muted uppercase mb-2.5">Current</div>
                <button
                  onClick={() => handleProjectOpen(currentProject)}
                  className={`w-full text-left bg-card rounded-2xl p-4 shadow-sm border active:scale-[0.99] transition-transform ${currentProject.pendingDeletionAt ? 'border-red-300' : 'border-border'}`}
                >
                  {currentProject.pendingDeletionAt && (
                    <div className="flex items-center gap-2 bg-red-50 text-red-700 text-xs font-medium px-3 py-2 rounded-lg mb-3">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {formatDeletionCountdown(new Date(currentProject.pendingDeletionAt))}
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-text-primary leading-tight pr-2">
                      {currentProject.projectName}
                    </h3>
                    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === currentProject.projectId ? null : currentProject.projectId);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 -mr-1 -mt-0.5"
                      >
                        <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                      <ProjectMenu
                        isOpen={menuOpenId === currentProject.projectId}
                        onClose={() => setMenuOpenId(null)}
                        onSetCurrent={() => setPinnedProject(currentProject.projectId)}
                        isCurrent
                        onSettings={
                          canManage(currentProject.role)
                            ? () => { setSettingsProjectId(currentProject.projectId); setScreen('project-settings'); }
                            : undefined
                        }
                        onDelete={() => { setDeleteError(null); setDeleteModalProject(currentProject); }}
                        isOwner={currentProject.role === 'owner'}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-text-muted">
                    {getTypeLabel(currentProject.productionType)}
                    <span className="mx-1.5 text-text-light">&middot;</span>
                    {getMembershipLabel(currentProject)}
                  </p>
                  {(currentProject.sceneCount > 0 || currentProject.teamMemberCount > 0) && (
                    <p className="text-xs text-text-muted mt-1.5">
                      {currentProject.sceneCount > 0 && `${currentProject.sceneCount} scene${currentProject.sceneCount !== 1 ? 's' : ''}`}
                      {currentProject.sceneCount > 0 && currentProject.teamMemberCount > 0 && (
                        <span className="mx-1.5 text-text-light">&middot;</span>
                      )}
                      {currentProject.teamMemberCount > 0 && `${currentProject.teamMemberCount} team`}
                    </p>
                  )}
                  <p className="text-[11px] text-text-light mt-2">
                    Last active {formatRelativeTime(currentProject.lastAccessedAt)}
                  </p>
                </button>
              </section>
            )}

            {/* Other projects - list rows */}
            {otherProjects.length > 0 && (
              <section>
                <div className="text-[11px] font-medium tracking-wider text-text-muted uppercase mb-2.5">Other Projects</div>
                <div className="bg-card rounded-2xl border border-border divide-y divide-border">
                  {otherProjects.map((project) => (
                    <div key={project.projectId} className="relative">
                      <button
                        onClick={() => handleProjectOpen(project)}
                        className="w-full text-left px-4 py-3.5 active:bg-gray-50 transition-colors"
                      >
                        {project.pendingDeletionAt && (
                          <div className="flex items-center gap-2 bg-red-50 text-red-700 text-xs font-medium px-2.5 py-1.5 rounded-lg mb-2">
                            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {formatDeletionCountdown(new Date(project.pendingDeletionAt))}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium text-text-primary truncate">
                              {project.projectName}
                            </h4>
                            <p className="text-xs text-text-muted mt-0.5">
                              {getMembershipLabel(project)}
                            </p>
                            <p className="text-[11px] text-text-light mt-0.5">
                              Last active {formatRelativeTime(project.lastAccessedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            <div onClick={(e) => e.stopPropagation()} className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(menuOpenId === project.projectId ? null : project.projectId);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                              >
                                <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="12" cy="5" r="1.5" />
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>
                              <ProjectMenu
                                isOpen={menuOpenId === project.projectId}
                                onClose={() => setMenuOpenId(null)}
                                onSetCurrent={() => setPinnedProject(project.projectId)}
                                onSettings={
                                  canManage(project.role)
                                    ? () => { setSettingsProjectId(project.projectId); setScreen('project-settings'); }
                                    : undefined
                                }
                                onDelete={() => { setDeleteError(null); setDeleteModalProject(project); }}
                                isOwner={project.role === 'owner'}
                                openUpward
                              />
                            </div>
                            <svg className="w-4 h-4 text-text-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Create / Join - inline at bottom */}
            <div className="flex items-center justify-center gap-5 pt-2 pb-4">
              <button
                onClick={handleCreateClick}
                className="flex items-center gap-1.5 text-sm font-medium text-gold active:opacity-70 transition-opacity"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create
              </button>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={() => setScreen('join')}
                className="flex items-center gap-1.5 text-sm font-medium text-text-secondary active:opacity-70 transition-opacity"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Join
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="px-4 py-3 pb-safe-bottom">
        <button
          onClick={signOut}
          className="w-full text-center text-xs text-text-muted active:opacity-70 transition-opacity"
        >
          Sign out
        </button>
      </div>

      {/* Modals */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => { setShowUpgradeModal(false); setScreen('select-plan'); }}
      />
      <DeleteProjectModal
        isOpen={deleteModalProject !== null}
        onClose={() => { setDeleteModalProject(null); setDeleteError(null); }}
        onConfirm={handleDeleteConfirm}
        projectName={deleteModalProject?.projectName || ''}
        isOwner={deleteModalProject?.role === 'owner'}
        isLoading={isLoading}
        error={deleteError}
      />
    </div>
  );
}
