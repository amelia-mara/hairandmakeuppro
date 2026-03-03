import { Menu, Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui';

interface TopBarProps {
  projectName?: string;
  onExport?: () => void;
  onSettings?: () => void;
}

export function TopBar({ projectName, onExport, onSettings }: TopBarProps) {
  return (
    <header className="flex items-center justify-between w-full h-12 px-4 bg-surface border-b border-border-subtle shrink-0">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <button className="flex items-center justify-center w-8 h-8 rounded text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors duration-150">
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gold tracking-wide select-none">
            PREP HAPPY
          </span>
          {projectName && (
            <>
              <span className="text-text-muted select-none">/</span>
              <span className="text-sm text-text-secondary truncate max-w-[200px]">
                {projectName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {onExport && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={onExport}
          >
            Export
          </Button>
        )}
        {onSettings && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Settings size={16} />}
            onClick={onSettings}
          />
        )}
      </div>
    </header>
  );
}
