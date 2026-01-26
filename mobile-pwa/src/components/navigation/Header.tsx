import { clsx } from 'clsx';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  showSearch?: boolean;
  onSearch?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
}

export function Header({
  title,
  showBack = false,
  onBack,
  showSearch = false,
  onSearch,
  rightContent,
  className,
}: HeaderProps) {
  return (
    <header
      className={clsx(
        'sticky top-0 z-30 bg-card border-b border-border safe-top',
        className
      )}
    >
      <div className="mobile-container">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left side */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {showBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-gold tap-target touch-manipulation -ml-2"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-semibold text-text-primary truncate">
              {title}
            </h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {rightContent}
            {showSearch && (
              <button
                onClick={onSearch}
                className="p-2 text-text-muted hover:text-text-primary tap-target touch-manipulation"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

interface SubHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function SubHeader({ children, className }: SubHeaderProps) {
  return (
    <div className={clsx('bg-card border-b border-border px-4 py-3', className)}>
      <div className="mobile-container">
        {children}
      </div>
    </div>
  );
}
