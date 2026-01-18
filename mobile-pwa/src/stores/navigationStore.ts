import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NavTab } from '@/types';
import { DEFAULT_BOTTOM_NAV, ALL_NAV_ITEMS } from '@/types';

interface NavigationState {
  // Bottom nav slots (3 items max, 'more' is always slot 4)
  bottomNavItems: NavTab[];

  // Whether the edit menu is open
  isEditMenuOpen: boolean;

  // Actions
  setBottomNavItems: (items: NavTab[]) => void;
  openEditMenu: () => void;
  closeEditMenu: () => void;

  // Move item to bottom nav (swap if needed)
  moveToBottomNav: (item: NavTab, position: number) => void;

  // Move item to more menu
  moveToMoreMenu: (item: NavTab) => void;

  // Reorder within bottom nav
  reorderBottomNav: (fromIndex: number, toIndex: number) => void;

  // Get items that should appear in More menu
  getMoreMenuItems: () => NavTab[];

  // Reset to defaults
  resetToDefaults: () => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set, get) => ({
      bottomNavItems: DEFAULT_BOTTOM_NAV,
      isEditMenuOpen: false,

      setBottomNavItems: (items) => {
        // Ensure max 3 items and settings is always accessible
        const validItems = items.slice(0, 3);
        set({ bottomNavItems: validItems });
      },

      openEditMenu: () => set({ isEditMenuOpen: true }),
      closeEditMenu: () => set({ isEditMenuOpen: false }),

      moveToBottomNav: (item, position) => {
        const current = [...get().bottomNavItems];
        const itemIndex = current.indexOf(item);

        if (itemIndex !== -1) {
          // Item already in bottom nav, reorder
          current.splice(itemIndex, 1);
          current.splice(position, 0, item);
        } else if (current.length < 3) {
          // Room to add
          current.splice(position, 0, item);
        } else {
          // Need to swap - remove item at position and add new one
          current[position] = item;
        }

        set({ bottomNavItems: current.slice(0, 3) });
      },

      moveToMoreMenu: (item) => {
        const current = get().bottomNavItems.filter(i => i !== item);

        // Ensure we have at least one item in bottom nav
        if (current.length === 0) {
          // Can't remove last item
          return;
        }

        set({ bottomNavItems: current });
      },

      reorderBottomNav: (fromIndex, toIndex) => {
        const items = [...get().bottomNavItems];
        const [removed] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, removed);
        set({ bottomNavItems: items });
      },

      getMoreMenuItems: () => {
        const bottomItems = get().bottomNavItems;
        return ALL_NAV_ITEMS
          .filter(item => !bottomItems.includes(item.id))
          .map(item => item.id);
      },

      resetToDefaults: () => {
        set({ bottomNavItems: DEFAULT_BOTTOM_NAV });
      },
    }),
    {
      name: 'hair-makeup-navigation',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        bottomNavItems: state.bottomNavItems,
      }),
    }
  )
);
