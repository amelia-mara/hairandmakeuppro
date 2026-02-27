import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useNavigationStore, MAX_BOTTOM_NAV_ITEMS } from '@/stores/navigationStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useAuthStore } from '@/stores/authStore';
import { NavIcon } from '@/components/navigation/BottomNav';
import { formatShortDate } from '@/utils/helpers';
import type { NavTab } from '@/types';
import { ALL_NAV_ITEMS, PROJECT_RETENTION_DAYS, canManageProject } from '@/types';
import { ProjectExportScreen } from './ProjectExportScreen';
import { BillingDetailsScreen } from './BillingDetailsScreen';
import {
  TeamScreen,
  InviteScreen,
  ProjectStatsScreen,
  ScheduleScreen,
  ProjectSettingsScreen,
  ProductionDetailsScreen,
} from '@/components/project-settings';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';
import { parseScenesFast } from '@/utils/scriptParser';
import { AmendmentReviewModal } from '@/components/breakdown/AmendmentReviewModal';
import type { AmendmentResult } from '@/services/scriptAmendmentService';
import { ScheduleAmendmentModal } from '@/components/schedule/ScheduleAmendmentModal';
import type { ScheduleAmendmentResult } from '@/services/scheduleAmendmentService';
import { UserProfileScreen } from '@/components/profile/UserProfileScreen';
import { UserGuide } from '@/components/settings/UserGuide';

type MoreView = 'menu' | 'script' | 'schedule' | 'callsheets' | 'editMenu' | 'export' | 'archivedProjects' | 'projectSettings' | 'team' | 'invite' | 'projectStats' | 'manualSchedule' | 'billing' | 'userProfile' | 'productionDetails' | 'helpGuide';

interface MoreProps {
  onNavigateToTab?: (tab: NavTab) => void;
  onStartNewProject?: () => void;
  initialView?: NavTab;
  resetKey?: number;
  subView?: 'team' | 'invite' | 'projectStats' | 'projectSettings' | 'userProfile' | 'billing'; // Direct navigation to sub-views
}

