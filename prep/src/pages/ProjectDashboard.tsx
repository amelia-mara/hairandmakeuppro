import { useState, useCallback } from 'react';
import { ResponsiveGridLayout as RGL, useContainerWidth } from 'react-grid-layout';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ResponsiveGridLayout = RGL as React.ComponentType<any>;
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  useDashboardStore,
  AVAILABLE_WIDGETS,
  type WidgetId,
  type LayoutItem,
} from '@/stores/dashboardStore';

interface ProjectDashboardProps {
  projectId: string;
}

export function ProjectDashboard({ projectId }: ProjectDashboardProps) {
  const { getConfig, removeWidget, updateLayouts, addWidget } = useDashboardStore();
  const config = getConfig(projectId);
  const [showAddModal, setShowAddModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { width: containerWidth, containerRef } = useContainerWidth() as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLayoutChange = useCallback(
    (_current: any, allLayouts: any) => {
      const lg = allLayouts?.lg;
      if (lg) updateLayouts(projectId, lg as LayoutItem[]);
    },
    [projectId, updateLayouts]
  );

  const handleRemoveWidget = useCallback(
    (widgetId: WidgetId) => {
      removeWidget(projectId, widgetId);
    },
    [projectId, removeWidget]
  );

  const handleAddWidget = useCallback(
    (widgetId: WidgetId) => {
      addWidget(projectId, widgetId);
      setShowAddModal(false);
    },
    [projectId, addWidget]
  );

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="dashboard-header">
        <h1 style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          color: 'var(--text-heading)',
          margin: 0,
        }}>
          H&MU DASHBOARD
        </h1>
        <button className="btn-action-gold" onClick={() => setShowAddModal(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Widget
        </button>
      </div>

      {/* Widget grid or empty state */}
      {config.activeWidgets.length === 0 ? (
        <div className="dashboard-empty">
          <div className="icon-circle" style={{ width: 64, height: 64, margin: '0 auto 20px', border: '1.5px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent-gold)' }}>
              <rect x="3" y="3" width="7" height="9" rx="1"/>
              <rect x="14" y="3" width="7" height="5" rx="1"/>
              <rect x="14" y="12" width="7" height="9" rx="1"/>
              <rect x="3" y="16" width="7" height="5" rx="1"/>
            </svg>
          </div>
          <p style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text-heading)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            marginBottom: '8px',
          }}>
            No widgets yet
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Add widgets to customise your dashboard
          </p>
          <button className="btn-action-gold" onClick={() => setShowAddModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Widget
          </button>
        </div>
      ) : (
        <div className="dashboard-grid-wrapper" ref={containerRef}>
          {containerWidth > 0 && <ResponsiveGridLayout
            className="dashboard-grid"
            width={containerWidth}
            layouts={{ lg: config.layouts }}
            breakpoints={{ lg: 900, md: 600, sm: 0 }}
            cols={{ lg: 12, md: 8, sm: 4 }}
            rowHeight={60}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
            isResizable={true}
            isDraggable={true}
            margin={[16, 16]}
            containerPadding={[0, 0]}
          >
            {config.activeWidgets.map((widgetId) => (
              <div key={widgetId} className="widget-card">
                <WidgetRenderer
                  widgetId={widgetId}
                  onRemove={() => handleRemoveWidget(widgetId)}
                />
              </div>
            ))}
          </ResponsiveGridLayout>}
        </div>
      )}

      {/* Add Widget Modal */}
      {showAddModal && (
        <AddWidgetModal
          activeWidgets={config.activeWidgets}
          onAdd={handleAddWidget}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

/* ━━━ Widget Renderer ━━━ */

function WidgetRenderer({ widgetId, onRemove }: { widgetId: WidgetId; onRemove: () => void }) {
  const def = AVAILABLE_WIDGETS.find((w) => w.id === widgetId);
  if (!def) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Widget header */}
      <div className="widget-header">
        <div className="widget-drag-handle" style={{ flex: 1, cursor: 'grab', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/>
            <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
            <circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
          }}>
            {def.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="widget-icon-btn" title="Expand" disabled>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
          <button className="widget-icon-btn" title="Remove widget" onClick={onRemove}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Widget content */}
      <div style={{ flex: 1, padding: '16px 20px', overflow: 'auto' }}>
        {widgetId === 'budget-overview' && <BudgetOverviewWidget />}
        {widgetId === 'quick-actions' && <QuickActionsWidget />}
        {widgetId !== 'budget-overview' && widgetId !== 'quick-actions' && (
          <PlaceholderWidget name={def.name} description={def.description} />
        )}
      </div>
    </div>
  );
}

