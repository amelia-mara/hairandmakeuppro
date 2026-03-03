import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  selected?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({ children, hover, selected, padding = 'md', className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-elevated border rounded-lg
        ${selected ? 'border-gold bg-gold-muted' : 'border-border-default'}
        ${hover && !selected ? 'transition-colors-fast hover:border-border-strong hover:bg-surface-hover cursor-pointer' : ''}
        ${paddingClasses[padding]}
        ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
