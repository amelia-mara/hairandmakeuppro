import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { RateCardSettings } from '@/components/timesheet';
import { NavIcon } from '@/components/navigation/BottomNav';
import { formatShortDate } from '@/utils/helpers';
import type { NavTab } from '@/types';
import { ALL_NAV_ITEMS } from '@/types';

type MoreView = 'menu' | 'script' | 'schedule' | 'callsheets' | 'settings' | 'editMenu';

interface MoreProps {
  onNavigateToTab?: (tab: NavTab) => void;
}

export function More({ onNavigateToTab }: MoreProps) {
  const [currentView, setCurrentView] = useState<MoreView>('menu');
  const { isEditMenuOpen, closeEditMenu, openEditMenu } = useNavigationStore();

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

  const renderView = () => {
    switch (effectiveView) {
      case 'script':
        return <ScriptViewer onBack={() => setCurrentView('menu')} />;
      case 'schedule':
        return <ScheduleViewer onBack={() => setCurrentView('menu')} />;
      case 'callsheets':
        return <CallSheetArchive onBack={() => setCurrentView('menu')} />;
      case 'settings':
        return <Settings onBack={() => setCurrentView('menu')} />;
      case 'editMenu':
        return <EditMenuScreen onDone={handleEditMenuClose} />;
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
          Drag items to reorder. First 3 appear in bottom nav.
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
            {bottomNavItems.length < 3 && (
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
                onAddToNav={bottomNavItems.length < 3 ? () => moveToBottomNav(item.id, bottomNavItems.length) : undefined}
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
        {touchDragActive && (
          <div
            className="fixed inset-0 z-40"
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

        {/* More button is always slot 4 notice */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <NavIcon name="ellipsis" className="w-5 h-5" />
            <span><strong>More</strong> button is always slot 4 and cannot be moved.</span>
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
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const { currentProject } = useProjectStore();

  const sceneNumbers = currentProject?.scenes.map(s => s.sceneNumber).sort((a, b) => a - b) || [];

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
          </div>

          <div className="px-4 pb-3 flex gap-2">
            <div className="flex-1 relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card text-text-primary"
              />
            </div>
            <select
              value={selectedScene || ''}
              onChange={(e) => setSelectedScene(Number(e.target.value) || null)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-text-primary"
            >
              <option value="">Jump to...</option>
              {sceneNumbers.map((num) => (
                <option key={num} value={num}>Scene {num}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <NavIcon name="document" className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-1">No Script Uploaded</h3>
          <p className="text-sm text-text-muted text-center mb-6">
            Upload your script PDF to view it here
          </p>
          <button className="px-4 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform">
            Upload Script PDF
          </button>
        </div>
      </div>
    </>
  );
}

// Schedule Viewer Component
function ScheduleViewer({ onBack }: ViewerProps) {
  const demoSchedule = [
    { dayNumber: 1, date: '2025-01-13', scenes: [1, 2, 3], location: 'COFFEE SHOP' },
    { dayNumber: 2, date: '2025-01-14', scenes: [4, 5, 6, 7], location: 'APARTMENT' },
    { dayNumber: 3, date: '2025-01-15', scenes: [8, 9], location: 'PARK' },
    { dayNumber: 4, date: '2025-01-18', scenes: [12, 15, 16, 8, 23], location: 'VARIOUS' },
    { dayNumber: 5, date: '2025-01-19', scenes: [10, 11], location: 'OFFICE' },
  ];

  const today = new Date().toISOString().split('T')[0];

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
            <h1 className="text-lg font-semibold text-text-primary">Schedule</h1>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4">
        <div className="space-y-2.5">
          {demoSchedule.map((day) => {
            const isToday = day.date === today;
            return (
              <div
                key={day.dayNumber}
                className={`card ${isToday ? 'border-2 border-gold' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-text-primary">Day {day.dayNumber}</span>
                      {isToday && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gold text-white">
                          TODAY
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-text-muted">{formatShortDate(day.date)}</span>
                  </div>
                  <span className="text-xs text-text-light">{day.scenes.length} scenes</span>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <svg className="w-4 h-4 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span className="text-sm text-text-secondary">{day.location}</span>
                </div>

                <div className="flex flex-wrap gap-1 mt-2">
                  {day.scenes.map((sceneNum) => (
                    <span
                      key={sceneNum}
                      className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-text-muted"
                    >
                      {sceneNum}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// Call Sheet Archive Component
function CallSheetArchive({ onBack }: ViewerProps) {
  const demoCallSheets = [
    { id: '1', date: '2025-01-18', productionDay: 4, scenes: 5 },
    { id: '2', date: '2025-01-15', productionDay: 3, scenes: 4 },
    { id: '3', date: '2025-01-14', productionDay: 2, scenes: 6 },
    { id: '4', date: '2025-01-13', productionDay: 1, scenes: 3 },
  ];

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
            <button className="p-2 text-gold active:opacity-70 transition-opacity touch-manipulation">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4">
        <div className="space-y-2">
          {demoCallSheets.map((sheet) => (
            <button
              key={sheet.id}
              className="w-full card flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <NavIcon name="document" className="w-5 h-5 text-text-light" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-text-primary">Day {sheet.productionDay}</h3>
                  <p className="text-xs text-text-muted">{formatShortDate(sheet.date)} • {sheet.scenes} scenes</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-gold-100 text-gold">
                  Set Today
                </button>
                <svg className="w-4 h-4 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button className="px-6 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform">
            Upload Call Sheet PDF
          </button>
        </div>
      </div>
    </>
  );
}

// Settings Component
function Settings({ onBack }: ViewerProps) {
  const { clearProject, currentProject } = useProjectStore();
  const { resetToDefaults } = useNavigationStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
              <div className="text-sm text-text-muted mt-1">
                {currentProject.scenes.length} scenes • {currentProject.characters.length} characters
              </div>
            )}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">RATE CARD</h2>
          <div className="card">
            <RateCardSettings />
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

        <section>
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">DATA</h2>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="card w-full text-left text-error hover:bg-red-50 transition-colors"
          >
            Clear All Data
          </button>
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
                  onClick={() => {
                    clearProject();
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
      </div>
    </>
  );
}
