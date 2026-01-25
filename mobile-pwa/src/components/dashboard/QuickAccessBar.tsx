import type { ProjectMembership } from '@/types';

export interface QuickAccessBarProps {
  project: ProjectMembership;
  onReturn: () => void;
}

export function QuickAccessBar({ project, onReturn }: QuickAccessBarProps) {
  return (
    <button
      onClick={onReturn}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gold-50 border-b border-gold/20 hover:bg-gold-100/50 transition-colors"
    >
      <div className="flex items-center gap-2 text-gold">
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 14 4 9 9 4" />
          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </svg>
        <span className="text-sm font-medium">
          Return to {project.projectName}
        </span>
      </div>
      <svg
        className="w-4 h-4 text-gold"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}