export function More({ onNavigateToTab, onStartNewProject, initialView, resetKey, subView }: MoreProps) {
  // Determine initial view based on the tab that was navigated to
  const getInitialView = (): MoreView => {
    // If a subView is specified, use it directly
    if (subView) {
      return subView as MoreView;
    }
    if (initialView && ['script', 'schedule', 'callsheets'].includes(initialView)) {
      return initialView as MoreView;
    }
    return 'menu';
  };

  const [currentView, setCurrentView] = useState<MoreView>(getInitialView);
  const [billingReturnView, setBillingReturnView] = useState<MoreView>('menu');
  const { isEditMenuOpen, closeEditMenu, openEditMenu } = useNavigationStore();
  const { projectMemberships, user } = useAuthStore();
  const { projectSettings, clearState: clearProjectSettingsState } = useProjectSettingsStore();
  const activeProjectId = useProjectStore((s) => s.currentProject?.id ?? '');

  // Get current project membership — match the ACTIVE project, not just the first in the array
  const currentProjectMembership = projectMemberships.find(pm => pm.projectId === activeProjectId)
    || (projectMemberships.length > 0 ? projectMemberships[0] : null);
  const isOwner = currentProjectMembership?.role === 'owner';
  const canManage = currentProjectMembership && user ? canManageProject(user.tier, {
    isOwner,
    role: isOwner ? 'designer' : currentProjectMembership.role === 'supervisor' ? 'supervisor' : 'trainee',
  }) : false;

  // Update view when initialView prop changes or resetKey changes (e.g., user taps same tab again)
  useEffect(() => {
    // If a subView is specified, use it directly
    if (subView) {
      setCurrentView(subView as MoreView);
    } else if (initialView && ['script', 'schedule', 'callsheets'].includes(initialView)) {
      setCurrentView(initialView as MoreView);
    } else if (initialView === 'more') {
      setCurrentView('menu');
    }
  }, [initialView, resetKey, subView]);

  // If edit menu is open via store, show it
  const effectiveView = isEditMenuOpen ? 'editMenu' : currentView;

  const handleViewChange = (view: MoreView) => {
    if (view === 'editMenu') {
      openEditMenu();
    } else {
      setCurrentView(view);
    }
  };

  const handleEditMenuClose = () => {
    closeEditMenu();
    setCurrentView('menu');
  };

  // Handle back navigation - if user came from bottom nav, go to 'today' instead of 'menu'
  const handleBack = () => {
    if (initialView && ['script', 'schedule', 'callsheets'].includes(initialView)) {
      // User navigated directly from bottom nav - go to Today
      onNavigateToTab?.('today');
    } else {
      setCurrentView('menu');
    }
  };

  const renderView = () => {
    switch (effectiveView) {
      case 'script':
        return <ScriptViewer onBack={handleBack} />;
      case 'schedule':
        return <ScheduleViewer onBack={handleBack} />;
      case 'callsheets':
        return <CallSheetArchive onBack={handleBack} />;
      case 'editMenu':
        return <EditMenuScreen onDone={handleEditMenuClose} />;
      case 'export':
        return (
          <ProjectExportScreen
            onBack={() => setCurrentView('projectSettings')}
            onExportComplete={() => setCurrentView('projectSettings')}
            onNavigateToBilling={() => { setBillingReturnView('export'); setCurrentView('billing'); }}
          />
        );
      case 'archivedProjects':
        return <ArchivedProjectsScreen onBack={() => setCurrentView('menu')} />;
      case 'projectSettings':
        return (
          <ProjectSettingsScreen
            projectId={activeProjectId || currentProjectMembership?.projectId || ''}
            onBack={() => setCurrentView('menu')}
            onNavigateToTeam={() => setCurrentView('team')}
            onNavigateToStats={() => setCurrentView('projectStats')}
            onNavigateToExport={() => setCurrentView('export')}
            onNavigateToProductionDetails={() => setCurrentView('productionDetails')}
            onProjectArchived={() => {
              clearProjectSettingsState();
              setCurrentView('menu');
            }}
            onProjectDeleted={() => {
              clearProjectSettingsState();
              onStartNewProject?.();
            }}
          />
        );
      case 'productionDetails':
        return (
          <ProductionDetailsScreen
            projectId={activeProjectId || currentProjectMembership?.projectId || ''}
            onBack={() => setCurrentView('projectSettings')}
          />
        );
      case 'team':
        return (
          <TeamScreen
            projectId={activeProjectId || currentProjectMembership?.projectId || ''}
            canManage={canManage}
            isOwner={isOwner}
            onBack={() => setCurrentView('projectSettings')}
            onInvite={() => setCurrentView('invite')}
          />
        );
      case 'invite':
        return (
          <InviteScreen
            inviteCode={projectSettings?.inviteCode || currentProjectMembership?.projectCode || ''}
            isOwner={isOwner}
            onBack={() => setCurrentView('team')}
          />
        );
      case 'projectStats':
        return (
          <ProjectStatsScreen
            projectId={activeProjectId || currentProjectMembership?.projectId || ''}
            onBack={() => setCurrentView('projectSettings')}
          />
        );
      case 'manualSchedule':
        return (
          <ScheduleScreen
            onBack={() => setCurrentView('projectSettings')}
            onSaved={() => setCurrentView('projectSettings')}
          />
        );
      case 'billing':
        return (
          <BillingDetailsScreen
            onBack={() => setCurrentView(billingReturnView)}
            onUpgrade={() => {
              useAuthStore.getState().setScreen('select-plan');
            }}
          />
        );
      case 'userProfile':
        return (
          <UserProfileScreen
            onBack={() => setCurrentView('menu')}
            onNavigateToBilling={() => { setBillingReturnView('userProfile'); setCurrentView('billing'); }}
          />
        );
      case 'helpGuide':
        return <UserGuide onBack={() => setCurrentView('menu')} />;
      default:
        return <MoreMenu onNavigate={handleViewChange} onNavigateToTab={onNavigateToTab} canManage={canManage} />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {renderView()}
    </div>
  );
}

// Main Menu Component
interface MoreMenuProps {
  onNavigate: (view: MoreView) => void;
  onNavigateToTab?: (tab: NavTab) => void;
  canManage?: boolean;
}

function MoreMenu({ onNavigate, onNavigateToTab, canManage }: MoreMenuProps) {
  const { getMoreMenuItems } = useNavigationStore();
  const moreMenuItems = getMoreMenuItems();

  // Get full config for items in the more menu
  const menuItemConfigs = moreMenuItems
    .map(id => ALL_NAV_ITEMS.find(item => item.id === id))
    .filter(Boolean) as typeof ALL_NAV_ITEMS;

  const getDescription = (id: NavTab): string => {
    switch (id) {
      case 'lookbook': return 'Character looks and styles';
      case 'script': return 'View script PDF with scene search';
      case 'schedule': return 'Shooting schedule day-by-day';
      case 'callsheets': return 'Upload and manage call sheets';
      case 'today': return 'Today\'s shooting schedule';
      case 'breakdown': return 'Scene breakdown by character';
      case 'hours': return 'Timesheet and earnings';
      case 'budget': return 'Expenses overview, scan receipts';
      default: return '';
    }
  };

  const handleItemClick = (id: NavTab) => {
    // For items that have dedicated views in More, navigate to them
    if (['script', 'schedule', 'callsheets'].includes(id)) {
      onNavigate(id as MoreView);
    } else if (onNavigateToTab) {
      // For other items (looks, today, breakdown, hours), navigate to that tab
      onNavigateToTab(id);
    }
  };

  // Filter out 'settings' from menu items as it's been removed
  const filteredMenuConfigs = menuItemConfigs.filter(item => item.id !== 'settings');

  return (
    <>
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center">
            <h1 className="text-lg font-semibold text-text-primary">More</h1>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4">
        <div className="space-y-2">
          {filteredMenuConfigs.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className="w-full card flex items-center gap-4 active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-gold-100/50 flex items-center justify-center text-gold">
                <NavIcon name={item.iconName} className="w-6 h-6" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-sm font-semibold text-text-primary">{item.label}</h3>
                <p className="text-xs text-text-muted">{getDescription(item.id)}</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}

          {/* Settings button for owners/supervisors */}
          {canManage && (
            <button
              onClick={() => onNavigate('projectSettings')}
              className="w-full card flex items-center gap-4 active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-gold-100/50 flex items-center justify-center text-gold">
                <NavIcon name="cog" className="w-6 h-6" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-sm font-semibold text-text-primary">Settings</h3>
                <p className="text-xs text-text-muted">Project settings and management</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Help & Guide */}
          <button
            onClick={() => onNavigate('helpGuide')}
            className="w-full card flex items-center gap-4 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-gold-100/50 flex items-center justify-center text-gold">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-sm font-semibold text-text-primary">Help & Guide</h3>
              <p className="text-xs text-text-muted">How to use the app</p>
            </div>
            <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Edit Menu button at the bottom */}
          <div className="pt-4 border-t border-border mt-4">
            <button
              onClick={() => onNavigate('editMenu')}
              className="w-full card flex items-center gap-4 active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-text-muted">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-sm font-semibold text-text-primary">Edit Menu</h3>
                <p className="text-xs text-text-muted">Customize bottom navigation</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Edit Menu Screen with Drag and Drop
interface EditMenuScreenProps {
  onDone: () => void;
}

function EditMenuScreen({ onDone }: EditMenuScreenProps) {
  const {
    bottomNavItems,
    setBottomNavItems,
    moveToBottomNav,
    moveToMoreMenu,
  } = useNavigationStore();

  const [draggedItem, setDraggedItem] = useState<NavTab | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverSection, setDragOverSection] = useState<'bottom' | 'more' | null>(null);

  // Touch drag state
  const [touchDragActive, setTouchDragActive] = useState(false);
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; item: NavTab } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const bottomSectionRef = useRef<HTMLDivElement>(null);
  const moreSectionRef = useRef<HTMLDivElement>(null);

  // Get items not in bottom nav (for More section)
  const moreItems = ALL_NAV_ITEMS.filter(item => !bottomNavItems.includes(item.id));

  // Get full config for bottom nav items
  const bottomNavConfigs = bottomNavItems
    .map(id => ALL_NAV_ITEMS.find(item => item.id === id))
    .filter(Boolean) as typeof ALL_NAV_ITEMS;

  const handleDragStart = useCallback((item: NavTab) => {
    setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedItem && dragOverIndex !== null && dragOverSection) {
      if (dragOverSection === 'bottom') {
        moveToBottomNav(draggedItem, dragOverIndex);
      } else if (dragOverSection === 'more') {
        moveToMoreMenu(draggedItem);
      }
    }
    setDraggedItem(null);
    setDragOverIndex(null);
    setDragOverSection(null);
    setTouchDragActive(false);
    setTouchPosition(null);
  }, [draggedItem, dragOverIndex, dragOverSection, moveToBottomNav, moveToMoreMenu]);

  const handleDragOver = useCallback((section: 'bottom' | 'more', index: number) => {
    setDragOverSection(section);
    setDragOverIndex(index);
  }, []);

  // Calculate which drop zone the touch is over
  const calculateDropZone = useCallback((touchY: number) => {
    // Check bottom section items
    const bottomSection = bottomSectionRef.current;
    const moreSection = moreSectionRef.current;

    if (bottomSection) {
      const bottomRect = bottomSection.getBoundingClientRect();
      if (touchY >= bottomRect.top && touchY <= bottomRect.bottom) {
        // Find which item we're over
        let foundIndex = bottomNavConfigs.length; // default to end
        for (let i = 0; i < bottomNavConfigs.length; i++) {
          const itemEl = itemRefs.current.get(`bottom-${bottomNavConfigs[i].id}`);
          if (itemEl) {
            const itemRect = itemEl.getBoundingClientRect();
            const itemMiddle = itemRect.top + itemRect.height / 2;
            if (touchY < itemMiddle) {
              foundIndex = i;
              break;
            }
          }
        }
        setDragOverSection('bottom');
        setDragOverIndex(foundIndex);
        return;
      }
    }

    if (moreSection) {
      const moreRect = moreSection.getBoundingClientRect();
      if (touchY >= moreRect.top && touchY <= moreRect.bottom) {
        setDragOverSection('more');
        setDragOverIndex(0);
        return;
      }
    }

    // Not over any section
    setDragOverSection(null);
    setDragOverIndex(null);
  }, [bottomNavConfigs]);

  // Touch handlers for mobile drag
  const handleTouchStart = useCallback((e: React.TouchEvent, item: NavTab) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      item,
    };

    // Long press to start drag
    longPressTimerRef.current = setTimeout(() => {
      setDraggedItem(item);
      setTouchDragActive(true);
      setTouchPosition({ x: touch.clientX, y: touch.clientY });
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 200);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];

    if (!touchStartRef.current) return;

    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // If not yet dragging and moved too much, cancel long press
    if (!touchDragActive && (deltaX > 10 || deltaY > 10) && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      return;
    }

    // If actively dragging, update position and calculate drop zone
    if (touchDragActive) {
      e.preventDefault();
      setTouchPosition({ x: touch.clientX, y: touch.clientY });
      calculateDropZone(touch.clientY);
    }
  }, [touchDragActive, calculateDropZone]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;

    if (touchDragActive) {
      handleDragEnd();
    }
  }, [touchDragActive, handleDragEnd]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
    setDraggedItem(null);
    setDragOverIndex(null);
    setDragOverSection(null);
    setTouchDragActive(false);
    setTouchPosition(null);
  }, []);

  // Handle touch move on overlay (non-passive)
  const handleOverlayTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
    calculateDropZone(touch.clientY);
  }, [calculateDropZone]);

  const handleOverlayTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleTouchEnd();
  }, [handleTouchEnd]);

  // Reorder within bottom nav
  const handleReorderBottomNav = (fromIndex: number, toIndex: number) => {
    const newItems = [...bottomNavItems];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, removed);
    setBottomNavItems(newItems);
  };

  // Register item ref
  const setItemRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) {
      itemRefs.current.set(key, el);
    } else {
      itemRefs.current.delete(key);
    }
  }, []);

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text-primary">Customize Menu</h1>
            <button
              onClick={onDone}
              className="px-4 py-1.5 text-sm font-semibold text-gold active:opacity-70 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4">
        <p className="text-sm text-text-muted mb-6">
          Drag items to reorder. Up to {MAX_BOTTOM_NAV_ITEMS} appear in bottom nav.
        </p>

        {/* Bottom Nav Section */}
        <div className="mb-6" ref={bottomSectionRef}>
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            BOTTOM NAV
          </h2>
          <div className="space-y-2">
            {bottomNavConfigs.map((item, index) => (
              <DraggableItem
                key={item.id}
                item={item}
                index={index}
                section="bottom"
                isDragging={draggedItem === item.id}
                isDragOver={dragOverSection === 'bottom' && dragOverIndex === index}
                onDragStart={() => handleDragStart(item.id)}
                onDragEnd={handleDragEnd}
                onDragOver={() => handleDragOver('bottom', index)}
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
                onMoveUp={index > 0 ? () => handleReorderBottomNav(index, index - 1) : undefined}
                onMoveDown={index < bottomNavConfigs.length - 1 ? () => handleReorderBottomNav(index, index + 1) : undefined}
                onRemove={bottomNavConfigs.length > 1 ? () => moveToMoreMenu(item.id) : undefined}
                refCallback={(el) => setItemRef(`bottom-${item.id}`, el)}
              />
            ))}

            {/* Drop zone when bottom nav has less than 3 items */}
            {bottomNavItems.length < MAX_BOTTOM_NAV_ITEMS && (
              <div
                className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                  dragOverSection === 'bottom' && dragOverIndex === bottomNavItems.length
                    ? 'border-gold bg-gold/5'
                    : 'border-border'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  handleDragOver('bottom', bottomNavItems.length);
                }}
                onDrop={handleDragEnd}
              >
                <span className="text-sm text-text-light">Drop here to add</span>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-6" />

        {/* More Menu Section */}
        <div ref={moreSectionRef}>
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            MORE MENU
          </h2>
          <div className="space-y-2">
            {moreItems.map((item, index) => (
              <DraggableItem
                key={item.id}
                item={item}
                index={index}
                section="more"
                isDragging={draggedItem === item.id}
                isDragOver={dragOverSection === 'more' && dragOverIndex === index}
                onDragStart={() => handleDragStart(item.id)}
                onDragEnd={handleDragEnd}
                onDragOver={() => handleDragOver('more', index)}
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
                onAddToNav={bottomNavItems.length < MAX_BOTTOM_NAV_ITEMS ? () => moveToBottomNav(item.id, bottomNavItems.length) : undefined}
                refCallback={(el) => setItemRef(`more-${item.id}`, el)}
              />
            ))}

            {moreItems.length === 0 && (
              <div className="text-center py-6 text-text-light text-sm">
                All items are in the bottom nav
              </div>
            )}
          </div>
        </div>

        {/* Touch overlay to capture touch events during drag (prevents scroll) */}
        {/* z-30 to stay below BottomNav (z-40) so users can still navigate away */}
        {touchDragActive && (
          <div
            className="fixed inset-0 z-30"
            style={{ touchAction: 'none' }}
            onTouchMove={handleOverlayTouchMove}
            onTouchEnd={handleOverlayTouchEnd}
            onTouchCancel={handleTouchCancel}
          />
        )}

        {/* Floating drag indicator for touch */}
        {touchDragActive && touchPosition && draggedItem && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: touchPosition.x - 100,
              top: touchPosition.y - 30,
            }}
          >
            <div className="bg-gold text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 opacity-90">
              <NavIcon
                name={ALL_NAV_ITEMS.find(i => i.id === draggedItem)?.iconName || 'ellipsis'}
                className="w-5 h-5"
              />
              <span className="text-sm font-medium">
                {ALL_NAV_ITEMS.find(i => i.id === draggedItem)?.label}
              </span>
            </div>
            <div className="text-xs text-center mt-1 text-gold font-medium">
              {dragOverSection === 'bottom' ? 'Drop in Bottom Nav' : dragOverSection === 'more' ? 'Drop in More Menu' : 'Drag to reorder'}
            </div>
          </div>
        )}

        {/* More button notice */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <NavIcon name="ellipsis" className="w-5 h-5" />
            <span><strong>More</strong> button is always last and cannot be moved.</span>
          </div>
        </div>
      </div>
    </>
  );
}

