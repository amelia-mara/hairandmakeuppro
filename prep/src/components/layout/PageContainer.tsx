import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div
      className={`min-h-[calc(100vh-4rem)] ${className}`}
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {children}
    </div>
  );
}
