import { clsx } from 'clsx';
import type { NavTab } from '@/types';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs: { id: NavTab; label: string; icon: JSX.Element }[] = [
    {
      id: 'today',
      label: 'Today',
      icon: <CalendarIcon />,
    },
    {
      id: 'breakdown',
      label: 'Breakdown',
      icon: <GridTableIcon />,
    },
    {
      id: 'looks',
      label: 'Looks',
      icon: <BookIcon />,
    },
    {
      id: 'hours',
      label: 'Hours',
      icon: <ClockIcon />,
    },
    {
      id: 'more',
      label: 'More',
      icon: <EllipsisIcon />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card shadow-nav border-t border-border">
      <div className="mobile-container">
        <div className="flex items-center justify-around bottom-nav-safe">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={clsx(
                  'flex flex-col items-center justify-center py-2 px-3 min-w-[56px] tap-target touch-manipulation transition-colors',
                  {
                    'text-gold': isActive,
                    'text-text-light hover:text-text-muted': !isActive,
                  }
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="w-6 h-6 mb-1">{tab.icon}</span>
                <span className={clsx('text-[10px] font-medium', {
                  'font-semibold': isActive,
                })}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Icon components
function CalendarIcon() {
  return (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function GridTableIcon() {
  return (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function EllipsisIcon() {
  return (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  );
}
