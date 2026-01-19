import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { CountBadge } from './Badge';

export interface AccordionProps {
  title: string;
  count?: number;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function Accordion({
  title,
  count,
  badge,
  defaultOpen = false,
  children,
  className,
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={clsx('bg-card rounded-card shadow-card overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-[18px] py-4 text-left touch-manipulation"
        aria-expanded={isOpen}
      >
        <span className="section-header">{title}</span>
        <div className="flex items-center gap-2.5">
          {badge && <span className="text-xs text-text-muted">{badge}</span>}
          {count !== undefined && count > 0 && <CountBadge count={count} />}
          <ChevronIcon isOpen={isOpen} />
        </div>
      </button>
      <div
        className={clsx(
          'overflow-hidden transition-all duration-300 ease-in-out',
          {
            'max-h-0 opacity-0': !isOpen,
            'max-h-[2000px] opacity-100': isOpen,
          }
        )}
      >
        <div className="px-[18px] pb-[18px]">{children}</div>
      </div>
    </div>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={clsx(
        'w-5 h-5 text-text-muted transition-transform duration-200',
        { 'rotate-180': isOpen }
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

export interface AccordionGroupProps {
  children: ReactNode;
  className?: string;
}

export function AccordionGroup({ children, className }: AccordionGroupProps) {
  return (
    <div className={clsx('divide-y divide-border border-t border-border', className)}>
      {children}
    </div>
  );
}