/* ━━━ Budget Overview Widget ━━━ */

function BudgetOverviewWidget() {
  const budget = 25000;
  const spent = 12350;
  const remaining = budget - spent;
  const pct = Math.round((spent / budget) * 100);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <BudgetFigure label="Department Budget" value={`£${budget.toLocaleString()}`} />
        <BudgetFigure label="Spent to Date" value={`£${spent.toLocaleString()}`} />
        <BudgetFigure label="Remaining" value={`£${remaining.toLocaleString()}`} highlight />
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
          Budget Used
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-heading)', fontWeight: 600 }}>
          {pct}%
        </span>
      </div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Link */}
      <div style={{ marginTop: '16px' }}>
        <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
          View full budget →
        </button>
      </div>
    </div>
  );
}

function BudgetFigure({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: '0.6875rem',
        fontWeight: 500,
        color: 'var(--text-muted)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        marginBottom: '6px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.125rem',
        fontWeight: 700,
        color: highlight ? 'var(--accent-gold)' : 'var(--text-heading)',
        letterSpacing: '-0.01em',
        textShadow: highlight ? '0 0 30px rgba(var(--a), 0.20)' : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

/* ━━━ Quick Actions Widget ━━━ */

function QuickActionsWidget() {
  const actions = [
    { label: 'Upload Call Sheet', icon: UploadIcon },
    { label: "Today's Breakdown", icon: BreakdownIcon },
    { label: 'Live Continuity', icon: ContinuityIcon },
    { label: 'Share with Team', icon: ShareIcon },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', height: '100%' }}>
      {actions.map((action) => (
        <button key={action.label} className="quick-action-btn">
          <action.icon />
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 500,
            color: 'var(--text-heading)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            lineHeight: 1.3,
          }}>
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ━━━ Placeholder Widget ━━━ */

function PlaceholderWidget({ name, description }: { name: string; description: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 500,
        color: 'var(--text-heading)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        marginBottom: '8px',
      }}>
        {name}
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

/* ━━━ Add Widget Modal ━━━ */

function AddWidgetModal({
  activeWidgets,
  onAdd,
  onClose,
}: {
  activeWidgets: WidgetId[];
  onAdd: (id: WidgetId) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-glass" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '24px 28px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            color: 'var(--text-heading)',
            margin: 0,
          }}>
            Add Widget
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-card)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-medium)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-card)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {AVAILABLE_WIDGETS.map((widget) => {
            const isAdded = activeWidgets.includes(widget.id);
            return (
              <button
                key={widget.id}
                className={`widget-option ${isAdded ? 'added' : ''}`}
                disabled={isAdded}
                onClick={() => onAdd(widget.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: isAdded ? 'var(--text-muted)' : 'var(--text-heading)',
                    marginBottom: '2px',
                  }}>
                    {widget.name}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}>
                    {widget.description}
                  </div>
                </div>
                {isAdded ? (
                  <span style={{
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.06em',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                  }}>
                    Added
                  </span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--accent-gold)', flexShrink: 0 }}>
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ━━━ Quick Action Icons ━━━ */

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-gold)' }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function BreakdownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-gold)' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
      <path d="M14 2v6h6"/>
      <path d="M16 13H8M16 17H8M10 9H8"/>
    </svg>
  );
}

function ContinuityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-gold)' }}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-gold)' }}>
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
