import type { ReactNode } from 'react';

interface ThreePanelProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  leftWidth?: number;
  rightWidth?: number;
}

export function ThreePanel({
  left,
  center,
  right,
  leftWidth = 250,
  rightWidth = 350,
}: ThreePanelProps) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel */}
      <div
        className="shrink-0 overflow-y-auto bg-surface border-r border-border-subtle"
        style={{ width: `${leftWidth}px` }}
      >
        {left}
      </div>

      {/* Center panel */}
      <div className="flex-1 min-w-0 overflow-y-auto bg-surface">
        {center}
      </div>

      {/* Right panel */}
      <div
        className="shrink-0 overflow-y-auto bg-surface border-l border-border-subtle"
        style={{ width: `${rightWidth}px` }}
      >
        {right}
      </div>
    </div>
  );
}