// Draggable Item Component
interface DraggableItemProps {
  item: (typeof ALL_NAV_ITEMS)[number];
  index: number;
  section: 'bottom' | 'more';
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  onAddToNav?: () => void;
  refCallback?: (el: HTMLDivElement | null) => void;
}

function DraggableItem({
  item,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAddToNav,
  refCallback,
}: DraggableItemProps) {
  return (
    <div
      ref={refCallback}
      className={`card flex items-center gap-3 transition-all cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isDragOver ? 'ring-2 ring-gold ring-offset-2' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {/* Drag handle */}
      <div className="text-text-light touch-none">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        </svg>
      </div>

      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-gold-100/50 flex items-center justify-center text-gold">
        <NavIcon name={item.iconName} className="w-5 h-5" />
      </div>

      {/* Label */}
      <span className="flex-1 text-sm font-medium text-text-primary">
        {item.label}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {onMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-text-light"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}
        {onMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-text-light"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-text-light hover:text-error"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {onAddToNav && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToNav(); }}
            className="p-1.5 rounded-lg hover:bg-green-50 text-text-light hover:text-green-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Script Viewer Component
interface ViewerProps {
  onBack: () => void;
}

function ScriptViewer({ onBack }: ViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'pdf'>('full');
  const { currentProject, compareScriptAmendment, applyScriptAmendment } = useProjectStore();
  const sceneRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [amendmentResult, setAmendmentResult] = useState<AmendmentResult | null>(null);

  // Handle revised script upload
  const handleRevisedScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Parse the new script using fast parsing
      const parsedScript = await parseScenesFast(file);

      // Compare against existing breakdown
      const result = compareScriptAmendment(parsedScript.scenes);
      if (result) {
        setAmendmentResult(result);
      }
    } catch (error) {
      console.error('Error processing revised script:', error);
      alert('Failed to process the script. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle applying amendment changes
  const handleApplyAmendment = (options: {
    includeNew: boolean;
    includeModified: boolean;
    includeDeleted: boolean;
  }) => {
    if (amendmentResult) {
      applyScriptAmendment(amendmentResult, options);
      setAmendmentResult(null);
    }
  };

  // Sort scenes by scene number
  const sortedScenes = useMemo(() => {
    if (!currentProject?.scenes) return [];
    return [...currentProject.scenes].sort((a, b) =>
      a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true })
    );
  }, [currentProject?.scenes]);

  // Check if we have script content
  const hasScriptContent = sortedScenes.some(s => s.scriptContent);

  // Filter scenes by search query
  const filteredScenes = useMemo(() => {
    if (!searchQuery.trim()) return sortedScenes;
    const query = searchQuery.toLowerCase();
    return sortedScenes.filter(scene =>
      scene.scriptContent?.toLowerCase().includes(query) ||
      scene.slugline.toLowerCase().includes(query) ||
      scene.synopsis?.toLowerCase().includes(query)
    );
  }, [sortedScenes, searchQuery]);

  // Scroll to scene when selected
  useEffect(() => {
    if (selectedScene) {
      const sceneEl = sceneRefs.current.get(selectedScene);
      if (sceneEl) {
        sceneEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Clear selection after scroll
      setTimeout(() => setSelectedScene(null), 500);
    }
  }, [selectedScene]);

  // Highlight search matches in text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-gold/30 text-text-primary px-0.5 rounded">{part}</mark>
        : part
    );
  };

  return (
    <>
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-text-primary">Script</h1>
            {hasScriptContent && (
              <>
                <span className="ml-auto text-xs text-text-muted">
                  {sortedScenes.length} scenes
                </span>
                {/* Upload Revised Script button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="ml-2 px-2 py-1 text-[10px] font-medium text-gold border border-gold rounded-lg active:bg-gold/10 transition-colors disabled:opacity-50"
                >
                  {isUploading ? 'Processing...' : 'Upload New Draft'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.fdx,.txt,.fountain"
                  onChange={handleRevisedScriptUpload}
                  className="hidden"
                />
              </>
            )}
          </div>

          {hasScriptContent && (
            <>
              {/* View mode toggle */}
              <div className="px-4 pb-3 flex gap-2">
                <button
                  onClick={() => setViewMode('full')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    viewMode === 'full'
                      ? 'bg-gold text-white'
                      : 'bg-gray-100 text-text-muted'
                  }`}
                >
                  Full Script
                </button>
                <button
                  onClick={() => setViewMode('pdf')}
                  disabled={!currentProject?.scriptPdfData}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    viewMode === 'pdf'
                      ? 'bg-gold text-white'
                      : 'bg-gray-100 text-text-muted'
                  } ${!currentProject?.scriptPdfData ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  PDF Script
                </button>
              </div>

              {/* Search and jump controls - only show in Full Script mode */}
              {viewMode === 'full' && (
                <>
                  <div className="px-4 pb-2 flex gap-2">
                    <div className="flex-1 relative">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search script..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card text-text-primary"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text-muted"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <select
                      value={selectedScene || ''}
                      onChange={(e) => setSelectedScene(e.target.value || null)}
                      className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-text-primary min-w-[100px]"
                    >
                      <option value="">Jump to...</option>
                      {sortedScenes.map((scene) => (
                        <option key={scene.sceneNumber} value={scene.sceneNumber}>
                          Scene {scene.sceneNumber}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search results count */}
                  {searchQuery && (
                    <div className="px-4 pb-2">
                      <span className="text-xs text-text-muted">
                        {filteredScenes.length} scene{filteredScenes.length !== 1 ? 's' : ''} found
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mobile-container pb-safe-bottom">
        {!hasScriptContent ? (
          /* Empty State */
          <div className="px-4 py-8">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <NavIcon name="document" className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">No Script Content</h3>
              <p className="text-sm text-text-muted text-center mb-6">
                Upload a script (PDF, FDX, or Fountain) to view it here
              </p>
              <button className="px-4 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform">
                Upload Script
              </button>
            </div>
          </div>
        ) : viewMode === 'full' ? (
          /* Full Script View */
          <div className="px-4 py-4">
            {filteredScenes.map((scene) => (
              <div
                key={scene.id}
                ref={(el) => {
                  if (el) sceneRefs.current.set(scene.sceneNumber, el);
                }}
                className="mb-6"
              >
                {/* Scene header */}
                <div className="sticky top-[120px] z-10 bg-gold/10 backdrop-blur-sm border-l-4 border-gold px-3 py-2 mb-2 rounded-r-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gold">
                      SCENE {scene.sceneNumber}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      scene.intExt === 'INT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {scene.intExt}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-text-muted">
                      {scene.timeOfDay}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-text-primary mt-1">
                    {scene.slugline}
                  </p>
                  {scene.synopsis && (
                    <p className="text-xs text-text-muted italic mt-1">
                      {highlightText(scene.synopsis, searchQuery)}
                    </p>
                  )}
                </div>

                {/* Script content */}
                {scene.scriptContent ? (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-text-primary leading-relaxed pl-3">
                    {searchQuery
                      ? highlightText(scene.scriptContent, searchQuery)
                      : scene.scriptContent}
                  </pre>
                ) : (
                  <p className="text-sm text-text-muted italic pl-3">
                    No script content available for this scene
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* PDF Script View */
          <div className="h-[calc(100vh-180px)]">
            {currentProject?.scriptPdfData ? (
              <iframe
                src={currentProject.scriptPdfData}
                className="w-full h-full border-0"
                title="Script PDF"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full px-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-1">No PDF Available</h3>
                <p className="text-sm text-text-muted text-center">
                  Upload a PDF script to view the original document here
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Amendment Review Modal */}
      {amendmentResult && (
        <AmendmentReviewModal
          amendmentResult={amendmentResult}
          onApply={handleApplyAmendment}
          onCancel={() => setAmendmentResult(null)}
        />
      )}
    </>
  );
}

// Schedule Viewer Component
function ScheduleViewer({ onBack }: ViewerProps) {
  const {
    schedule,
    isUploading,
    uploadError,
    uploadScheduleStage1,
    uploadRevisionStage1,
    startRevisionStage2Processing,
    compareAmendment,
    applyAmendment,
    clearPendingSchedule,
    clearSchedule,
    isProcessingStage2,
    stage2Progress,
    stage2Error,
    startStage2Processing,
    getCastNamesForNumbers,
  } = useScheduleStore();
  const { currentProject, syncCastDataFromSchedule } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const revisionInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'pdf' | 'breakdown'>('breakdown');
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [scheduleAmendmentResult, setScheduleAmendmentResult] = useState<ScheduleAmendmentResult | null>(null);
  const [isProcessingRevision, setIsProcessingRevision] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      try {
        // Stage 1: Parse cast list for character identification
        await uploadScheduleStage1(file);
        // Automatically start Stage 2 processing in the background
        setViewMode('breakdown');
        await startStage2Processing();
        // Auto-sync after processing completes
        if (currentProject) {
          handleSyncCastData({ autoConfirm: true });
        }
      } catch (err) {
        console.error('Failed to upload schedule:', err);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRevisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    try {
      setIsProcessingRevision(true);
      // Stage 1: Parse the new schedule
      await uploadRevisionStage1(file);
      // Stage 2: Process with AI to extract scene data
      await startRevisionStage2Processing();
      // Compare against existing schedule
      const result = compareAmendment();
      if (result) {
        setScheduleAmendmentResult(result);
      }
      setIsProcessingRevision(false);
    } catch (err) {
      console.error('Failed to process schedule revision:', err);
      setIsProcessingRevision(false);
      clearPendingSchedule();
    }

    if (revisionInputRef.current) {
      revisionInputRef.current.value = '';
    }
  };

  const handleApplyScheduleAmendment = (options: {
    includeAddedScenes: boolean;
    includeRemovedScenes: boolean;
    includeMovedScenes: boolean;
    includeCastChanges: boolean;
    includeTimingChanges: boolean;
  }) => {
    if (!scheduleAmendmentResult) return;
    applyAmendment(scheduleAmendmentResult, options);
    setScheduleAmendmentResult(null);
    // Auto-sync cast data after amendment
    if (currentProject) {
      handleSyncCastData({ autoConfirm: true });
    }
  };

  const handleCancelScheduleAmendment = () => {
    setScheduleAmendmentResult(null);
    clearPendingSchedule();
  };

  const handleDelete = () => {
    clearSchedule();
    setShowDeleteConfirm(false);
    setViewMode('pdf');
  };

  const handleProcessSchedule = async () => {
    setViewMode('breakdown');
    await startStage2Processing();
    // Auto-sync after processing completes
    if (currentProject) {
      handleSyncCastData({ autoConfirm: true });
    }
  };

  const handleSyncCastData = (options?: { createMissingCharacters?: boolean; overwriteExisting?: boolean; autoConfirm?: boolean }) => {
    // Get fresh schedule data from store (not from hook, which may be stale after async operations)
    const freshSchedule = useScheduleStore.getState().schedule;
    if (!freshSchedule || !currentProject) return;

    try {
      const result = syncCastDataFromSchedule(freshSchedule, {
        createMissingCharacters: options?.createMissingCharacters ?? true,
        overwriteExisting: options?.overwriteExisting ?? false,
        autoConfirm: options?.autoConfirm ?? true,
      });

      if (result) {
        console.log('[ScheduleViewer] Cast data synced:', {
          scenesUpdated: result.scenesUpdated,
          charactersCreated: result.charactersCreated,
        });
        if (result.errors.length > 0) {
          console.warn('[ScheduleViewer] Sync had some errors:', result.errors);
        }
      }
    } catch (error) {
      console.error('[ScheduleViewer] Failed to sync cast data:', error);
    }
  };

  // Auto-start processing if schedule has no breakdown data (e.g., after page refresh during processing)
  useEffect(() => {
    if (
      schedule &&
      !isProcessingStage2 &&
      !isProcessingRevision &&
      (!schedule.days || schedule.days.length === 0) &&
      schedule.rawText // Has raw text available for processing
    ) {
      console.log('[ScheduleViewer] Auto-starting processing for unprocessed schedule');
      handleProcessSchedule();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const hasBreakdownData = schedule?.days && schedule.days.length > 0;

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-text-primary">Schedule</h1>
            </div>
            {schedule ? (
              <div className="flex items-center gap-2">
                {/* Upload New Draft button - shown when breakdown data exists */}
                {hasBreakdownData && (
                  <button
                    onClick={() => revisionInputRef.current?.click()}
                    disabled={isUploading || isProcessingStage2 || isProcessingRevision}
                    className="px-2 py-1 text-[10px] font-medium text-gold border border-gold rounded-lg active:bg-gold/10 transition-colors disabled:opacity-50"
                  >
                    {isProcessingRevision ? 'Processing...' : 'Upload New Draft'}
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-red-500 active:opacity-70 transition-opacity touch-manipulation"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gold active:opacity-70 transition-opacity touch-manipulation"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gold active:opacity-70 transition-opacity touch-manipulation"
                disabled={isUploading}
              >
                {isUploading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {/* View toggle - Breakdown / PDF */}
          {schedule && (
            <div className="px-4 pb-3 flex gap-1 bg-card">
              <button
                onClick={() => setViewMode('breakdown')}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                  viewMode === 'breakdown'
                    ? 'gold-gradient text-white'
                    : 'bg-gray-100 text-text-muted'
                }`}
              >
                Breakdown
              </button>
              <button
                onClick={() => setViewMode('pdf')}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                  viewMode === 'pdf'
                    ? 'gold-gradient text-white'
                    : 'bg-gray-100 text-text-muted'
                }`}
              >
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={revisionInputRef}
        type="file"
        accept=".pdf"
        onChange={handleRevisionUpload}
        className="hidden"
      />

      <div className="mobile-container px-4 py-4">
        {uploadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{uploadError}</p>
          </div>
        )}

        {stage2Error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{stage2Error}</p>
            <button
              onClick={handleProcessSchedule}
              className="mt-2 text-xs text-red-700 underline"
            >
              Retry Processing
            </button>
          </div>
        )}

        {!schedule ? (
          /* Empty state - No schedule uploaded */
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <NavIcon name="schedule" className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">No Schedule Uploaded</h3>
            <p className="text-sm text-text-muted text-center mb-6 max-w-xs">
              Upload your production schedule PDF to view it here
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-6 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform disabled:opacity-50 mb-6"
            >
              {isUploading ? 'Uploading...' : 'Upload Schedule PDF'}
            </button>
            {/* Background processing note */}
            <div className="rounded-xl bg-gold/5 border border-gold/20 p-4 max-w-xs">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-text-secondary">
                  <p className="font-medium mb-1">Automatic Processing</p>
                  <p>The schedule will process automatically in the background. Characters will be confirmed within a few minutes.</p>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'pdf' ? (
          /* Schedule PDF Viewer - full page */
          schedule.pdfUri ? (
            <iframe
              src={schedule.pdfUri}
              className="w-full h-[calc(100vh-180px)] border-0 -mx-4 -mt-4"
              style={{ width: 'calc(100% + 2rem)' }}
              title="Schedule PDF"
            />
          ) : (
            <div className="card">
              <p className="text-sm text-text-muted text-center py-4">
                PDF preview not available
              </p>
            </div>
          )
        ) : (
          /* Breakdown View */
          <div className="space-y-4">
            {/* Processing progress indicator (hide when revision indicator is active) */}
            {isProcessingStage2 && !isProcessingRevision && (
              <div className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <svg className="w-5 h-5 animate-spin text-gold" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-text-primary block">
                      {stage2Progress.message || `Processing Day ${stage2Progress.current} of ${stage2Progress.total}...`}
                    </span>
                    <span className="text-xs text-text-muted">
                      You can navigate away - processing continues in the background
                    </span>
                  </div>
                </div>
                {stage2Progress.total > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div
                      className="gold-gradient h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(stage2Progress.current / stage2Progress.total) * 100}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-text-muted">
                  Characters will be automatically confirmed once processing completes.
                </p>
              </div>
            )}

            {/* Revision processing indicator */}
            {isProcessingRevision && (
              <div className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <svg className="w-5 h-5 animate-spin text-gold" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div>
                    <span className="text-sm font-medium text-text-primary block">
                      Processing New Draft...
                    </span>
                    <span className="text-xs text-text-muted">
                      {stage2Progress.message || (stage2Progress.total > 0
                        ? `Day ${stage2Progress.current} of ${stage2Progress.total}`
                        : 'Parsing schedule PDF')}
                    </span>
                  </div>
                </div>
                {stage2Progress.total > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="gold-gradient h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(stage2Progress.current / stage2Progress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Pending state - schedule uploaded, processing starting automatically */}
            {!hasBreakdownData && !isProcessingStage2 && !isProcessingRevision && schedule && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gold animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-1">Processing Schedule</h3>
                <p className="text-sm text-text-muted text-center mb-6 max-w-xs">
                  {schedule.totalDays > 0
                    ? `Preparing to process ${schedule.totalDays} shooting day${schedule.totalDays !== 1 ? 's' : ''}...`
                    : 'Starting schedule processing...'}
                </p>
                <p className="text-xs text-text-muted text-center max-w-xs">
                  Characters will be automatically synced to your breakdown once processing completes.
                </p>
              </div>
            )}

            {/* Breakdown data - shooting days */}
            {hasBreakdownData && schedule.days.map((day) => (
              <div key={day.dayNumber} className="card overflow-hidden">
                {/* Day header - expandable */}
                <button
                  onClick={() => setExpandedDay(expandedDay === day.dayNumber ? null : day.dayNumber)}
                  className="w-full p-3 flex items-center justify-between text-left active:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        Day {day.dayNumber}
                      </span>
                      {day.date && (
                        <span className="text-xs text-text-muted">
                          {day.dayOfWeek ? `${day.dayOfWeek}, ` : ''}{day.date}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {day.location && (
                        <span className="text-xs text-text-muted truncate">{day.location}</span>
                      )}
                      <span className="text-xs text-gold font-medium">
                        {day.scenes.length} scene{day.scenes.length !== 1 ? 's' : ''}
                      </span>
                      {day.totalPages && (
                        <span className="text-xs text-text-muted">{day.totalPages} pages</span>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${
                      expandedDay === day.dayNumber ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded day - scene list */}
                {expandedDay === day.dayNumber && (
                  <div className="border-t border-border">
                    {day.notes && day.notes.length > 0 && (
                      <div className="px-3 py-2 bg-amber-50 border-b border-border">
                        {day.notes.map((note, i) => (
                          <span key={i} className="text-xs text-amber-700 block">{note}</span>
                        ))}
                      </div>
                    )}
                    {day.scenes.map((scene, idx) => (
                      <div
                        key={`${scene.sceneNumber}-${idx}`}
                        className={`px-3 py-2.5 ${idx > 0 ? 'border-t border-border/50' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Scene number badge */}
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex flex-col items-center justify-center">
                            <span className="text-[10px] text-text-muted leading-none">Sc</span>
                            <span className="text-xs font-bold text-text-primary leading-tight">{scene.sceneNumber}</span>
                          </div>
                          {/* Scene details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                                scene.intExt === 'EXT' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {scene.intExt}
                              </span>
                              <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                                scene.dayNight.toLowerCase().includes('night') || scene.dayNight.startsWith('N')
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {scene.dayNight}
                              </span>
                              {scene.pages && (
                                <span className="text-[10px] text-text-muted">{scene.pages} pgs</span>
                              )}
                              {scene.estimatedTime && (
                                <span className="text-[10px] text-text-muted ml-auto">{scene.estimatedTime}</span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-text-primary mt-0.5 truncate">
                              {scene.setLocation}
                            </p>
                            {scene.description && (
                              <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                                {scene.description}
                              </p>
                            )}
                            {/* Cast numbers */}
                            {scene.castNumbers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {getCastNamesForNumbers(scene.castNumbers).map((name, ci) => (
                                  <span key={ci} className="text-[10px] bg-gray-100 text-text-muted px-1.5 py-0.5 rounded">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {day.scenes.length === 0 && (
                      <div className="px-3 py-4 text-center">
                        <p className="text-xs text-text-muted">No scenes extracted for this day</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl p-4 max-w-sm w-full">
            <h3 className="text-base font-semibold text-text-primary mb-2">Delete Schedule?</h3>
            <p className="text-sm text-text-muted mb-4">
              This will remove the schedule and all cross-reference data. You can upload a new schedule at any time.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-button text-sm font-medium text-text-primary bg-gray-100 active:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 rounded-button text-sm font-medium text-white bg-red-500 active:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Amendment Review Modal */}
      {scheduleAmendmentResult && (
        <ScheduleAmendmentModal
          amendmentResult={scheduleAmendmentResult}
          getCastNamesForNumbers={getCastNamesForNumbers}
          onApply={handleApplyScheduleAmendment}
          onCancel={handleCancelScheduleAmendment}
        />
      )}
    </>
  );
}

// Call Sheet Archive Component
function CallSheetArchive({ onBack }: ViewerProps) {
  const { callSheets, activeCallSheetId, setActiveCallSheet, uploadCallSheet, deleteCallSheet, isUploading, uploadError } = useCallSheetStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      try {
        await uploadCallSheet(file);
      } catch (err) {
        console.error('Failed to upload call sheet:', err);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSetActive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveCallSheet(id);
  };

  const handleDelete = (id: string) => {
    deleteCallSheet(id);
    setShowDeleteConfirm(null);
  };

  const selectedCallSheet = selectedSheet ? callSheets.find(cs => cs.id === selectedSheet) : null;

  return (
    <>
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-text-primary">Call Sheets</h1>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gold active:opacity-70 transition-opacity touch-manipulation"
              disabled={isUploading}
            >
              {isUploading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="mobile-container px-4 py-4">
        {uploadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{uploadError}</p>
          </div>
        )}

        {callSheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <NavIcon name="document" className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">No Call Sheets</h3>
            <p className="text-sm text-text-muted text-center mb-6">
              Upload your daily call sheet PDFs to track scenes and times
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-6 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload Call Sheet PDF'}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {callSheets.map((sheet) => (
                <div
                  key={sheet.id}
                  onClick={() => setSelectedSheet(sheet.id)}
                  className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      sheet.id === activeCallSheetId ? 'bg-gold-100' : 'bg-gray-100'
                    }`}>
                      <NavIcon name="document" className={`w-5 h-5 ${
                        sheet.id === activeCallSheetId ? 'text-gold' : 'text-text-light'
                      }`} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-text-primary">
                        Day {sheet.productionDay}
                        {sheet.totalProductionDays && ` of ${sheet.totalProductionDays}`}
                      </h3>
                      <p className="text-xs text-text-muted">
                        {formatShortDate(sheet.date)} • {sheet.scenes.length} scene{sheet.scenes.length !== 1 ? 's' : ''}
                        {sheet.unitCallTime && ` • Call: ${sheet.unitCallTime}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sheet.id === activeCallSheetId ? (
                      <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-green-100 text-green-600">
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={(e) => handleSetActive(sheet.id, e)}
                        className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-gold-100 text-gold hover:bg-gold-200 transition-colors"
                      >
                        Set Active
                      </button>
                    )}
                    <svg className="w-4 h-4 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-6 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : 'Upload Call Sheet PDF'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Call Sheet PDF Viewer Modal */}
      {selectedCallSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setSelectedSheet(null)}
        >
          {/* Header */}
          <div
            className="flex-shrink-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between safe-top"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Day {selectedCallSheet.productionDay} Call Sheet
              </h2>
              <p className="text-xs text-text-muted">{formatShortDate(selectedCallSheet.date)}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Delete button */}
              {showDeleteConfirm === selectedCallSheet.id ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="px-3 py-1.5 text-xs text-text-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleDelete(selectedCallSheet.id);
                      setSelectedSheet(null);
                    }}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(selectedCallSheet.id)}
                  className="p-2 text-red-400 hover:text-red-500"
                  title="Delete call sheet"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              )}
              {/* Close button */}
              <button
                onClick={() => setSelectedSheet(null)}
                className="p-2 text-text-muted hover:text-text-primary"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {selectedCallSheet.pdfUri ? (
              <iframe
                src={selectedCallSheet.pdfUri}
                className="w-full h-full border-0"
                title={`Day ${selectedCallSheet.productionDay} Call Sheet`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">PDF Not Available</h3>
                <p className="text-sm text-gray-400 mb-4">
                  The original PDF for this call sheet was not saved.
                </p>
                <p className="text-xs text-gray-500">
                  Day {selectedCallSheet.productionDay} • {selectedCallSheet.scenes.length} scenes • Unit call {selectedCallSheet.unitCallTime}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Archived Projects Screen
interface ArchivedProjectsScreenProps {
  onBack: () => void;
}

function ArchivedProjectsScreen({ onBack }: ArchivedProjectsScreenProps) {
  const { getArchivedProjects, loadArchivedProject } = useProjectStore();
  const archivedProjects = getArchivedProjects();

  return (
    <>
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-text-primary">Archived Projects</h1>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4">
        {archivedProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">No Archived Projects</h3>
            <p className="text-sm text-text-muted">
              Wrapped projects will appear here after {PROJECT_RETENTION_DAYS} days.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {archivedProjects.map((project) => (
              <div key={project.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{project.name}</h3>
                    <p className="text-xs text-text-muted">
                      {project.scenesCount} scenes • {project.charactersCount} characters • {project.photosCount} photos
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-medium rounded-full ${
                    project.state === 'wrapped'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {project.state === 'wrapped' ? 'Wrapped' : 'Archived'}
                  </span>
                </div>

                {project.wrappedAt && (
                  <p className="text-xs text-text-light mb-3">
                    Wrapped {formatShortDate(new Date(project.wrappedAt).toISOString().split('T')[0])}
                    {project.daysUntilDeletion > 0 && ` • ${project.daysUntilDeletion} days until deletion`}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => loadArchivedProject(project.id)}
                    className="flex-1 px-3 py-2 text-sm font-medium rounded-button bg-gold/10 text-gold active:scale-[0.98] transition-transform"
                  >
                    Restore Project
                  </button>
                  <button
                    className="px-3 py-2 text-sm font-medium rounded-button bg-gray-100 text-text-secondary active:scale-[0.98] transition-transform"
                  >
                    Export
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
