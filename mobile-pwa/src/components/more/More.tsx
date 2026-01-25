import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useNavigationStore, MAX_BOTTOM_NAV_ITEMS } from '@/stores/navigationStore';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useChatStore } from '@/stores/chatStore';
import { useTimesheetStore } from '@/stores/timesheetStore';
import { useAuthStore } from '@/stores/authStore';
import { clearAllData as clearIndexedDBData } from '@/db';
import { NavIcon } from '@/components/navigation/BottomNav';
import { formatShortDate } from '@/utils/helpers';
import type { NavTab, SceneDiscrepancy, ScheduleDay } from '@/types';
import { ALL_NAV_ITEMS, PROJECT_RETENTION_DAYS, canManageProject } from '@/types';
import { ProjectExportScreen } from './ProjectExportScreen';
import { SubscriptionSection } from '@/components/subscription';
import {
  TeamScreen,
  InviteScreen,
  ProjectStatsScreen,
  ScheduleScreen,
  ProjectSettingsScreen,
} from '@/components/project-settings';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';

type MoreView = 'menu' | 'script' | 'schedule' | 'callsheets' | 'settings' | 'editMenu' | 'export' | 'archivedProjects' | 'projectSettings' | 'team' | 'invite' | 'projectStats' | 'manualSchedule';

interface MoreProps {
  onNavigateToTab?: (tab: NavTab) => void;
  onStartNewProject?: () => void;
  initialView?: NavTab;
  resetKey?: number;
}

