import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export type WidgetId =
  | 'budget-overview'
  | 'quick-actions'
  | 'todays-cast'
  | 'hmu-requirements'
  | 'continuity-events'
  | 'breakdown-progress'
  | 'recent-activity'
  | 'crew-overview';

export interface WidgetDefinition {
  id: WidgetId;
  name: string;
  description: string;
  defaultLayout: { w: number; h: number };
}

export const AVAILABLE_WIDGETS: WidgetDefinition[] = [
  { id: 'budget-overview', name: 'Budget Overview', description: 'Track department spend', defaultLayout: { w: 4, h: 4 } },
  { id: 'quick-actions', name: 'Quick Actions', description: 'Shortcuts to common tasks', defaultLayout: { w: 4, h: 4 } },
  { id: 'todays-cast', name: "Today's Cast", description: 'Call times and artist assignments', defaultLayout: { w: 4, h: 4 } },
  { id: 'hmu-requirements', name: 'H&MU Requirements', description: 'Scene-by-scene requirements', defaultLayout: { w: 4, h: 4 } },
  { id: 'continuity-events', name: 'Continuity Events', description: 'Active continuity flags', defaultLayout: { w: 4, h: 4 } },
  { id: 'breakdown-progress', name: 'Breakdown Progress', description: 'Scene completion overview', defaultLayout: { w: 4, h: 4 } },
  { id: 'recent-activity', name: 'Recent Activity', description: 'Latest changes and updates', defaultLayout: { w: 4, h: 4 } },
  { id: 'crew-overview', name: 'Crew Overview', description: 'Team members and availability', defaultLayout: { w: 4, h: 4 } },
];

const DEFAULT_WIDGETS: WidgetId[] = ['budget-overview', 'quick-actions'];

function buildDefaultLayouts(widgetIds: WidgetId[]): LayoutItem[] {
  return widgetIds.map((id, i) => {
    const def = AVAILABLE_WIDGETS.find((w) => w.id === id)!;
    return {
      i: id,
      x: (i % 3) * 4,
      y: Math.floor(i / 3) * 4,
      w: def.defaultLayout.w,
      h: def.defaultLayout.h,
      minW: 3,
      minH: 3,
    };
  });
}

interface DashboardConfig {
  activeWidgets: WidgetId[];
  layouts: LayoutItem[];
}

interface DashboardState {
  configs: Record<string, DashboardConfig>;
  getConfig: (projectId: string) => DashboardConfig;
  addWidget: (projectId: string, widgetId: WidgetId) => void;
  removeWidget: (projectId: string, widgetId: WidgetId) => void;
  updateLayouts: (projectId: string, layouts: LayoutItem[]) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      configs: {},

      getConfig: (projectId: string) => {
        const existing = get().configs[projectId];
        if (existing) return existing;
        const config: DashboardConfig = {
          activeWidgets: [...DEFAULT_WIDGETS],
          layouts: buildDefaultLayouts(DEFAULT_WIDGETS),
        };
        set((state) => ({
          configs: { ...state.configs, [projectId]: config },
        }));
        return config;
      },

      addWidget: (projectId, widgetId) =>
        set((state) => {
          const config = state.configs[projectId] || {
            activeWidgets: [...DEFAULT_WIDGETS],
            layouts: buildDefaultLayouts(DEFAULT_WIDGETS),
          };
          if (config.activeWidgets.includes(widgetId)) return state;
          const def = AVAILABLE_WIDGETS.find((w) => w.id === widgetId)!;
          const maxY = config.layouts.reduce((max, l) => Math.max(max, l.y + l.h), 0);
          const newLayout: LayoutItem = {
            i: widgetId,
            x: 0,
            y: maxY,
            w: def.defaultLayout.w,
            h: def.defaultLayout.h,
            minW: 3,
            minH: 3,
          };
          return {
            configs: {
              ...state.configs,
              [projectId]: {
                activeWidgets: [...config.activeWidgets, widgetId],
                layouts: [...config.layouts, newLayout],
              },
            },
          };
        }),

      removeWidget: (projectId, widgetId) =>
        set((state) => {
          const config = state.configs[projectId];
          if (!config) return state;
          return {
            configs: {
              ...state.configs,
              [projectId]: {
                activeWidgets: config.activeWidgets.filter((id) => id !== widgetId),
                layouts: config.layouts.filter((l) => l.i !== widgetId),
              },
            },
          };
        }),

      updateLayouts: (projectId, layouts) =>
        set((state) => {
          const config = state.configs[projectId];
          if (!config) return state;
          return {
            configs: {
              ...state.configs,
              [projectId]: { ...config, layouts },
            },
          };
        }),
    }),
    {
      name: 'prep-happy-dashboard',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