export function More({ onNavigateToTab, onStartNewProject, initialView, resetKey }: MoreProps) {
  // Determine initial view based on the tab that was navigated to
  const getInitialView = (): MoreView => {
    if (initialView && ['script', 'schedule', 'callsheets', 'settings'].includes(initialView)) {
      return initialView as MoreView;
    }
    return 'menu';
  };

  const [currentView, setCurrentView] = useState<MoreView>(getInitialView);
  const { isEditMenuOpen, closeEditMenu, openEditMenu } = useNavigationStore();
  const { projectMemberships, user } = useAuthStore();
  const { projectSettings, clearState: clearProjectSettingsState } = useProjectSettingsStore();

  // Get current project membership
  const currentProjectMembership = projectMemberships.length > 0 ? projectMemberships[0] : null;
  const isOwner = currentProjectMembership?.role === 'owner';
  const canManage = currentProjectMembership && user ? canManageProject(user.tier, {
    isOwner,
    role: isOwner ? 'designer' : currentProjectMembership.role === 'supervisor' ? 'supervisor' : 'floor',
  }) : false;

  // Update view when initialView prop changes or resetKey changes (e.g., user taps same tab again)
  useEffect(() => {
    if (initialView && ['script', 'schedule', 'callsheets', 'settings'].includes(initialView)) {
      setCurrentView(initialView as MoreView);
    } else if (initialView === 'more') {
      setCurrentView('menu');
    }
  }, [initialView, resetKey]);

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
    if (initialView && ['script', 'schedule', 'callsheets', 'settings'].includes(initialView)) {
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
      case 'settings':
        return (
          <Settings
            onBack={handleBack}
            onStartNewProject={onStartNewProject}
            onNavigateToExport={() => setCurrentView('export')}
            onNavigateToArchived={() => setCurrentView('archivedProjects')}
            onNavigateToProjectSettings={() => setCurrentView('projectSettings')}
            onNavigateToTeam={() => setCurrentView('team')}
            onNavigateToInvite={() => setCurrentView('invite')}
            onNavigateToStats={() => setCurrentView('projectStats')}
            canManage={canManage}
          />
        );
      case 'editMenu':
        return <EditMenuScreen onDone={handleEditMenuClose} />;
      case 'export':
        return <ProjectExportScreen onBack={() => setCurrentView('settings')} onExportComplete={() => setCurrentView('settings')} />;
      case 'archivedProjects':
        return <ArchivedProjectsScreen onBack={() => setCurrentView('settings')} />;
      case 'projectSettings':
        return (
          <ProjectSettingsScreen
            projectId={currentProjectMembership?.projectId || ''}
            onBack={() => setCurrentView('settings')}
            onNavigateToSchedule={() => setCurrentView('manualSchedule')}
            onProjectArchived={() => {
              clearProjectSettingsState();
              setCurrentView('settings');
            }}
            onProjectDeleted={() => {
              clearProjectSettingsState();
              onStartNewProject?.();
            }}
          />
        );
      case 'team':
        return (
          <TeamScreen
            projectId={currentProjectMembership?.projectId || ''}
            canManage={canManage}
            isOwner={isOwner}
            onBack={() => setCurrentView('settings')}
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
            projectId={currentProjectMembership?.projectId || ''}
            onBack={() => setCurrentView('settings')}
          />
        );
      case 'manualSchedule':
        return (
          <ScheduleScreen
            onBack={() => setCurrentView('projectSettings')}
            onSaved={() => setCurrentView('projectSettings')}
          />
        );
      default:
        return <MoreMenu onNavigate={handleViewChange} onNavigateToTab={onNavigateToTab} />;
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
}

function MoreMenu({ onNavigate, onNavigateToTab }: MoreMenuProps) {
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
      case 'settings': return 'Rate card, sync, preferences';
      case 'today': return 'Today\'s shooting schedule';
      case 'breakdown': return 'Scene breakdown by character';
      case 'hours': return 'Timesheet and earnings';
      case 'budget': return 'Expenses overview, scan receipts';
      default: return '';
    }
  };

  const handleItemClick = (id: NavTab) => {
    // For items that have dedicated views in More, navigate to them
    if (['script', 'schedule', 'callsheets', 'settings'].includes(id)) {
      onNavigate(id as MoreView);
    } else if (onNavigateToTab) {
      // For other items (looks, today, breakdown, hours), navigate to that tab
      onNavigateToTab(id);
    }
  };

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
          {menuItemConfigs.map((item) => (
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
  const { currentProject } = useProjectStore();
  const sceneRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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
              <span className="ml-auto text-xs text-text-muted">
                {sortedScenes.length} scenes
              </span>
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
    </>
  );
}

// Schedule Viewer Component
type ScheduleViewMode = 'parsed' | 'pdf';

function ScheduleViewer({ onBack }: ViewerProps) {
  const {
    schedule,
    discrepancies,
    isUploading,
    uploadError,
    showDiscrepancyModal,
    uploadSchedule,
    clearSchedule,
    crossReferenceWithBreakdown,
    getCastNamesForNumbers,
    setShowDiscrepancyModal,
    aiProcessingStatus,
    isAIProcessing,
    startAIProcessing,
  } = useScheduleStore();
  const { currentProject, updateSceneShootingDays } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [showCastList, setShowCastList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('parsed');

  const today = new Date().toISOString().split('T')[0];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      try {
        const parsedSchedule = await uploadSchedule(file);

        // Cross-reference with breakdown if we have scenes
        if (currentProject?.scenes && currentProject.scenes.length > 0) {
          const foundDiscrepancies = crossReferenceWithBreakdown(currentProject.scenes);

          // Update shooting days on scenes
          if (parsedSchedule && updateSceneShootingDays) {
            const shootingDayMap: Record<string, number> = {};
            for (const day of parsedSchedule.days) {
              for (const scene of day.scenes) {
                shootingDayMap[scene.sceneNumber] = day.dayNumber;
              }
            }
            updateSceneShootingDays(shootingDayMap, foundDiscrepancies);
          }
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

  const handleDelete = () => {
    clearSchedule();
    setShowDeleteConfirm(false);
  };

  const getDiscrepancyCountForDay = (day: ScheduleDay): number => {
    return day.scenes.filter(s =>
      discrepancies.some(d => d.sceneNumber === s.sceneNumber)
    ).length;
  };

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

        {!schedule ? (
          /* Empty state - No schedule uploaded */
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <NavIcon name="schedule" className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">No Schedule Uploaded</h3>
            <p className="text-sm text-text-muted text-center mb-6 max-w-xs">
              Upload your production schedule PDF to see shooting days and cross-reference with your breakdown
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-6 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload Schedule PDF'}
            </button>
          </div>
        ) : (
          /* Schedule content */
          <div className="space-y-4">
            {/* View Mode Toggle and AI Status */}
            <div className="flex items-center justify-between gap-2">
              {/* View Mode Toggle */}
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setViewMode('parsed')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'parsed' ? 'bg-gold text-white' : 'bg-card text-text-muted'
                  }`}
                >
                  Breakdown
                </button>
                <button
                  onClick={() => setViewMode('pdf')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'pdf' ? 'bg-gold text-white' : 'bg-card text-text-muted'
                  }`}
                  disabled={!schedule.pdfUri}
                >
                  View PDF
                </button>
              </div>

              {/* AI Processing Status */}
              {(isAIProcessing || aiProcessingStatus.status === 'processing') && (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <svg className="w-4 h-4 animate-spin text-gold" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>AI analyzing...</span>
                </div>
              )}
            </div>

            {/* AI Processing Status Banner */}
            {aiProcessingStatus.status === 'processing' && (
              <div className="card bg-blue-50 border-blue-200">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700">Analyzing with AI</p>
                    <p className="text-xs text-blue-600">{aiProcessingStatus.message}</p>
                  </div>
                  <span className="text-xs font-semibold text-blue-600">{aiProcessingStatus.progress}%</span>
                </div>
                <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${aiProcessingStatus.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* AI Processing Error */}
            {aiProcessingStatus.status === 'error' && (
              <div className="card bg-red-50 border-red-200">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700">AI Analysis Failed</p>
                    <p className="text-xs text-red-600">{aiProcessingStatus.error || 'Unknown error'}</p>
                  </div>
                  <button
                    onClick={() => startAIProcessing()}
                    className="px-3 py-1 text-xs font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* PDF Viewer Mode */}
            {viewMode === 'pdf' && schedule.pdfUri && (
              <div className="card p-0 overflow-hidden">
                <iframe
                  src={schedule.pdfUri}
                  className="w-full h-[calc(100vh-280px)] min-h-[400px] border-0"
                  title="Schedule PDF"
                />
              </div>
            )}

            {/* Parsed View Mode */}
            {viewMode === 'parsed' && (
              <>
            {/* Schedule header info */}
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-text-primary">
                  {schedule.productionName || 'Production Schedule'}
                </h2>
                <span className="text-xs text-text-muted">
                  {schedule.totalDays} days, {schedule.days.reduce((sum, d) => sum + d.scenes.length, 0)} scenes
                </span>
              </div>
              {schedule.scriptVersion && (
                <p className="text-xs text-text-muted">Script: {schedule.scriptVersion}</p>
              )}
              {schedule.scheduleVersion && (
                <p className="text-xs text-text-muted">Schedule: {schedule.scheduleVersion}</p>
              )}

              {/* Discrepancy summary */}
              {discrepancies.length > 0 && (
                <button
                  onClick={() => setShowDiscrepancyModal(true)}
                  className="mt-3 w-full p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-amber-700 font-medium">
                    {discrepancies.length} discrepanc{discrepancies.length === 1 ? 'y' : 'ies'} found
                  </span>
                  <svg className="w-4 h-4 text-amber-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Cast List Toggle */}
            {schedule.castList.length > 0 && (
              <div className="card">
                <button
                  onClick={() => setShowCastList(!showCastList)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-text-primary">
                      Cast List ({schedule.castList.length})
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-text-muted transition-transform ${showCastList ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showCastList && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {schedule.castList.map((cast) => (
                      <div
                        key={cast.number}
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                      >
                        <span className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full bg-gold-100 text-gold">
                          {cast.number}
                        </span>
                        <span className="text-xs text-text-primary truncate">
                          {cast.character || cast.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Shooting Days */}
            <div className="space-y-2.5">
              {schedule.days.map((day) => {
                const isToday = day.date === today;
                const isExpanded = expandedDay === day.dayNumber;
                const discrepancyCount = getDiscrepancyCountForDay(day);

                return (
                  <div
                    key={day.dayNumber}
                    className={`card ${isToday ? 'border-2 border-gold' : ''}`}
                  >
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : day.dayNumber)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-text-primary">Day {day.dayNumber}</span>
                            {isToday && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gold text-white">
                                TODAY
                              </span>
                            )}
                            {discrepancyCount > 0 && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-600">
                                {discrepancyCount} issue{discrepancyCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {day.date && (
                            <span className="text-sm text-text-muted">
                              {day.dayOfWeek ? `${day.dayOfWeek}, ` : ''}{formatShortDate(day.date)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-light">{day.scenes.length} scenes</span>
                          <svg
                            className={`w-5 h-5 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                        {day.location && (
                          <div className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            <span>{day.location}</span>
                          </div>
                        )}
                        {day.hours && (
                          <div className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{day.hours}</span>
                          </div>
                        )}
                        {day.totalPages && (
                          <span>{day.totalPages} pgs</span>
                        )}
                      </div>
                    </button>

                    {/* Collapsed scene badges */}
                    {!isExpanded && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {day.scenes.slice(0, 8).map((scene) => {
                          const hasDiscrepancy = discrepancies.some(d => d.sceneNumber === scene.sceneNumber);
                          return (
                            <span
                              key={scene.sceneNumber}
                              className={`px-2 py-0.5 text-xs font-medium rounded ${
                                hasDiscrepancy
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-text-muted'
                              }`}
                            >
                              {scene.sceneNumber}
                            </span>
                          );
                        })}
                        {day.scenes.length > 8 && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-text-muted">
                            +{day.scenes.length - 8} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Expanded scene details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {day.notes && day.notes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {day.notes.map((note, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-600"
                              >
                                {note}
                              </span>
                            ))}
                          </div>
                        )}
                        {day.scenes.map((scene) => {
                          const hasDiscrepancy = discrepancies.some(d => d.sceneNumber === scene.sceneNumber);
                          const sceneDiscrepancy = discrepancies.find(d => d.sceneNumber === scene.sceneNumber);
                          const castNames = getCastNamesForNumbers(scene.castNumbers);

                          return (
                            <div
                              key={scene.sceneNumber}
                              className={`p-2.5 rounded-lg ${
                                hasDiscrepancy ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-text-primary">
                                    Sc {scene.sceneNumber}
                                  </span>
                                  {hasDiscrepancy && (
                                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                  <span className={scene.intExt === 'EXT' ? 'text-blue-500' : 'text-amber-500'}>
                                    {scene.intExt}
                                  </span>
                                  <span>{scene.dayNight}</span>
                                  {scene.pages && <span>{scene.pages}</span>}
                                </div>
                              </div>
                              <p className="text-xs text-text-secondary mb-1">{scene.setLocation}</p>
                              {scene.description && (
                                <p className="text-xs text-text-muted italic mb-1">{scene.description}</p>
                              )}
                              {castNames.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {castNames.map((name, idx) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-white text-text-muted border"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {sceneDiscrepancy && (
                                <p className="mt-2 text-xs text-amber-600">{sceneDiscrepancy.message}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Discrepancy Modal */}
      {showDiscrepancyModal && discrepancies.length > 0 && (
        <DiscrepancyModal
          discrepancies={discrepancies}
          onClose={() => setShowDiscrepancyModal(false)}
        />
      )}

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
    </>
  );
}

// Discrepancy Modal Component
function DiscrepancyModal({
  discrepancies,
  onClose,
}: {
  discrepancies: SceneDiscrepancy[];
  onClose: () => void;
}) {
  const getDiscrepancyIcon = (type: SceneDiscrepancy['type']) => {
    switch (type) {
      case 'scene_not_in_breakdown':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'scene_not_in_schedule':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'character_mismatch':
        return (
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 safe-bottom">
      <div className="bg-card rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-base font-semibold text-text-primary">
              Schedule Discrepancies
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted active:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-sm text-text-muted mb-3">
            The following scenes don&apos;t match between the schedule and your breakdown.
            Please check these scenes in the Breakdown page.
          </p>
          {discrepancies.map((d, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-gray-50 border border-gray-100"
            >
              <div className="flex items-start gap-2">
                {getDiscrepancyIcon(d.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-text-primary">Scene {d.sceneNumber}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                      d.type === 'scene_not_in_breakdown' ? 'bg-red-100 text-red-600' :
                      d.type === 'scene_not_in_schedule' ? 'bg-blue-100 text-blue-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {d.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{d.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
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

// Settings Component
interface SettingsProps {
  onBack: () => void;
  onStartNewProject?: () => void;
  onNavigateToExport?: () => void;
  onNavigateToArchived?: () => void;
  onNavigateToProjectSettings?: () => void;
  onNavigateToTeam?: () => void;
  onNavigateToInvite?: () => void;
  onNavigateToStats?: () => void;
  canManage?: boolean;
}

function Settings({ onBack, onStartNewProject, onNavigateToExport, onNavigateToArchived, onNavigateToProjectSettings, onNavigateToTeam, onNavigateToInvite, onNavigateToStats, canManage }: SettingsProps) {
  const {
    clearProject,
    currentProject,
    lifecycle,
    wrapProject,
    restoreProject,
    getDaysUntilDeletion,
    getArchivedProjects,
  } = useProjectStore();
  const { resetToDefaults } = useNavigationStore();
  const { theme, setTheme } = useThemeStore();
  const { clearAll: clearCallSheets } = useCallSheetStore();
  const { clearSchedule } = useScheduleStore();
  const { clearMessages: clearChat } = useChatStore();
  const { clearAll: clearTimesheet } = useTimesheetStore();
  const { setScreen, isAuthenticated } = useAuthStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showNewProjectConfirm, setShowNewProjectConfirm] = useState(false);
  const [showWrapConfirm, setShowWrapConfirm] = useState(false);

  const archivedProjects = getArchivedProjects();
  const daysUntilDeletion = getDaysUntilDeletion();

  // Navigate to plan selection screen
  const handleChangePlan = () => {
    setScreen('select-plan');
  };

  // Theme options
  const themeOptions: { value: Theme; label: string; icon: JSX.Element }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  const handleStartNewProject = async () => {
    // Clear all stores
    clearProject();
    clearCallSheets();
    clearSchedule();
    clearChat();
    clearTimesheet();
    resetToDefaults();
    // Clear IndexedDB data (photos, captures, etc.)
    await clearIndexedDBData();
    setShowNewProjectConfirm(false);
    onStartNewProject?.();
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
            <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4">
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">CURRENT PROJECT</h2>
          <div className="card">
            <div className="text-base font-semibold text-text-primary">
              {currentProject?.name ?? 'No project loaded'}
            </div>
            {currentProject && (
              <>
                <div className="text-sm text-text-muted mt-1">
                  {currentProject.scenes.length} scenes • {currentProject.characters.length} characters
                </div>
                {lifecycle.state === 'wrapped' && (
                  <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-amber-800">
                        Wrapped • {daysUntilDeletion} days until archive
                      </span>
                      <button
                        onClick={() => restoreProject()}
                        className="text-xs font-medium text-gold"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                )}
                {lifecycle.state === 'archived' && (
                  <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-sm text-red-800">
                      Archived - Read Only
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Project Management Section */}
        {currentProject && (
          <section className="mb-6">
            <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">PROJECT MANAGEMENT</h2>
            <div className="space-y-2">
              {/* Team */}
              <button
                onClick={onNavigateToTeam}
                className="card w-full text-left flex items-center gap-3 hover:bg-gold/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-text-primary block">Team</span>
                  <span className="text-xs text-text-muted">View and manage team members</span>
                </div>
                <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Share Invite Code */}
              <button
                onClick={onNavigateToInvite}
                className="card w-full text-left flex items-center gap-3 hover:bg-gold/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-text-primary block">Share Invite Code</span>
                  <span className="text-xs text-text-muted">Invite team members to join</span>
                </div>
                <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Project Stats */}
              <button
                onClick={onNavigateToStats}
                className="card w-full text-left flex items-center gap-3 hover:bg-gold/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-text-primary block">Project Stats</span>
                  <span className="text-xs text-text-muted">View project statistics</span>
                </div>
                <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Project Settings (Owner/Supervisor only) */}
              {canManage && (
                <button
                  onClick={onNavigateToProjectSettings}
                  className="card w-full text-left flex items-center gap-3 hover:bg-gold/5 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-text-primary block">Project Settings</span>
                    <span className="text-xs text-text-muted">Configure permissions and details</span>
                  </div>
                  <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </section>
        )}

        {/* Subscription Section - only show for authenticated users */}
        {isAuthenticated && (
          <SubscriptionSection onChangePlan={handleChangePlan} />
        )}

        {/* Export Section */}
        {currentProject && (
          <section className="mb-6">
            <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">EXPORT & WRAP</h2>
            <div className="space-y-2">
              <button
                onClick={onNavigateToExport}
                className="card w-full text-left flex items-center gap-3 hover:bg-gold/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-medium text-text-primary block">Export Project</span>
                  <span className="text-xs text-text-muted">Download continuity documents</span>
                </div>
              </button>

              {lifecycle.state === 'active' && (
                <button
                  onClick={() => setShowWrapConfirm(true)}
                  className="card w-full text-left flex items-center gap-3 hover:bg-amber-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.875 1.875 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-amber-700 block">Mark as Wrapped</span>
                    <span className="text-xs text-text-muted">Production complete, archive in {PROJECT_RETENTION_DAYS} days</span>
                  </div>
                </button>
              )}
            </div>
          </section>
        )}

        {/* Archived Projects Section */}
        {archivedProjects.length > 0 && (
          <section className="mb-6">
            <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">ARCHIVED PROJECTS</h2>
            <button
              onClick={onNavigateToArchived}
              className="card w-full text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-medium text-text-primary block">Archived Projects</span>
                  <span className="text-xs text-text-muted">{archivedProjects.length} project{archivedProjects.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </section>
        )}

        {/* Project Retention Info */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">DATA RETENTION</h2>
          <div className="card">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Project Retention</span>
              <span className="text-sm font-medium text-text-primary">{PROJECT_RETENTION_DAYS} days</span>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Wrapped projects are stored for {PROJECT_RETENTION_DAYS} days before being archived. Export your data to keep a permanent backup.
            </p>
          </div>
        </section>

        {/* Appearance / Theme Section */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">APPEARANCE</h2>
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-primary">Theme</span>
              <span className="text-xs text-text-muted capitalize">{theme}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    theme === option.value
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border bg-input-bg text-text-muted hover:border-gold/30'
                  }`}
                >
                  {option.icon}
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-3">
              {theme === 'dark'
                ? 'Dark mode matches the website aesthetic with gold accents.'
                : theme === 'system'
                ? 'Automatically matches your device settings.'
                : 'Classic light mode with warm tones.'}
            </p>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">PROJECT</h2>
          <div className="space-y-2">
            <button
              onClick={() => setShowNewProjectConfirm(true)}
              className="card w-full text-left flex items-center gap-3 hover:bg-gold/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-text-primary block">Start New Project</span>
                <span className="text-xs text-text-muted">Upload a new script and start fresh</span>
              </div>
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="card w-full text-left flex items-center gap-3 hover:bg-red-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-error block">Clear All Data</span>
                <span className="text-xs text-text-muted">Delete all photos and captured data</span>
              </div>
            </button>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">NAVIGATION</h2>
          <button
            onClick={resetToDefaults}
            className="card w-full text-left text-text-primary hover:bg-gray-50 transition-colors"
          >
            Reset Menu to Defaults
          </button>
        </section>

        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">SYNC STATUS</h2>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-text-primary">Offline Mode</span>
            </div>
            <p className="text-xs text-text-muted mt-2">
              All data is stored locally on your device.
            </p>
            <button className="mt-3 text-sm text-gold font-medium">
              Sync with Desktop
            </button>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">ABOUT</h2>
          <div className="card space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Version</span>
              <span className="text-sm text-text-primary">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Platform</span>
              <span className="text-sm text-text-primary">Mobile PWA</span>
            </div>
          </div>
        </section>

        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Clear All Data?</h3>
              <p className="text-sm text-text-muted mb-6">
                This will delete all captured photos and scene data. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-button bg-gray-100 text-text-primary font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // Clear all stores
                    clearProject();
                    clearCallSheets();
                    clearSchedule();
                    clearChat();
                    clearTimesheet();
                    // Clear IndexedDB data (photos, captures, etc.)
                    await clearIndexedDBData();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-button bg-error text-white font-medium"
                >
                  Clear Data
                </button>
              </div>
            </div>
          </div>
        )}

        {showNewProjectConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Start New Project?</h3>
              <p className="text-sm text-text-muted mb-6">
                This will clear all current project data and take you to the setup screen. Make sure you've synced any important data first.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewProjectConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-button bg-gray-100 text-text-primary font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartNewProject}
                  className="flex-1 px-4 py-2.5 rounded-button gold-gradient text-white font-medium"
                >
                  Start New
                </button>
              </div>
            </div>
          </div>
        )}

        {showWrapConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl p-6 max-w-sm w-full">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.875 1.875 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary text-center mb-2">Wrap Project?</h3>
              <p className="text-sm text-text-muted text-center mb-4">
                This will mark "{currentProject?.name}" as wrapped. The project will be stored for {PROJECT_RETENTION_DAYS} days before being automatically archived.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <p className="text-xs text-amber-800">
                  You can still access and edit your project during this time. Export your continuity documents to keep a permanent backup.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWrapConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-button bg-gray-100 text-text-primary font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    wrapProject('manual');
                    setShowWrapConfirm(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-button bg-amber-500 text-white font-medium"
                >
                  Wrap Project
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
